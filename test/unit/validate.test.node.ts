import { validateRegex } from '~/util/validate';

describe('validateRegex', () => {
  test('接受有效正则', () => {
    expect(validateRegex('abc')).toBe(true);
    expect(validateRegex('^kate$')).toBe(true);
  });

  test('拒绝空正则', () => {
    expect(validateRegex('')).toBe(false);
  });

  test('拒绝非字符串输入且不抛错', () => {
    // 尽管类型标注为 string，运行时调用方可能传入 undefined/null。
    // 回归：validateRegex(undefined) 曾抛出 TypeError（同步上游 #1276）。
    expect(validateRegex(undefined as unknown as string)).toBe(false);
    expect(validateRegex(null as unknown as string)).toBe(false);
  });

  test('拒绝 JS 无效正则', () => {
    expect(validateRegex('Notepad++')).toBe(false);
  });
});
