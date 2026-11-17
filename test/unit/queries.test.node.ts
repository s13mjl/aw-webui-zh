/**
 * Tests for browser app name regex patterns in queries.ts.
 *
 * The patterns in browser_appname_regex replaced exhaustive exact-match lists that were
 * previously hardcoded in browser_appnames. Every app name that was in the old lists is
 * tested here as a regression guard. If a real-world app name is discovered that doesn't
 * match, add it to the relevant test below AND update the regex pattern in queries.ts.
 *
 * Historical exact-match lists (pre-regex):
 *
 *   Chrome:   'Google Chrome', 'Google-chrome', 'Chrome.exe', 'chrome.exe',
 *             'google-chrome-stable', 'Chromium', 'Chromium-browser', 'chromium-browser',
 *             'Chromium-browser-chromium', 'Chromium.exe', 'chromium.exe',
 *             'Google-chrome-beta', 'Google-chrome-unstable'
 *             (Flatpak app IDs retained as exact: 'com.google.Chrome', 'com.google.ChromeDev',
 *              'org.chromium.Chromium')
 *             Ungoogled Chromium, which also runs the Chrome Web Store extension
 *             build but whose process name does not start with 'chromium':
 *             'ungoogled-chromium', 'ungoogled_chromium', 'Ungoogled Chromium',
 *             'ungoogled-chromium-bin'
 *
 *   Firefox:  'Firefox', 'Firefox.exe', 'firefox', 'firefox.exe',
 *             'Firefox Developer Edition', 'firefoxdeveloperedition',
 *             'Firefox-esr', 'Firefox Beta', 'Nightly', 'firefox-aurora', 'firefox-trunk-dev',
 *             'LibreWolf-Portable.exe', 'LibreWolf', 'LibreWolf.exe', 'Librewolf', 'Librewolf.exe',
 *             'librewolf', 'librewolf.exe', 'librewolf-default',
 *             'Waterfox', 'Waterfox.exe', 'waterfox', 'waterfox.exe'
 *             (Flatpak app IDs retained as exact: 'org.mozilla.firefox',
 *              'io.gitlab.librewolf-community', 'net.waterfox.waterfox')
 *
 *   Opera:    'opera.exe', 'Opera.exe', 'Opera'
 *             (Flatpak app ID retained: 'com.opera.Opera')
 *
 *   Brave:    'Brave-browser', 'brave-browser', 'Brave Browser', 'brave.exe', 'Brave.exe'
 *             (Flatpak app ID retained: 'com.brave.Browser')
 *
 *   Edge:     'msedge.exe', 'Microsoft Edge', 'Microsoft Edge Beta',
 *             'Microsoft-Edge-Stable', 'Microsoft-edge', 'microsoft-edge',
 *             'microsoft-edge-beta', 'microsoft-edge-dev'
 *             (Flatpak app IDs retained: 'com.microsoft.Edge', 'com.microsoft.EdgeDev')
 *
 *   Arc:      'arc.exe', 'Arc.exe', 'Arc'
 *             (also matched by the chrome pattern, since Arc reports to the chrome bucket
 *              unless the browser name is overridden in the extension settings)
 *
 *   Vivaldi:  'Vivaldi-stable', 'Vivaldi-snapshot', 'vivaldi.exe', 'Vivaldi.exe', 'Vivaldi'
 *             (Flatpak app ID retained: 'com.vivaldi.Vivaldi')
 *
 *   Orion:    'Orion'
 *
 *   Yandex:   'Yandex'
 *             (Flatpak app ID retained: 'ru.yandex.Browser')
 *
 *   Zen:      'Zen', 'Zen Browser', 'Zen-browser', 'zen', 'zen browser', 'zen-browser',
 *             'zen.exe', 'Zen.exe'
 *             (Flatpak app ID retained: 'app.zen_browser.zen')
 *
 *   Floorp:   'Floorp', 'floorp.exe', 'Floorp.exe', 'floorp'
 *             (Flatpak app ID retained: 'one.ablaze.floorp')
 */

