import { shallowMount } from '@vue/test-utils';
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
