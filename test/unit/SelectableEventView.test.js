import { mount } from '@vue/test-utils';
import SelectableEventView from '~/components/SelectableEventView.vue';
import i18nInstance from '~/i18n';
import { installBootstrapVue } from '~/compat/bootstrap-vue';

const event = {
  timestamp: '2026-10-31T12:00:00Z',
  duration: 12,
  data: { title: 'Code', app: 'Vim' },
};

function mountView(events, visMethod = 'eventlist') {
  const wrapper = mount(SelectableEventView, {
    props: { events, event_type: 'currentwindow' },
    global: {
      plugins: [i18nInstance, { install: installBootstrapVue }],
      stubs: {
        'vis-timeline': { name: 'TimelineStub', template: '<div class="timeline-stub" />' },
        'aw-eventlist': {
          name: 'EventListStub',
          props: ['events'],
          template: '<div class="eventlist-stub" />',
        },
        'aw-summary': { name: 'SummaryStub', template: '<div class="summary-stub" />' },
      },
    },
  });
  if (visMethod !== wrapper.vm.vis_method) wrapper.setData({ vis_method: visMethod });
  return wrapper;
}

describe('SelectableEventView 结果形状准入', () => {
  test('普通事件数组使用 EventList', async () => {
    const wrapper = mountView([event]);
    try {
      await wrapper.vm.$nextTick();
      expect(wrapper.find('.eventlist-stub').exists()).toBe(true);
      expect(wrapper.find('pre.result-fallback').exists()).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });

  test('空事件数组仍使用 EventList', async () => {
    const wrapper = mountView([]);
    try {
      await wrapper.vm.$nextTick();
      expect(wrapper.find('.eventlist-stub').exists()).toBe(true);
      expect(wrapper.find('pre.result-fallback').exists()).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });

  test.each([
    [42, '42'],
    [{ total: 42 }, '"total": 42'],
    [null, 'null'],
    [[1, 2], '1'],
    [[event, 1], '1'],
  ])('非事件结果 %p 回退到 JSON', async (value, snippet) => {
    const wrapper = mountView(value);
    try {
      await wrapper.vm.$nextTick();
      expect(wrapper.find('.eventlist-stub').exists()).toBe(false);
      const fallback = wrapper.find('pre.result-fallback');
      expect(fallback.exists()).toBe(true);
      expect(fallback.text()).toContain(snippet);
    } finally {
      wrapper.unmount();
    }
  });

  describe.each(['eventlist', 'timeline', 'summary'])('%s 形状准入', visMethod => {
    test.each([
      [[{ duration: 5, label: 'total' }]],
      [[{ timestamp: event.timestamp }]],
      [[{ ...event, data: null }]],
      [[event, { duration: 5 }]],
    ])('残缺/畸形对象保留为 JSON：%p', async value => {
      const wrapper = mountView(value, visMethod);
      try {
        await wrapper.vm.$nextTick();
        expect(wrapper.find('pre.result-fallback').text()).toBe(JSON.stringify(value, null, 2));
        expect(wrapper.find('.eventlist-stub, .timeline-stub, .summary-stub').exists()).toBe(false);
      } finally {
        wrapper.unmount();
      }
    });

    test('有效事件数组仍走所选事件视图', async () => {
      const wrapper = mountView([event], visMethod);
      try {
        await wrapper.vm.$nextTick();
        expect(wrapper.find('pre.result-fallback').exists()).toBe(false);
        expect(wrapper.find('.eventlist-stub, .timeline-stub, .summary-stub').exists()).toBe(true);
      } finally {
        wrapper.unmount();
      }
    });
  });

  test('原始 JSON 模式仍渲染事件数组', async () => {
    const wrapper = mountView([event], 'raw');
    try {
      await wrapper.vm.$nextTick();
      expect(wrapper.find('.eventlist-stub').exists()).toBe(false);
      expect(wrapper.find('pre').exists()).toBe(true);
    } finally {
      wrapper.unmount();
    }
  });
});
