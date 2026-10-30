<template lang="pug">
div
  div.d-flex.flex-wrap.align-items-center.px-3.py-2.stopwatch-entry
    div.flex-fill.mr-2
      span #[b {{event.data.label || $t('stopwatchEntry.noLabel')}}]
      span.text-muted &nbsp;|&nbsp;
      span(v-if="event.data.running")
        | {{ $t('stopwatchEntry.runningFor') }} #[span(:title="event.timestamp") {{ $filters.friendlyduration(event.data.running ? (now - event.timestamp) / 1000 : event.duration) }}]
        | &nbsp;{{ $t('stopwatchEntry.startedAt', { time: $filters.shorttime(event.timestamp) }) }}
      span(v-else)
        | {{ $t('stopwatchEntry.started') }} #[span(:title="event.timestamp") {{ $filters.friendlytime(event.timestamp) }}]
        | &nbsp;({{ $filters.friendlyduration(event.data.running ? (now - event.timestamp) / 1000 : event.duration) }})
    div.stopwatch-entry__actions
      b-button.mx-1(v-if="event.data.running", @click="stop", variant="outline-primary", size="sm")
        icon.ml-0.mr-1(name="stop")
        | {{ $t('stopwatchEntry.stop') }}
      b-button.mx-1(v-if="!event.data.running", @click="$emit('new')", variant="outline-primary", size="sm")
        icon.ml-0.mr-1(name="play")
        | {{ $t('stopwatchEntry.startNew') }}
      b-button.mx-1(v-b-modal="'edit-modal-' + event.id", variant="outline-dark", size="sm")
        icon.ml-0.mr-1(name="edit")
        | {{ $t('stopwatchEntry.edit') }}
  event-editor(:event="event", :bucket_id="bucket_id", @save="save", @delete="delete_")
</template>

<style scoped lang="scss">
.stopwatch-entry {
  border-bottom: 1px solid #eee;
}

.stopwatch-entry:hover {
  background-color: #f8f9fa;
}

.stopwatch-entry__actions {
  display: flex;
  flex-wrap: nowrap;
}
</style>

<script lang="ts">
import moment from 'moment';

import EventEditor from './EventEditor.vue';

export default {
  name: 'StopwatchEntry',
  components: {
    'event-editor': EventEditor,
  },
  props: {
    event: Object,
    bucket_id: String,
    now: {
      type: moment,
      default: moment(),
    },
  },
  methods: {
    stop: async function () {
      const new_event = JSON.parse(JSON.stringify(this.event));
      new_event.data.running = false;
      new_event.duration = moment().diff(moment(new_event.timestamp)) / 1000;
      await this.$aw.replaceEvent(this.bucket_id, new_event);
      this.$emit('update', new_event);
    },
    save: async function (new_event) {
      this.$emit('update', new_event);
    },
    delete_: async function (new_event) {
      this.$emit('delete', new_event);
    },
  },
};
</script>
