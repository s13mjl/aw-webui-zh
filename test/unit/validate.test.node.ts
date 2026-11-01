import { validateRegex, isRegexBroad } from '~/util/validate';

// Ported from upstream test/unit/validate.test.node.ts (PR #921).
//
// The two upstream describes that distinguished "Node with the
// @unicode/unicode-13.0.0 name database" from "browser build without it" collapse
// into one here: this fork does not depend on that package, so \N{...} escapes are
// always handled by upstream's fail-safe path (rejected, see src/util/validate.ts).
// The expectations for the five "\N{VALID NAME} is accepted" cases are therefore
// flipped to false; every other assertion is unchanged.
describe('validateRegex', () => {
  test('accepts valid patterns', () => {
    expect(validateRegex('Notepad\\+\\+')).toBe(true);
    expect(validateRegex('Chrome|Firefox')).toBe(true);
    expect(validateRegex('.*\\.py$')).toBe(true);
    expect(validateRegex('[a-z]+')).toBe(true);
  });

  test('rejects empty string', () => {
    expect(validateRegex('')).toBe(false);
  });

  test('rejects JavaScript-invalid patterns', () => {
    // ++ is invalid: nothing to repeat for the second +
    expect(validateRegex('Notepad++')).toBe(false);
    // Unclosed group
    expect(validateRegex('(foo')).toBe(false);
    // Unclosed character class
    expect(validateRegex('[foo')).toBe(false);
    // Invalid quantifier
    expect(validateRegex('a{2,1}')).toBe(false);
  });

  test('rejects JavaScript-only syntax that Python does not support', () => {
    // JS named groups (?<name>...) are invalid in Python's re module
    expect(validateRegex('(?<name>foo)')).toBe(false);
    expect(validateRegex('(?<year>\\d{4})-(?<month>\\d{2})')).toBe(false);
    // JavaScript treats unknown letter escapes as literal characters, while Python rejects them
    expect(validateRegex('foo\\qbar')).toBe(false);
    expect(validateRegex('foo\\Cbar')).toBe(false);
    expect(validateRegex('foo\\8bar')).toBe(false);
  });

  test('rejects Python named Unicode escapes (no name database available)', () => {
    // Upstream accepts these after verifying the name against
    // @unicode/unicode-13.0.0; without that package the name cannot be
    // verified, so the fail-safe rejects valid and invalid names alike.
    expect(validateRegex('\\N{EM DASH}')).toBe(false);
    expect(validateRegex('foo\\N{EM DASH}bar')).toBe(false);
    expect(validateRegex('\\N{LF}')).toBe(false);
    expect(validateRegex('\\N{CR}')).toBe(false);
    expect(validateRegex('\\N{LINE FEED}')).toBe(false);
    expect(validateRegex('\\N{NOT A REAL UNICODE NAME}')).toBe(false);
  });

  test('accepts patterns with no \\N{...} escapes', () => {
    expect(validateRegex('Chrome|Firefox')).toBe(true);
    expect(validateRegex('.*\\.py$')).toBe(true);
    expect(validateRegex('foo\\\\qbar')).toBe(true);
  });

  test('ignores named-group text in literal regex contexts', () => {
    expect(validateRegex('[(?<]')).toBe(true);
    expect(validateRegex('\\(?<name>foo\\)')).toBe(true);
    expect(validateRegex('[abc](?<name>foo)')).toBe(false);
  });

  test('accepts lookbehind assertions (valid in both JS and Python)', () => {
    // Positive lookbehind (?<=...) is valid in both
    expect(validateRegex('(?<=foo)bar')).toBe(true);
    // Negative lookbehind (?<!...) is valid in both
    expect(validateRegex('(?<!foo)bar')).toBe(true);
    // Escaped backslashes and punctuation escapes are accepted by both engines
    expect(validateRegex('foo\\\\qbar')).toBe(true);
    expect(validateRegex('foo\\!bar')).toBe(true);
  });
});

describe('isRegexBroad', () => {
  test('flags single-char patterns as broad', () => {
    expect(isRegexBroad('a')).toBe(true);
  });

  test('flags patterns that match common strings as broad', () => {
    expect(isRegexBroad('.*')).toBe(true);
  });

  test('does not flag specific patterns as broad', () => {
    expect(isRegexBroad('Notepad\\+\\+')).toBe(false);
    expect(isRegexBroad('MySpecificApp')).toBe(false);
  });
});
