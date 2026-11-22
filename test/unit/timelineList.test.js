import { timelineListRows } from '~/util/timelineList';

const bucket = (id, events, extra = {}) => ({
  id,
  hostname: 'host-a',
  type: 'currentwindow',
  events,
  ...extra,
});
const event = (timestamp, duration, data) => ({ timestamp, duration, data });

describe('timelineListRows', () => {
  test('按开始时间、桶 ID 和源顺序稳定排序', () => {
    const rows = timelineListRows([
      bucket('b', [
        event('2026-01-01T00:00:02Z', 10, { app: 'B2', title: 'b2' }),
        event('2026-01-01T00:00:01Z', 10, { app: 'B1', title: 'b1' }),
      ]),
      bucket('a', [event('2026-01-01T00:00:01Z', 20, { app: 'A1', title: 'a1' })]),
    ]);
    expect(rows.map(r => r.key)).toEqual(['a:0', 'b:1', 'b:0']);
  });

  test('计算结束时间、时长、标题和详情', () => {
    const rows = timelineListRows([
      bucket('w', [event('2026-01-01T00:00:00Z', 90, { app: 'Editor', title: 'main.ts' })]),
    ]);
    expect(rows[0].start).toBe(Date.UTC(2026, 0, 1));
    expect(rows[0].end).toBe(Date.UTC(2026, 0, 1) + 90_000);
    expect(rows[0].duration).toBe(90);
    expect(rows[0].label).toBe('Editor');
    expect(rows[0].detail).toBe('main.ts');
  });

  test('标题与标签相同时不重复展示，缺少标题时回退到数据字段', () => {
    const same = timelineListRows([
      bucket('w', [event('2026-01-01T00:00:00Z', 1, { app: 'Editor', title: 'Editor' })]),
    ]);
    expect(same[0].detail).toBe('');

    const fallback = timelineListRows([
      {
        id: 'custom',
        type: 'custom',
        events: [event('2026-01-01T00:00:00Z', 1, { foo: 'bar', baz: 'qux' })],
      },
    ]);
    expect(fallback[0].detail).toContain('foo: bar');
    expect(fallback[0].detail).toContain('baz: qux');
  });

  test('标记触及查询范围边界的开始和结束', () => {
    const rows = timelineListRows(
      [bucket('w', [event('2026-01-01T00:00:00Z', 120, { app: 'Editor', title: 'main.ts' })])],
      ['2026-01-01T00:00:00Z', '2026-01-01T00:01:00Z']
    );
    expect(rows[0].clippedStart).toBe(true);
    expect(rows[0].clippedEnd).toBe(true);
  });

  test('空桶或 null 不抛错', () => {
    expect(timelineListRows(null)).toEqual([]);
    expect(timelineListRows([])).toEqual([]);
    expect(timelineListRows([{ id: 'empty' }])).toEqual([]);
  });
});
