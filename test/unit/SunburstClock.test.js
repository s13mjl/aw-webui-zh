import moment from 'moment';
import { createPinia, setActivePinia } from 'pinia';

import * as classes from '~/util/classes';
import { getColorFromString } from '~/util/color';
import { useSettingsStore } from '~/stores/settings';
import sunburst from '~/visualizations/sunburst-clock';

// 上游 #1183：时钟图的“窗口弧”（深度 2）应使用分类配置的颜色，
// 而不是应用名/状态的字符串哈希色。这里直接驱动真实的 SVG fill 回调。
describe('sunburst-clock 窗口弧使用分类颜色', () => {
  const categories = [
    { name: ['Work'], rule: { type: 'none' }, data: { color: '#123456' } },
    { name: ['Work', 'Code'], rule: { type: 'regex', regex: '^Project Alpha$' } },
    { name: ['Media'], rule: { type: 'regex', regex: 'Movie' }, data: { color: '#654321' } },
  ];

  beforeEach(() => {
    setActivePinia(createPinia());
    useSettingsStore().useColorFallback = false;
    jest.spyOn(classes, 'loadClasses').mockReturnValue(categories);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function renderColors(windowData) {
    const el = document.createElement('div');
    el.innerHTML = '<div class="legend"></div><div class="sequence"></div>';
    sunburst.create(el);
    const start = moment('2026-09-01T00:00:00');
    const windowEvent = {
      timestamp: start.clone().add(1, 'hour').toISOString(),
      duration: 3600,
      data: windowData,
    };
    const statusEvent = {
      timestamp: start.toISOString(),
      duration: 86400,
      data: { status: 'not-afk' },
      children: [windowEvent],
    };
    sunburst.update(
      el,
      { timestamp: start.toISOString(), duration: 86400, data: {}, children: [statusEvent] },
      start
    );
    const paths = Array.from(el.querySelectorAll('#container path'));
    return {
      status: paths[1].style.fill,
      window: paths[2].style.fill,
    };
  }

  test('窗口标题命中子分类时继承父分类颜色，状态弧仍用哈希色', () => {
    const colors = renderColors({ app: 'editor', title: 'Project Alpha' });
    expect(colors.window).toBe('#123456');
    expect(colors.status).toBe(getColorFromString('not-afk'));
  });

  test('显式配置了颜色的分类优先于应用名哈希色', () => {
    expect(renderColors({ app: 'firefox', title: 'Movie' }).window).toBe('#654321');
  });

  test('未命中分类时沿用未分类回退色与回退开关', () => {
    expect(renderColors({ app: 'unknown-app', title: 'unmatched' }).window).toBe('#CCC');
    useSettingsStore().useColorFallback = true;
    // 本地实现按字段单独匹配，回退时只哈希首个字段（app）
    expect(renderColors({ app: 'unknown-app', title: 'unmatched' }).window).toBe(
      getColorFromString('unknown-app')
    );
  });
});
