const mockGetSettings = jest.fn();
const mockPost = jest.fn();

jest.mock('~/util/awclient', () => ({
  getClient: () => ({
    get_settings: mockGetSettings,
    req: { defaults: { timeout: 0 }, post: mockPost },
  }),
}));

import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import i18nInstance from '~/i18n';
import { installBootstrapVue } from '~/compat/bootstrap-vue';
import TimelineDurationSettings from '~/views/settings/TimelineDurationSettings.vue';
import { useSettingsStore } from '~/stores/settings';

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
  mockGetSettings.mockReset().mockResolvedValue({});
  mockPost.mockReset();
});

afterEach(() => jest.restoreAllMocks());

describe('timeline grouping preference', () => {
  test('defaults off when neither server nor local storage has a preference', async () => {
    const store = useSettingsStore();
    await store.load();
    expect(store.timelineGroupGranularity).toBe(0);
  });

  test('loads a numeric local fallback and lets the server take priority', async () => {
    localStorage.setItem('timelineGroupGranularity', '15');
    let store = useSettingsStore();
    await store.load();
    expect(store.timelineGroupGranularity).toBe(15);

    mockGetSettings.mockResolvedValue({ timelineGroupGranularity: 30 });
    store = useSettingsStore();
    await store.load();
    expect(store.timelineGroupGranularity).toBe(30);
  });

  test.each(['bad', '-1', 'Infinity'])('ignores invalid local preference %s', async value => {
    localStorage.setItem('timelineGroupGranularity', value);
    const store = useSettingsStore();
    await store.load();
    expect(store.timelineGroupGranularity).toBe(0);
  });

  test('saves numeric values through update and reloads without writing a local override', async () => {
    const store = useSettingsStore();
    await store.load();
    const server = { ...store.$state };
    mockGetSettings.mockImplementation(async () => ({ ...server }));
    mockPost.mockImplementation(async (url, value) => {
      server[url.split('/').pop()] = value;
    });
    jest.spyOn(console, 'log').mockImplementation(jest.fn());

    for (const seconds of [15, 0]) {
      await store.update({ timelineGroupGranularity: seconds });
      expect(mockPost).toHaveBeenCalledWith('/0/settings/timelineGroupGranularity', seconds, {
        headers: { 'Content-Type': 'application/json' },
      });
      expect(store.timelineGroupGranularity).toBe(seconds);
      expect(localStorage.getItem('timelineGroupGranularity')).toBeNull();
    }
  });

  test('settings input exposes units and constraints and submits a number', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useSettingsStore();
    store.$patch({ _loaded: true });
    const update = jest.spyOn(store, 'update').mockResolvedValue();
    const wrapper = mount(TimelineDurationSettings, {
      global: {
        plugins: [pinia, i18nInstance, { install: installBootstrapVue }],
      },
    });
    const input = wrapper.find('#timeline-group-granularity');
    expect(input.attributes()).toMatchObject({ type: 'number', min: '0', step: '1' });
    expect(wrapper.find('label').text()).toContain('seconds');
    expect(wrapper.find('#timeline-group-granularity-help').text()).toContain('Set to 0');
    expect(wrapper.text()).toContain('duration filter remains independent');

    await input.setValue('20');
    await input.trigger('change');
    expect(update).toHaveBeenLastCalledWith({ timelineGroupGranularity: 20 });
    update.mockClear();
    await input.setValue('-1');
    await input.trigger('change');
    expect(update).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