import {
  browser_appname_regex,
  browser_appnames,
  editorActivityQuery,
  fullDesktopQuery,
  androidBrowserQuery,
  querystr_to_array,
} from '~/queries';

// Convert ActivityWatch (?i) patterns to JS RegExp with i flag for testing.
// AW server uses Python-style (?i) inline flag; JS uses RegExp 'i' flag instead.
function toRegex(pattern: string): RegExp {
  const stripped = pattern.replace(/^\(\?i\)/, '');
  return new RegExp(stripped, 'i');
}

describe('browser_appname_regex', () => {
  test('chrome pattern matches all known Chrome/Chromium app names', () => {
    const re = toRegex(browser_appname_regex.chrome);
    // Every entry from the old exact-match list
    const knownNames = [
      'Google Chrome',
      'Google-chrome',
      'Chrome.exe',
      'chrome.exe',
      'google-chrome-stable',
      'Google_Chrome',
      'Chromium',
      'Chromium-browser',
      'chromium-browser',
      'Chromium-browser-chromium',
      'Chromium.exe',
      'chromium.exe',
      'Google-chrome-beta',
      'Google-chrome-unstable',
      // Chromium forks that report through the chrome extension bucket (#927)
      'Arc',
      'arc.exe',
      'Arc.exe',
      'Dia',
      'Dia.exe',
      // Ungoogled Chromium via the Chrome Web Store extension build; its process
      // name does not start with 'chromium' so the plain chromium alternative misses it.
      'ungoogled-chromium',
      'ungoogled_chromium',
      'Ungoogled Chromium',
      'ungoogled-chromium-bin',
    ];
    for (const name of knownNames) {
      expect(re.test(name)).toBe(true);
    }
  });

  test('chrome pattern does not false-positive', () => {
    const re = toRegex(browser_appname_regex.chrome);
    // Flatpak app IDs are in the exact list, not matched by regex
    expect(re.test('com.google.Chrome')).toBe(false);
    expect(re.test('Slack')).toBe(false);
    expect(re.test('Electron')).toBe(false);
    // The fork alternatives are anchored, so names merely starting with them don't match
    expect(re.test('archive')).toBe(false);
    expect(re.test('arcade')).toBe(false);
    expect(re.test('Dialog')).toBe(false);
  });

  test('firefox pattern matches all known Firefox/LibreWolf/Waterfox app names', () => {
    const re = toRegex(browser_appname_regex.firefox);
    // Every entry from the old exact-match list
    const knownNames = [
      'Firefox',
      'Firefox.exe',
      'firefox',
      'firefox.exe',
      'Firefox Developer Edition',
      'firefoxdeveloperedition',
      'Firefox-esr',
      'firefox-esr-esr140', // versioned ESR (issue #749)
      'Firefox Beta',
      'Nightly',
      'firefox-aurora',
      'firefox-trunk-dev',
      'LibreWolf-Portable.exe',
      'LibreWolf',
      'LibreWolf.exe',
      'Librewolf',
      'Librewolf.exe',
      'librewolf',
      'librewolf.exe',
      'librewolf-default',
      'Waterfox',
      'Waterfox.exe',
      'waterfox',
      'waterfox.exe',
    ];
    for (const name of knownNames) {
      expect(re.test(name)).toBe(true);
    }
  });

  test('opera pattern matches all known Opera app names', () => {
    const re = toRegex(browser_appname_regex.opera);
    const knownNames = ['opera.exe', 'Opera.exe', 'Opera'];
    for (const name of knownNames) {
      expect(re.test(name)).toBe(true);
    }
  });

  test('brave pattern matches all known Brave app names', () => {
    const re = toRegex(browser_appname_regex.brave);
    const knownNames = [
      'Brave-browser',
      'brave-browser',
      'Brave Browser',
      'brave.exe',
      'Brave.exe',
    ];
    for (const name of knownNames) {
      expect(re.test(name)).toBe(true);
    }
  });

  test('edge pattern matches all known Edge app names', () => {
    const re = toRegex(browser_appname_regex.edge);
    const knownNames = [
      'msedge.exe',
      'Microsoft Edge',
      'Microsoft Edge Beta',
      'Microsoft-Edge-Stable',
      'Microsoft-edge',
      'microsoft-edge',
      'microsoft-edge-beta',
      'microsoft-edge-dev',
    ];
    for (const name of knownNames) {
      expect(re.test(name)).toBe(true);
    }
  });

  test('arc pattern matches known Arc names but not arc-prefixed words', () => {
    const re = toRegex(browser_appname_regex.arc);
    // Known app names
    expect(re.test('Arc')).toBe(true);
    expect(re.test('arc.exe')).toBe(true);
    expect(re.test('Arc.exe')).toBe(true);
    // Must NOT match names that merely contain "arc"
    expect(re.test('archive')).toBe(false);
    expect(re.test('arcade')).toBe(false);
    expect(re.test('ReactNativeArcApp')).toBe(false);
  });

  test('vivaldi pattern matches all known Vivaldi app names', () => {
    const re = toRegex(browser_appname_regex.vivaldi);
    const knownNames = [
      'Vivaldi-stable',
      'Vivaldi-snapshot',
      'vivaldi.exe',
      'Vivaldi.exe',
      'Vivaldi',
    ];
    for (const name of knownNames) {
      expect(re.test(name)).toBe(true);
    }
  });

  test('orion pattern matches known Orion app names', () => {
    const re = toRegex(browser_appname_regex.orion);
    expect(re.test('Orion')).toBe(true);
    expect(re.test('orion')).toBe(true);
  });

  test('yandex pattern matches known Yandex app names', () => {
    const re = toRegex(browser_appname_regex.yandex);
    expect(re.test('Yandex')).toBe(true);
    expect(re.test('yandex')).toBe(true);
  });

  test('zen pattern matches all known Zen Browser app names', () => {
    const re = toRegex(browser_appname_regex.zen);
    const knownNames = [
      'Zen',
      'Zen Browser',
      'Zen-browser',
      'zen',
      'zen browser',
      'zen-browser',
      'zen.exe',
      'Zen.exe',
    ];
    for (const name of knownNames) {
      expect(re.test(name)).toBe(true);
    }
  });

  test('floorp pattern matches all known Floorp app names', () => {
    const re = toRegex(browser_appname_regex.floorp);
    const knownNames = ['Floorp', 'floorp.exe', 'Floorp.exe', 'floorp'];
    for (const name of knownNames) {
      expect(re.test(name)).toBe(true);
    }
  });
});

