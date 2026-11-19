import { shallowMount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import i18nInstance from '~/i18n';
import { installBootstrapVue } from '~/compat/bootstrap-vue';
import Activity from '~/views/activity/Activity.vue';
import { useSettingsStore } from '~/stores/settings';
import { useBucketsStore } from '~/stores/buckets';
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
  bucket('aw-watcher-window_desktop', 'currentwindow', 'desktop'),
  bucket('aw-watcher-afk_desktop', 'afkstatus', 'desktop'),
];

function mountActivity(props) {
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

  return shallowMount(Activity, {
    props: { host: 'self', periodLength: 'day', ...props },
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
}

describe('Activity 多设备选择控件 (#1004)', () => {
  test('单主机时不显示多选控件，保留原主机标签', async () => {
    const wrapper = mountActivity({ host: 'self' });
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.isMultidevice).toBe(false);
    expect(wrapper.vm.selectedHosts).toEqual(['self']);
    expect(wrapper.find('[data-testid="host-selector"]').exists()).toBe(true);
    expect(wrapper.vm.hostLabel).toBe('self');
    wrapper.unmount();
  });

  test('多主机选择时渲染“所有设备”与各主机复选框，选中态与路由一致', async () => {
    const wrapper = mountActivity({ host: 'self,laptop' });
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.isMultidevice).toBe(true);
    expect(wrapper.vm.selectedHosts).toEqual(['self', 'laptop']);
    expect(wrapper.find('[data-testid="host-selector-all"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="host-selector-host-self"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="host-selector-host-laptop"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="host-selector-host-desktop"]').exists()).toBe(true);

    const checked = wrapper.findAll('input[type="checkbox"]').filter(i => i.element.checked);
    expect(checked).toHaveLength(2);
    wrapper.unmount();
  });

  test('勾选未选主机后跳转携带更新后的主机列表', async () => {
    const wrapper = mountActivity({ host: 'self,laptop' });
    await wrapper.vm.$nextTick();

    wrapper.vm.toggleHost('desktop');
    const push = wrapper.vm.$router.push;
    expect(push).toHaveBeenCalledTimes(1);
    const path = push.mock.calls[0][0].path;
    // 选满全部可用主机后归并为 @all 保留字
    expect(path).toBe('/activity/@all/day/view/');
    wrapper.unmount();
  });

  test('@all 选择在刷新（重新挂载）后恢复为“所有设备”', async () => {
    const first = mountActivity({ host: '@all' });
    await first.vm.$nextTick();
    expect(first.vm.hostSelection.all).toBe(true);
    expect(first.vm.selectedHosts).toEqual(['self', 'laptop', 'desktop']);
    expect(first.vm.hostLabel).toBe(
      first.vm.$t('activity.allDevicesCount', { count: 3 }).toString()
    );
    first.unmount();

    // 模拟刷新：用相同路由参数重新挂载
    const second = mountActivity({ host: '@all' });
    await second.vm.$nextTick();
    expect(second.vm.hostSelection.all).toBe(true);
    expect(second.vm.selectedHosts).toEqual(['self', 'laptop', 'desktop']);
    second.unmount();
  });

  test('URL 中失效的主机以禁用未选状态展示并标注无数据', async () => {
    const wrapper = mountActivity({ host: 'self,gone' });
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.unavailableHosts).toEqual(['gone']);
    const stale = wrapper.find('[data-testid="host-selector-unavailable-gone"]');
    expect(stale.exists()).toBe(true);
    expect(stale.find('input[type="checkbox"]').element.disabled).toBe(true);
    expect(stale.text()).toContain(wrapper.vm.$t('visualizations.noData'));
    wrapper.unmount();
  });
});
