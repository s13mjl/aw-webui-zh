import { mount } from '@vue/test-utils';
import EventList from '~/visualizations/EventList.vue';
import i18nInstance from '~/i18n';
import { installBootstrapVue } from '~/compat/bootstrap-vue';
import { filters } from '~/util/filters';

// 同步上游 #1271：events 加载/出错时可能不是数组，模板计数与列表都需守卫。
function mountGuarded(events) {
  return mount(EventList, {
    props: { events, bucket_id: 'aw-test' },
    global: {
      plugins: [i18nInstance, { install: installBootstrapVue }],
      config: { globalProperties: { $filters: filters } },
      stubs: { 'event-editor': true, icon: true },
    },
  });
}

describe('EventList 对非数组 events 的守卫', () => {
  test('正常数组仍渲染条目并显示总数', () => {
    const events = Array.from({ length: 3 }, (_, i) => ({
      timestamp: new Date(2026, 0, 1).toISOString(),
      duration: 10,
      data: { label: `E${i}` },
    }));
    const wrapper = mountGuarded(events);
    expect(wrapper.vm.safe_events).toEqual(events);
    expect(wrapper.vm.displayed_events).toHaveLength(3);
    expect(wrapper.text()).toContain('3');
    wrapper.unmount();
  });

  test.each([
    ['null', null],
    ['undefined', undefined],
    ['object', { length: 2 }],
    ['string', 'abc'],
  ])('%s 不抛错且按空列表渲染', (_name, events) => {
    const wrapper = mountGuarded(events);
    expect(wrapper.vm.safe_events).toEqual([]);
    expect(wrapper.vm.displayed_events).toEqual([]);
    expect(wrapper.text()).not.toMatch(/NaN/);
    wrapper.unmount();
  });
});
