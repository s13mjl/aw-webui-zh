import fs from 'fs';
import path from 'path';
import Timeline from '~/views/Timeline.vue';

describe('Timeline 视图模式', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../src/views/Timeline.vue'), 'utf8');
  const listSrc = fs.readFileSync(
    path.join(__dirname, '../../src/visualizations/TimelineEventList.vue'),
    'utf8'
  );

  test('组件模板可编译', () => {
    expect(Timeline.name).toBe('Timeline');
  });

  test('提供时间线/列表切换，列表模式隐藏时间线专属控件', () => {
    expect(src).toMatch(/view_mode: 'timeline'/);
    expect(src).toMatch(/:pressed="view_mode === 'timeline'"/);
    expect(src).toMatch(/:pressed="view_mode === 'list'"/);
    expect(src).toMatch(/aw-timeline-event-list/);
    expect(src).toMatch(/v-if="view_mode === 'timeline'"[\s\S]*?timeline\.scrollHint/);
  });

  test('列表组件使用本地 i18n 命名空间并分页', () => {
    expect(listSrc).toMatch(/\$t\('timeline\.listShowing'/);
    expect(listSrc).toMatch(/\$t\('timeline\.showMore'/);
    expect(listSrc).toMatch(/TIMELINE_LIST_PAGE_SIZE/);
  });
});
