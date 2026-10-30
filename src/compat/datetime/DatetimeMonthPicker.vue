<template>
  <div class="vdatetime-month-picker">
    <div class="vdatetime-month-picker__list vdatetime-month-picker__list" ref="monthList">
      <div
        class="vdatetime-month-picker__item"
        v-for="month in months"
        :key="`mo-${month.number}`"
        @click="select(month)"
        :class="{ 'vdatetime-month-picker__item--selected': month.selected, 'vdatetime-month-picker__item--disabled': month.disabled }"
      >{{ month.label }}</div>
    </div>
  </div>
</template>

<script>
import { DateTime } from 'luxon';
import { monthIsDisabled, months } from './util';

export default {
  name: 'DatetimeMonthPicker',
  props: {
    year: { type: Number, required: true },
    month: { type: Number, required: true },
    minDate: { type: DateTime, default: null },
    maxDate: { type: DateTime, default: null },
  },
  computed: {
    months() {
      return months(this.month).map((month, index) => ({
        number: ++index,
        label: month,
        selected: index === this.month,
        disabled: !index || monthIsDisabled(this.minDate, this.maxDate, this.year, index),
      }));
    },
  },
  methods: {
    select(month) {
      if (month.disabled) return;
      this.$emit('change', parseInt(month.number));
    },
    scrollToCurrent() {
      const selectedMonth = this.$refs.monthList.querySelector('.vdatetime-month-picker__item--selected');
      this.$refs.monthList.scrollTop = selectedMonth ? selectedMonth.offsetTop - 250 : 0;
    },
  },
  mounted() {
    this.scrollToCurrent();
  },
  updated() {
    this.scrollToCurrent();
  },
};
</script>
