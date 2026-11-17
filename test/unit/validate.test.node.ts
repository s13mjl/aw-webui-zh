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

  test('拒绝 Python 不支持的 JS 命名分组', () => {
    expect(validateRegex('(?<year>\\d{4})')).toBe(false);
    // 后行断言不是命名分组，不应被该规则误拒
    expect(validateRegex('(?<=abc)foo')).toBe(true);
  });

  test('接受两种引擎都合法的标准转义序列', () => {
    // \n, \t, \r 等在 JS 与 Python 正则中均合法
    expect(validateRegex('^app\\nwindow title$')).toBe(true);
    expect(validateRegex('foo\\tbar')).toBe(true);
    expect(validateRegex('line\\rend')).toBe(true);
    expect(validateRegex('\\n+')).toBe(true);
  });

  test('接受定宽后行断言（Python 合法）', () => {
    // 定宽量词在后行断言内合法
    expect(validateRegex('(?<=\\d{3})foo')).toBe(true);
    expect(validateRegex('(?<=abc)foo')).toBe(true);
    // 分支等宽的后行交替在 Python 中合法
    expect(validateRegex('(?<=foo|bar)x')).toBe(true);
    expect(validateRegex('(?<=\\d{2}|[a-z]{2})x')).toBe(true);
  });

  test('拒绝 Python 非法的后行断言（变宽或分支不等宽）', () => {
    // 后行断言内的变宽量词：Python 拒绝
    expect(validateRegex('(?<=\\d+)foo')).toBe(false);
    expect(validateRegex('(?<=a*)foo')).toBe(false);
    expect(validateRegex('(?<=a?)foo')).toBe(false);
    expect(validateRegex('(?<=\\d{2,3})foo')).toBe(false);
    // 分支宽度不一致的交替：Python 抛出 re.error
    expect(validateRegex('(?<=\\d{2}|[a-z]{3})foo')).toBe(false);
    expect(validateRegex('(?<=a|ab)x')).toBe(false);
    // 后行断言内嵌套后行断言：Python re 不支持
    expect(validateRegex('(?<=(?<=a)b)x')).toBe(false);
    expect(validateRegex('(?<=(?<!a)b)x')).toBe(false);
    // 字符类内的字面 (?<= 不是嵌套后行断言——校验需感知字符类，避免误拒。
    // (?<=[a(?<=z]b) 的主体 [a(?<=z]b 定宽（1+1=2 字符）→ 合法。
    expect(validateRegex('(?<=[a(?<=z]b)')).toBe(true);
  });
});
