import { parseThresholds, parseAwNotifyConfig } from '~/util/aw-notify';

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

describe('parseAwNotifyConfig', () => {
  const canonicalAlert = {
    label: 'All',
    category: null,
    thresholdMinutes: [60, 120, 240],
    positive: false,
  };

  test('accepts a valid config with alerts', () => {
    const config = { alerts: [canonicalAlert] };
    expect(parseAwNotifyConfig(config)).toEqual(config);
  });

  test('accepts enabled: true', () => {
    const config = { enabled: true, alerts: [canonicalAlert] };
    expect(parseAwNotifyConfig(config)).toEqual(config);
  });

  test('accepts enabled: false', () => {
    const config = { enabled: false, alerts: [] };
    expect(parseAwNotifyConfig(config)).toEqual(config);
  });

  test('accepts missing enabled (undefined)', () => {
    const config = { alerts: [] };
    expect(parseAwNotifyConfig(config)).toEqual(config);
  });

  test('preserves unknown config keys', () => {
    const config = { enabled: true, alerts: [canonicalAlert], http_port: 5600 };
    expect(parseAwNotifyConfig(config)).toEqual(config);
  });

  test('preserves an explicitly empty alert list', () => {
    expect(parseAwNotifyConfig({ alerts: [] })).toEqual({ alerts: [] });
  });

  test.each([
    null,
    'not-an-object',
    [],
    [canonicalAlert],
    { alerts: 'not-an-array' },
    { alerts: [canonicalAlert], enabled: 'yes' },
    { alerts: [canonicalAlert], enabled: 1 },
    { alerts: [{ ...canonicalAlert, thresholdMinutes: [0] }] },
    { alerts: [{ ...canonicalAlert, thresholdMinutes: ['60'] }] },
    { alerts: [{ ...canonicalAlert, positive: 'yes' }] },
  ])('rejects unsupported config %p', config => {
    expect(parseAwNotifyConfig(config)).toBeNull();
  });
});