describe('chrome pattern in generated query', () => {
  test('chrome bucket regex embedded in AQL matches ungoogled-chromium (#1124)', () => {
    const query = fullDesktopQuery({
      bid_window: 'aw-watcher-window_testhost',
      bid_afk: 'aw-watcher-afk_testhost',
      bid_browsers: ['aw-watcher-web-chrome_testhost'],
      filter_afk: true,
      categories: [],
      filter_categories: [],
    }).join('\n');
    // Deliberately not asserting the exact AQL line: arc/dia alternatives contain
    // backslashes, and whether JSON.stringify double-escapes them is decided by a
    // separate fix (#1084). Assert the alternatives actually reached the pattern.
    const emitted = query.match(
      /window_chrome_re = filter_keyvals_regex\(events, "app", "(.*)"\);/
    );
    expect(emitted).not.toBeNull();
    for (const alt of ['google[-_ ]?chrome', 'chromium', 'ungoogled[-_ ]?chromium', 'arc', 'dia']) {
      expect(emitted[1]).toContain(alt);
    }
  });
});

describe('bucket ID escaping', () => {
  test('escapes backslashes before quotes so escaping cannot be bypassed', () => {
    const query = editorActivityQuery(['aw-watcher-window_a\\"b']).join('\n');
    expect(query).toContain(String.raw`query_bucket("aw-watcher-window_a\\\"b")`);
  });
});

