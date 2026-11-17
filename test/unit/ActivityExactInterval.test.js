import { shallowMount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import i18nInstance from '~/i18n';
import { installBootstrapVue } from '~/compat/bootstrap-vue';
import Activity from '~/views/activity/Activity.vue';
import { useSettingsStore } from '~/stores/settings';
import { useBucketsStore } from '~/stores/buckets';
import { filters } from '~/util/filters';
import { instantToWall } from '~/util/timeperiod';

jest.mock('~/util/awclient', () => ({
  getClient: jest.fn(),
  getEventsLong: jest.fn(),
  queryLong: jest.fn(),
}));

const { getClient } = require('~/util/awclient');

function mockClient() {
  getClient.mockReturnValue({
    controller: new AbortController(),
    req: { defaults: { headers: {} } },
    abort: jest.fn(),
    getBuckets: jest.fn(async () => []),
    getEvents: jest.fn(async () => []),
    query: jest.fn(async () => []),
  });
}

function mountActivity(props) {
  const pinia = createPinia();
  setActivePinia(pinia);
  useSettingsStore().$patch({
    _loaded: true,
    startOfDay: '00:00',
    useMultidevice: false,
    requestTimeout: 30,
  });
  useBucketsStore().$patch({ buckets: [] });
  mockClient();

  return shallowMount(Activity, {
    props: { host: 'testhost', ...props },
    global: {
      plugins: [pinia, i18nInstance, { install: installBootstrapVue }],
      config: { globalProperties: { $filters: filters } },
      mocks: {
        $route: {
          query: {},
          meta: { subview: 'default' },
          params: { viewid: 'default' },
          path: '/',
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
      },
    },
  });
}

const VALID = '2026-10-20T13:00:00Z..2026-10-20T14:00:00Z';

describe('Activity 精确时段 (#1168)', () => {
  test('有效区间渲染两个 datetime-local 输入并列出精确时段选项', async () => {
    const wrapper = mountActivity({ periodLength: 'interval', date: VALID });
    await wrapper.vm.$nextTick();

    const inputs = wrapper.findAll('input[type="datetime-local"]');
    expect(inputs).toHaveLength(2);
    expect(inputs[0].element.value).toBe(instantToWall('2026-10-20T13:00:00Z').slice(0, 16));
    expect(inputs[1].element.value).toBe(instantToWall('2026-10-20T14:00:00Z').slice(0, 16));

    expect(wrapper.find('[variant="warning"]').exists()).toBe(false);
    const labels = wrapper.vm.periodLengthsButtons.map(b => b.text);
    expect(labels).toContain(wrapper.vm.$t('activity.periodExactInterval'));
    expect(wrapper.vm.exactInterval).toEqual({
      start: '2026-10-20T13:00:00Z',
      end: '2026-10-20T14:00:00Z',
    });
    wrapper.unmount();
  });

  test('非法区间显示 invalidInterval 提示、隐藏时间输入并禁用下一页', async () => {
    const wrapper = mountActivity({
      periodLength: 'interval',
      date: '2026-10-20T14:00:00Z..2026-10-20T13:00:00Z',
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.invalidInterval).toBe(true);
    expect(wrapper.find('[variant="warning"]').text()).toBe(
      wrapper.vm.$t('activity.invalidInterval')
    );
    expect(wrapper.findAll('input[type="datetime-local"]')).toHaveLength(0);
    expect(wrapper.vm.nextDisabled).toBe(true);
    wrapper.unmount();
  });

  test('裸日期与无时区时刻按非法区间处理', async () => {
    const bare = mountActivity({ periodLength: 'interval', date: '2026-10-20..2026-10-21' });
    await bare.vm.$nextTick();
    expect(bare.vm.invalidInterval).toBe(true);
    expect(bare.findAll('input[type="datetime-local"]')).toHaveLength(0);
    bare.unmount();

    const naive = mountActivity({
      periodLength: 'interval',
      date: '2026-10-20T13:00:00..2026-10-20T14:00:00',
    });
    await naive.vm.$nextTick();
    expect(naive.vm.invalidInterval).toBe(true);
    naive.unmount();
  });

  test('切换到 day 周期时路由到 day 路径，不沿用区间段', async () => {
    const wrapper = mountActivity({ periodLength: 'interval', date: VALID });
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll('input[type="datetime-local"]')).toHaveLength(2);

    wrapper.vm.setDate(wrapper.vm._date, 'day');
    const push = wrapper.vm.$router.push;
    const arg = push.mock.calls[push.mock.calls.length - 1][0];
    expect(arg.path).toBe('/activity/testhost/day/2026-10-20/default/');
    expect(arg.path).not.toContain('interval');
    wrapper.unmount();
  });

  test('结束早于开始时提示 intervalEndAfterStart', async () => {
    const wrapper = mountActivity({ periodLength: 'interval', date: VALID });
    await wrapper.vm.$nextTick();

    wrapper.vm.editInterval('start', instantToWall('2026-10-20T15:00:00Z'));
    expect(wrapper.vm.intervalIssue.message).toBe(wrapper.vm.$t('activity.intervalEndAfterStart'));
    wrapper.unmount();
  });

  test('无法解析的墙时提示 intervalNonexistentTime', async () => {
    const wrapper = mountActivity({ periodLength: 'interval', date: VALID });
    await wrapper.vm.$nextTick();

    wrapper.vm.editInterval('end', 'garbage');
    expect(wrapper.vm.intervalIssue.message).toBe(
      wrapper.vm.$t('activity.intervalNonexistentTime')
    );
    wrapper.unmount();
  });

  test('极短区间（30 秒）仍生成非空 timeperiod，不退化为空图', async () => {
    const wrapper = mountActivity({
      periodLength: 'interval',
      date: '2026-10-20T13:00:00Z..2026-10-20T13:00:30Z',
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.timeperiod).not.toBeNull();
    expect(wrapper.vm.timeperiod.length).toEqual([30000, 'milliseconds']);
    expect(wrapper.findAll('input[type="datetime-local"]')).toHaveLength(2);
    wrapper.unmount();
  });

  test('上一/下一周期按整个区间长度平移', async () => {
    const wrapper = mountActivity({ periodLength: 'interval', date: VALID });
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.previousPeriod()).toBe('2026-10-20T12:00:00Z..2026-10-20T13:00:00Z');
    expect(wrapper.vm.nextPeriod()).toBe('2026-10-20T14:00:00Z..2026-10-20T15:00:00Z');
    wrapper.unmount();
  });

  test('与全部时间互斥：all 周期不渲染时间输入', async () => {
    const wrapper = mountActivity({ periodLength: 'all', date: '' });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.exactInterval).toBeNull();
    expect(wrapper.findAll('input[type="datetime-local"]')).toHaveLength(0);
    wrapper.unmount();
  });
});
