<template lang="pug">
div
  h3 {{ $t('buckets.title') }}

  b-card.bucket-card.mb-3(
    v-for="(device, deviceKey) in bucketsStore.bucketsByDevice",
    :key="deviceKey",
    :class="{'bucket-card--unknown': device.hostname === 'unknown'}"
  )
    div.d-flex.justify-content-between.align-items-start.mb-2
      div.d-flex.align-items-center
        icon.mr-2.text-muted(v-if="device.hostname === 'unknown'" name="question" scale="1.2")
        icon.mr-2.text-secondary(v-else-if="bucketsStore.available(device.hostname).android" name="mobile" scale="1.2")
        icon.mr-2.text-secondary(v-else name="desktop" scale="1.2")
        div
          span.font-weight-bold {{ device.hostname }}
          b-badge.ml-2(v-if="serverStore.info && serverStore.info.hostname == device.hostname" variant="info") {{ $t('buckets.thisDevice') }}
          div.small.text-muted(v-if="device.identityAmbiguous")
            | {{ $t('common.id') }} {{ device.device_id ? device.device_id : $t('common.unknown') }}
          div.small(v-if="deviceHasEvents(device)")
            span.text-muted {{ $t('buckets.lastUpdatedInline') }}&nbsp;
            time(:class="{'text-success': isRecent(device.last_updated)}",
                 :datetime="device.last_updated",
                 :title="device.last_updated")
              | {{ $filters.friendlytime(device.last_updated) }}
          div.small.text-muted(v-else)
            | {{ $t('buckets.noEventsYet') }}
      b-dropdown.kebab-dropdown(
        size="sm",
        variant="outline-secondary",
        toggle-class="border-0",
        no-caret,
        right,
        boundary="window",
        :title="$t('buckets.moreActionsFor', { hostname: device.hostname })",
        :aria-label="$t('buckets.moreActionsFor', { hostname: device.hostname })"
      )
        template(v-slot:button-content)
          icon(name="ellipsis-v")
        b-dropdown-item-button(
          @click="openDeleteHostModal(device)",
          button-class="text-danger",
          :title="$t('buckets.deleteAllTitle', { count: device.buckets.length, hostname: device.hostname })"
        )
          icon.mr-1(name="trash")
          | {{ $t('buckets.deleteAllForHost') }}

    b-table.mb-0.bucket-table(
      small, hover,
      :items="device.buckets",
      :fields="fields",
      :empty-text="$t('common.noRecords')"
    )
      template(v-slot:cell(id)="data")
        small.text-monospace.bucket-id(:title="data.item.id") {{ data.item.id }}
      template(v-slot:cell(last_updated)="data")
        small(v-if="bucketHasEvents(data.item)", :class="{'text-success': isRecent(data.item.last_updated)}")
          | {{ $filters.friendlytime(data.item.last_updated) }}
        small.text-muted(v-else) {{ $t('buckets.noEvents') }}
      template(v-slot:cell(actions)="data")
        b-button-group(size="sm")
          b-button(variant="primary", :to="'/buckets/' + data.item.id", :title="$t('buckets.openBucket')")
            icon.d-none.d-md-inline-block.mr-1(name="folder-open")
            | {{ $t('common.open') }}
          b-dropdown.kebab-dropdown(variant="outline-secondary", toggle-class="border-0", size="sm", right, no-caret, boundary="window", :title="$t('common.more')")
            template(v-slot:button-content)
              icon(name="ellipsis-v")
            b-dropdown-item(@click="export_bucket_json(data.item.id)", :title="$t('buckets.exportBucketJson')")
              icon.mr-1(name="download")
              | {{ $t('buckets.exportBucketJson') }}
            b-dropdown-item(@click="export_csv(data.item.id)", :title="$t('buckets.exportEventsCsv')")
              icon.mr-1(name="download")
              | {{ $t('buckets.exportEventsCsv') }}
            b-dropdown-divider
            b-dropdown-item-button(@click="openDeleteBucketModal(data.item.id)", :title="$t('buckets.deleteBucket')", button-class="text-danger")
              icon.mr-1(name="trash")
              | {{ $t('buckets.deleteBucket') }}

    div(v-for="msg in runChecks(device)" :key="msg")
      b-alert.mt-2.mb-0.py-1.px-2.small(show variant="warning")
        icon(name="exclamation-triangle")
        | &nbsp;
        | {{ msg }}

  b-modal(id="delete-modal", :title="$t('buckets.deleteBucketTitle')", centered, hide-footer)
    | {{ $t('buckets.deleteConfirm', { id: delete_bucket_selected }) }}
    br
    br
    b {{ $t('buckets.deletePermanent') }}
    hr
    div.float-right
      b-button.mx-2(@click="$hideModal('delete-modal')")
        | {{ $t('common.cancel') }}
      b-button(@click="deleteBucket(delete_bucket_selected)", variant="danger")
        | {{ $t('common.confirm') }}

  b-modal(id="delete-host-modal", :title="deleteHostModalTitle", centered, hide-footer, @hidden="delete_host_selected = null; delete_host_error = null")
    template(v-if="delete_host_selected")
      | {{ $t('buckets.deleteHostConfirmPrefix') }}
      |
      b {{ $t('buckets.deleteHostConfirmCount', { count: delete_host_selected.bucketCount }) }}
      |
      | {{ $t('buckets.deleteHostConfirmSuffix', { hostname: delete_host_selected.hostname }) }}
      br
      br
      b {{ $t('buckets.deletePermanent') }}
      div.small.text-muted.mt-2(style="max-height: 200px; overflow-y: auto;")
        | {{ $t('buckets.bucketsToDelete') }}
        ul.mb-0
          li(v-for="bucketId in delete_host_selected.bucketIds", :key="bucketId")
            code {{ bucketId }}
      b-alert.mt-2(v-if="delete_host_error" show variant="danger")
        | {{ delete_host_error }}
      hr
      div.float-right
        b-button.mx-2(@click="$hideModal('delete-host-modal')")
          | {{ $t('common.cancel') }}
        b-button(@click="deleteBucketsForSelectedHost()",
                 :disabled="deleting_host",
                 variant="danger")
          template(v-if="deleting_host")
            | {{ $t('buckets.deleting') }}
          template(v-else)
            | {{ $t('common.confirm') }}

  h4.mt-4 {{ $t('buckets.importExportTitle') }}

  b-card-group.deck
    b-card(:header="$t('buckets.importBuckets')")
      b-alert(v-if="import_error" show variant="danger" dismissible)
        | {{ import_error }}
      b-alert(v-if="import_success" show variant="success" dismissible)
        | {{ import_success }}
      b-form-file(:value="import_file"
                  @input="onImportFile"
                  :placeholder="$t('buckets.importPlaceholder')"
                  :drop-placeholder="$t('buckets.importDrop')"
                  :browse-text="$t('common.browseFiles')")
      div.mt-2(v-if="import_file")
        b-spinner.mr-2(small)
        small.text-muted {{ $t('buckets.importing') }}
      small.d-block.mt-2.text-muted
        | {{ $t('buckets.importHelpNew') }}
    b-card(:header="$t('buckets.exportBuckets')")
      p.small.text-muted {{ $t('buckets.exportHelp') }}
      b-button(@click="export_all_buckets_json()",
               :title="$t('buckets.exportAllJson')",
               variant="outline-secondary")
        icon.mr-1(name="download")
        | {{ $t('buckets.exportAllJson') }}

  hr

  b-alert(show)
    | {{ $t('buckets.moreWatchers') }} #[a(href="https://docs.activitywatch.net/en/latest/watchers.html") {{ $t('buckets.docsLink') }}].

  aw-devonly(:reason="$t('buckets.devReason')")
    h4.p-2 {{ $t('buckets.tools') }}

    hr

    aw-bucket-validate.p-2

    hr

    aw-bucket-merge.p-2
