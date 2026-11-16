import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import SelectableEventView from '~/components/SelectableEventView.vue';
import Summary from '~/visualizations/Summary.vue';
import summary from '~/visualizations/summary';
import i18nInstance from '~/i18n';
import { installBootstrapVue } from '~/compat/bootstrap-vue';

const event = { duration: 60, data: { title: 'TITLE_ONE', app: 'APP_ONE' } };

function svgName(wrapper) {
  const title = wrapper.element.querySelector('g[id^="summary_"] > title');
  return title ? title.textContent.split('\n')[0] : null;
}

async function flush(wrapper) {
  await wrapper.vm.$nextTick();
  await new Promise(resolve => setTimeout(resolve, 20));
}

function mountView() {
  return mount(SelectableEventView, {
    props: { events: [event] },
    global: {
      components: { 'aw-summary': Summary },
      plugins: [i18nInstance, { install: installBootstrapVue }],
      stubs: { 'vis-timeline': true, 'aw-eventlist': true },
    },
    attachTo: document.body,
  });
}

describe('SelectableEventView 数据键变化重绘', () => {
  beforeEach(() => setActivePinia(createPinia()));

  test('数据键变化时重绘标签与颜色，无需替换事件', async () => {
    const wrapper = mountView();
    try {
      wrapper.setData({ vis_method: 'summary' });
      await flush(wrapper);
      expect(svgName(wrapper)).toBe('TITLE_ONE');

      const input = wrapper.find('input');
      input.element.value = 'app';
      input.trigger('change');
      await flush(wrapper);
      expect(wrapper.vm.summaryKey).toBe('app');
      expect(svgName(wrapper)).toBe('APP_ONE');
    } finally {
      wrapper.unmount();
    }
  });

  test('键已是 app 时，等价新事件数组仍能重绘', async () => {
    const wrapper = mountView();
    try {
      wrapper.setData({ vis_method: 'summary' });
      await flush(wrapper);
      const input = wrapper.find('input');
      input.element.value = 'app';
      input.trigger('change');
      await flush(wrapper);
      await wrapper.setProps({ events: [{ duration: 60, data: { title: 'TITLE_ONE', app: 'APP_ONE' } }] });
      await flush(wrapper);
      expect(svgName(wrapper)).toBe('APP_ONE');
    } finally {
      wrapper.unmount();
    }
  });

  test('同一 tick 内的字段与回调变化合并为一次重绘', async () => {
    const nameA = e => e.data.title;
    const nameB = e => e.data.app;
    const colorA = e => e.data.title;
    const colorB = e => e.data.app;
    const wrapper = mount(Summary, {
      props: { fields: [event], namefunc: nameA, colorfunc: colorA },
      global: {
        plugins: [i18nInstance, { install: installBootstrapVue }],
      },
      attachTo: document.body,
    });
    try {
      await flush(wrapper);
      const spy = jest.spyOn(summary, 'updateSummedEvents');
      await wrapper.setProps({
        fields: [{ duration: 60, data: { title: 'TITLE_ONE', app: 'APP_ONE' } }],
        namefunc: nameB,
        colorfunc: colorB,
      });
      await wrapper.vm.$nextTick();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(svgName(wrapper)).toBe('APP_ONE');
      spy.mockRestore();
    } finally {
      wrapper.unmount();
    }
  });
});
