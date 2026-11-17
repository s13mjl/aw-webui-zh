import { createPinia, setActivePinia } from 'pinia';
import BillingViewComponent from '~/views/BillingView.vue';
import i18nInstance, { i18n } from '~/i18n';
import { getClient } from '~/util/awclient';
import { buildBillingQuery } from '~/util/workReport';

jest.mock('~/util/awclient', () => ({ getClient: jest.fn() }));

const BillingView = BillingViewComponent;

const buckets = [
  { id: 'aw-watcher-window_laptop', hostname: 'laptop', type: 'currentwindow' },
  { id: 'aw-watcher-afk_laptop', hostname: 'laptop', type: 'afkstatus' },
  { id: 'aw-watcher-window_phone', hostname: 'phone', type: 'currentwindow' },
];

function context(overrides = {}) {
  const ctx = {
    ...BillingView.data(),
    $t: (key, values) => i18n.t(key, values),
  };
  for (const [key, method] of Object.entries(BillingView.methods)) {
    ctx[key] = method.bind(ctx);
  }
  for (const [key, getter] of Object.entries(BillingView.computed)) {
    Object.defineProperty(ctx, key, { get: () => getter.call(ctx) });
  }
  ctx.downloadFile = jest.fn();
  // 不走 mounted()，需要像 WorkReport 测试那样手动给定默认主机。
  ctx.selectedHosts = ['laptop'];
  ctx.categoryStore = {
    all_categories: [['Work'], ['Work', 'Code']],
    classes_for_query: [],
  };
  ctx.settingsStore = { startOfDay: '04:00' };
  ctx.bucketsStore = { buckets };
  Object.assign(ctx, overrides);
  return ctx;
}

const eventsWithCategories = [
  { duration: 3600, data: { $category: ['Work'] } },
  { duration: 1800, data: { $category: ['Work', 'Code'] } },
  { duration: 600, data: {} },
];

let query;