describe('browser regex escaping in generated query', () => {
  const params = {
    bid_window: 'aw-watcher-window_testhost',
    bid_afk: 'aw-watcher-afk_testhost',
    filter_afk: true,
    include_audible: false,
    categories: [],
    filter_categories: [],
  };

  test('arc bucket query emits single-backslash regex (not double-escaped)', () => {
    // Regression test for #1080: JSON.stringify was doubling backslashes, so
    // arc(\.exe)?$ became arc(\\.exe)?$ in the query text — aw-server-rust then
    // treated \\.exe as a literal backslash + any char + exe, so Arc.exe on
    // Windows never matched.
    const query = fullDesktopQuery({
      ...params,
      bid_browsers: ['aw-watcher-web-arc_testhost'],
    }).join('\n');
    expect(query).toContain('window_arc_re =');
    // After fix: single backslash (\.exe), not double (\\. exe)
    expect(query).toContain('arc(\\.exe)?$');
    expect(query).not.toContain('arc(\\\\.exe)?$');
  });

  test('no browser app regex is emitted with doubled backslashes', () => {
    // Generic guard for every pattern in browser_appname_regex: whatever the
    // server receives must keep a single backslash, otherwise patterns such as
    // arc(\.exe)?$ silently stop matching on Windows.
    const query = fullDesktopQuery({
      ...params,
      bid_browsers: Object.keys(browser_appname_regex).map(
        name => `aw-watcher-web-${name}_testhost`
      ),
    }).join('\n');
    const emitted = [...query.matchAll(/filter_keyvals_regex\(events, "app", "(.*)"\);/g)];
    expect(emitted.length).toBeGreaterThan(0);
    for (const [, pattern] of emitted) {
      expect(pattern).not.toContain('\\\\');
    }
    expect(query).toContain('window_arc_re =');
    expect(query).toContain('window_chrome_re =');
  });
});

describe('querystr_to_array', () => {
  test('splits simple multi-statement query correctly', () => {
    const query = 'events = query_bucket("aw-watcher-window_host"); RETURN = {"events": events};';
    const result = querystr_to_array(query);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('events = query_bucket("aw-watcher-window_host");');
    expect(result[1]).toBe('RETURN = {"events": events};');
  });

  test('does not split on semicolons inside string literals (category regex case)', () => {
    // A category rule with a semicolon in the regex — the naive .split(';') would shred this.
    const query = 'events = categorize(events, [["Work", {"type": "regex", "regex": "foo;bar"}]]);';
    const result = querystr_to_array(query);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(
      'events = categorize(events, [["Work", {"type": "regex", "regex": "foo;bar"}]]);'
    );
  });

  test('handles escaped double-quotes inside string literals', () => {
    const query = 'x = "say \\"hello;world\\""; RETURN = x;';
    const result = querystr_to_array(query);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('x = "say \\"hello;world\\"";');
    expect(result[1]).toBe('RETURN = x;');
  });

  test('filters out empty statements from whitespace-only segments', () => {
    const query = '\n  events = query_bucket("bucket");\n  RETURN = events;\n';
    const result = querystr_to_array(query);
    expect(result).toHaveLength(2);
  });
});

