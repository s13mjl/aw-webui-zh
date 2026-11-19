import { shallowMount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import i18nInstance from '~/i18n';
import { installBootstrapVue } from '~/compat/bootstrap-vue';
import Activity from '~/views/activity/Activity.vue';
import { useSettingsStore } from '~/stores/settings';
import { useBucketsStore } from '~/stores/buckets';
import { useActivityStore } from '~/stores/activity';
import { filters } from '~/util/filters';

jest.mock('~/util/awclient', () => ({
  getClient: jest.fn(),
  getEventsLong: jest.fn(),
  queryLong: jest.fn(),
}));

const { getClient } = require('~/util/awclient');

const bucket = (id, type, hostname) => ({
  id,
  type,
  hostname,
  client: 'test',
  created: '2026-01-01T00:00:00Z',
  last_updated: '2026-01-01T00:00:00Z',
  data: {},
});

const buckets = [
  bucket('aw-watcher-window_self', 'currentwindow', 'self'),
  bucket('aw-watcher-afk_self', 'afkstatus', 'self'),
  bucket('aw-watcher-window_laptop', 'currentwindow', 'laptop'),
  bucket('aw-watcher-afk_laptop', 'afkstatus', 'laptop'),
  bucket('aw-watcher-window_desktop2', 'currentwindow', 'desktop2'),
  bucket('aw-watcher-afk_desktop2', 'afkstatus', 'desktop2'),
];

const hostDurations = [
  { host: 'self', duration: 3600, overlap: 0 },
  { host: 'laptop', duration: 1800, overlap: 600 },
  { host: 'desktop2', duration: 1200, overlap: 0 },
];

// Four-device sample used by the methods-level share check.
const fourDeviceDurations = [
  { host: 'desktop', duration: 3600, overlap: 0 },
  { host: 'laptop', duration: 1800, overlap: 600 },
  { host: 'desktop2', duration: 1200, overlap: 0 },
  { host: 'desktop3', duration: 600, overlap: 0 },
];

function mountActivity(props = {}) {
  const pinia = createPinia();
  setActivePinia(pinia);
  useSettingsStore().$patch({
    _loaded: true,
    startOfDay: '00:00',
    requestTimeout: 30,
  });
  useBucketsStore().$patch({ buckets });
  getClient.mockReturnValue({
    controller: new AbortController(),
    req: { defaults: { headers: {} } },
    abort: jest.fn(),
    getBuckets: jest.fn(async () => buckets),
    getEvents: jest.fn(async () => []),
    get_settings: jest.fn(async () => ({})),
    query: jest.fn(async () => []),
  });

  const wrapper = shallowMount(Activity, {
    props: { host: 'self,laptop,desktop2', periodLength: 'day', ...props },
    global: {
      plugins: [pinia, i18nInstance, { install: installBootstrapVue }],
      config: { globalProperties: { $filters: filters } },
      mocks: {
        $route: {
          query: {},
          meta: { subview: 'view' },
          params: { host: props.host || 'self', periodLength: 'day', view_id: 'default' },
          path: `/activity/${props.host || 'self'}/day`,
        },
        $router: { push: jest.fn() },
      },
      stubs: {
        'aw-uncategorized-notification': true,
        'aw-periodusage': true,
        icon: true,
        'b-alert': { template: '<div><slot /></div>' },
        'b-input-group': { template: '<div><slot /></div>' },
        'b-input-group-prepend': { template: '<div><slot /></div>' },
        'b-input-group-append': { template: '<div><slot /></div>' },
        'b-dropdown': { template: '<div><slot /></div>' },
        'b-dropdown-item': { template: '<div><slot /></div>' },
        'b-dropdown-divider': { template: '<div />' },
        'b-dropdown-form': { template: '<div><slot /></div>' },
        'b-form-checkbox': {
          props: ['checked', 'disabled'],
          template:
            '<label><input type="checkbox" :checked="checked" :disabled="disabled" /><slot /></label>',
        },
      },
    },
  });
  return wrapper;
}

describe('Activity per-device breakdown bar (methods)', () => {
  test('segment widths are each device share of the merged total', () => {
    const vm = { hostDurations: fourDeviceDurations };
    const shares = fourDeviceDurations.map(d => Activity.methods.deviceShare.call(vm, d));
    expect(shares).toEqual([50, 25, 100 / 6, 100 / 12]);
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(100);
  });

  test('an empty total gives zero-width segments instead of NaN', () => {
    const vm = { hostDurations: [{ host: 'a', duration: 0, overlap: 0 }] };
    expect(Activity.methods.deviceShare.call(vm, vm.hostDurations[0])).toBe(0);
  });

  test('device colours are assigned by position and wrap around the palette', () => {
    expect(Activity.methods.deviceColor(0)).toBe(Activity.methods.deviceColor(10));
    expect(Activity.methods.deviceColor(0)).not.toBe(Activity.methods.deviceColor(1));
  });
});

describe('Activity per-device breakdown rendering', () => {
  test('multidevice view shows one stacked segment per device, hidden for a single device', async () => {
    const wrapper = mountActivity();
    const activityStore = useActivityStore();
    activityStore.window.host_durations = [...hostDurations];
    await wrapper.vm.$nextTick();

    const breakdown = wrapper.find('[data-testid="device-breakdown"]');
    expect(breakdown.exists()).toBe(true);
    const segments = wrapper.findAll('.device-breakdown-segment');
    expect(segments).toHaveLength(3);
    const total = hostDurations.reduce((sum, d) => sum + d.duration, 0);
    hostDurations.forEach((d, i) => {
      expect(segments[i].attributes('style')).toContain(`width: ${(100 * d.duration) / total}%`);
    });

    wrapper.unmount();

    const single = mountActivity({ host: 'self' });
    await single.vm.$nextTick();
    expect(single.find('[data-testid="device-breakdown"]').exists()).toBe(false);
    single.unmount();
  });

  test('clicking the toggle opens the per-device table with a row per host and the overlap note', async () => {
    const wrapper = mountActivity();
    const activityStore = useActivityStore();
    activityStore.window.host_durations = [...hostDurations];
    await wrapper.vm.$nextTick();

    const toggle = wrapper.find('[data-testid="device-breakdown-toggle"]');
    expect(wrapper.find('[data-testid="device-breakdown-table"]').exists()).toBe(false);

    await toggle.trigger('click');
    await wrapper.vm.$nextTick();

    const table = wrapper.find('[data-testid="device-breakdown-table"]');
    expect(table.exists()).toBe(true);
    const rows = table.findAll('tr');
    expect(rows).toHaveLength(3);

    const hostNames = rows.map(r => r.find('.device-breakdown-host').text());
    expect(hostNames).toEqual(['self', 'laptop', 'desktop2']);

    // The laptop's 600s overlap (>= 60s) is surfaced in its row.
    expect(rows[1].text()).toContain(wrapper.vm.$t('activity.overlap'));
    expect(rows[0].text()).not.toContain(wrapper.vm.$t('activity.overlap'));

    // Total credited time equals the sum of the per-device rows.
    const total = hostDurations.reduce((sum, d) => sum + d.duration, 0);
    expect(wrapper.vm.hostDurations.reduce((sum, d) => sum + d.duration, 0)).toBe(total);

    wrapper.unmount();
  });

  test('no breakdown when fewer than two devices have durations', async () => {
    const wrapper = mountActivity();
    const activityStore = useActivityStore();
    activityStore.window.host_durations = [{ host: 'self', duration: 3600, overlap: 0 }];
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="device-breakdown"]').exists()).toBe(false);
    wrapper.unmount();
  });
});
