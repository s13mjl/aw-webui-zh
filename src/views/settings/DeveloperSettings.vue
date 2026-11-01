<template lang="pug">
div
  b-alert(show variant="warning") #[b {{ $t('settings.developer.note') }}] {{ $t('settings.developer.noteBody') }}

  div.d-flex.justify-content-between.align-items-center
    div
      h5.mb-0#devmode-label {{ $t('settings.developer.forceDevmode') }}
    div
      b-form-checkbox(v-model="devmode" switch aria-labelledby="devmode-label")
  small.text-muted
    | {{ $t('settings.developer.forceDevmodeHelp') }}

  div.mt-3.d-flex.justify-content-between.align-items-center
    div
      h5.mb-0#multidevice-label {{ $t('settings.developer.multidevice') }}
    div
      b-form-checkbox(v-model="useMultidevice" switch aria-labelledby="multidevice-label")
  small.text-muted
    | {{ $t('settings.developer.multideviceHelp') }}

  div.mt-3.d-sm-flex.justify-content-between
    div
      h5.mt-1.mb-2.mb-sm-0#request-timeout-label {{ $t('settings.developer.requestTimeout') }}
    div
      b-input(v-model="requestTimeout" type="number" size="sm" aria-labelledby="request-timeout-label")
  small.text-muted
    | {{ $t('settings.developer.requestTimeoutHelp') }}

  div.mt-3.d-flex.justify-content-between.align-items-center
    div.mr-2
      h5.mb-0#hide-unsupported-label {{ $t('settings.developer.hideUnsupportedVisualizations') }}
    div
      b-form-checkbox(v-model="hideUnsupportedVisualizations" switch aria-labelledby="hide-unsupported-label")
  small.text-muted
    | {{ $t('settings.developer.hideUnsupportedVisualizationsHelp') }}

  div.mt-3
    | {{ $t('settings.developer.commitHash') }} {{ COMMIT_HASH }}
</template>

<script lang="ts">
import { useSettingsStore } from '~/stores/settings';

export default {
  data() {
    return {
      showSettings: false,
    };
  },
  computed: {
    devmode: {
      get() {
        return useSettingsStore().devmode;
      },
      set(devmode) {
        useSettingsStore().update({ devmode });
      },
    },
    useMultidevice: {
      get() {
        return useSettingsStore().useMultidevice;
      },
      set(useMultidevice) {
        useSettingsStore().update({ useMultidevice });
      },
    },
    requestTimeout: {
      get() {
        return useSettingsStore().requestTimeout;
      },
      set(requestTimeout) {
        useSettingsStore().update({ requestTimeout });
      },
    },
    hideUnsupportedVisualizations: {
      get() {
        return useSettingsStore().hideUnsupportedVisualizations;
      },
      set(hideUnsupportedVisualizations) {
        useSettingsStore().update({ hideUnsupportedVisualizations });
      },
    },
  },
};
</script>
