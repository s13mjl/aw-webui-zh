<template lang="pug">
div
  div.d-sm-flex.justify-content-between
    div
      h5.mb-2.mb-sm-0 {{ $t('settings.timelineDuration.title') }}
    div
      b-select(size="sm" :value="durationDefault", @change="durationDefault = $event")
          option(:value="15*60") {{ $t('durations.min15') }}
          option(:value="30*60") {{ $t('durations.min30') }}
          option(:value="60*60") {{ $t('durations.hour1') }}
          option(:value="2*60*60") {{ $t('durations.hour2') }}
          option(:value="4*60*60") {{ $t('durations.hour4') }}
          option(:value="6*60*60") {{ $t('durations.hour6') }}
          option(:value="12*60*60") {{ $t('durations.hour12') }}
          option(:value="24*60*60") {{ $t('durations.hour24') }}
  small.text-muted
    | {{ $t('settings.timelineDuration.help') }}
</template>
<script lang="ts">
import { useSettingsStore } from '~/stores/settings';

export default {
  name: 'TimelineDurationSettings',
  data() {
    return {
      settingsStore: useSettingsStore(),
    };
  },
  computed: {
    durationDefault: {
      get() {
        return this.settingsStore.durationDefault;
      },
      set(value) {
        console.log('Set default timeline duration to ' + value);
        this.settingsStore.update({ durationDefault: value });
      },
    },
  },
};
</script>