describe('browser_appnames Android 包名识别（同步上游 #1091）', () => {
  test('Chrome 系 Android 包名归入 chrome 桶', () => {
    for (const pkg of [
      'com.android.chrome',
      'com.chrome.beta',
      'com.chrome.dev',
      'com.chrome.canary',
      'org.bromite.cromite',
    ]) {
      expect(browser_appnames.chrome).toContain(pkg);
    }
  });

  test('Firefox 系 Android 包名归入 firefox 桶', () => {
    for (const pkg of ['org.mozilla.fenix', 'org.mozilla.firefox_beta', 'org.mozilla.focus']) {
      expect(browser_appnames.firefox).toContain(pkg);
    }
  });

  test('其它浏览器的 Android 包名归入各自分组', () => {
    expect(browser_appnames.opera).toEqual(
      expect.arrayContaining(['com.opera.Opera', 'com.opera.browser', 'com.opera.browser.beta'])
    );
    expect(browser_appnames.brave).toEqual(
      expect.arrayContaining([
        'com.brave.Browser',
        'com.brave.browser',
        'com.brave.browser_beta',
        'com.brave.browser_nightly',
      ])
    );
    expect(browser_appnames.edge).toEqual(
      expect.arrayContaining([
        'com.microsoft.Edge',
        'com.microsoft.EdgeDev',
        'com.microsoft.emmx',
        'com.microsoft.emmx.beta',
        'com.microsoft.emmx.dev',
      ])
    );
    expect(browser_appnames.vivaldi).toContain('com.vivaldi.browser');
    expect(browser_appnames.yandex).toContain('ru.yandex.browser');
  });

  test('相似包名不误伤：非浏览器包名与扩展后缀不进入任何分组', () => {
    const all = Object.values(browser_appnames).flat();
    for (const pkg of [
      'com.chromeos',
      'com.android.chrome.xxx',
      'com.chrome.beta.xxx',
      'com.brave.browser.xxx',
      'org.mozilla.firefox.xxx',
      'com.microsoft.emmx.xxx',
    ]) {
      expect(all).not.toContain(pkg);
    }
  });

  test('桌面端既有精确标识保留不回归', () => {
    expect(browser_appnames.chrome).toEqual(
      expect.arrayContaining(['com.google.Chrome', 'com.google.ChromeDev', 'org.chromium.Chromium'])
    );
    expect(browser_appnames.firefox).toEqual(
      expect.arrayContaining([
        'org.mozilla.firefox',
        'io.gitlab.librewolf-community',
        'net.waterfox.waterfox',
      ])
    );
    expect(browser_appnames.orion).toContain('Orion');
    expect(browser_appnames.zen).toContain('app.zen_browser.zen');
  });
});

