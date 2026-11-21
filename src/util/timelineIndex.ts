import type { IBucket, IEvent } from './interfaces';

export interface IndexedEvent {
  id: string;
  bucket: IBucket;
  event: IEvent;
  start: number;
  end: number;
  members?: IndexedEvent[];
}

type BucketWithEvents = IBucket & { events?: IEvent[] };

/**
 * Group consecutive short events within a single bucket into composite
 * entries. Ported from upstream aw-webui PR #1181.
 *
 * - Invalid intervals (non-finite end, non-positive duration) split runs and
 *   are never rendered.
 * - Events at least as long as the threshold stay on their own.
 * - A gap of 1ms or more splits a run; sub-millisecond differences are
 *   treated as adjacent (Date loses sub-millisecond precision).
 * - A run flushes once its span reaches the threshold in milliseconds.
 */
function groupTimelineEntries(entries: IndexedEvent[], threshold: number): IndexedEvent[] {
  const grouped: IndexedEvent[] = [];
  let members: IndexedEvent[] = [];
  const flush = () => {
    if (members.length > 1) {
      const first = members[0];
      grouped.push({
        ...first,
        id: JSON.stringify([first.bucket.id, 'group', members.map(item => item.id)]),
        event: {
          ...first.event,
          duration: members.reduce((total, item) => total + item.event.duration, 0),
          data: {},
        },
        end: members[members.length - 1].end,
        members,
      });
    } else if (members.length) {
      grouped.push(members[0]);
    }
    members = [];
  };
  // Process barriers before valid intervals at the same timestamp.
  entries.sort(
    (a, b) =>
      a.start - b.start ||
      Number(a.event.duration > 0 && Number.isFinite(a.end)) -
        Number(b.event.duration > 0 && Number.isFinite(b.end))
  );
  for (const item of entries) {
    // Invalid intervals still split runs, even though they cannot be rendered.
    if (!Number.isFinite(item.end) || item.event.duration <= 0) {
      flush();
      continue;
    }
    if (item.event.duration >= threshold) {
      flush();
      grouped.push(item);
      continue;
    }
    // Date truncates microsecond timestamps to milliseconds, while durations
    // retain their precision. Treat differences below that resolution as adjacent.
    if (members.length && Math.abs(item.start - members[members.length - 1].end) >= 1) flush();
    members.push(item);
    if (item.end - members[0].start >= threshold * 1000) flush();
  }
  flush();
  return grouped;
}

export function indexTimelineEvents(
  buckets: BucketWithEvents[],
  filterShort: boolean | ((bucket: BucketWithEvents) => boolean) = true,
  displayEvent: (bucketId: string, event: IEvent) => IEvent = (_bucketId, event) => event,
  groupingSeconds: number | ((bucket: BucketWithEvents) => number) = 0,
  expandedGroups: readonly string[] = []
): { entries: IndexedEvent[] } {
  const entries: IndexedEvent[] = [];
  const expanded = expandedGroups.length ? new Set(expandedGroups) : undefined;
  for (const bucket of buckets) {
    const dropShort = typeof filterShort === 'function' ? filterShort(bucket) : filterShort;
    const threshold =
      typeof groupingSeconds === 'function' ? groupingSeconds(bucket) : groupingSeconds;
    const group = Number.isFinite(threshold) && threshold > 0;
    const bucketEntries: IndexedEvent[] = group ? [] : entries;
    let invalidTimestamp = false;
    (bucket.events || []).forEach((sourceEvent, index) => {
      const event = displayEvent(bucket.id, sourceEvent);
      if (dropShort && event.duration <= 1) return;
      const start = new Date(event.timestamp).getTime();
      const end = start + event.duration * 1000;
      if (!Number.isFinite(start)) {
        invalidTimestamp = true;
        return;
      }
      if (!group && !Number.isFinite(end)) return;
      bucketEntries.push({
        id: JSON.stringify([bucket.id, event.id ?? [event.timestamp, index]]),
        bucket,
        event,
        start,
        end,
      });
    });
    if (!group) continue;
    // An invalid timestamp cannot be placed safely between chronological members.
    const grouped = !invalidTimestamp
      ? groupTimelineEntries(bucketEntries, threshold)
      : bucketEntries.filter(item => Number.isFinite(item.end) && item.event.duration > 0);
    for (const item of grouped) {
      if (item.members && expanded?.has(item.id)) {
        for (const member of item.members) entries.push(member);
      } else {
        entries.push(item);
      }
    }
  }
  entries.sort((a, b) => a.start - b.start);
  return { entries };
}
