import { parseThresholds } from '~/util/aw-notify';

describe('parseThresholds', () => {
  test('parses comma-separated positive whole minutes', () => {
    expect(parseThresholds('1,5,15')).toEqual([1, 5, 15]);
    expect(parseThresholds('15, 30, 60')).toEqual([15, 30, 60]);
  });

  test('trims surrounding whitespace around each value', () => {
    expect(parseThresholds(' 60 , 120 , 240 ')).toEqual([60, 120, 240]);
  });

  test.each(['', '   ', '60.5', '60, abc', '60, -5', '60, 0', '60,', '60,,120', 'abc', '1e3'])(
    'rejects invalid threshold input %p',
    input => {
      expect(parseThresholds(input)).toBeNull();
    }
  );
});