describe('androidBrowserQuery 融合查询（同步上游 #1091）', () => {
  test('移动端包名按 package 精确匹配，不使用桌面 app 正则', () => {
    const joined = androidBrowserQuery(
      'aw-watcher-android_device',
      ['aw-watcher-web-firefox', 'aw-watcher-web-brave'],
      [],
      []
    ).join('\n');
    expect(joined).toContain('org.mozilla.fenix');
    expect(joined).toContain('com.brave.browser_nightly');
    // aw-android 把展示名放在 app、标识放在 package
    expect(joined).toContain('window_firefox = filter_keyvals(events, "package",');
    expect(joined).not.toContain('filter_keyvals(events, "app",');
    // Firefox 桌面端 "nightly" 备选会同时匹配 Brave Nightly，移动端不能用正则
    expect(joined).not.toContain('filter_keyvals_regex(events, "app"');
  });

  test.each([
    ['yandex', 'ru.yandex.browser'],
    ['edge', 'com.microsoft.emmx.dev'],
  ])('为 %s 的 Android 包名生成前台交集', (browser, androidPackage) => {
    const joined = androidBrowserQuery(
      'aw-watcher-android_device',
      [`aw-watcher-web-${browser}_phone`],
      [],
      []
    ).join('\n');
    const foregroundFilter = joined
      .split('\n')
      .find(line => line.includes(`window_${browser} = filter_keyvals(events, "package",`));
    expect(foregroundFilter).toContain(`"${androidPackage}"`);
    expect(joined).toContain(`filter_period_intersect(events_${browser}, window_${browser})`);
  });

  test('桶名里出现的浏览器名（主机名/profile）不被当作浏览器标识', () => {
    const joined = androidBrowserQuery(
      'aw-watcher-android_device',
      ['aw-watcher-web-firefox_chromephone', 'aw-watcher-web-brave_firefox-profile'],
      [],
      []
    ).join('\n');
    expect(joined.match(/filter_period_intersect/g)).toHaveLength(2);
    expect(joined).not.toContain('events_chrome =');
    expect(joined).toContain(
      'events_firefox = flood(query_bucket("aw-watcher-web-firefox_chromephone"))'
    );
    expect(joined).toContain(
      'events_brave = flood(query_bucket("aw-watcher-web-brave_firefox-profile"))'
    );
  });

  test('未知自定义浏览器名保留纯浏览器数据，不做前台交集', () => {
    const joined = androidBrowserQuery(
      'aw-watcher-android_device',
      ['aw-watcher-web-cromite_phone', 'aw-watcher-web-personal_phone', 'aw-watcher-web-arc_phone'],
      [],
      []
    ).join('\n');
    expect(joined).toContain('query_bucket("aw-watcher-web-cromite_phone")');
    expect(joined).toContain('query_bucket("aw-watcher-web-personal_phone")');
    expect(joined).toContain('query_bucket("aw-watcher-web-arc_phone")');
    expect(joined).not.toContain('filter_period_intersect');
    expect(joined).toContain('split_url_events');
  });

  test('同一浏览器多个 profile 桶全部查询', () => {
    const buckets = [
      'aw-watcher-web-firefox_profile1',
      'aw-watcher-web-firefox_profile2',
      'aw-watcher-web-firefox-synced-from-phone',
    ];
    const joined = androidBrowserQuery('aw-watcher-android_device', buckets, [], []).join('\n');
    for (const bucket of buckets) {
      expect(joined).toContain(`query_bucket("${bucket}")`);
    }
    expect(joined.match(/filter_period_intersect/g)).toHaveLength(3);
  });

  test('片段合并前保留全部浏览器聚合结果（不在查询内截断）', () => {
    const joined = androidBrowserQuery(
      'aw-watcher-android_device',
      ['aw-watcher-web-chrome'],
      [],
      []
    ).join('\n');
    expect(joined).not.toContain('limit_events(browser_');
  });

  test('保留事件时间戳，URL 交集使用真实前台时段', () => {
    const joined = androidBrowserQuery(
      'aw-watcher-android_device',
      ['aw-watcher-web-chrome'],
      [],
      [],
      false
    ).join('\n');
    // 未保留时间戳时 canonicalEvents 会按 app 合并，09:00–09:10 与 10:00–10:10
    // 会被压成 09:00 起的 20 分钟单事件，交集取错时段。
    expect(joined).not.toContain('merge_events_by_keys(events, ["app"])');
    expect(joined).not.toContain('merge_events_by_keys(events, ["app", "title"])');
    expect(joined).toContain('filter_period_intersect');
  });

  test('类别过滤不在浏览器前台时段选择之前应用', () => {
    const joined = androidBrowserQuery(
      'aw-watcher-android_device',
      ['aw-watcher-web-chrome'],
      [[['Work'], { type: 'regex', regex: 'Chrome' }]],
      [['Work']],
      false
    ).join('\n');
    expect(joined).not.toContain('filter_keyvals(events, "$category"');
    expect(joined).toContain('com.android.chrome');
  });

  test('RETURN 包含浏览器 domains、urls、titles、duration', () => {
    const joined = androidBrowserQuery(
      'aw-watcher-android_device',
      ['aw-watcher-web-chrome'],
      [],
      [],
      false
    ).join('\n');
    expect(joined).toContain('"domains"');
    expect(joined).toContain('"urls"');
    expect(joined).toContain('"titles"');
    expect(joined).toContain('"duration"');
  });
});
