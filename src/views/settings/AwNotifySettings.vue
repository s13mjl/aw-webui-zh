<template lang="pug">
div
  div.d-flex.justify-content-between.align-items-center.mb-3
    div
      h5.mb-1 {{ $t('settings.awNotify.title') }}
      small.text-muted {{ $t('settings.awNotify.subtitle') }}
    b-btn(@click="save" size="sm" variant="primary" :disabled="!canSave")
      | {{ saving ? $t('settings.awNotify.saving') : $t('settings.awNotify.save') }}

  b-alert(v-if="error" show variant="danger") {{ error }}
  b-alert(v-if="success" show variant="success" dismissible @dismissed="success = false") {{ $t('settings.awNotify.saved') }}

  div(v-if="loading")
    b-spinner(small) {{ $t('settings.awNotify.loading') }}

  div(v-else)
    b-form-group.mb-2
      b-form-checkbox(v-model="enabled" switch)
        | {{ $t('settings.awNotify.enabledLabel') }}
        small.text-muted.ml-2 {{ $t('settings.awNotify.enabledHelp') }}
    p.text-muted.small(v-if="!enabled") {{ $t('settings.awNotify.disabledHint') }}

    p.text-muted.small.mb-3
      | {{ $t('settings.awNotify.introPrefix') }}
      code /api/0/settings/aw-notify
      | {{ $t('settings.awNotify.introSuffix') }}

    div(v-if="alerts.length === 0")
      p.text-muted.font-italic {{ $t('settings.awNotify.empty') }}

    b-card.mb-2(v-for="(alert, idx) in alerts" :key="idx")
      div.d-flex.align-items-start
        div.flex-grow-1
          b-form-group(:label="$t('settings.awNotify.label')" label-cols-sm="3" label-size="sm")
            b-input(v-model="alert.label" size="sm" :disabled="!enabled" :placeholder="$t('settings.awNotify.labelPlaceholder')")
          b-form-group(:label="$t('settings.awNotify.category')" label-cols-sm="3" label-size="sm")
            b-input(
              v-model="alert.category"
              size="sm"
              :disabled="!enabled"
              :placeholder="$t('settings.awNotify.categoryPlaceholder')"
            )
            small.form-text.text-muted {{ $t('settings.awNotify.categoryHelp') }}
          b-form-group(
            :label="$t('settings.awNotify.thresholds')"
            label-cols-sm="3"
            label-size="sm"
            :invalid-feedback="thresholdError(alert.thresholdStr)"
            :state="thresholdState(alert.thresholdStr)"
          )
            b-input(
              v-model="alert.thresholdStr"
              size="sm"
              :disabled="!enabled"
              :placeholder="$t('settings.awNotify.thresholdsPlaceholder')"
              :state="thresholdState(alert.thresholdStr)"
            )
            small.form-text.text-muted {{ $t('settings.awNotify.thresholdsHelp') }}
          b-form-group(:label="$t('settings.awNotify.type')" label-cols-sm="3" label-size="sm")
            b-form-radio-group(v-model="alert.positive" :options="goalOptions" size="sm" :disabled="!enabled")
        b-btn.ml-2(@click="removeAlert(idx)" variant="outline-danger" size="sm" :disabled="!enabled" :title="$t('settings.awNotify.removeTitle')")
          icon(name="trash")

    b-btn.mt-1(@click="addAlert" variant="outline-secondary" size="sm" :disabled="!enabled")
      icon(name="plus")
      |  {{ $t('settings.awNotify.addAlert') }}
</template>

<script lang="ts">
import { getClient } from '~/util/awclient';
import { parseThresholds, parseAwNotifyConfig } from '~/util/aw-notify';
import type { AwNotifyConfig, AwNotifyAlert } from '~/util/aw-notify';

const SETTINGS_KEY = 'aw-notify';

interface AlertRow {
  label: string;
  category: string; // '' = aggregate "All"
  thresholdStr: string;
  positive: boolean;
}

function dtoToRow(dto: AwNotifyAlert): AlertRow {
  return {
    label: dto.label ?? '',
    category: dto.category ?? '',
    thresholdStr: dto.thresholdMinutes.join(', '),
    positive: dto.positive,
  };
}

function rowToDto(row: AlertRow): AwNotifyAlert {
  const thresholds = parseThresholds(row.thresholdStr);
  if (!thresholds) {
    throw new Error('Thresholds must be comma-separated positive whole minutes.');
  }
  return {
    label: row.label || null,
    category: row.category && row.category.trim() !== '' ? row.category.trim() : null,
    thresholdMinutes: thresholds,
    positive: row.positive,
  };
}

function cloneRows(rows: AlertRow[]): AlertRow[] {
  return rows.map(row => ({ ...row }));
}

