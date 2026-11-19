import { hostDurationBreakdown, HostDuration } from '~/util/multidevice';
import { mergeFullDesktopResults } from '~/util/desktopQuerySplit';
import { multideviceQuery } from '~/queries';

describe('hostDurationBreakdown', () => {
  test('credited shares add up to the merged total', () => {
    // desktop 5h, laptop 3h of which 1h overlaps the desktop
    const out = hostDurationBreakdown(
      ['desktop', 'laptop'],
      [5 * 3600, 7 * 3600],
      [5 * 3600, 3 * 3600]
    );
    expect(out).toEqual([
      { host: 'desktop', duration: 5 * 3600, overlap: 0 },
      { host: 'laptop', duration: 2 * 3600, overlap: 3600 },
    ]);
    expect(out[0].duration + out[1].duration).toBe(7 * 3600);
  });

  test('no overlap: each host keeps its own raw duration', () => {
    // Two devices active in disjoint time intervals: union equals the sum.
    const out = hostDurationBreakdown(['desktop', 'laptop'], [3600, 7200], [3600, 3600]);
    expect(out).toEqual([
      { host: 'desktop', duration: 3600, overlap: 0 },
      { host: 'laptop', duration: 3600, overlap: 0 },
    ]);
  });

  test('fully overlapped later host gets no credited time, all raw time is overlap', () => {
    // Every second of the laptop timeline is already covered by the desktop.
    const out = hostDurationBreakdown(
      ['desktop', 'laptop'],
      [5 * 3600, 5 * 3600],
      [5 * 3600, 3600]
    );
    expect(out).toEqual([
      { host: 'desktop', duration: 5 * 3600, overlap: 0 },
      { host: 'laptop', duration: 0, overlap: 3600 },
    ]);
  });

  test('single device: its own duration is the credited share, overlap is zero', () => {
    const out = hostDurationBreakdown(['desktop'], [4200], [4200]);
    expect(out).toEqual([{ host: 'desktop', duration: 4200, overlap: 0 }]);
  });

  test('returns nothing when the durations do not match the hosts', () => {
    expect(hostDurationBreakdown(['a', 'b'], undefined, undefined)).toEqual([]);
    expect(hostDurationBreakdown(['a', 'b'], [1], [1])).toEqual([]);
    expect(hostDurationBreakdown(['a', 'b'], [1, 2, 3], [1, 2])).toEqual([]);
  });

  test('missing raw durations fall back to the credited duration, with no overlap', () => {
    const out = hostDurationBreakdown(['a', 'b'], [100, 180], undefined);
    expect(out).toEqual([
      { host: 'a', duration: 100, overlap: 0 },
      { host: 'b', duration: 80, overlap: 0 },
    ]);
  });

  test('negative cumulative deltas at a cross-boundary chunk are clamped to zero', () => {
    // A noisy chunk can leave cumulative[i] below cumulative[i - 1]; the
    // credited share must not go negative, and the whole own duration counts
    // as overlap.
    const out = hostDurationBreakdown(['a', 'b'], [1000, 800], [1000, 500]);
    expect(out).toEqual([
      { host: 'a', duration: 1000, overlap: 0 },
      { host: 'b', duration: 0, overlap: 500 },
    ]);
  });

  test('missing entries are treated as zero', () => {
    const out = hostDurationBreakdown(['a', 'b'], [undefined as any, 300], [undefined as any, 300]);
    expect(out).toEqual([
      { host: 'a', duration: 0, overlap: 0 },
      { host: 'b', duration: 300, overlap: 0 },
    ]);
  });
});

test('period chunks sum per-host durations element-wise', () => {
  const merged = mergeFullDesktopResults([
    { window: { host_cumulative_durations: [10, 15], host_raw_durations: [10, 8] } },
    { window: { host_cumulative_durations: [4, 6], host_raw_durations: [4, 2] } },
  ] as any);
  expect(merged.window.host_cumulative_durations).toEqual([14, 21]);
  expect(merged.window.host_raw_durations).toEqual([14, 10]);
});

test('period chunks without per-host durations stay undefined', () => {
  const merged = mergeFullDesktopResults([
    { window: { duration: 5 } },
    { window: { duration: 7 } },
  ] as any);
  expect(merged.window.host_cumulative_durations).toBeUndefined();
  expect(merged.window.host_raw_durations).toBeUndefined();
});

test('multideviceQuery returns cumulative and raw per-host durations', () => {
  const q = multideviceQuery({
    categories: [],
    filter_categories: [],
    filter_afk: true,
    hosts: ['a', 'b'],
    host_params: {},
  } as any).join('\n');
  expect(q).toContain('host_cumulative_0 = sum_durations(events);');
  expect(q).toContain('host_raw_0 = sum_durations(events_a_0);');
  expect(q).toContain('host_cumulative_1 = sum_durations(events);');
  expect(q).toContain('host_raw_1 = sum_durations(events_b_1);');
  expect(q).toContain('"host_cumulative_durations": [host_cumulative_0, host_cumulative_1]');
  expect(q).toContain('"host_raw_durations": [host_raw_0, host_raw_1]');
});

// Sanity: the exported type is a HostDuration[]-shaped row.
const _typeCheck: HostDuration = { host: 'h', duration: 1, overlap: 0 };
void _typeCheck;
