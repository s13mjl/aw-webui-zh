import periodusage from '~/visualizations/periodusage';

// get_hour_offset 读取设置里的 startOfDay；测试固定为 00:00。
jest.mock('~/stores/settings', () => ({
  useSettingsStore: () => ({ startOfDay: '00:00' }),
}));

// 同步上游 #1277：Today 标签位于自身柱子右侧、最后绘制且不拦截交互。
const NOW = new Date('2026-09-09T12:00:00Z').getTime();

const period = day => `${day}T04:00:00Z`;
const active = (timestamp, duration) => [
  { timestamp, duration, data: { status: 'not-afk' } },
];

function render(starts) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  document.body.appendChild(svg);
  periodusage.update(
    svg,
    starts.map(d => active(period(d), 100)),
    () => undefined
  );
  return svg;
}

describe('Today 标签绘制', () => {
  let nowSpy;
  let svg;

  beforeEach(() => {
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => {
    svg?.remove();
    nowSpy.mockRestore();
  });

  test.each([
    ['左侧', 0],
    ['中间', 1],
    ['最右', 2],
  ])('位于%s的今日柱子右侧且绘制在最上层（%s）', (_name, todayIndex) => {
    const starts = ['2026-09-06', '2026-09-07', '2026-09-08'];
    starts[todayIndex] = '2026-09-09';
    svg = render(starts);
    const label = Array.from(svg.querySelectorAll('text')).find(t => t.textContent === 'Today');
    expect(label).toBeDefined();
    expect(label.getAttribute('text-anchor')).toBe('start');
    expect(svg.lastElementChild).toBe(label);
    expect(label.getAttribute('pointer-events')).toBe('none');

    const bar = svg.querySelectorAll('rect')[todayIndex];
    const left = parseFloat(bar.getAttribute('x'));
    const right = left + parseFloat(bar.getAttribute('width'));
    const x = parseFloat(label.getAttribute('x'));
    expect(x).toBeCloseTo(left + 1.5 * parseFloat(bar.getAttribute('width')));
    expect(x).toBeGreaterThan(right);
  });

  test('重新渲染替换旧的 Today 标记', () => {
    svg = render(['2026-09-09', '2026-09-07', '2026-09-08']);
    expect(svg.querySelectorAll('text')).toHaveLength(1);
    periodusage.update(
      svg,
      ['2026-09-09', '2026-09-07', '2026-09-08'].map(d => active(period(d), 50)),
      () => undefined
    );
    expect(svg.querySelectorAll('text')).toHaveLength(1);
    expect(svg.querySelectorAll('rect')).toHaveLength(3);
  });
});
