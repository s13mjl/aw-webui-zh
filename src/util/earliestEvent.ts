import { IBucket } from '~/util/interfaces';

type GetEvents = (
  bucketId: string,
  params: { end?: Date; limit: number }
) => Promise<{ timestamp: string | Date }[]>;

const DAY_MS = 24 * 60 * 60 * 1000;
// Start from the Unix epoch so imported data with old timestamps is found.
const SEARCH_FLOOR = new Date(0);

/**
 * A time at most ~1 day before the earliest event in a bucket (never after it).
 *
 * aw-server-rust reports it directly as `metadata.start`. aw-server (Python)
 * has no such field, so bisect with `GET /events?end=<t>&limit=1`, which returns
 * the latest event before `t` from an indexed query. ~15 small requests per
 * bucket instead of reading every event.
 */
export async function earliestEventInBucket(
  bucket: IBucket,
  getEvents: GetEvents
): Promise<Date | null> {
  if (bucket.metadata && bucket.metadata.start) {
    return new Date(bucket.metadata.start);
  }

  const latest = await getEvents(bucket.id, { limit: 1 });
  if (latest.length === 0) return null;

  // Invariant: an event exists at or before `hi`, none before `lo`.
  let hi = new Date(latest[0].timestamp).getTime();
  let lo = SEARCH_FLOOR.getTime();
  for (let i = 0; i < 40 && hi - lo > DAY_MS; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const events = await getEvents(bucket.id, { end: new Date(mid), limit: 1 });
    if (events.length === 0) {
      lo = mid;
    } else {
      // The returned event may overlap `mid` rather than start before it.
      hi = Math.min(mid, new Date(events[0].timestamp).getTime());
    }
  }
  // `lo` has no event at or before it, so it is a conservative start (at most
  // a day before the first event) that cannot skip the first partial day.
  return new Date(lo);
}

/**
 * A query range that also covers `earliest` when it precedes `range.start`.
 * Used by All time for buckets outside the host's standard set, whose data the
 * shared All time start does not account for (#1077). Never shortens the range.
 */
export function rangeCoveringEarliest(
  range: { start: string; end: string },
  earliest: Date | null
): { start: string; end: string } {
  if (!earliest || earliest.getTime() >= new Date(range.start).getTime()) return range;
  return { start: earliest.toISOString(), end: range.end };
}
