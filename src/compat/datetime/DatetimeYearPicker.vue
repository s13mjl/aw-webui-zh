<template>
  <div class="vdatetime-year-picker">
    <div class="vdatetime-year-picker__list vdatetime-year-picker__list" ref="yearList">
      <div
        class="vdatetime-year-picker__item"
        v-for="year in years"
        :key="`y-${year.number}`"
        @click="select(year)"
        :class="{ 'vdatetime-year-picker__item--selected': year.selected, 'vdatetime-year-picker__item--disabled': year.disabled }"
      >{{ year.number }}</div>
    </div>
  </div>
</template>

<script>
import { DateTime } from 'luxon';
import { yearIsDisabled, years } from './util';

export default {
  name: 'DatetimeYearPicker',
  props: {
    year: { type: Number, required: true },
    minDate: { type: DateTime, default: null },
    maxDate: { type: DateTime, default: null },
  },
  computed: {
    years() {
      return years(this.year).map((year) => ({
        number: year,
        selected: year === this.year,
        disabled: !year || yearIsDisabled(this.minDate, this.maxDate, year),
      }));
    },
  },
  methods: {
    select(year) {
      if (year.disabled) return;
      this.$emit('change', parseInt(year.number));
    },
    scrollToCurrent() {
      if (this.$refs.yearList) {
        const selectedYear = this.$refs.yearList.querySelector('.vdatetime-year-picker__item--selected');
        this.$refs.yearList.scrollTop = selectedYear ? selectedYear.offsetTop - 250 : 0;
      }
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
