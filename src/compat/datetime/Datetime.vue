<template>
  <div class="vdatetime">
    <slot name="before"></slot>
    <input
      class="vdatetime-input"
      :class="inputClass"
      :style="inputStyle"
      :id="inputId"
      type="text"
      :value="inputValue"
      v-bind="$attrs"
      @click="open"
      @focus="open"
    />
    <input v-if="hiddenName" type="hidden" :name="hiddenName" :value="modelValue" @input="setValue" />
    <slot name="after"></slot>
    <transition-group name="vdatetime-fade" tag="div">
      <div key="overlay" v-if="isOpen && !hideBackdrop" class="vdatetime-overlay" @click.self="clickOutside"></div>
      <datetime-popup
        key="popup"
        v-if="isOpen"
        :type="type"
        :datetime="popupDate"
        :phrases="phrases"
        :use12-hour="use12Hour"
        :hour-step="hourStep"
        :minute-step="minuteStep"
        :min-datetime="popupMinDatetime"
        :max-datetime="popupMaxDatetime"
        @confirm="confirm"
        @cancel="cancel"
        :auto="auto"
        :week-start="weekStart"
        :flow="flow"
        :title="title"
      >
        <template #button-cancel__internal="scope">
          <slot name="button-cancel" :step="scope.step">{{ phrases.cancel }}</slot>
        </template>
        <template #button-confirm__internal="scope">
          <slot name="button-confirm" :step="scope.step">{{ phrases.ok }}</slot>
        </template>
      </datetime-popup>
    </transition-group>
  </div>
</template>

<script>
import { DateTime } from 'luxon';
import DatetimePopup from './DatetimePopup.vue';
import { datetimeFromISO, startOfDay, weekStart } from './util';

export default {
  name: 'Datetime',
  components: { DatetimePopup },
  inheritAttrs: false,
  props: {
    modelValue: { type: String, default: undefined },
    valueZone: { type: String, default: 'UTC' },
    inputId: { type: String, default: null },
    inputClass: { type: [Object, Array, String], default: '' },
    inputStyle: { type: [Object, Array, String], default: '' },
    hiddenName: { type: String, default: undefined },
    zone: { type: String, default: 'local' },
    format: { type: [Object, String], default: null },
    type: { type: String, default: 'date' },
    phrases: {
      type: Object,
      default() {
        return { cancel: 'Cancel', ok: 'Ok' };
      },
    },
    use12Hour: { type: Boolean, default: false },
    hourStep: { type: Number, default: 1 },
    minuteStep: { type: Number, default: 1 },
    minDatetime: { type: String, default: null },
    maxDatetime: { type: String, default: null },
    auto: { type: Boolean, default: false },
    weekStart: {
      type: Number,
      default() {
        return weekStart();
      },
    },
    flow: { type: Array, default: undefined },
    title: { type: String, default: undefined },
    hideBackdrop: { type: Boolean, default: false },
    backdropClick: { type: Boolean, default: true },
  },
  emits: ['update:modelValue', 'close'],
  data() {
    return {
      isOpen: false,
      datetime: datetimeFromISO(this.modelValue),
    };
  },
  watch: {
    modelValue(newValue) {
      this.datetime = datetimeFromISO(newValue);
    },
  },
  created() {
    this.emitInput();
  },
  computed: {
    inputValue() {
      let format = this.format;
      if (!format) {
        switch (this.type) {
          case 'date':
            format = DateTime.DATE_MED;
            break;
          case 'time':
            format = DateTime.TIME_24_SIMPLE;
            break;
          case 'datetime':
          case 'default':
            format = DateTime.DATETIME_MED;
            break;
        }
      }
      if (typeof format === 'string') {
        return this.datetime ? DateTime.fromISO(this.datetime).setZone(this.zone).toFormat(format) : '';
      }
      return this.datetime ? this.datetime.setZone(this.zone).toLocaleString(format) : '';
    },
    popupDate() {
      return this.datetime ? this.datetime.setZone(this.zone) : this.newPopupDatetime();
    },
    popupMinDatetime() {
      return this.minDatetime ? DateTime.fromISO(this.minDatetime).setZone(this.zone) : null;
    },
    popupMaxDatetime() {
      return this.maxDatetime ? DateTime.fromISO(this.maxDatetime).setZone(this.zone) : null;
    },
  },
  methods: {
    emitInput() {
      let datetime = this.datetime ? this.datetime.setZone(this.valueZone) : null;
      if (datetime && this.type === 'date') {
        datetime = startOfDay(datetime);
      }
      this.$emit('update:modelValue', datetime ? datetime.toISO() : '');
    },
    open(event) {
      event.target.blur();
      this.isOpen = true;
    },
    close() {
      this.isOpen = false;
      this.$emit('close');
    },
    confirm(datetime) {
      this.datetime = datetime.toUTC();
      this.emitInput();
      this.close();
    },
    cancel() {
      this.close();
    },
    clickOutside() {
      if (this.backdropClick === true) this.cancel();
    },
    newPopupDatetime() {
      let datetime = DateTime.utc().setZone(this.zone).set({ seconds: 0, milliseconds: 0 });
      if (this.popupMinDatetime && datetime < this.popupMinDatetime) {
        datetime = this.popupMinDatetime.set({ seconds: 0, milliseconds: 0 });
      }
      if (this.popupMaxDatetime && datetime > this.popupMaxDatetime) {
        datetime = this.popupMaxDatetime.set({ seconds: 0, milliseconds: 0 });
      }
      if (this.minuteStep === 1) return datetime;
      const roundedMinute = Math.round(datetime.minute / this.minuteStep) * this.minuteStep;
      if (roundedMinute === 60) {
        return datetime.plus({ hours: 1 }).set({ minute: 0 });
      }
      return datetime.set({ minute: roundedMinute });
    },
    setValue(event) {
      this.datetime = datetimeFromISO(event.target.value);
      this.emitInput();
    },
  },
};
</script>
