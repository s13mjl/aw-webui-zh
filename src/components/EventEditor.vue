<template lang="pug">
b-modal(v-if="event && event.id", :id="'edit-modal-' + event.id", ref="eventEditModal", :title="$t('eventEditor.title')", centered, hide-footer)
  div(v-if="!draftReady")
    | {{ $t('eventEditor.loading') }}

  div(v-else)
    table(style="width: 100%")
      tr
        th {{ $t('eventEditor.bucket') }}
        td {{ bucket_id }}
      tr
        th {{ $t('eventEditor.id') }}
        td {{ event.id }}
      tr
        th {{ $t('eventEditor.start') }}
        datetime(type="datetime" v-model="start")
      tr
        th {{ $t('eventEditor.end') }}
        datetime(type="datetime" v-model="end")
      tr
        th {{ $t('eventEditor.duration') }}
        td {{ $filters.friendlyduration(editedEvent.duration) }}

    hr

    table(style="width: 100%")
      tr
        th {{ $t('eventEditor.key') }}
        th {{ $t('eventEditor.value') }}
      tr(v-for="(v, k) in editedEvent.data" :key="k")
        td
          b-input(disabled, :value="k", size="sm")
        td
          b-checkbox(v-if="typeof event.data[k] === typeof true", v-model="editedEvent.data[k]", style="margin: 0.25em")
          b-input(v-if="typeof event.data[k] === typeof 'string'", v-model="editedEvent.data[k]", size="sm")
          b-input(v-if="typeof event.data[k] === 'number'", v-model.number="editedEvent.data[k]", size="sm", type="number")

    hr

    div.float-left
      b-button.mx-1(@click="delete_(); close();" variant="danger")
        icon.mx-1(name="trash")
        | {{ $t('eventEditor.delete') }}
    div.float-right
      b-button.mx-1(@click="close")
        icon.mx-1(name="times")
        | {{ $t('eventEditor.cancel') }}
      b-button.mx-1(@click="save(); close();", variant="primary")
        icon.mx-1(name="save")
        | {{ $t('eventEditor.save') }}
</template>

<style lang="scss"></style>

<script lang="ts">
// This EventEditor can be used to edit events in a specific bucket.
//
// It is used in:
//  - Stopwatch
//  - Bucket viewer
//  - Timeline (on event-click)
//  - Search (soon)

import moment from 'moment';
import _ from 'lodash';

export default {
  name: 'EventEditor',
  props: {
    event: { type: Object },
    bucket_id: { type: String, required: true },
  },
  // The template root is a v-if <b-modal>, i.e. a fragment root — without the
  // emits declaration, Vue 3 cannot auto-inherit the save/delete listeners.
  emits: ['save', 'saved', 'delete', 'deleted', 'close'],
  data() {
    return {
      editedEvent: null,
      // The draft belongs to one selection (bucket + event id + object instance).
      // Loading a different selection must never let a stale draft be edited or
      // submitted, and a late load/response must not overwrite the current one.
      draftIdentity: null,
      draftSource: null,
      loadSequence: 0,
      disposed: false,
    };
  },
  computed: {
    selectionIdentity() {
      return this.bucket_id && this.event && this.event.id
        ? JSON.stringify([this.bucket_id, this.event.id])
        : null;
    },
    // Object replacement is a new editing session even for the same bucket/id
    // (e.g. reopening a timeline event after cancelling its draft).
    selectionSource() {
      return { identity: this.selectionIdentity, event: this.event };
    },
    draftReady() {
      return (
        this.editedEvent !== null &&
        this.draftIdentity === this.selectionIdentity &&
        this.draftSource === this.event
      );
    },
    start: {
      get: function () {
        return moment(this.editedEvent.timestamp).format();
      },
      set: function (dt) {
        // Duration needs to be set first since otherwise the computed for end will use the new timestamp
        this.editedEvent.duration = moment(this.end).diff(dt, 'seconds');
        this.editedEvent.timestamp = new Date(dt);
      },
    },
    end: {
      get: function () {
        const end = moment(this.editedEvent.timestamp).add(this.editedEvent.duration, 'seconds');
        return end.format();
      },
      set: function (dt) {
        this.editedEvent.duration = moment(dt).diff(this.editedEvent.timestamp, 'seconds');
      },
    },
  },
  watch: {
    selectionSource() {
      // React to bucket and event changes (including a replacement object with
      // the same id); getEvent guards against late responses itself.
      this.getEvent();
    },
  },
  mounted: async function () {
    await this.getEvent();
  },
  beforeUnmount() {
    // Invalidate any pending load or mutation when the editor goes away.
    this.disposed = true;
    this.loadSequence++;
  },
  methods: {
    async save() {
      // Only a draft owned by the current selection may be submitted; a stale
      // draft after navigation/reopen must not mutate another event.
      if (!this.draftReady || this.disposed) return;
      // Capture before any async suspension: another selection can change
      // this.editedEvent or this.bucket_id while replaceEvent is in-flight.
      const savedEvent = _.cloneDeep(this.editedEvent);
      const savedBucketId = this.bucket_id;
      // This emit needs to be called first, otherwise it won't occur for some reason
      // FIXME: but what if the replace fails? Then UI will incorrectly think event was replaced?
      this.$emit('save', savedEvent);
      await this.$aw.replaceEvent(savedBucketId, savedEvent);
      this.$emit('saved', savedEvent, savedBucketId);
    },
    async delete_() {
      if (!this.draftReady || this.disposed) return;
      // This emit needs to be called first, otherwise it won't occur for some reason
      // FIXME: but what if the replace fails? Then UI will incorrectly think event was deleted?
      const deletedEvent = _.cloneDeep(this.event);
      const deletedBucketId = this.bucket_id;
      this.$emit('delete', deletedEvent);
      await this.$aw.deleteEvent(deletedBucketId, deletedEvent.id);
      this.$emit('deleted', deletedEvent, deletedBucketId);
    },
    async getEvent() {
      const source = this.selectionSource;
      const identity = source.identity;
      const sequence = ++this.loadSequence;
      // Clear the old draft immediately so it can never be edited/submitted
      // while the new selection's event is loading.
      this.editedEvent = null;
      this.draftIdentity = null;
      this.draftSource = null;
      if (!identity || this.disposed) return;
      const bucketId = this.bucket_id;
      const eventId = source.event.id;
      const stillSelected = () =>
        !this.disposed && this.selectionSource === source && this.loadSequence === sequence;
      const event = await this.$aw.getEvent(bucketId, eventId);
      if (stillSelected()) {
        this.editedEvent = event;
        this.draftIdentity = identity;
        this.draftSource = source.event;
      }
    },
    close() {
      this.$refs.eventEditModal.hide();
      this.$emit('close', this.event);
    },
  },
};
</script>
