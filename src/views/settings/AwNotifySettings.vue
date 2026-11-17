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
            b-input(v-model="alert.label" size="sm" :placeholder="$t('settings.awNotify.labelPlaceholder')")
          b-form-group(:label="$t('settings.awNotify.category')" label-cols-sm="3" label-size="sm")
            b-input(
              v-model="alert.category"
              size="sm"
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
              :placeholder="$t('settings.awNotify.thresholdsPlaceholder')"
              :state="thresholdState(alert.thresholdStr)"
            )
            small.form-text.text-muted {{ $t('settings.awNotify.thresholdsHelp') }}
          b-form-group(:label="$t('settings.awNotify.type')" label-cols-sm="3" label-size="sm")
            b-form-radio-group(v-model="alert.positive" :options="goalOptions" size="sm")
        b-btn.ml-2(@click="removeAlert(idx)" variant="outline-danger" size="sm" :title="$t('settings.awNotify.removeTitle')")
          icon(name="trash")

    b-btn.mt-1(@click="addAlert" variant="outline-secondary" size="sm")
      icon(name="plus")
      |  {{ $t('settings.awNotify.addAlert') }}
</template>

<script lang="ts">
import { getClient } from '~/util/awclient';
import { parseThresholds } from '~/util/aw-notify';

const SETTINGS_KEY = 'aw-notify';

interface AlertRow {
  label: string;
  category: string; // '' = aggregate "All"
  thresholdStr: string;
  positive: boolean;
}

interface AlertDTO {
  label: string;
  category: string | null;
  thresholdMinutes: number[];
  positive: boolean;
}

function dtoToRow(dto: AlertDTO): AlertRow {
  return {
    label: dto.label,
    category: dto.category ?? '',
    thresholdStr: dto.thresholdMinutes.join(', '),
    positive: dto.positive,
  };
}

function rowToDto(row: AlertRow): AlertDTO {
  const thresholds = parseThresholds(row.thresholdStr);
  if (!thresholds) {
    throw new Error('Thresholds must be comma-separated positive whole minutes.');
  }
  return {
    label: row.label,
    category: row.category && row.category.trim() !== '' ? row.category.trim() : null,
    thresholdMinutes: thresholds,
    positive: row.positive,
  };
}

export default {
  name: 'AwNotifySettings',
  data() {
    return {
      alerts: [] as AlertRow[],
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
      return !this.loading && !this.saving && !this.hasInvalid;
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
        const data: AlertDTO[] = resp.data;
        this.alerts = Array.isArray(data) ? data.map(dtoToRow) : this.defaultAlerts();
      } catch (e: any) {
        if (e?.response?.status === 404) {
          this.alerts = this.defaultAlerts();
        } else {
          this.error = this.$t('settings.awNotify.loadFailed', {
            error: e?.message ?? e,
          });
        }
      } finally {
        this.loading = false;
      }
    },
    async save() {
      this.error = '';
      this.success = false;
      if (this.hasInvalid) {
        this.error = this.$t('settings.awNotify.invalidThresholds');
        return;
      }
      this.saving = true;
      try {
        const client = getClient();
        const payload: AlertDTO[] = this.alerts.map(rowToDto);
        await client.req.post(`/0/settings/${SETTINGS_KEY}`, payload, {
          headers: { 'Content-Type': 'application/json' },
        });
        this.success = true;
      } catch (e: any) {
        this.error = this.$t('settings.awNotify.saveFailed', {
          error: e?.message ?? e,
        });
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