</template>

<style lang="scss">
.bucket-card {
  .card-header,
  .card-footer {
    padding: 0.5em 0.75em 0.5em 0.75em;
  }

  .card-body {
    padding: 0.5em;
  }
}
</style>

<style scoped lang="scss">
.bucket-card {
  margin-bottom: 1em;
}

// No `opacity` here: opacity < 1 makes the card a stacking context, which
// traps its dropdown menus underneath the cards below it.
.bucket-card--unknown {
  background: #fbfbfb;
}

.bucket-table {
  table-layout: fixed;
}

::v-deep .bucket-table td {
  vertical-align: middle;
}

::v-deep .bucket-id {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}

::v-deep .kebab-dropdown > .btn {
  color: #6c757d;
  background: transparent;
}

::v-deep .kebab-dropdown > .btn:hover,
::v-deep .kebab-dropdown > .btn:focus,
::v-deep .kebab-dropdown.show > .btn {
  background: #f0f1f3;
  color: #212529;
}

.bucket-last-updated {
  color: #666;
}
</style>

<script lang="ts">
import { defineAsyncComponent } from 'vue';

import _ from 'lodash';
import Papa from 'papaparse';
import moment from 'moment';

import { useServerStore } from '~/stores/server';
import { useBucketsStore } from '~/stores/buckets';
import { downloadFile } from '~/util/export';
import { exportBucketLong, exportAllBucketsLong, LONG_TIMEOUT_MS } from '~/util/awclient';

