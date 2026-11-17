import { mount } from '@vue/test-utils';
import EventList from '~/visualizations/EventList.vue';
import i18nInstance from '~/i18n';
import { installBootstrapVue } from '~/compat/bootstrap-vue';
import { filters } from '~/util/filters';

function makeEvents(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    timestamp: new Date(2026, 0, 1, 0, 0, i % 60).toISOString(),
    duration: 1,
    data: { title: `event ${i}` },
  }));
}

function mountList(events) {
  return mount(EventList, {
    props: { events, bucket_id: 'test-bucket' },
    global: {
      plugins: [i18nInstance, { install: installBootstrapVue }],
      config: { globalProperties: { $filters: filters } },
      stubs: {
        'event-editor': true,
        'b-button': {
          inheritAttrs: false,
          template: '<button :class="$attrs.class" @click="$emit(\'click\')"><slot /></button>',
        },
        'b-btn': true,
        icon: true,
      },
    },
  });
}

describe('EventList 分页', () => {
  test('超过 100 条时只显示前 100 条并提供再显示按钮', () => {
    const wrapper = mountList(makeEvents(250));
    expect(wrapper.vm.displayed_events).toHaveLength(100);
    expect(wrapper.find('.show-more').exists()).toBe(true);
    wrapper.unmount();
  });

  test('点击后逐页展开，全部显示后按钮消失', async () => {
    const wrapper = mountList(makeEvents(250));
    await wrapper.find('.show-more').trigger('click');
    expect(wrapper.vm.displayed_events).toHaveLength(200);
    await wrapper.find('.show-more').trigger('click');
    expect(wrapper.vm.displayed_events).toHaveLength(250);
    expect(wrapper.find('.show-more').exists()).toBe(false);
    wrapper.unmount();
  });

  test('事件列表变化时回到第一页', async () => {
    const wrapper = mountList(makeEvents(250));
    await wrapper.find('.show-more').trigger('click');
    expect(wrapper.vm.displayed_events).toHaveLength(200);
    await wrapper.setProps({ events: makeEvents(150) });
    expect(wrapper.vm.displayed_events).toHaveLength(100);
    wrapper.unmount();
  });

  test('短列表不显示再显示按钮', () => {
    const wrapper = mountList(makeEvents(5));
    expect(wrapper.vm.displayed_events).toHaveLength(5);
    expect(wrapper.find('.show-more').exists()).toBe(false);
    wrapper.unmount();
  });
});
