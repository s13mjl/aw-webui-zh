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

describe('Activity 自定义日期范围 (#1005)', () => {
  test('有效区间渲染起止两个日期输入框并互相约束', async () => {
    const wrapper = mountActivity({ periodLength: 'range', date: '2026-01-01..2026-01-07' });
    await wrapper.vm.$nextTick();

    const inputs = wrapper.findAll('input[type="date"]');
    expect(inputs).toHaveLength(2);
    expect(inputs[0].element.value).toBe('2026-01-01');
    expect(inputs[1].element.value).toBe('2026-01-07');
    expect(inputs[0].attributes('max')).toBe('2026-01-07');
    expect(inputs[1].attributes('min')).toBe('2026-01-01');

    // 非法区间提示不出现
    expect(wrapper.find('[variant="warning"]').exists()).toBe(false);

    // 下拉包含自定义范围与全部时间两个选项
    const buttons = wrapper.vm.periodLengthsButtons;
    const labels = buttons.map(b => b.text);
    expect(labels).toContain(wrapper.vm.$t('activity.periodCustomRange'));
    expect(labels.some(l => l.includes(wrapper.vm.$t('activity.periodAllTime')))).toBe(true);
    wrapper.unmount();
  });

  test('起止倒置时显示非法区间提示并隐藏日期输入、禁用下一页', async () => {
    const wrapper = mountActivity({ periodLength: 'range', date: '2026-03-01..2026-01-01' });
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.invalidRange).toBe(true);
    expect(wrapper.find('[variant="warning"]').exists()).toBe(true);
    expect(wrapper.find('[variant="warning"]').text()).toBe(wrapper.vm.$t('activity.invalidRange'));
    expect(wrapper.findAll('input[type="date"]')).toHaveLength(0);
    expect(wrapper.vm.nextDisabled).toBe(true);
    wrapper.unmount();
  });

  test('不存在的日历日期（2 月 30 日）按非法区间处理', async () => {
    const wrapper = mountActivity({ periodLength: 'range', date: '2026-02-30..2026-03-01' });
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.invalidRange).toBe(true);
    expect(wrapper.find('[variant="warning"]').exists()).toBe(true);
    expect(wrapper.findAll('input[type="date"]')).toHaveLength(0);
    wrapper.unmount();
  });

  test('全部时间显示慢速提示且不渲染起止双输入框', async () => {
    const wrapper = mountActivity({ periodLength: 'all', date: '' });
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[variant="warning"]').exists()).toBe(false);
    expect(wrapper.text()).toContain(wrapper.vm.$t('activity.allTimeSlowHint'));
    expect(wrapper.findAll('input[type="date"]')).toHaveLength(0);
    wrapper.unmount();
  });

  test('空区间（缺日期段）回退到当天，不渲染双输入框', async () => {
    const wrapper = mountActivity({ periodLength: 'range', date: '' });
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.invalidRange).toBe(true);
    expect(wrapper.findAll('input[type="date"]')).toHaveLength(0);
    wrapper.unmount();
  });
});