export default {
  name: 'AwNotifySettings',
  data() {
    return {
      enabled: false,
      alerts: [] as AlertRow[],
      // Last-saved raw DTO snapshot: alerts, enabled and any unknown keys.
      config: {} as AwNotifyConfig,
      // Rows snapshot at the last successful load/save, used to roll back on
      // a failed save.
      savedRows: [] as AlertRow[],
      loading: false,
      saving: false,
      error: '',
      success: false,
    };
  },
  computed: {
    goalOptions() {
      return [
        { text: this.$t('settings.awNotify.goalWarning'), value: false },
        { text: this.$t('settings.awNotify.goalTarget'), value: true },
      ];
    },
    hasInvalid(): boolean {
      return this.alerts.some(row => parseThresholds(row.thresholdStr) === null);
    },
    canSave(): boolean {
      // When the switch is off the form is not validated (its hidden pending
      // edit must not block disabling); when on, an invalid threshold blocks save.
      return !this.loading && !this.saving && (!this.enabled || !this.hasInvalid);
    },
  },
  async mounted() {
    await this.load();
  },
  methods: {
    async load() {
      this.loading = true;
      this.error = '';
      try {
        const client = getClient();
        const resp = await client.req.get(`/0/settings/${SETTINGS_KEY}`);
        this.applyLoaded(resp.data);
      } catch (e: any) {
        if (e?.response?.status === 404) {
          this.useDefaults();
        } else {
          this.error = this.$t('settings.awNotify.loadFailed', {
            error: e?.message ?? e,
          });
        }
      } finally {
        this.loading = false;
      }
    },
    applyLoaded(data: unknown) {
      // Backwards compatibility: older saves stored a bare alert array. Treat
      // those as enabled so existing thresholds keep working.
      if (Array.isArray(data)) {
        this.config = { alerts: data as AwNotifyAlert[] };
        this.enabled = true;
        this.alerts = (data as AwNotifyAlert[]).map(dtoToRow);
      } else {
        const parsed = parseAwNotifyConfig(data);
        if (parsed) {
          this.config = parsed;
          this.enabled = parsed.enabled ?? false;
          this.alerts = parsed.alerts.map(dtoToRow);
        } else {
          this.useDefaults();
          return;
        }
      }
      this.savedRows = cloneRows(this.alerts);
    },
    useDefaults() {
      this.config = {} as AwNotifyConfig;
      this.enabled = false;
      this.alerts = this.defaultAlerts();
      this.savedRows = cloneRows(this.alerts);
    },
    async save() {
      this.error = '';
      this.success = false;
      let alertDtos: AwNotifyAlert[];
      if (this.enabled) {
        if (this.hasInvalid) {
          this.error = this.$t('settings.awNotify.invalidThresholds');
          return;
        }
        alertDtos = this.alerts.map(rowToDto);
      } else {
        // Disabling: skip form validation and reuse the last-saved alerts so a
        // pending invalid edit in a hidden field cannot block the toggle.
        alertDtos = this.config.alerts ?? [];
      }
      this.saving = true;
      try {
        const client = getClient();
        // Spread the last-saved config first to preserve unknown keys (e.g.
        // http_port, future fields), then override enabled and alerts.
        const payload: AwNotifyConfig = {
          ...this.config,
          enabled: this.enabled,
          alerts: alertDtos,
        };
        await client.req.post(`/0/settings/${SETTINGS_KEY}`, payload, {
          headers: { 'Content-Type': 'application/json' },
        });
        // Keep the snapshot in sync: a later disabled save must use the latest
        // saved alerts, not the stale load-time snapshot.
        this.config = payload;
        this.savedRows = cloneRows(this.alerts);
        this.success = true;
      } catch (e: any) {
        this.error = this.$t('settings.awNotify.saveFailed', {
          error: e?.message ?? e,
        });
        // Roll back to the last-saved snapshot so the panel never shows a
        // state the server rejected.
        this.enabled = this.config.enabled ?? false;
        this.alerts = cloneRows(this.savedRows);
      } finally {
        this.saving = false;
      }
    },
    thresholdError(value: string): string {
      return parseThresholds(value) === null ? this.$t('settings.awNotify.thresholdsInvalid') : '';
    },
    thresholdState(value: string): boolean | null {
      return parseThresholds(value) === null ? false : null;
    },
    addAlert() {
      this.alerts.push({
        label: '',
        category: '',
        thresholdStr: '60, 120',
        positive: false,
      });
    },
    removeAlert(idx: number) {
      this.alerts.splice(idx, 1);
    },
    defaultAlerts(): AlertRow[] {
      return [
        { label: 'All', category: '', thresholdStr: '60, 120, 240', positive: false },
        { label: 'Work', category: 'Work', thresholdStr: '15, 30, 60', positive: true },
      ];
    },
  },
};
</script>
