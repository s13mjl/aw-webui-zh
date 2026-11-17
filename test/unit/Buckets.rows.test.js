import fs from 'fs';
import path from 'path';

describe('Buckets.vue 行式列表', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../src/views/Buckets.vue'), 'utf8');

  test('用可点击的行替代按钮表格，时间不占固定列宽', () => {
    expect(src).not.toMatch(/b-table/);
    expect(src).toMatch(/router-link\.bucket-link/);
    expect(src).toMatch(/\.bucket-updated \{\s*flex: none;/);
    expect(src).toMatch(/\.bucket-id \{\s*flex: 1 1 auto;\s*min-width: 0;/);
    expect(src).toMatch(/sortedBuckets/);
  });
});
