import { mount } from '@vue/test-utils';
import EventEditor from '~/components/EventEditor.vue';
import i18nInstance from '~/i18n';
import { installBootstrapVue } from '~/compat/bootstrap-vue';

const event = (id = 1, title = 'original') => ({
  id,
  timestamp: '2026-10-01T12:00:00Z',
  duration: 60,
  data: { title },
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
async function flush() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

function mountEditor(getEvent, replaceEvent = jest.fn().mockResolvedValue(undefined)) {
  const $aw = {
    getEvent: getEvent || jest.fn(async () => event()),
    replaceEvent,
    deleteEvent: jest.fn().mockResolvedValue(undefined),
  };
  const wrapper = mount(EventEditor, {
    props: { event: event(), bucket_id: 'bucket-A' },
    global: {
      plugins: [i18nInstance, { install: installBootstrapVue }],
      mocks: { $aw },
      config: { globalProperties: { $filters: { friendlyduration: d => String(d) } } },
      stubs: {
        'b-modal': {
          template: '<div><slot /></div>',
        },
        datetime: true,
        'b-input': true,
        'b-checkbox': true,
        'b-button': true,
        icon: true,
      },
    },
  });
  return { wrapper, $aw };
}

describe('EventEditor draft ownership', () => {
  test('a late load cannot replace the current selection draft', async () => {
    const old = deferred();
    const next = deferred();
    const getEvent = jest
      .fn()
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(next.promise);
    const { wrapper, $aw } = mountEditor(getEvent);

    await wrapper.setProps({ bucket_id: 'bucket-B', event: event(2) });
    next.resolve(event(2, 'newer'));
    await flush();
    old.resolve(event(1, 'stale'));
    await flush();

    expect(wrapper.vm.editedEvent.id).toBe(2);
    expect(wrapper.vm.editedEvent.data.title).toBe('newer');
    await wrapper.vm.save();
    expect($aw.replaceEvent).toHaveBeenCalledWith('bucket-B', expect.objectContaining({ id: 2 }));
    wrapper.unmount();
  });

  test('changing selection clears the draft and blocks saving until the new load succeeds', async () => {
    const next = deferred();
    const getEvent = jest.fn().mockResolvedValueOnce(event()).mockReturnValueOnce(next.promise);
    const { wrapper, $aw } = mountEditor(getEvent);
    await flush();
    expect(wrapper.vm.draftReady).toBe(true);

    await wrapper.setProps({ bucket_id: 'bucket-B', event: event(2) });
    await flush();
    expect(wrapper.vm.editedEvent).toBeNull();
    expect(wrapper.vm.draftReady).toBe(false);
    await wrapper.vm.save();
    expect($aw.replaceEvent).not.toHaveBeenCalled();

    next.resolve(event(2));
    await flush();
    expect(wrapper.vm.draftReady).toBe(true);
    await wrapper.vm.save();
    expect($aw.replaceEvent).toHaveBeenCalledWith('bucket-B', expect.objectContaining({ id: 2 }));
    wrapper.unmount();
  });

  test('clearing the selection invalidates the draft and both mutation actions', async () => {
    const { wrapper, $aw } = mountEditor();
    await flush();
    await wrapper.setProps({ event: null });
    expect(wrapper.vm.editedEvent).toBeNull();
    expect(wrapper.vm.draftReady).toBe(false);
    await wrapper.vm.save();
    await wrapper.vm.delete_();
    expect($aw.replaceEvent).not.toHaveBeenCalled();
    expect($aw.deleteEvent).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  test('unmount invalidates a pending load', async () => {
    const load = deferred();
    const { wrapper } = mountEditor(jest.fn().mockReturnValue(load.promise));
    wrapper.unmount();
    load.resolve(event());
    await flush();
    expect(wrapper.vm.editedEvent).toBeNull();
  });
});
