import { earliestEventInBucket, earliestEventInBuckets } from '~/util/earliestEvent';
import { IBucket } from '~/util/interfaces';

function makeBucket(overrides: Partial<IBucket> = {}): IBucket {
  return {
    id: 'aw-watcher-window_testhost',
    type: 'currentwindow',
    hostname: 'testhost',
    data: {},
    created: null,
    first_seen: null,
    last_updated: null,
    metadata: null,
    ...overrides,
  } as IBucket;
}

describe('earliestEventInBucket', () => {
  test('uses metadata.start when present (aw-server-rust)', async () => {
    const bucket = makeBucket({
      metadata: { start: '2026-03-01T08:30:00Z', color: null, icon: null },
    });
    const getEvents = jest.fn();
    const result = await earliestEventInBucket(bucket, getEvents);
    expect(result!.toISOString()).toBe('2026-03-01T08:30:00.000Z');
    expect(getEvents).not.toHaveBeenCalled();
  });

  test('returns null for an empty bucket', async () => {
    const getEvents = jest.fn(async () => []);
    expect(await earliestEventInBucket(makeBucket(), getEvents)).toBeNull();
    expect(getEvents).toHaveBeenCalledWith(expect.any(String), { limit: 1 });
  });

  test('bisects without reading every event and stays conservative before the first event', async () => {
    const firstEvent = '2026-02-10T12:00:00Z';
    // Simulate an indexed "latest event before t" query
    const getEvents = jest.fn(async (id, params) => {
      if (!params.end) return [{ timestamp: firstEvent }];
      const end = params.end.getTime();
      const first = new Date(firstEvent).getTime();
      return end > first ? [{ timestamp: firstEvent }] : [];
    });

    const result = await earliestEventInBucket(makeBucket(), getEvents);

    expect(result).not.toBeNull();
    // Conservative: at most a day before the first event, never after it
    expect(result!.getTime()).toBeLessThanOrEqual(new Date(firstEvent).getTime());
    expect(new Date(firstEvent).getTime() - result!.getTime()).toBeLessThan(24 * 60 * 60 * 1000);
    // Bisect used a bounded number of indexed queries, not a full event read
    expect(getEvents.mock.calls.length).toBeLessThan(20);
  });
});

describe('earliestEventInBuckets', () => {
  test('returns the earliest start across buckets', async () => {
    const buckets = [
      makeBucket({ id: 'a', metadata: { start: '2026-05-01T00:00:00Z', color: null, icon: null } }),
      makeBucket({ id: 'b', metadata: { start: '2026-02-12T00:00:00Z', color: null, icon: null } }),
    ];
    const result = await earliestEventInBuckets(buckets, jest.fn());
    expect(result!.toISOString()).toBe('2026-02-12T00:00:00.000Z');
  });

  test('returns null when all buckets are empty', async () => {
    const getEvents = jest.fn(async () => []);
    expect(await earliestEventInBuckets([makeBucket(), makeBucket()], getEvents)).toBeNull();
  });

  test('ignores empty buckets when at least one has data', async () => {
    const buckets = [
      makeBucket({ metadata: { start: '2026-01-20T00:00:00Z', color: null, icon: null } }),
      makeBucket({ id: 'empty' }),
    ];
    const getEvents = jest.fn(async () => []);
    const result = await earliestEventInBuckets(buckets, getEvents);
    expect(result!.toISOString()).toBe('2026-01-20T00:00:00.000Z');
  });
});