beforeEach(() => {
  setActivePinia(createPinia());
  query = jest.fn().mockResolvedValue([{ events: eventsWithCategories, duration: 6000 }]);
  getClient.mockReturnValue({ query });
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe('BillingView 分类聚合', () => {
  test('按分类路径累加时长，未分类事件回落到 Uncategorized', async () => {
    const ctx = context();
    await ctx.loadData();

    expect(ctx.categoryRows).toHaveLength(3);
    const byCategory = Object.fromEntries(ctx.categoryRows.map(r => [r.category, r]));
    expect(byCategory['Work'].duration).toBe(3600);
    expect(byCategory['Work > Code'].duration).toBe(1800);
    expect(byCategory[i18n.t('billing.uncategorized')].duration).toBe(600);
    expect(byCategory['Work > Code'].depth).toBe(1);
    expect(byCategory['Work > Code'].label).toBe('Code');
    expect(ctx.totalDuration).toBe(6000);
    expect(ctx.hasData).toBe(true);
  });

  test('空事件列表时无行且不报错', async () => {
    query.mockResolvedValueOnce([{ events: [], duration: 0 }]);
    const ctx = context();
    await ctx.loadData();

    expect(ctx.categoryRows).toHaveLength(0);
    expect(ctx.hasData).toBe(false);
    expect(ctx.totalDuration).toBe(0);
  });

  test('查询失败进入错误提示并复位 loading，不清空已有结果', async () => {
    const ctx = context();
    await ctx.loadData();
    const previousRows = ctx.categoryRows;

    query.mockRejectedValueOnce(new Error('offline'));
    await ctx.loadData();

    expect(ctx.errorMessage).toBe(i18n.t('billing.errLoading'));
    expect(ctx.loading).toBe(false);
    expect(ctx.categoryRows).toBe(previousRows);
  });
});

describe('BillingView 主机筛选', () => {
  test('未选择主机时提示错误且不发起查询', async () => {
    const ctx = context({ selectedHosts: [] });
    await ctx.loadData();

    expect(ctx.errorMessage).toBe(i18n.t('billing.errNoHost'));
    expect(query).not.toHaveBeenCalled();
  });

  test('所选主机全部缺少 AFK 时列出主机名且不发起查询', async () => {
    const ctx = context({ selectedHosts: ['phone'] });
    await ctx.loadData();

    expect(ctx.errorMessage).toBe(i18n.t('billing.errMissingAfk', { hosts: 'phone' }));
    expect(query).not.toHaveBeenCalled();
  });

  test('受支持主机进入查询，缺 AFK 的主机被剔除', async () => {
    const ctx = context({ selectedHosts: ['laptop', 'phone'] });
    await ctx.loadData();

    expect(query).toHaveBeenCalledTimes(1);
    const awQuery = query.mock.calls[0][1][0];
    expect(awQuery).toContain('aw-watcher-window_laptop');
    expect(awQuery).toContain('aw-watcher-afk_laptop');
    expect(awQuery).not.toContain('aw-watcher-window_phone');
    expect(ctx.errorMessage).toBe('');
  });
});

describe('BillingView 时薪与金额换算', () => {
  test('未单独填写的行回落到默认时薪，显式填 0 视为不可计费', async () => {
    const ctx = context();
    await ctx.loadData();
    ctx.defaultRate = 10;

    const byCategory = Object.fromEntries(ctx.categoryRows.map(r => [r.category, r]));
    const work = byCategory['Work'];
    const code = byCategory['Work > Code'];

    expect(ctx.getEffectiveRate(work)).toBe(10);
    // 1.00 小时 × 10 = 10.00
    expect(ctx.getAmount(work)).toBeCloseTo(10);

    // 显式 0 不再回落默认费率
    ctx.categoryRates[work.key] = 0;
    expect(ctx.getEffectiveRate(work)).toBe(0);
    expect(ctx.getAmount(work)).toBe(0);

    // 单独费率覆盖默认
    ctx.categoryRates[code.key] = 20;
    expect(ctx.getEffectiveRate(code)).toBe(20);
    // 0.50 小时 × 20 = 10.00
    expect(ctx.getAmount(code)).toBeCloseTo(10);
  });

  test('总额为各行金额之和', async () => {
    const ctx = context();
    await ctx.loadData();
    ctx.defaultRate = 10;

    // Work 1h×10=10，Code 0.5h×10=5，Uncategorized 600s×10/3600≈1.6667
    expect(ctx.totalAmount).toBeCloseTo(10 + 5 + (600 / 3600) * 10, 2);
  });

  test('工时与金额格式化', () => {
    const ctx = context();
    expect(ctx.formatHours(3600)).toBe('1.00');
    expect(ctx.formatHours(1800)).toBe('0.50');
    expect(ctx.formatAmount(0)).toBe('—');
    expect(ctx.formatAmount(10.5)).toBe('$10.50');
  });
});

describe('BillingView 日期范围', () => {
  test('四种范围都返回合法的起止时间周期', () => {
    const ctx = context();
    for (const dateRange of ['thisMonth', 'last30d', 'thisWeek', 'last7d']) {
      ctx.dateRange = dateRange;
      const tp = ctx.getTimeperiod();
      const [start, end] = tp.split('/');
      expect(start).toBeTruthy();
      expect(end).toBeTruthy();
      expect(new Date(start).getTime()).toBeLessThanOrEqual(new Date(end).getTime());
    }
  });

  test('本月范围从当月 1 号开始', () => {
    const ctx = context({ dateRange: 'thisMonth' });
    const [start] = ctx.getTimeperiod().split('/');
    expect(new Date(start).getDate()).toBe(1);
  });
});

describe('BillingView CSV 导出', () => {
  test('导出包含注释头、列头、按行费率金额与合计行', async () => {
    const ctx = context();
    await ctx.loadData();
    ctx.defaultRate = 10;
    const codeRow = ctx.categoryRows.find(r => r.category === 'Work > Code');
    ctx.categoryRates[codeRow.key] = 20;

    ctx.exportCSV();
    const content = ctx.downloadFile.mock.calls.slice(-1)[0][0];
    const lines = content.split('\n');

    expect(lines[0]).toBe(`# ${i18n.t('billing.csvExportTitle')}`);
    expect(lines[1]).toMatch(/^# .*\d{4}-\d{2}-\d{2}.*\d{4}-\d{2}-\d{2}/);
    expect(lines[2]).toMatch(/^# .*\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
    const colsLine = lines.find(line => line.startsWith(i18n.t('billing.csvCategory') + ','));
    expect(colsLine).toBe(
      [
        i18n.t('billing.csvCategory'),
        i18n.t('billing.csvHours'),
        i18n.t('billing.csvRate'),
        i18n.t('billing.csvAmount'),
      ].join(',')
    );

    // Code 行：0.50h，单独费率 20.00，金额 10.00
    expect(lines).toContain('"Work > Code",0.50,20.00,10.00');
    // 未分类行使用默认费率 10.00
    expect(lines).toContain(`"${i18n.t('billing.uncategorized')}",0.17,10.00,1.67`);

    const totals = lines[lines.length - 1];
    expect(totals).toContain(`"${i18n.t('billing.csvTotal')}"`);
    expect(totals.split(',')[1]).toBe('1.67'); // 6000s ≈ 1.67h
    expect(totals.split(',')[3]).toBe('21.67');

    const filename = ctx.downloadFile.mock.calls.slice(-1)[0][1];
    expect(filename).toMatch(/^billable-hours-\d{4}-\d{2}\.csv$/);
  });

  test('分类名中的双引号在 CSV 中转义', async () => {
    query.mockResolvedValueOnce([
      {
        events: [{ duration: 3600, data: { $category: ['Work', 'Bonus "Q3"'] } }],
        duration: 3600,
      },
    ]);
    const ctx = context();
    await ctx.loadData();
    ctx.exportCSV();
    const content = ctx.downloadFile.mock.calls.slice(-1)[0][0];
    expect(content).toContain('"Work > Bonus ""Q3"""');
  });
});

describe('buildBillingQuery', () => {
  test('window 与 AFK 桶均使用单参 flood()', () => {
    const q = buildBillingQuery(['laptop'], '[]');
    expect(q).toContain('events_0 = flood(query_bucket("aw-watcher-window_laptop"));');
    expect(q).toContain('not_afk_0 = flood(query_bucket("aw-watcher-afk_laptop"));');
    expect(q).not.toMatch(/flood\([^)]+,[^)]+\)/);
  });

  test('多主机分别查询并 union_no_overlap 合并，再按分类归类', () => {
    const q = buildBillingQuery(['laptop', 'desktop'], '[]');
    expect(q).toContain('aw-watcher-window_laptop');
    expect(q).toContain('aw-watcher-window_desktop');
    expect(q).toContain('categorize(events_0, []);');
    expect(q).toContain('union_no_overlap(events, events_0);');
    expect(q).toContain('union_no_overlap(events, events_1);');
    expect(q).toContain('RETURN = {"events": events, "duration": duration};');
  });
});

// 避免未使用告警（i18nInstance 供全局插件解析）
void i18nInstance;
