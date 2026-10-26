<template lang="pug">
div(v-if="datasets && datasets.length > 0")
  // Height set here to avoid elements jumping when loading Activity view
  bar(:chart-data="chartData" :chart-options="chartOptions" :height="330")
div.small(v-else-if="datasets === null", style="font-size: 16pt; color: #aaa;")
  | {{ $t('timelineBarChart.noData') }}
div.small(v-else, style="font-size: 16pt; color: #aaa;")
  .aw-loading {{ $t('timelineBarChart.loading') }}
</template>

<script lang="ts">
import _ from 'lodash';
import moment from 'moment';
import { ChartOptions } from 'chart.js';
import 'chart.js/auto';
import { Bar } from 'vue-chartjs/legacy';
import {
  format_day_of_month,
  format_weekday_short,
  get_hour_offset,
  get_short_month_labels,
} from '~/util/time';
import { timeperiodsForPeriod } from '~/util/timeperiod';

function hourToTick(hours: number): string {
  if (hours > 1) {
    return `${hours}h`;
  } else {
    if (hours == 1) {
      return '1h';
    } else if (hours == 0) {
      return '0';
    } else {
      return Math.round(hours * 60) + 'm';
    }
  }
}

export default {
  name: 'TimelineBarChart',
  components: { Bar },
  props: {
    datasets: {
      type: Array,
      default: () => [
        {
          label: (this as any).$t('timelineBarChart.totalTime'),
          backgroundColor: '#6699ff',
          data: Array.from({ length: 40 }, () => Math.floor(Math.random() * 40)),
        },
      ],
    },
    timeperiod_start: {
      type: String,
      default: () => null,
    },
    timeperiod_length: {
      type: Array,
      default: () => [1, 'day'],
    },
  },
  computed: {
    labels() {
      const start = this.timeperiod_start;
      const [count, resolution] = this.timeperiod_length;
      if (resolution.startsWith('day') && count == 1) {
        const hourOffset = get_hour_offset();
        return _.range(0, 24).map(h => `${(h + hourOffset) % 24}`);
      } else if (resolution.startsWith('day')) {
        // Mirror the activity store's adaptive splitting so labels line up
        // with the bars for long custom/all-time ranges.
        const periods = timeperiodsForPeriod({
          start,
          length: this.timeperiod_length,
        });
        const firstDays = periods.length > 0 ? periods[0].length[0] : 1;
        return periods.map(period => {
          const date = moment(period.start);
          if (firstDays > 300) return date.format('YYYY');
          if (firstDays > 25) return date.format('YYYY-MM');
          return date.format('MM-DD');
        });
      } else if (resolution.startsWith('week')) {
        // Look up days of the week from `start`
        return _.range(7).map(d => {
          const date = new Date(start);
          date.setHours(12, 0, 0, 0);
          date.setDate(date.getDate() + d);
          return format_weekday_short(date);
        });
      } else if (resolution.startsWith('month')) {
        // FIXME: Needs access to the timeperiod start to know which month
        // How many days are in the given month?
        const date = new Date(start);
        const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        return _.range(1, daysInMonth + 1).map(d =>
          format_day_of_month(new Date(date.getFullYear(), date.getMonth(), d, 12))
        );
      } else if (resolution == 'year') {
        return get_short_month_labels();
      } else {
        console.error(`Invalid resolution: ${resolution}`);
        return [];
      }
    },
    chartData() {
      return {
        labels: this.labels,
        datasets: _.sortBy(this.datasets, d => d.label),
        title: {
          display: true,
          text: this.$t('timelineBarChart.timeline'),
        },
        responsive: true,
        maintainAspectRatio: false,
      };
    },
    chartOptions(): ChartOptions {
      const [count, resolution] = this.timeperiod_length;
      // Hourly bars are capped at 1h, daily bars at 24h. Longer adaptive
      // ranges (monthly/yearly bars) need an auto-scaled axis.
      const isHourly = resolution.startsWith('day') && count == 1;
      const isDaily = resolution.startsWith('day') && count > 1 && count <= 62;
      return {
        plugins: {
          tooltip: {
            mode: 'point',
            intersect: false,
            callbacks: {
              label: function (context) {
                const value = context.parsed.y;
                let hours = Math.floor(value);
                let minutes = Math.round((value - hours) * 60);
                if (minutes == 60) {
                  minutes = 0;
                  hours += 1;
                }
                const minutes_str = minutes.toString().padStart(2, '0');
                return `${hours}:${minutes_str}`;
              },
            },
          },
          legend: {
            display: false,
          },
        },
        scales: {
          x: {
            stacked: true,
          },
          y: {
            stacked: true,
            min: 0,
            // Use a hard max for day view: each bar represents one hour, so
            // activity can never legitimately exceed 1h. Using suggestedMax
            // lets Chart.js extend the axis past 1h (e.g. to 2h) when data
            // contains overlapping events, which is misleading — see #851.
            max: isHourly ? 1 : isDaily ? 24 : undefined,
            ticks: {
              callback: hourToTick,
              stepSize: isHourly ? 0.25 : isDaily ? 4 : 1,
            },
          },
        },
      };
    },
  },
};
</script>

<style></style>