// Kept outside component methods on purpose: the global asyncErrorCapturedMixin
// wraps every async method so its rejection is swallowed and reported to the
// ErrorBoundary. A wrapped import would never reject in onImportFile's catch,
// so a failed import would still show a success alert.
async function importBuckets(aw, importFile) {
  const formData = new FormData();
  formData.append('buckets.json', importFile);
  const headers = { 'Content-Type': 'multipart/form-data' };
  return aw.req.post('/0/import', formData, { headers });
}

// Like importBuckets, keep rejection observable by the caller's local catch.
async function reconcileHostDeletion(vm, selection) {
  if (!selection.reconcileIds.length) return;
  // ID-only DELETE acknowledgements cannot identify the incarnation removed,
  // so reload the catalogue and compare creation timestamps before dropping
  // an acknowledgement (a bucket with the same id may have been recreated).
  await vm.bucketsStore.loadBuckets();
  selection.bucketIds = selection.bucketIds.filter(id => {
    if (!selection.reconcileIds.includes(id)) return true;
    const bucket = vm.bucketsStore.getBucket(id);
    return bucket && bucket.created?.valueOf() === selection.bucketCreated[id];
  });
  selection.bucketCount = selection.bucketIds.length;
  vm.delete_host_reconcile_ids = vm.delete_host_reconcile_ids.filter(
    id => !selection.reconcileIds.includes(id)
  );
  selection.reconcileIds = [];
}

