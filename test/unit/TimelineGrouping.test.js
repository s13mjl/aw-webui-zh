import { createPinia, setActivePinia } from 'pinia';
import VisTimeline from '~/visualizations/VisTimeline.vue';
import { i18n } from '~/i18n';

jest.mock('vis-timeline/esnext', () => ({ Timeline: jest.fn() }));
jest.mock('vis-timeline/styles/vis-timeline-graph2d.css', () => ({}));

beforeEach(() => {
  setActivePinia(createPinia());
});

function makeVm(seconds = 6, duration = 2) {
  const vm = {
    ...VisTimeline.data(),
    ...VisTimeline.methods,
    groupGranularity: seconds,
    filterShortEvents: true,
    swimlane: null,
    showRowLabels: false,
    queriedInterval: undefined,
    updateTimelineWindow: false,
    itemEvents: new Map(),
    expandedGroups: [],
    $t: i18n.t.bind(i18n),
    $aw: { getEvent: jest.fn().mockResolvedValue({ id: 1 }) },
    $nextTick: jest.fn(),
    bucketsFromEither: [
      {
        id: 'aw-watcher-window_test',
        type: 'currentwindow',
        events: Array.from({ length: 6 }, (_, i) => ({
          id: i + 1,
          timestamp: new Date(i * duration * 1000).toISOString(),
          duration,
          data: { app: ['vim', 'terminal', 'browser'][i % 3], title: `event ${i}` },
        })),
      },
    ],
  };
  Object.defineProperty(vm, 'eventIndex', {
    get: () => VisTimeline.computed.eventIndex.call(vm),
  });
  Object.defineProperty(vm, 'chartData', {
    get: () => VisTimeline.computed.chartData.call(vm),
  });
  let currentWindow = { start: new Date(0), end: new Date(12000) };
  vm.timeline = {
    getWindow: () => currentWindow,
    setWindow: jest.fn((start, end) => {
      currentWindow = { start: new Date(start), end: new Date(end) };
    }),
    setOptions: jest.fn(),
    setData: jest.fn(),
    on: jest.fn(),
  };
  vm.update();
  return vm;
}

test('default-off keeps raw items and short-event suppression; grouping includes tiny switches', () => {
  expect(makeVm(0).items).toHaveLength(6);
  expect(makeVm(0, 0.5).items).toHaveLength(0);
  const grouped = makeVm(1, 0.5);
  expect(grouped.items).toHaveLength(3);
  expect(grouped.items.every(item => item.className === 'timeline-composite')).toBe(true);
});

test('composite group label carries member count and summed duration', () => {
  const vm = makeVm();
  const composite = vm.items[0];
  expect(composite.className).toBe('timeline-composite');
  expect(composite.content).toBe('3 events · 6s');
  expect(composite.group).toBe('aw-watcher-window_test');
});

test('hover breakdown sums each activity and escapes untrusted app labels', () => {
  const vm = makeVm();
  const events = vm.bucketsFromEither[0].events;
  events[0].data.app = '<img src=x onerror=alert(1)>';
  events[1].data.app = events[0].data.app;
  vm.update();
  const tooltip = vm.chartData[0].tooltip;
  expect(tooltip).toContain('&lt;img');
  expect(tooltip).not.toContain('<img');
  expect(tooltip).toContain('<td>4s</td>');
  expect(tooltip).toContain('<td>2s</td>');
});

test('composite activity headers support wrapping without changing ordinary tooltip labels', () => {
  const vm = makeVm();
  const label = 'a'.repeat(500);
  vm.bucketsFromEither[0].events[0].data.app = label;
  vm.update();
  const container = document.createElement('div');
  container.innerHTML = vm.chartData[0].tooltip;
  const header = [...container.querySelectorAll('th')].find(cell => cell.textContent === label);
  expect(header).toBeDefined();
  expect(header.classList.contains('timeline-composite-activity')).toBe(true);
  expect(header.getAttribute('scope')).toBe('row');

  const raw = makeVm(0);
  expect(raw.chartData[0].tooltip).not.toContain('timeline-composite-activity');
});

test('composite breakdown preserves subsecond activity totals', () => {
  const vm = makeVm(1, 0.5);
  const tooltip = vm.chartData[0].tooltip;
  expect(tooltip.match(/<td>0\.5s<\/td>/g)).toHaveLength(2);
  expect(tooltip).not.toContain('<td>0s</td>');
});

test('tap expands original members without synthetic lookup; raw members still open the editor', async () => {
  const vm = makeVm();
  const id = vm.items[0].id;
  expect(vm.items).toHaveLength(2);
  const currentWindow = vm.timeline.getWindow();
  vm.timeline.setWindow.mockClear();
  await vm.onSelect({ items: [id] });
  expect(vm.$aw.getEvent).not.toHaveBeenCalled();
  expect(vm.items).toHaveLength(4);
  expect(vm.timeline.getWindow()).toEqual(currentWindow);
  expect(vm.timeline.setWindow).not.toHaveBeenCalled();
  const member = vm.items.find(item => !item.className);
  await vm.onSelect({ items: [member.id] });
  expect(vm.$aw.getEvent).toHaveBeenCalledWith('aw-watcher-window_test', 1);
  vm.collapseGroups();
  expect(vm.items.map(item => item.id)).toContain(id);
  expect(vm.items).toHaveLength(2);
  expect(vm.timeline.getWindow()).toEqual(currentWindow);
});

test('membership survives viewport changes and explicit upstream filtering', () => {
  const vm = makeVm();
  const ids = vm.items.map(item => item.id);
  vm.timeline.setWindow(1000, 9000);
  vm.update(false);
  expect(vm.items.map(item => item.id)).toEqual(ids);
  vm.bucketsFromEither[0].events = vm.bucketsFromEither[0].events.slice(0, 3);
  vm.update();
  expect(vm.itemEvents.get(vm.items[0].id).members).toHaveLength(3);
});

test('changing grouping setting collapses groups and preserves the viewport', async () => {
  const vm = makeVm();
  await vm.onSelect({ items: [vm.items[0].id] });
  const currentWindow = vm.timeline.getWindow();
  vm.groupGranularity = 0;
  VisTimeline.watch.groupGranularity.call(vm);
  expect(vm.expandedGroups).toEqual([]);
  expect(vm.items).toHaveLength(6);
  expect(vm.timeline.getWindow()).toEqual(currentWindow);
});
