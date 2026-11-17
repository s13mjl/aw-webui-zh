<template lang="pug">
div
  div
    b-alert(v-if="invalidDaterange", variant="warning", show)
      | {{ $t('inputTime.invalidRange') }}
    b-alert(v-if="unresolvableTime", variant="warning", show)
      | {{ $t('inputTime.unresolvableTime') }}
    b-alert(v-if="daterangeTooLong", variant="warning", show)
      | {{ $t('inputTime.rangeTooLong') }}

  div.input-time-interval.d-flex.flex-wrap.align-items-start.justify-content-between
    // Two-row grid: labels share a fixed-width column so the Mode toggle
    // and the Range controls line up vertically and the secondary label
    // stays in the same spot (just "Range") regardless of which mode is
    // active. Previously the label flipped between "Quick range" / "Range"
    // and the inputs shifted horizontally on every toggle.
    div.time-interval-grid
      label.col-form-label.col-form-label-sm.mb-0(for="time-mode") {{ $t('inputTime.mode') }}
      b-form-radio-group#time-mode(
        v-model="mode",
        @change="valueChanged",
        buttons,
        button-variant="outline-secondary",
        size="sm",
        :options="modeOptions"
      )

      label.col-form-label.col-form-label-sm.mb-0 {{ $t('inputTime.range') }}
      div.d-flex.flex-wrap.align-items-center(v-if="mode == 'last_duration'")
        div.btn-group(role="group" :aria-label="$t('inputTime.quickDurations')")
          template(v-for="(dur, idx) in durations")
            input(
              type="radio"
              :id="'dur' + idx"
              :value="dur.seconds"
              v-model="duration"
              @change="applyLastDuration"
            ).d-none
            label(:for="'dur' + idx" v-html="dur.label").btn.btn-light.btn-sm
      div.d-flex.flex-wrap.align-items-center(v-else)
        input.form-control.form-control-sm.mr-1(
          type="date", v-model="start", :max="end || undefined", style="width: auto"
          :aria-label="$t('inputTime.startDate')"
        )
        input.form-control.form-control-sm.mr-1(
          v-if="allowTime", type="time", v-model="startTime", style="width: auto"
          :aria-label="$t('inputTime.startTime')"
        )
        input.form-control.form-control-sm.mr-1(
          type="date", v-model="end", :min="start || undefined", :placeholder="$t('common.optional')", style="width: auto"
          :aria-label="$t('inputTime.endDate')"
        )
        input.form-control.form-control-sm.mr-1(
          v-if="allowTime", type="time", v-model="endTime", style="width: auto"
          :aria-label="$t('inputTime.endTime')"
        )
        b-button(
          size="sm" variant="outline-dark"
          :disabled="invalidDaterange || emptyDaterange || daterangeTooLong || unresolvableTime"
          @click="applyRange"
        ) {{ $t('inputTime.apply') }}

    div.text-right.d-none.d-md-block(v-if="showUpdate")
      b-button.px-2(@click="refresh()", variant="outline-dark", size="sm")
        icon.mr-1(name="sync")
        span.d-none.d-md-inline
          | {{ $t('inputTime.refresh') }}
      div.mt-2.small.text-muted(v-if="lastUpdate")
        | {{ $t('inputTime.lastUpdate') }} #[time(:datetime="lastUpdate.format()") {{ $filters.friendlytime(lastUpdate) }}]
</template>

<style scoped lang="scss">
.input-time-interval {
  row-gap: 0.5rem;
}

.time-interval-grid {
  display: grid;
  // Fixed label column keeps Mode/Range labels aligned and the controls
  // start at the same X regardless of which mode is active.
  grid-template-columns: 4rem minmax(0, 1fr);
  column-gap: 0.75rem;
  row-gap: 0.5rem;
  align-items: center;
  min-width: 0;
}

.btn-group {
  input[type='radio']:checked + label {
    background-color: #495057;
    color: #fff;
    border-color: #495057;
  }
}

@media (max-width: 575.98px) {
  .time-interval-grid {
    grid-template-columns: 1fr;
  }

  .btn-group {
    flex-wrap: wrap;
  }
}
</style>