export default {
  name: 'Buckets',
  components: {
    'aw-bucket-merge': defineAsyncComponent(() => import('~/components/BucketMerge.vue')),
    'aw-bucket-validate': defineAsyncComponent(() => import('~/components/BucketValidate.vue')),
  },
  data() {
    return {
      moment,
      bucketsStore: useBucketsStore(),
      serverStore: useServerStore(),

      import_file: null,
      // A selection owns its outcome: a late result from a previous file must
      // not overwrite the success/error state of the current selection.
      import_request_id: 0,
      import_error: null,
      import_success: null,
      delete_bucket_selected: null,
      delete_host_selected: null,
      deleting_host: false,
      delete_host_error: null,
      // DELETE acknowledgements that still need reconciling with the catalogue;
      // they survive modal dismissal so a confirmed deletion is never retried.
      delete_host_reconcile_ids: [],
    };
  },
  computed: {
    fields() {
      return [
        {
          key: 'id',
          label: this.$t('buckets.bucketId'),
          sortable: true,
          thStyle: { width: '65%' },
        },
        {
          key: 'last_updated',
          label: this.$t('buckets.updated'),
          sortable: true,
          thStyle: { width: '20%' },
        },
        {
          key: 'actions',
          label: '',
          thStyle: { width: '15%' },
          tdClass: 'text-right',
        },
      ];
    },
    deleteHostModalTitle() {
      if (this.delete_host_selected) {
        return this.$t('buckets.deleteHostTitleNamed', {
          hostname: this.delete_host_selected.hostname,
        });
      }
      return this.$t('buckets.deleteHostTitle');
    },
  },
  mounted: async function () {
    await this.bucketsStore.loadBuckets();
  },
  methods: {
    async onImportFile(importFile) {
      // BFormFile emits null again when our completed selection resets it.
      // Preserve that outcome, but handle user selection/clear events now.
      if (importFile === this.import_file) return;
      const requestId = ++this.import_request_id;
      this.import_file = importFile;
      // Clear previous messages so the user sees the result of this attempt
      this.import_error = null;
      this.import_success = null;
      if (importFile == null) return;

      try {
        const result = await importBuckets(this.$aw, importFile);
        if (requestId === this.import_request_id) {
          // importBuckets may return a payload with a server message; otherwise
          // show a generic success message (see issue #394).
          if (result && typeof result === 'object' && 'message' in result && result.message) {
            this.import_success = this.$t('buckets.importSuccessDetail', {
              detail: result.message,
            });
          } else {
            this.import_success = this.$t('buckets.importSuccess');
          }
        }
      } catch (err) {
        if (requestId === this.import_request_id) {
          // Surface server-provided details so the user can act on them (#394).
          const detail = err && (err.response?.data?.message || err.message || String(err));
          this.import_error = detail
            ? this.$t('buckets.importFailedDetail', { detail })
            : this.$t('buckets.importFailed');
        }
      }
      // Submitted imports still reconcile the catalogue even when another
      // selection owns the UI; refresh errors keep reaching ErrorBoundary.
      try {
        await this.bucketsStore.loadBuckets();
      } finally {
        if (requestId === this.import_request_id) {
          this.import_file = null;
        }
      }
    },
    isRecent: function (date) {
      return moment().diff(date) / 1000 < 120;
    },
    bucketHasEvents: function (bucket) {
      return Boolean(bucket && bucket.last_updated);
    },
    deviceHasEvents: function (device) {
      return _.some(device.buckets, b => this.bucketHasEvents(b));
    },
    runChecks: function (device) {
      const checks = [
        {
          msg: () => {
            return this.$t('buckets.deviceMultiHost', { hostnames: device.hostnames.join(', ') });
          },
          failed: () => device.hostnames.length > 1,
        },
        {
          msg: () => {
            return this.$t('buckets.deviceMultiId', { ids: device.device_ids.join(', ') });
          },
          failed: () => device.device_ids.length > 1,
        },
        {
          msg: () => {
            return this.$t('buckets.deviceSpecial');
          },
          failed: () => _.isEqual(device.hostnames, ['unknown']),
        },
      ];
      const failedChecks = _.filter(checks, c => c.failed());
      return _.map(failedChecks, c => c.msg());
    },
    openDeleteBucketModal: function (bucketId: string) {
      this.delete_bucket_selected = bucketId;
      this.$showModal('delete-modal');
    },
    deleteBucket: async function (bucketId: string) {
      await this.bucketsStore.deleteBucket({ bucketId });
      this.$hideModal('delete-modal');
    },
    openDeleteHostModal: function (device) {
      this.delete_host_error = null;
      this.delete_host_selected = {
        hostname: device.hostname,
        bucketCount: device.buckets.length,
        bucketIds: device.buckets.map(b => b.id),
        bucketCreated: Object.fromEntries(device.buckets.map(b => [b.id, b.created?.valueOf()])),
        reconcileIds: device.buckets
          .map(b => b.id)
          .filter(id => this.delete_host_reconcile_ids.includes(id)),
      };
      this.$showModal('delete-host-modal');
    },
    deleteBucketsForSelectedHost: async function () {
      if (!this.delete_host_selected || this.deleting_host) return;
      const selection = this.delete_host_selected;
      const deletedIds = new Set();
      this.deleting_host = true;
      this.delete_host_error = null;
      try {
        // Retry a previously failed reconciliation before sending any DELETE.
        if (selection.reconcileIds.length) await reconcileHostDeletion(this, selection);
        await this.bucketsStore.deleteBucketsByHost({
          bucketIds: [...selection.bucketIds],
          onDeleted: bucketId => {
            deletedIds.add(bucketId);
            // Dismissal can outlive this operation; retain the acknowledgement
            // before consulting the current modal selection.
            if (!this.delete_host_reconcile_ids.includes(bucketId)) {
              this.delete_host_reconcile_ids.push(bucketId);
            }
            if (this.delete_host_selected !== selection) return;
            selection.bucketIds = selection.bucketIds.filter(id => id !== bucketId);
            selection.bucketCount = selection.bucketIds.length;
          },
        });
        if (this.delete_host_selected === selection) {
          this.$hideModal('delete-host-modal');
        }
      } catch (err) {
        if (this.delete_host_selected === selection) {
          this.delete_host_error = err?.message || this.$t('buckets.deletionFailed');
        }
      } finally {
        // Reconcile acknowledgements for any selection reopened during the
        // operation. Old errors/close events stay with their own selection.
        let current = this.delete_host_selected;
        while (current && current !== selection) {
          current.reconcileIds = [
            ...new Set([
              ...current.reconcileIds.filter(
                id =>
                  !deletedIds.has(id) || current.bucketCreated[id] !== selection.bucketCreated[id]
              ),
              ...current.bucketIds.filter(
                id => deletedIds.has(id) && current.bucketCreated[id] !== selection.bucketCreated[id]
              ),
            ]),
          ];
          this.delete_host_reconcile_ids = [
            ...new Set([...this.delete_host_reconcile_ids, ...current.reconcileIds]),
          ];
          current.bucketIds = current.bucketIds.filter(
            id => !deletedIds.has(id) || current.reconcileIds.includes(id)
          );
          current.bucketCount = current.bucketIds.length;
          try {
            await reconcileHostDeletion(this, current);
          } catch (err) {
            if (this.delete_host_selected === current) {
              this.delete_host_error = err?.message || this.$t('buckets.deletionFailed');
            }
          }
          if (this.delete_host_selected === current) break;
          current = this.delete_host_selected;
        }
        // Single-flight spans dismiss/reopen: an old operation cannot overlap a new one.
        this.deleting_host = false;
      }
    },
    async export_bucket_json(bucketId: string) {
      // Use extended timeout — buckets with many events can exceed the
      // default requestTimeout when serialized. See #847.
      const data = await exportBucketLong(bucketId);
      await downloadFile(
        `aw-bucket-export-${bucketId}.json`,
        JSON.stringify(data, null, 2),
        'application/json'
      );
    },

    async export_all_buckets_json() {
      // Use extended timeout — exporting all buckets can take a long time
      // for users with large datasets. See #847.
      const data = await exportAllBucketsLong();
      await downloadFile(
        'aw-bucket-export.json',
        JSON.stringify(data, null, 2),
        'application/json'
      );
    },

    async export_csv(bucketId: string) {
      // Use extended timeout — fetching all events for CSV export can
      // exceed the default requestTimeout for large buckets. See #847.
      const bucket = await this.bucketsStore.getBucketWithEvents({
        id: bucketId,
        timeoutMs: LONG_TIMEOUT_MS,
      });
      const events = bucket.events;
      const datakeys = events.length > 0 ? Object.keys(events[0].data) : [];
      const columns = ['timestamp', 'duration'].concat(datakeys);
      const data = events.map(e => {
        return Object.assign(
          { timestamp: e.timestamp, duration: e.duration },
          Object.fromEntries(datakeys.map(k => [k, e.data[k]]))
        );
      });
      const csv = Papa.unparse(data, { columns, header: true });
      const filename = `aw-events-export-${bucketId}-${new Date()
        .toISOString()
        .substring(0, 10)}.csv`;
      await downloadFile(filename, csv, 'text/csv');
    },
  },
};
</script>
