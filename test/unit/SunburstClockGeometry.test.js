import moment from 'moment';
import sunburst from '~/visualizations/sunburst-clock';

// 同步上游 #1240：时钟图按本地挂钟时间定位弧段，06:00 始终固定在表盘右侧，
// 与 reporting day 的 startOfDay 偏移及 DST 无关；跨 DST 时在偏移切换处切分弧段。
const turn = 2 * Math.PI;
const hour = turn / 24;

function render(start, timestamp, duration = 1800) {
  const el = document.createElement('div');
  el.innerHTML = '<div class="legend"></div><div class="sequence"></div>';
  sunburst.create(el);
  sunburst.update(
    el,
    {
      timestamp: start.toISOString(),
      duration: start.clone().add(1, 'day').diff(start, 'seconds'),
      data: {},
      children: [{ timestamp, duration, data: { app: 'fixture' } }],
    },
    start
  );
  const paths = Array.from(el.querySelectorAll('#container path')).filter(
    path => path.__data__.data.data.app === 'fixture'
  );
  return { el, paths, nodes: paths.map(path => path.__data__) };
}

function expectSpan(node, from, to) {
  expect(node.x0).toBeCloseTo(from * hour, 9);
  expect(node.x1).toBeCloseTo(to * hour, 9);
}

describe('sunburst 时钟挂钟几何', () => {
  test.each(['00:00', '04:00', '04:30'])('从 %s 起报时，06:00 仍对齐固定刻度', start => {
    const { el, nodes, paths } = render(moment(`2026-10-29T${start}:00`), '2026-10-29T06:00:00');
    expect(nodes).toHaveLength(1);
    expectSpan(nodes[0], 6, 6.5);
    expect(paths[0].getAttribute('d')).toMatch(/^M[\d.]+,0A/);
    const six = Array.from(el.querySelectorAll('text')).find(t => t.textContent === '06:00');
    expect(Number(six.getAttribute('x'))).toBeCloseTo(130, 9);
    expect(Number(six.getAttribute('y'))).toBeCloseTo(5, 9);
    if (start !== '00:00') {
      const boundary = Array.from(el.querySelectorAll('text')).find(
        t => t.textContent === `${start} ☀`
      );
      const angle = (Number(start.slice(0, 2)) + Number(start.slice(3)) / 60) * hour;
      expect(Number(boundary.getAttribute('x'))).toBeCloseTo(130 * Math.sin(angle), 9);
      expect(Number(boundary.getAttribute('y'))).toBeCloseTo(5 - 140 * Math.cos(angle), 9);
    }
  });

  test('次日历日事件在偏移边界前仍画在其挂钟时刻', () => {
    const { nodes } = render(moment('2026-10-29T04:30:00'), '2026-10-30T02:00:00');
    expect(nodes).toHaveLength(1);
    expectSpan(nodes[0], 2, 2.5);
  });

  test('跨越日历午夜连续绘制，不产生整圈扇形', () => {
    const { nodes } = render(moment('2026-10-29T04:00:00'), '2026-10-29T23:30:00', 3600);
    expect(nodes).toHaveLength(1);
    expectSpan(nodes[0], 23.5, 24.5);
  });

  test.each([
    ['2026-10-29T04:00:00', 3600, 4.5, 5],
    ['2026-10-30T04:00:00', 3600, 4, 4.5],
  ])('按实际显示周期裁剪 %s', (timestamp, duration, from, to) => {
    const { nodes } = render(moment('2026-10-29T04:30:00'), timestamp, duration);
    expect(nodes).toHaveLength(1);
    expectSpan(nodes[0], from, to);
  });

  test.each(['2026-10-29T03:00:00', '2026-10-30T04:30:00'])('省略周期外事件 %s', timestamp => {
    expect(render(moment('2026-10-29T04:30:00'), timestamp).nodes).toHaveLength(0);
  });
});

// TZ 在 jest 进程启动时继承，测试内改 process.env.TZ 不可靠；
// 用 TZ=Europe/Stockholm 单独跑此套件以覆盖 DST 用例。
const stockholm = Intl.DateTimeFormat().resolvedOptions().timeZone === 'Europe/Stockholm';
(stockholm ? describe : describe.skip)('sunburst 时钟 DST 挂钟策略', () => {
  test.each(['2026-03-29', '2026-10-25'])('短/长日 %s 上 06:00 仍固定', day => {
    const { nodes } = render(moment(`${day}T00:00:00`), `${day}T06:00:00`);
    expectSpan(nodes[0], 6, 6.5);
  });

  test('春季跳变缺失小时留空，不拉伸已过时长', () => {
    const { nodes } = render(moment('2026-03-29T00:00:00'), '2026-03-29T01:30:00+01:00', 3600);
    expect(nodes).toHaveLength(2);
    expectSpan(nodes[0], 1.5, 2);
    expectSpan(nodes[1], 3, 3.5);
    expect(nodes.reduce((sum, n) => sum + n.x1 - n.x0, 0)).toBeCloseTo(hour, 9);
  });

  test('秋季重复小时落在同一挂钟扇区', () => {
    const { nodes } = render(moment('2026-10-25T00:00:00'), '2026-10-25T02:00:00+02:00', 7200);
    expect(nodes).toHaveLength(2);
    expectSpan(nodes[0], 2, 3);
    expectSpan(nodes[1], 2, 3);
    expect(nodes[0].data).toBe(nodes[1].data);
    expect(nodes.reduce((sum, n) => sum + n.x1 - n.x0, 0)).toBeCloseTo(2 * hour, 9);
  });
});
