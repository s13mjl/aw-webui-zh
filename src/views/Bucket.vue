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
      tr
        th {{ $t('bucket.data') }}
        td {{ bucket.data }}

    input-timeinterval(v-model="daterange", :maxDuration="maxDuration")

    vis-timeline(:buckets="[bucket_with_events]", :showRowLabels="false")

    aw-eventlist(:bucket_id="id", @save="updateEvent", :events="events" editable=true)
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
      const bucket = await this.bucketsStore.getBucketWithEvents({
        id: bucket_id,
        start: this.daterange[0].format(),
        end: this.daterange[1].format(),
      });
      this.events = bucket.events;
    },
    getEventCount: async function (bucket_id) {
      const count = await getClient().countEvents(bucket_id);
      // aw-client already unwraps the response body, except that 0.3.x returns the
      // raw response when the body is falsy (a count of 0).
      this.eventcount = typeof count === 'number' ? count : count.data;
    },
    updateEvent: function (event) {
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
