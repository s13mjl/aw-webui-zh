<template lang="pug">
div.timeline-event-list
  table.table.table-sm.table-hover.mb-2
    thead
      tr
        th {{ $t('eventEditor.start') }}
        th {{ $t('eventEditor.end') }}
        th.text-right {{ $t('eventEditor.duration') }}
        th {{ $t('eventEditor.bucket') }}
        th {{ $t('timeline.eventTitle') }}
    tbody
      tr(v-for="row in visibleRows", :key="row.key")
        // ≤/≥: clipped to the selected range, the event extends beyond it
        td.text-nowrap {{ row.clippedStart ? '≤ ' : '' }}{{ formatTime(row.start) }}
        td.text-nowrap {{ row.clippedEnd ? '≥ ' : '' }}{{ formatTime(row.end) }}
        td.text-nowrap.text-right
          | {{ row.clippedStart || row.clippedEnd ? '≥ ' : '' }}{{ formatDuration(row.duration) }}
        td.text-nowrap
          | {{ row.bucketId }}
          small.text-muted.ml-1(v-if="row.hostname") ({{ row.hostname }})
        td.timeline-event-list__title
          b(v-if="row.label") {{ row.label }}
          span.text-muted(v-if="row.detail")
            | {{ row.label ? ' — ' : '' }}{{ row.detail }}
  div.d-flex.align-items-center
    small.text-muted.mr-2 {{ $t('timeline.listShowing', { shown: visibleRows.length, total: rows.length }) }}
    b-button(v-if="visibleRows.length < rows.length", size="sm", variant="outline-secondary", @click="showMore")
      | {{ $t('timeline.showMore') }}
</template>

<script lang="ts">
import moment from 'moment';
import { seconds_to_duration } from '~/util/time';
import { timelineListRows, TIMELINE_LIST_PAGE_SIZE } from '~/util/timelineList';

// Read-only chronological list of the same filtered buckets the Timeline renders.
export default {
  name: 'aw-timeline-event-list',
  props: {
    buckets: { type: Array, default: null },
    // The queried [start, end]; rows touching it are marked as clipped.
    range: { type: Array, default: null },
  },
  data() {
    return { limit: TIMELINE_LIST_PAGE_SIZE };
  },
  computed: {
    rows() {
      return timelineListRows(this.buckets, this.range);
    },
    visibleRows() {
      return this.rows.slice(0, this.limit);
    },
  },
  watch: {
    buckets() {
      this.limit = TIMELINE_LIST_PAGE_SIZE;
    },
  },
  methods: {
    showMore() {
      this.limit += TIMELINE_LIST_PAGE_SIZE;
    },
    formatTime(ms: number) {
      return moment(ms).format('YYYY-MM-DD HH:mm:ss');
    },
    formatDuration(seconds: number) {
      return seconds_to_duration(seconds);
    },
  },
};
</script>

<style scoped>
.timeline-event-list__title {
  word-break: break-word;
}
</style>
