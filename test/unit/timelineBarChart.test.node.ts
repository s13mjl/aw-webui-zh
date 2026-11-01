// The Vue 3 rewrite imports Bar from the vue-chartjs root entry (the /legacy
// build is Vue 2-only), so that's the module to stub out here.
jest.mock('vue-chartjs', () => ({ Bar: {} }));
import TimelineBarChart from '~/visualizations/TimelineBarChart.vue';

// Inspect computed Chart.js configuration without mounting a canvas in Node.
const computed = (TimelineBarChart as any).computed;

function chartOptions(count: number, resolution = 'days') {
  return computed.chartOptions.call({ timeperiod_length: [count, resolution] });
}

describe('TimelineBarChart options', () => {
  test('puts responsive height controls in options, not chart data', () => {
    const options = chartOptions(7);
    expect(options.responsive).toBe(true);
    expect(options.maintainAspectRatio).toBe(false);
    const data = computed.chartData.call({
      datasets: [],
      labels: [],
      timeperiod_length: [7, 'days'],
      $t: (key: string) => key,
    });
    expect(data).not.toHaveProperty('responsive');
    expect(data).not.toHaveProperty('maintainAspectRatio');
  });

  test('takes the chart height from a prop so callers can shrink it', () => {
    // Regression: Trends renders a compact per-day chart with :height="100",
    // but the template hard-coded 330 so the option was silently ignored.
    const props = (TimelineBarChart as any).props;
    expect(props.height).toEqual({ type: Number, default: 330 });
  });

  test('reserves one-hour scale and minute ticks for the single-day chart', () => {
    // Upstream #1059 uses suggestedMax here; this repo keeps the hard max of
    // the day view (see #851), which fixes the same "multi-day charts stuck on
    // the hourly axis" bug through the isHourly/isDaily split.
    expect(chartOptions(1).scales.y.max).toBe(1);
    expect(chartOptions(1).scales.y.ticks.stepSize).toBe(0.25);
    expect(chartOptions(7).scales.y.max).toBe(24);
    expect(chartOptions(30).scales.y.max).toBe(24);
    for (const days of [90, 365]) {
      expect(chartOptions(days).scales.y.max).toBeUndefined();
    }
  });
});
