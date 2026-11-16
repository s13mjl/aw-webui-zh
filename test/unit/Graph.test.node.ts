import GraphComponent from '~/views/Graph.vue';

// 上游 #1219：Graph 生成图数据时用结构化键（JSON）而非 '>' 拼接字符串作为分类身份，
// 避免含字面量分隔符的分类互相碰撞；display label/title 与内部 id 分离。
const Graph: any = GraphComponent;

function graph(categories: string[][], maxDepth = 10) {
  const get_category_color = jest.fn(category => JSON.stringify(category));
  const events = categories.map((category, i) => ({
    timestamp: '2026-10-01T00:00:00Z',
    duration: (i + 1) * 60,
    data: { $category: category },
  }));
  const data = Graph.methods.generateGraphData.call(
    { maxDepth, categoryStore: { get_category_color } },
    events
  );
  return { ...data, get_category_color, events };
}

describe('Graph 分类身份', () => {
  test('字面量分隔符与分类层级保持区分', () => {
    const { nodes, links, get_category_color } = graph([['Work>Code'], ['Work', 'Code']]);
    expect(nodes).toHaveLength(2);
    expect(nodes.map(n => n.value)).toEqual([60, 120]);
    expect(nodes[0].id).not.toBe(nodes[1].id);
    expect(nodes[0].group).not.toBe(nodes[1].group);
    expect(nodes.map(n => n.label)).toEqual(['Work>Code', 'Code']);
    expect(get_category_color.mock.calls).toEqual([[['Work>Code']], [['Work', 'Code']]]);
    expect(links).toEqual([{ source: nodes[0].id, target: nodes[1].id, value: 1 }]);
  });

  test('累计重复的有向转移，但不为同类事件生成连线', () => {
    const { nodes, links } = graph([
      ['Work', 'Code>Review'],
      ['Work>Code', 'Review'],
      ['Work', 'Code>Review'],
      ['Work', 'Code>Review'],
      ['Work>Code', 'Review'],
    ]);
    expect(nodes).toHaveLength(2);
    expect(nodes.map(n => n.value)).toEqual([480, 420]);
    expect(nodes[0].group).not.toBe(nodes[1].group);
    expect(links).toEqual([
      { source: nodes[0].id, target: nodes[1].id, value: 2 },
      { source: nodes[1].id, target: nodes[0].id, value: 1 },
    ]);
  });

  test('分组前裁剪深度且不修改输入数组', () => {
    const categories = [['Work', 'Code'], ['Work', 'Review'], ['Work>Code']];
    const originalCategories = categories.map(category => [...category]);
    const { nodes, links, events, get_category_color } = graph(categories, 1);
    expect(nodes).toHaveLength(2);
    expect(nodes.map(n => n.value)).toEqual([180, 180]);
    expect(get_category_color.mock.calls).toEqual([[['Work']], [['Work>Code']]]);
    expect(links).toEqual([{ source: nodes[0].id, target: nodes[1].id, value: 1 }]);
    expect(events.map(e => e.data.$category)).toEqual(originalCategories);
  });

  test('保留普通分类、父级分组与未分类', () => {
    const { nodes, links } = graph([
      ['Uncategorized'],
      ['Work', 'Code'],
      ['Work', 'Review'],
      ['Leisure'],
    ]);
    expect(nodes.map(n => n.value)).toEqual([60, 120, 180, 240]);
    expect(nodes.map(n => n.group)).toEqual([0, 1, 1, 2]);
    expect(links).toHaveLength(3);
    expect(new Set(nodes.map(n => n.id)).size).toBe(4);
    expect(graph([])).toMatchObject({ nodes: [], links: [] });
  });

  test('引号、反斜杠与对象属性名不会碰撞', () => {
    const { nodes } = graph([['a"', 'b\\c'], ['a">b\\c'], ['__proto__'], ['constructor']]);
    expect(new Set(nodes.map(n => n.id)).size).toBe(4);
    expect(new Set(nodes.map(n => n.group)).size).toBe(4);
  });
});