<script lang="ts">
import moment from 'moment';
import { wallTimeInstants } from '~/util/timeperiod';
export default {
  name: 'input-timeinterval',
  emits: ['update:modelValue'],
  props: {
    defaultDuration: {
      type: Number,
      default: 60 * 60,
    },
    maxDuration: {
      type: Number,
      default: null,
    },
    showUpdate: {
      type: Boolean,
      default: true,
    },
    // Optional time inputs next to the dates, for consumers that need exact
    // sub-day bounds. Off by default so date-only callers are unchanged.
    allowTime: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      duration: null,
      mode: 'last_duration',
      start: null,
      end: null,
      startTime: null,
      endTime: null,
      lastUpdate: null,
    };
  },
  computed: {
    durations() {
      return [
        { seconds: 0.25 * 60 * 60, label: this.$t('durations.quarterHour') },
        { seconds: 0.5 * 60 * 60, label: this.$t('durations.halfHour') },
        { seconds: 60 * 60, label: this.$t('durations.hour1') },
        { seconds: 2 * 60 * 60, label: this.$t('durations.hour2') },
        { seconds: 3 * 60 * 60, label: this.$t('durations.hour3') },
        { seconds: 4 * 60 * 60, label: this.$t('durations.hour4') },
        { seconds: 6 * 60 * 60, label: this.$t('durations.hour6') },
        { seconds: 12 * 60 * 60, label: this.$t('durations.hour12') },
        { seconds: 24 * 60 * 60, label: this.$t('durations.hour24') },
        { seconds: 48 * 60 * 60, label: this.$t('durations.hour48') },
      ];
    },
    modeOptions() {
      return [
        { text: this.$t('inputTime.modeLastDuration'), value: 'last_duration' },
        { text: this.$t('inputTime.modeRange'), value: 'range' },
      ];
    },
    // Optional time inputs make the range exact. Without them the date inputs
    // keep their inclusive-day semantics exactly as before.
    hasTime() {
      return this.allowTime && !!(this.startTime || this.endTime);
    },
    rangeStart() {
      if (!this.start) return null;
      return this.hasTime ? this.wallInstant(this.start, this.startTime) : moment(this.start);
    },
    rangeEnd() {
      if (!this.start) return null;
      const endDate = this.end || this.start;
      // No end time keeps the end date inclusive, even with a start time.
      if (!this.allowTime || !this.endTime) return moment(endDate).add(1, 'day');
      // An end time without an end date refers to the start date.
      return this.wallInstant(endDate, this.endTime);
    },
    // A wall time that does not exist (spring-forward gap) or happens twice
    // (fall-back) cannot name an exact interval, and we never silently pick one.
    unresolvableTime() {
      if (!this.hasTime) return false;
      return this.rangeStart === null || this.rangeEnd === null;
    },
    dateRange() {
      const start = this.rangeStart;
      const end = this.rangeEnd;
      if (start !== null && end !== null) return [start, end];
      // Unresolvable wall time: still emit the date-only range so consumers
      // never receive null. Apply stays disabled while this holds.
      const startDate = moment(this.start);
      // 日期输入是包含当天的，发出的结束时刻是下一个本地午夜。
      const endDate = this.end ? moment(this.end).add(1, 'day') : startDate.clone().add(1, 'day');
      return [startDate, endDate];
    },
    value: {
      get() {
        if (this.mode == 'range' && this.start) {
          return this.dateRange;
        } else {
          return [moment().subtract(this.duration, 'seconds'), moment()];
        }
      },
    },
    emptyDaterange() {
      return !this.start;
    },
    invalidDaterange() {
      if (!this.hasTime) return !!this.end && moment(this.start) > moment(this.end);
      const start = this.rangeStart;
      const end = this.rangeEnd;
      // Reported separately by unresolvableTime.
      if (start === null || end === null) return false;
      return !start.isBefore(end);
    },
    daterangeTooLong() {
      if (!this.start || this.maxDuration === null) return false;
      const [start, end] = this.dateRange;
      // maxDuration 是经过的秒数，不是日历天数（DST 下每天时长会变）。
      return end.diff(start, 'seconds', true) > this.maxDuration;
    },
  },
  mounted() {
    this.duration = this.defaultDuration;
    this.valueChanged();

    // We want our lastUpdated text to update every ~500ms
    // We can do this by setting it to null and then the previous value.
    this.lastUpdateTimer = setInterval(() => {
      const _lastUpdate = this.lastUpdate;
      this.lastUpdate = null;
      this.lastUpdate = _lastUpdate;
    }, 500);
  },
  beforeUnmount() {
    clearInterval(this.lastUpdateTimer);
  },
  methods: {
    // Resolve a local wall time (date plus optional time) to one instant.
    wallInstant(date: string, time: string | null) {
      const instants = wallTimeInstants(`${date}T${time || '00:00'}`);
      return instants.length === 1 ? moment(instants[0]) : null;
    },
    valueChanged() {
      if (
        this.mode == 'last_duration' ||
        (!this.emptyDaterange &&
          !this.invalidDaterange &&
          !this.daterangeTooLong &&
          !this.unresolvableTime)
      ) {
        this.lastUpdate = moment();
        this.$emit('update:modelValue', this.value);
      }
    },
    refresh() {
      const tmpMode = this.mode;
      this.mode = '';
      this.mode = tmpMode;
      this.valueChanged();
    },
    applyRange() {
      this.mode = 'range';
      this.valueChanged();
    },
    applyLastDuration() {
      this.mode = 'last_duration';
      this.valueChanged();
    },
  },
};
</script>
