import { mount } from '@vue/test-utils';
import Alerts from '~/views/Alerts.vue';
import i18nInstance, { i18n } from '~/i18n';
import { installBootstrapVue } from '~/compat/bootstrap-vue';
import { filters } from '~/util/filters';

jest.mock('~/stores/buckets', () => ({
  useBucketsStore: () => ({
    ensureLoaded: jest.fn().mockResolvedValue(undefined),
    hosts: ['testhost'],
    bucketsWindow: () => [{ id: 'aw-watcher-window_testhost' }],
    bucketsAFK: () => [{ id: 'aw-watcher-afk_testhost' }],
  }),
}));
jest.mock('~/stores/categories', () => ({
  useCategoryStore: () => ({
    load: jest.fn().mockResolvedValue(undefined),
    category_select: () => [],
    classes_for_query: [],
  }),
}));

function makeVm() {
  return {
    $t: (key, values) => i18n.t(key, values),
    $aw: { query: jest.fn() },
    hostname: 'testhost',
    filter_afk: false,
    status: null,
    events: [],
    error: '',
    alert_times: [],
    last_updated: null,
  };
}

async function checkEvents(vm, events) {
  vm.$aw.query.mockResolvedValueOnce([events]);
  await Alerts.methods.check.call(vm);
  return Alerts.computed.alertTime.call(vm);
}

describe('Alerts 分类路径累计', () => {
  test('按分类段精确匹配并累计子路径，不误命中同前缀兄弟/祖先', async () => {
    const vm = makeVm();
    const alertTime = await checkEvents(vm, [
      { duration: 60, data: { $category: ['Work'] } },
      { duration: 120, data: { $category: ['Work', 'Code'] } },
      { duration: 30, data: { $category: ['Work', 'Code', 'Review'] } },
      { duration: 600, data: { $category: ['Workout'] } },
      { duration: 900, data: { $category: ['Work', 'Codec'] } },
      { duration: 1000, data: {} },
      { duration: 1000, data: { $category: [] } },
    ]);

    expect(alertTime(['Work'])).toBe(1110); // 60 + 120 + 30 + 900
    expect(alertTime(['Work', 'Code'])).toBe(150);
    expect(alertTime(['Work', 'Code', 'Review'])).toBe(30);
    expect(alertTime(['Workout'])).toBe(600);
    expect(alertTime(['Missing'])).toBe(0);
  });

  test('含分隔符的名称与多段路径保持区分', async () => {
    const vm = makeVm();
    const alertTime = await checkEvents(vm, [
      { duration: 10, data: { $category: ['Work,Code'] } },
      { duration: 20, data: { $category: ['Work', 'Code'] } },
      { duration: 30, data: { $category: ['Work,Code', 'Review'] } },
      { duration: 40, data: { $category: ['Work', 'Code,Review'] } },
      { duration: 50, data: { $category: ['Work', 'Code', 'Review'] } },
    ]);

    expect(alertTime(['Work,Code'])).toBe(40);
    expect(alertTime(['Work'])).toBe(110); // 20 + 40 + 50（不含 'Work,Code' 单段）
    expect(alertTime(['Work', 'Code'])).toBe(70);
    expect(alertTime(['Work', 'Code,Review'])).toBe(40);
    expect(alertTime(['Work', 'Code', 'Review'])).toBe(50);
  });
});

describe('Alerts 目标完成判定', () => {
  async function mountAlerts() {
    const wrapper = mount(Alerts, {
      global: {
        plugins: [i18nInstance, { install: installBootstrapVue }],
        config: { globalProperties: { $filters: filters } },
        mocks: { $aw: { query: jest.fn().mockResolvedValue([[]]) } },
        stubs: {
          icon: { template: '<span><slot /></span>', props: ['name'] },
          'b-card': { template: '<div class="card"><slot /></div>' },
        },
      },
    });
    for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0));
    return wrapper;
  }

  test('目标以分钟为单位比较，仅在达到 60 秒后标记为完成', async () => {
    const wrapper = await mountAlerts();
    try {
      await wrapper.setData({
        alerts: [{ name: 'Work goal', category: ['Work'], goal: 1 }],
        alert_times: [{ category: ['Work'], duration: 59 }],
      });
      await wrapper.vm.$nextTick();
      expect(wrapper.find('.card .text-success').exists()).toBe(false);
      expect(wrapper.find('.card .text-muted').exists()).toBe(true);

      await wrapper.setData({ alert_times: [{ category: ['Work'], duration: 60 }] });
      await wrapper.vm.$nextTick();
      expect(wrapper.find('.card .text-success').exists()).toBe(true);
      expect(wrapper.find('.card .text-muted').exists()).toBe(false);
    } finally {
      wrapper.unmount();
    }
  });
});
