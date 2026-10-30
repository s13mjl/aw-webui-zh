<template lang="pug">
div
  div.d-sm-flex.justify-content-between.align-items-center
    div
      h5.mb-0 {{ $t('settings.backup.title') }}
    div
      b-form-checkbox(v-model="enabled" switch)
  small.text-muted
    | {{ $t('settings.backup.help') }}

  div.mt-3(v-if="enabled")
    b-form-group(:label="$t('settings.backup.interval')" label-cols-md=4 label-class="small text-muted"
                 :description="$t('settings.backup.intervalHelp')")
      b-input-group(size="sm" :append="$t('settings.backup.hours')")
        b-input(type="number" min="1" size="sm" v-model.number="intervalHours")

    div.mt-2(v-if="lastBackupDisplay")
      small.text-muted
        | {{ $t('settings.backup.lastBackup') }}: {{ lastBackupDisplay }}

    div.mt-2
      b-btn(size="sm" variant="outline-primary" @click="backupNow" :disabled="backingUp")
        icon(name="download")
        |  {{ $t('settings.backup.backupNow') }}
</template>

<script lang="ts">
import { useSettingsStore } from '~/stores/settings';
import { performBackup } from '~/util/backup';
import moment from 'moment';


export default {
  name: 'BackupSettings',
  data: () => ({
    backingUp: false,
  }),
  computed: {
    enabled: {
      get(): boolean {
        return useSettingsStore().autoBackupEnabled;
      },
      set(v: boolean) {
        useSettingsStore().update({ autoBackupEnabled: v });
      },
    },
    intervalHours: {
      get(): number {
        return useSettingsStore().autoBackupIntervalHours;
      },
      set(v: number) {
        const hours = Number.isFinite(v) ? Math.max(1, v) : 24;
        useSettingsStore().update({ autoBackupIntervalHours: hours });
      },
    },
    lastBackupDisplay(): string | null {
      const t = useSettingsStore().autoBackupLastTime;
      if (!t) return null;
      return moment(t).format('YYYY-MM-DD HH:mm');
    },
  },
  methods: {
    async backupNow() {
      this.backingUp = true;
      try {
        await performBackup();
      } finally {
        this.backingUp = false;
      }
    },
  },
};
</script>
