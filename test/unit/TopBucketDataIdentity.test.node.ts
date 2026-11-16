import Component from '~/visualizations/TopBucketData.vue';

const TopBucketData: any = Component;

function aggregate(values: unknown[], field = 'value') {
  const vm: any = {
    selectedFieldValue: field,
    events: values.map((value, i) => ({ duration: (i + 1) * 60, data: { value } })),
    aggregated: [],
    $t: (key: string) => (key === 'topBucketData.unknown' ? 'Unknown' : key),
  };
  vm.formatValue = TopBucketData.methods.formatValue.bind(vm);
  TopBucketData.methods.aggregate.call(vm);
  return vm.aggregated;
}

test.each([
  ['missing', undefined, 'Unknown'],
  ['null', null, 'Unknown'],
  ['boolean', false, 'false'],
  ['number', 1, '1'],
  ['object', { a: 1 }, '{"a":1}'],
  ['array', ['Work'], '["Work"]'],
  ['array display', ['Work'], 'Work'],
  ['array separator', ['A', 'B'], ['A > B']],
  ['array element types', [1], ['1']],
])('%s 保留不同的类型分组与可区分的标签', (_name, first, second) => {
  const rows = aggregate([first, second]);
  expect(rows).toHaveLength(2);
  expect(rows.map(row => row.duration)).toEqual([120, 60]);
  expect(new Set(rows.map(row => row.data.display)).size).toBe(2);
  expect(rows.reduce((total, row) => total + row.duration, 0)).toBe(180);
});

test.each([
  ['string', 'A', 'A'],
  ['unknown', undefined, null],
  ['object key order', { a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 }],
  ['array objects', [{ a: 1, b: 2 }], [{ b: 2, a: 1 }]],
  ['array', ['Work', 'Code'], ['Work', 'Code']],
])('%s 相等的值仍然聚合', (_name, first, second) => {
  const rows = aggregate([first, second]);
  expect(rows).toHaveLength(1);
  expect(rows[0].duration).toBe(180);
});

test('数组顺序仍然有意义', () => {
  expect(
    aggregate([
      ['A', 'B'],
      ['B', 'A'],
    ])
  ).toHaveLength(2);
});

test('普通字符串保留名称与颜色键（含原型样式名称）', () => {
  const rows = aggregate(['__proto__', 'constructor', 'A']);
  expect(rows.map(row => row.data.display)).toEqual(['A', 'constructor', '__proto__']);
  expect(rows.map(row => row.data.colorKey)).toEqual(['A', 'constructor', '__proto__']);
});

test('生成的注解不与字面字符串或同类数组标签冲突', () => {
  const rows = aggregate([1, '1', '1 (number)', ['A > B'], ['A', 'B'], 'A > B (array)']);
  expect(rows).toHaveLength(6);
  expect(new Set(rows.map(row => row.data.display)).size).toBe(6);
});

test('注解保留原颜色键并预留字面注解拼写', () => {
  const rows = aggregate([1, '1', '1 (number)', ['Work'], 'Work', null, 'Unknown']);
  const number = rows.find(row => row.data.raw === 1);
  expect(number.data).toMatchObject({ display: '1 (number) #2', colorKey: '1' });
  const array = rows.find(row => Array.isArray(row.data.raw));
  expect(array.data).toMatchObject({ display: '["Work"] (array)', colorKey: 'Work' });
  const unknown = rows.find(row => row.data.raw === null);
  expect(unknown.data).toMatchObject({ display: 'Unknown (unknown)', colorKey: 'Unknown' });
  expect(rows.filter(row => typeof row.data.raw === 'string').map(row => row.data.display)).toEqual(
    ['Unknown', 'Work', '1 (number)', '1']
  );
});

test.each(['nested.value', 'data.nested.value'])('嵌套自定义路径 %s 保留合计', field => {
  const vm: any = {
    selectedFieldValue: field,
    events: [
      { duration: 60, data: { nested: { value: false } } },
      { duration: 120, data: { nested: { value: 'false' } } },
    ],
    aggregated: [],
    $t: (key: string) => (key === 'topBucketData.unknown' ? 'Unknown' : key),
  };
  vm.formatValue = TopBucketData.methods.formatValue.bind(vm);
  TopBucketData.methods.aggregate.call(vm);
  expect(vm.aggregated.map(row => row.duration)).toEqual([120, 60]);
});
