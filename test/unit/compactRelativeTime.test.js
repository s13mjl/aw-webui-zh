import { compact_relative_time } from '~/util/time';
import { i18n } from '~/i18n';

const now = new Date('2026-10-10T12:00:00Z');

describe('compact relative timestamps', () => {
  test.each([
    [0, '0s', '0s ago'],
    [1, '1s', '1s ago'],
    [60, '1min', '1min ago'],
    [3600, '1h', '1h ago'],
    [864000, '10d', '10d ago'],
    [2592000, '1mo', '1mo ago'],
    [31536000, '1y', '1y ago'],
  ])('formats %s seconds without verbose units', (seconds, short, full) => {
    const timestamp = new Date(now.getTime() - seconds * 1000).toISOString();
    expect(compact_relative_time(timestamp, 'en', true, now)).toBe(short);
    expect(compact_relative_time(timestamp, 'en', false, now)).toBe(full);
  });

  test('preserves future direction instead of displaying a negative age', () => {
    expect(compact_relative_time('2026-10-10T12:01:00Z', 'en', true, now)).toBe('+1min');
    expect(compact_relative_time('2026-10-10T12:01:00Z', 'en', false, now)).toBe('in 1min');
  });

  test('localizes the desktop label', () => {
    expect(compact_relative_time('2026-10-10T11:59:00Z', 'sv', false, now)).toBe(
      new Intl.RelativeTimeFormat('sv', { numeric: 'always', style: 'narrow' }).format(-1, 'minute')
    );
  });

  // aw-webui-zh: the narrow unit letters come from the locale files
  // (units.unit*), so the phone-width column is localized too.
  test('translates the unit abbreviations', () => {
    i18n.locale = 'zh-CN';
    try {
      const timestamp = new Date(now.getTime() - 864000 * 1000).toISOString();
      expect(compact_relative_time(timestamp, 'zh-CN', true, now)).toBe('10天');
      expect(compact_relative_time(timestamp, 'zh-CN', false, now)).toBe(
        new Intl.RelativeTimeFormat('zh-CN', { numeric: 'always', style: 'narrow' }).format(
          -10,
          'day'
        )
      );
    } finally {
      i18n.locale = 'en';
    }
  });
});
