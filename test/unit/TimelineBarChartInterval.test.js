// The Vue 3 rewrite imports Bar from the vue-chartjs root entry (the /legacy
// build is Vue 2-only), so that's the module to stub out here.
jest.mock('vue-chartjs', () => ({ Bar: {} }));

import { shallowMount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import i18nInstance from '~/i18n';
import TimelineBarChart from '~/visualizations/TimelineBarChart.vue';

function mountChart(timeperiod_start, timeperiod_length, datasets) {
  const pinia = createPinia();
  setActivePinia(pinia);
  return shallowMount(TimelineBarChart, {
    props: { datasets, timeperiod_start, timeperiod_length, clamp_hourly: true },
    global: { plugins: [pinia, i18nInstance] },
  });
}

const stacked = [
  { label: 'A', data: [0.9, 0.9] },
  { label: 'B', data: [0.9, 0.9] },
];

describe('TimelineBarChart 精确时段 (#1168)', () => {
  test('one elapsed hour gives a single hourly bucket', () => {
    const wrapper = mountChart('2026-10-20T13:00:00Z', [3600000, 'milliseconds'], stacked);
    expect(wrapper.vm.labels).toHaveLength(1);
    const [ds] = wrapper.vm.chartData.datasets;
    // Stack 1.8h > 1h capacity: proportionally scaled down to 1h
    expect(ds.data[0]).toBeCloseTo(0.5);
    wrapper.unmount();
  });

  test('clips the final bucket to its elapsed hours instead of a full hour', () => {
    const wrapper = mountChart('2026-10-20T13:15:00Z', [6300000, 'milliseconds'], stacked);
    expect(wrapper.vm.labels).toHaveLength(2);

    const datasets = wrapper.vm.chartData.datasets;
    // First bucket: full hour capacity 1, stack 1.8 -> 0.5 each
    expect(datasets[0].data[0]).toBeCloseTo(0.5);
    // Second bucket: 0.75h capacity, stack 1.8 -> 0.375 each
    expect(datasets[0].data[1]).toBeCloseTo(0.375);
    wrapper.unmount();
  });

  test('a single day still renders 24 hourly labels', () => {
    const wrapper = mountChart('2026-10-20T04:00:00Z', [1, 'day'], stacked);
    expect(wrapper.vm.labels).toHaveLength(24);
    wrapper.unmount();
  });

  test('the y axis stays hourly for an interval up to a day', () => {
    const wrapper = mountChart('2026-10-20T13:15:00Z', [6300000, 'milliseconds'], stacked);
    expect(wrapper.vm.chartOptions.scales.y.max).toBe(1);
    wrapper.unmount();
  });

  test('a very short interval still produces one bucket instead of an empty chart', () => {
    const wrapper = mountChart(
      '2026-10-20T13:00:00Z',
      [30000, 'milliseconds'],
      [{ label: 'A', data: [0.5] }]
    );
    expect(wrapper.vm.labels).toHaveLength(1);
    expect(wrapper.vm.chartData.datasets).toHaveLength(1);
    wrapper.unmount();
  });
});
