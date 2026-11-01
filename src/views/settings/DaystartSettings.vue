<template lang="pug">
div
  div.d-sm-flex.justify-content-between
    div
      h5.mt-1.mb-2.mb-sm-0 {{ $t('settings.daystart.startOfDay') }}
    div
      b-input(type="time" size="sm" :value="startOfDay" @change="startOfDay = $event")
  small.text-muted
    | {{ $t('settings.daystart.startOfDayHelp') }}

  div.mt-3.d-sm-flex.justify-content-between
    div
      h5.mt-1.mb-2.mb-sm-0 {{ $t('settings.daystart.startOfWeek') }}
    div
      b-form-select(size="sm" v-model="startOfWeek" variant="outline-dark" :options="startOfWeekOptions")
  small.text-muted
    | {{ $t('settings.daystart.startOfWeekHelp') }}
</template>
<script lang="ts">
import { useSettingsStore } from '~/stores/settings';

export default {
  name: 'DaystartSettings',
  data() {
    return {
      settingsStore: useSettingsStore(),
    };
  },
  computed: {
    // Canonical weekday values with translated labels. timeperiod.ts compares
    // startOfWeek against 'Sunday'/'Monday'/'Saturday', so the picker must not
    // persist the translated text itself (it did before, which silently broke
    // the week alignment on non-English locales).
    startOfWeekOptions() {
      return [
        { value: 'Saturday', text: this.$t('settings.daystart.saturday') as string },
        { value: 'Sunday', text: this.$t('settings.daystart.sunday') as string },
        { value: 'Monday', text: this.$t('settings.daystart.monday') as string },
      ];
    },
    startOfDay: {
      get: function () {
        return this.settingsStore.startOfDay;
      },
      set: function (value) {
        console.log('Set start of day to ' + value);
        this.settingsStore.update({ startOfDay: value });
      },
    },
    startOfWeek: {
      get: function () {
        const stored = this.settingsStore.startOfWeek;
        // Older saves stored the translated label; show the matching option.
        const byLabel = this.startOfWeekOptions.find(o => o.text === stored);
        return byLabel ? byLabel.value : stored;
      },
      set: function (value) {
        console.log('Set start of week to ' + value);
        this.settingsStore.update({ startOfWeek: value });
      },
    },
  },
};
</script>
