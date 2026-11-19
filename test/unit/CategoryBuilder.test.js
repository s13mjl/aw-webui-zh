import { setActivePinia, createPinia } from 'pinia';
import { createTestingPinia } from '@pinia/testing';
import { mount } from '@vue/test-utils';
import i18nInstance from '~/i18n';
import { installBootstrapVue } from '~/compat/bootstrap-vue';
import CategoryBuilder from '~/views/settings/CategoryBuilder.vue';
import Settings from '~/views/settings/Settings.vue';
import { useSettingsStore } from '~/stores/settings';
import { useCategoryStore } from '~/stores/categories';
import { getClient } from '~/util/awclient';

jest.mock('~/util/awclient');
jest.mock('~/stores/buckets', () => ({
  useBucketsStore: () => ({
    ensureLoaded: jest.fn().mockResolvedValue(undefined),
    hosts: [],
    buckets: [],
  }),
}));

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

function mountBuilder() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const settingsStore = useSettingsStore(pinia);
  settingsStore.ensureLoaded = jest.fn().mockResolvedValue(undefined);
  const categoryStore = useCategoryStore(pinia);
  categoryStore.load = jest.fn().mockResolvedValue(undefined);
  return mount(CategoryBuilder, {
    global: {
      plugins: [pinia, i18nInstance, { install: installBootstrapVue }],
      stubs: { icon: true, 'aw-query-options': true },
    },
  });
}

// "Ignore" used to only push to component state, so ignored words came back on
// reload. They now persist via the settings store.
// See https://github.com/ActivityWatch/aw-webui/issues/486
describe('CategoryBuilder ignored words', () => {
  function ctx(ignored = []) {
    const settingsStore = {
      category_builder_ignored_words: ignored,
      // $patch mirrors pinia's synchronous patch — update properties in place.
      $patch: jest.fn(state => Object.assign(settingsStore, state)),
      update: jest.fn(async state => Object.assign(settingsStore, state)),
    };
    const vm = { settingsStore, show_ignored: true, fetchWords: jest.fn() };
    vm.persistIgnoredWords = next => CategoryBuilder.methods.persistIgnoredWords.call(vm, next);
    // The component reads ignored_words through this computed.
    Object.defineProperty(vm, 'ignored_words', {
      get: () => CategoryBuilder.computed.ignored_words.call(vm),
    });
    return vm;
  }
  const call = (name, vm, ...args) => CategoryBuilder.methods[name].call(vm, ...args);

  test('ignoreWord persists the word to settings', async () => {
    const vm = ctx(['foo']);
    await call('ignoreWord', vm, 'bar');
    expect(vm.settingsStore.update).toHaveBeenCalledWith({
      category_builder_ignored_words: ['foo', 'bar'],
    });
    expect(vm.ignored_words).toEqual(['foo', 'bar']);
  });

  test('ignoreWord does not duplicate an already-ignored word', async () => {
    const vm = ctx(['foo']);
    await call('ignoreWord', vm, 'foo');
    expect(vm.settingsStore.update).not.toHaveBeenCalled();
  });

  test('unignoreWord removes the word and refetches so it can reappear', async () => {
    const vm = ctx(['foo', 'bar']);
    await call('unignoreWord', vm, 'foo');
    expect(vm.settingsStore.update).toHaveBeenCalledWith({
      category_builder_ignored_words: ['bar'],
    });
    expect(vm.fetchWords).toHaveBeenCalled();
  });

  test('resetIgnoredWords clears the list and refetches', async () => {
    const vm = ctx(['foo', 'bar']);
    await call('resetIgnoredWords', vm);
    expect(vm.settingsStore.update).toHaveBeenCalledWith({ category_builder_ignored_words: [] });
    expect(vm.show_ignored).toBe(false);
    expect(vm.fetchWords).toHaveBeenCalled();
  });

  test('missing setting reads as no ignored words', () => {
    const vm = ctx(undefined);
    expect(vm.ignored_words).toEqual([]);
  });

  test('ignoreWord patches store synchronously so overlapping calls read the updated list', async () => {
    // Simulate two rapid Ignore clicks before either async update resolves.
    // The second call must see the first word in the list, not the stale snapshot.
    const vm = ctx([]);
    // Fire both ignores without awaiting the first one
    const p1 = call('ignoreWord', vm, 'foo');
    const p2 = call('ignoreWord', vm, 'bar');
    await Promise.all([p1, p2]);
    // Both words must end up in the final list — neither should be lost.
    expect(vm.ignored_words).toEqual(expect.arrayContaining(['foo', 'bar']));
    expect(vm.ignored_words).toHaveLength(2);
  });

  test('ignoreWord calls $patch synchronously before the async update', async () => {
    const vm = ctx(['existing']);
    await call('ignoreWord', vm, 'new');
    // $patch must have been called (synchronous guard against read-modify-write race)
    expect(vm.settingsStore.$patch).toHaveBeenCalledWith({
      category_builder_ignored_words: ['existing', 'new'],
    });
  });
});

