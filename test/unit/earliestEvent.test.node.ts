import { IBucket } from '~/util/interfaces';
import { earliestEventInBucket, rangeCoveringEarliest } from '~/util/earliestEvent';

function bucket(metadata?: { start: Date; end: Date }): IBucket {
  return {
    id: 'aw-watcher-test_host',
    hostname: 'host',
    device_id: 'device',
    type: 'test',
    data: {},
    metadata,
  };
}

describe('earliestEventInBucket', () => {
  test('uses metadata.start without querying events', async () => {
    const getEvents = jest.fn();
    const earliest = await earliestEventInBucket(
      bucket({ start: new Date('2023-05-10T08:00:00Z'), end: new Date() }),
      getEvents
    );
    expect(earliest?.toISOString()).toBe('2023-05-10T08:00:00.000Z');
    expect(getEvents).not.toHaveBeenCalled();
  });

  test('returns null for an empty bucket', async () => {
    const earliest = await earliestEventInBucket(bucket(), jest.fn().mockResolvedValue([]));
    expect(earliest).toBeNull();
  });
});

describe('rangeCoveringEarliest', () => {
  const range = { start: '2025-03-14T00:00:00.000Z', end: '2026-10-07T00:00:00.000Z' };

  test('widens the start to an earlier first event (#1077)', () => {
    const res = rangeCoveringEarliest(range, new Date('2023-05-10T08:00:00Z'));
    expect(res).toEqual({ start: '2023-05-10T08:00:00.000Z', end: range.end });
  });

  test('keeps the range when the first event is inside it', () => {
    expect(rangeCoveringEarliest(range, new Date('2025-06-01T00:00:00Z'))).toBe(range);
  });

  test('keeps the range for an empty bucket', () => {
    expect(rangeCoveringEarliest(range, null)).toBe(range);
  });
});
