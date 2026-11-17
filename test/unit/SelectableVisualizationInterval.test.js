import { shallowMount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import i18nInstance from '~/i18n';
import SelectableVisualization from '~/components/SelectableVisualization.vue';
import { useActivityStore } from '~/stores/activity';

jest.mock('~/util/awclient', () => ({
  getClient: jest.fn(),
  getEventsLong: jest.fn(),
  queryLong: jest.fn(),
}));

const { getClient } = require('~/util/awclient');

function mountVis(type, timeperiod, date) {
  const pinia = createPinia();
  setActivePinia(pinia);
  getClient.mockReturnValue({
    controller: new AbortController(),
    req: { defaults: { headers: {} } },
    abort: jest.fn(),
    getBuckets: jest.fn(async () => []),
    getEvents: jest.fn(async () => []),
    query: jest.fn(async () => []),
  });
  const activityStore = useActivityStore();
  activityStore.$patch({
    buckets: { loaded: true },
    query_options: { timeperiod, date: date ?? null },
  });
  return shallowMount(SelectableVisualization, {
    props: { id: 1, type },
    global: { plugins: [pinia, i18nInstance] },
  });
}

describe('SelectableVisualization 精确时段 (#1168)', () => {
  test('时钟图在单日周期下渲染，在精确时段下隐藏', () => {
    const day = mountVis('sunburst_clock', { start: '2026-10-20T04:00:00Z', length: [1, 'day'] });
    expect(day.find('aw-sunburst-clock').exists()).toBe(true);
    day.unmount();

    const exact = mountVis('sunburst_clock', {
      start: '2026-10-20T13:00:00Z',
      length: [3600000, 'milliseconds'],
    });
    expect(exact.find('aw-sunburst-clock').exists()).toBe(false);
    exact.unmount();
  });

  test('时间轴不为精确时段取整天区间（timeline_daterange 为 null）', () => {
    const exact = mountVis(
      'vis_timeline',
      { start: '2026-10-20T13:00:00Z', length: [3600000, 'milliseconds'] },
      '2026-10-20'
    );
    expect(exact.vm.timeline_daterange).toBeNull();
    exact.unmount();

    const day = mountVis(
      'vis_timeline',
      { start: '2026-10-20T04:00:00Z', length: [1, 'day'] },
      '2026-10-20'
    );
    expect(day.vm.timeline_daterange).toHaveLength(2);
    day.unmount();
  });

  test('通用可视化在精确时段下仍可用（supports_period 为 true）', () => {
    const exact = mountVis('top_apps', {
      start: '2026-10-20T13:00:00Z',
      length: [3600000, 'milliseconds'],
    });
    expect(exact.vm.supports_period).toBe(true);
    exact.unmount();
  });
});
