import { shallowMount, mount } from '@vue/test-utils';
import EventList from '~/visualizations/EventList.vue';
import i18nInstance from '~/i18n';
import { installBootstrapVue } from '~/compat/bootstrap-vue';
import { filters } from '~/util/filters';

function mountList(events = [], bucketId = 'bucket-A') {
  return shallowMount(EventList, {
    props: { events, bucket_id: bucketId, editable: true },
    global: {
      plugins: [i18nInstance, { install: installBootstrapVue }],
      config: { globalProperties: { $filters: filters } },
      stubs: {
        'event-editor': true,
        'b-card': { template: '<div><slot name="header" /><slot /></div>' },
        'b-button': true,
        'b-btn': true,
        icon: true,
      },
    },
  });
}

describe('EventList confirmed deletion forwarding', () => {
  test('forwards a confirmed deletion with its owning bucket', () => {
    const wrapper = mountList([{ id: 11, timestamp: '2026-10-01T12:00:00Z', duration: 1, data: {} }]);
    const event = { id: 11 };
    wrapper.vm.removeEvent(event, 'bucket-A');
    expect(wrapper.emitted('deleted')[0]).toEqual([event, 'bucket-A']);
  });

  test('clears the selected draft only when it owns the deletion', () => {
    const wrapper = mountList([
      { id: 11, timestamp: '2026-10-01T12:00:00Z' },
      { id: 12, timestamp: '2026-10-01T12:01:00Z' },
    ]);
    wrapper.vm.editableEvent = { id: 11 };
    wrapper.vm.removeEvent({ id: 11 }, 'another-bucket');
    expect(wrapper.vm.editableEvent).toEqual({ id: 11 });

    wrapper.vm.removeEvent({ id: 11 }, 'bucket-A');
    expect(wrapper.vm.editableEvent).toBeNull();
  });
});

const sampleEvent = {
  timestamp: '2026-10-31T12:00:00Z',
  duration: 12,
  data: { title: 'Code', app: 'Vim' },
};

function mountFull(events) {
  return mount(EventList, {
    props: { events },
    global: {
      plugins: [i18nInstance, { install: installBootstrapVue }],
      config: {
        globalProperties: {
          $filters: { friendlytime: v => String(v), friendlyduration: v => String(v) },
        },
      },
      stubs: {
        'event-editor': true,
        'b-card': { template: '<div class="card"><slot name="header" /><slot /></div>' },
        'b-button': true,
        'b-btn': true,
        icon: true,
      },
    },
  });
}

describe('EventList 结果形状', () => {
  test('正常事件数组可渲染', () => {
    const wrapper = mountFull([sampleEvent]);
    try {
      expect(wrapper.text()).toContain('Code');
      expect(wrapper.findAll('li')).toHaveLength(1);
    } finally {
      wrapper.unmount();
    }
  });

  test('空事件数组不崩溃', () => {
    const wrapper = mountFull([]);
    try {
      expect(wrapper.findAll('li')).toHaveLength(0);
    } finally {
      wrapper.unmount();
    }
  });

  test.each([42, { total: 42 }, null])('非数组结果 %p 不抛错', value => {
    const wrapper = mountFull(value);
    try {
      expect(wrapper.findAll('li')).toHaveLength(0);
    } finally {
      wrapper.unmount();
    }
  });

  test('基本类型数组不抛错', () => {
    const wrapper = mountFull([1, 2]);
    try {
      expect(wrapper.findAll('li')).toHaveLength(2);
    } finally {
      wrapper.unmount();
    }
  });
});
