<template lang="pug">
div
  h3 {{ id }}
  b-alert(v-if="notFound", show, variant="warning")
    | {{ $t('bucket.notFound', { id }) }} #[router-link(to="/buckets") {{ $t('bucket.seeAllBuckets') }}]
  div(v-else-if="bucket")
    table
      tr
        th {{ $t('bucket.type') }}
        td {{ bucket.type }}
      tr
        th {{ $t('bucket.client') }}
        td {{ bucket.client }}
      tr
        th {{ $t('bucket.hostname') }}
        td {{ bucket.hostname }}
      tr
        th {{ $t('bucket.created') }}
        td {{ $filters.iso8601(bucket.created) }}
      tr(v-if="bucket.metadata")
        th {{ $t('bucket.firstEvent') }}
        td
          | {{ bucket.metadata.start}} /
          | {{ bucket.metadata.end }}
      tr
        th {{ $t('bucket.eventCount') }}
        td {{ eventcount }}
      tr(v-if="bucket.data && Object.keys(bucket.data).length > 0")
        th {{ $t('bucket.data') }}
        td {{ bucket.data }}

    input-timeinterval(v-model="daterange", :maxDuration="maxDuration")

    b-alert(v-if="showingMostRecent", show, variant="info")
      | {{ $t('bucket.showingRecent', { time: $filters.friendlytime(lastEventTime), count: events.length }) }}

    vis-timeline(:buckets="[bucket_with_events]", :showRowLabels="false")

    aw-eventlist(:bucket_id="id", @save="updateEvent", @deleted="removeEvent", :events="events" editable=true)
</template>

<script lang="ts">
import { useBucketsStore } from '~/stores/buckets';
import { getClient } from '~/util/awclient';

export default {
  name: 'Bucket',
  props: {
    id: String,
  },
  data: () => {
    return {
      bucketsStore: useBucketsStore(),

      events: [],
      eventcount: '?',
      showingMostRecent: false,
      lastEventTime: null,
      // Supersede in-flight loads so a stale snapshot cannot restore a
      // confirmed-deleted row or an already-obsolete total.
      eventsRequestId: 0,
      countRequestId: 0,
      loaded: false,
      daterange: null,
      maxDuration: 31 * 24 * 60 * 60,
    };
  },
  computed: {
    bucket() {
      return this.bucketsStore.getBucket(this.id);
    },
    notFound() {
      return this.loaded && !this.bucket;
    },
    bucket_with_events() {
      return {
        ...this.bucket,
        events: this.events,
      };
    },
  },
  watch: {
    daterange: async function () {
      // Rows from the previous range must not survive a failed load for the
      // new dates; clear first so only a complete refresh repopulates them.
      this.events = [];
      await this.getEvents(this.id);
    },
  },
  mounted: async function () {
    await this.bucketsStore.ensureLoaded();
    if (!this.bucket) {
      // The cached list may predate this bucket, so refresh before calling it missing.
      await this.bucketsStore.loadBuckets();
    }
    this.loaded = true;
    if (this.bucket) {
      await this.getEventCount(this.id);
    }
  },
  methods: {
    getEvents: async function (bucket_id) {
      const requestId = ++this.eventsRequestId;
      const bucket = await this.bucketsStore.getBucketWithEvents({
        id: bucket_id,
        start: this.daterange[0].format(),
        end: this.daterange[1].format(),
      });
      if (requestId !== this.eventsRequestId) return;
      this.events = bucket.events;
      this.showingMostRecent = false;

      // 陈旧或导入的存储桶在所选区间内可能没有任何事件（上游 #136）：
      // 回退到最近的事件，避免详情页空着无从排查。
      const hasData = this.bucket.metadata && this.bucket.metadata.end;
      if (this.events.length === 0 && hasData) {
        try {
          const recent = await this.bucketsStore.getBucketWithEvents({
            id: bucket_id,
            limit: 100,
          });
          if (requestId !== this.eventsRequestId) return;
          if (recent.events.length > 0) {
            this.events = recent.events;
            // The API returns newest first.
            this.lastEventTime = recent.events[0].timestamp;
            this.showingMostRecent = true;
          }
        } catch (e) {
          console.warn('[bucket] Failed to load most recent events:', e);
        }
      }
    },
    getEventCount: async function (bucket_id) {
      const requestId = ++this.countRequestId;
      const count = await getClient().countEvents(bucket_id);
      if (requestId !== this.countRequestId) return;
      // aw-client already unwraps the response body, except that 0.3.x returns the
      // raw response when the body is falsy (a count of 0).
      this.eventcount = typeof count === 'number' ? count : count.data;
    },
    removeEvent: async function (event, bucketId) {
      // A confirmed deletion only concerns its owning bucket, even if the view
      // has since navigated elsewhere (late confirmation).
      if (bucketId !== this.id) return;
      this.events = this.events.filter(e => e.id !== event.id);
      // A pre-delete count response may already include this deletion; only a
      // fresh authoritative count is trustworthy.
      this.eventcount = '?';
      // Supersede pre-delete loads, then refresh the current range and total.
      // Keep the local removal if refreshing fails — the server already committed it.
      await Promise.all([
        this.daterange ? this.getEvents(bucketId) : null,
        this.getEventCount(bucketId),
      ]).catch(e => console.warn('[bucket] Failed to refresh after deletion:', e));
    },
    updateEvent: function (event) {
      // A refresh started before this save may carry old data; supersede it so
      // it cannot replace the confirmed edit.
      this.eventsRequestId++;
      const i = this.events.findIndex(e => e.id == event.id);
      if (i != -1) {
        // This is needed instead of this.events[i] because insides of arrays
        // are not reactive in Vue.
        this.events[i] = event;
      } else {
        console.error(':(');
      }
    },
  },
};
</script>