// The mocked-store tests above cannot see save()'s trailing load(), which patches
// server state back over local state. This runs the real settings store against a
// slow fake server to check overlapping clicks still converge on every word.
describe('CategoryBuilder ignored words with the real settings store', () => {
  const KEY = 'category_builder_ignored_words';
  const STEP = 20;
  const delay = () => new Promise(resolve => setTimeout(resolve, STEP));
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  function setup(initial = []) {
    setActivePinia(createPinia());
    // Seed the server with every default so a save only has to post KEY.
    const defaults = JSON.parse(JSON.stringify(useSettingsStore().$state));
    Object.keys(defaults).forEach(k => k.startsWith('_') && delete defaults[k]);
    const server = { ...defaults, [KEY]: initial };
    getClient.mockReturnValue({
      req: {
        defaults: {},
        post: jest.fn(async (url, value) => {
          await delay();
          server[url.split('/').pop()] = JSON.parse(JSON.stringify(value));
        }),
      },
      get_settings: jest.fn(async () => {
        await delay();
        return JSON.parse(JSON.stringify(server));
      }),
    });
    const settingsStore = useSettingsStore();
    settingsStore.$patch({ _loaded: true });
    const vm = { settingsStore, show_ignored: true, fetchWords: jest.fn() };
    vm.persistIgnoredWords = next => CategoryBuilder.methods.persistIgnoredWords.call(vm, next);
    Object.defineProperty(vm, 'ignored_words', {
      get: () => CategoryBuilder.computed.ignored_words.call(vm),
    });
    return { vm, server, settingsStore };
  }
  const call = (name, vm, ...args) => CategoryBuilder.methods[name].call(vm, ...args);

  test('overlapping ignores persist every word', async () => {
    const { vm, server, settingsStore } = setup();
    // The first save is mid-flight (3 server round trips of STEP each) when the
    // second click lands, just before its trailing load() patches stale state back.
    const first = call('ignoreWord', vm, 'foo');
    await wait(STEP * 2.5);
    const second = call('ignoreWord', vm, 'bar');
    await Promise.all([first, second]);
    expect(server[KEY]).toEqual(['foo', 'bar']);
    expect(settingsStore[KEY]).toEqual(['foo', 'bar']);
  });

  test('overlapping unignores persist every removal', async () => {
    const { vm, server, settingsStore } = setup(['foo', 'bar', 'baz']);
    await settingsStore.load();
    const first = call('unignoreWord', vm, 'foo');
    await wait(STEP * 2.5);
    const second = call('unignoreWord', vm, 'bar');
    await Promise.all([first, second]);
    expect(server[KEY]).toEqual(['baz']);
    expect(settingsStore[KEY]).toEqual(['baz']);
  });

  test('a failed save does not block later saves', async () => {
    const { vm, server } = setup();
    const client = getClient();
    client.req.post.mockRejectedValueOnce(new Error('offline'));
    await expect(call('ignoreWord', vm, 'foo')).rejects.toThrow('offline');
    await call('ignoreWord', vm, 'bar');
    expect(server[KEY]).toEqual(expect.arrayContaining(['bar']));
  });
});

describe('CategoryBuilder unload listener', () => {
  afterEach(() => jest.restoreAllMocks());

  test('the mounted unload listener uses the component state and is removed on destroy', async () => {
    const addListener = jest.spyOn(window, 'addEventListener');
    const removeListener = jest.spyOn(window, 'removeEventListener');
    const wrapper = mountBuilder();
    wrapper.vm.$t = key => key;
    await flush();

    const handler = addListener.mock.calls.find(([type]) => type === 'beforeunload')[1];
    expect(handler).toBe(wrapper.vm.beforeUnload);

    const categories = useCategoryStore();
    categories.classes_unsaved_changes = false;
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    wrapper.vm.categoryStore.classes_unsaved_changes = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.classes_unsaved_changes).toBe(true);
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);

    wrapper.unmount();
    expect(removeListener).toHaveBeenCalledWith('beforeunload', handler);
    const afterDestroy = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(afterDestroy);
    expect(afterDestroy.defaultPrevented).toBe(false);
  });
});

describe('CategoryBuilder navigation guards', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ createSpy: jest.fn() }));
  });

  describe.each([
    ['standalone CategoryBuilder', CategoryBuilder],
    ['Settings parent of the embedded builder', Settings],
  ])('%s beforeRouteLeave', (_name, component) => {
    function makeVm(unsavedChanges) {
      const categoryStore = useCategoryStore();
      categoryStore.classes_unsaved_changes = unsavedChanges;
      return { $t: key => key };
    }

    test('calls next() immediately when there are no unsaved changes', () => {
      const vm = makeVm(false);
      const next = jest.fn();
      component.beforeRouteLeave.call(vm, {}, {}, next);
      expect(next).toHaveBeenCalledWith();
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('calls next() when user confirms leaving with unsaved changes', () => {
      const vm = makeVm(true);
      const next = jest.fn();
      jest.spyOn(window, 'confirm').mockReturnValue(true);
      component.beforeRouteLeave.call(vm, {}, {}, next);
      expect(window.confirm).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith();
    });

    test('calls next(false) when user cancels leaving with unsaved changes', () => {
      const vm = makeVm(true);
      const next = jest.fn();
      jest.spyOn(window, 'confirm').mockReturnValue(false);
      component.beforeRouteLeave.call(vm, {}, {}, next);
      expect(window.confirm).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(false);
    });

    afterEach(() => jest.restoreAllMocks());
  });

  describe('beforeUnload', () => {
    function makeVm(unsavedChanges) {
      return {
        classes_unsaved_changes: unsavedChanges,
        $t: key => key,
      };
    }

    test('does nothing when there are no unsaved changes', () => {
      const vm = makeVm(false);
      const e = { preventDefault: jest.fn(), returnValue: '' };
      const result = CategoryBuilder.methods.beforeUnload.call(vm, e);
      expect(e.preventDefault).not.toHaveBeenCalled();
      expect(e.returnValue).toBe('');
      expect(result).toBeUndefined();
    });

    test('sets returnValue and returns the message when there are unsaved changes', () => {
      const vm = makeVm(true);
      const e = { preventDefault: jest.fn(), returnValue: '' };
      const result = CategoryBuilder.methods.beforeUnload.call(vm, e);
      expect(e.preventDefault).toHaveBeenCalled();
      expect(e.returnValue).toBe('settings.unsavedCategoriesLeave');
      expect(result).toBe('settings.unsavedCategoriesLeave');
    });
  });
});
