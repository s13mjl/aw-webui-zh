import _ from 'lodash';

// TODO: Sanitize string input of buckets

export function querystr_to_array(querystr: string): string[] {
  // Split on ';' but only when not inside a double-quoted string literal.
  // A naive .split(';') breaks category rules whose regex contains semicolons,
  // e.g. `"regex": "foo;bar"` would be shredded before reaching the server.
  const statements: string[] = [];
  let current = '';
  let inString = false;
  let inEscape = false;

  for (const char of querystr) {
    if (inEscape) {
      current += char;
      inEscape = false;
    } else if (char === '\\' && inString) {
      current += char;
      inEscape = true;
    } else if (char === '"') {
      inString = !inString;
      current += char;
    } else if (char === ';' && !inString) {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed + ';');
      current = '';
    } else {
      current += char;
    }
  }

  const trimmed = current.trim();
  if (trimmed) statements.push(trimmed + ';');

  return statements;
}

function escape_doublequote(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// Hostname safe for using as a variable name
export function safeHostname(hostname: string): string {
  return hostname.replace(/[^a-zA-Z0-9_]/g, '');
}

interface Rule {
  type: string;
  regex?: string;
}

type Category = [string[], Rule];

interface BaseQueryParams {
  include_audible?: boolean;
  categories: Category[];
  filter_categories: string[][];
  bid_browsers?: string[];
  bid_stopwatch?: string;
  return_variable_suffix?: string;
}

interface DesktopQueryParams extends BaseQueryParams {
  bid_window: string;
  bid_afk: string;
  filter_afk: boolean;
  always_active_pattern?: string;
}

interface AndroidQueryParams extends BaseQueryParams {
  bid_android: string;
  /** 桶是否为 aw-import-screentime（iOS）导入。ScreenTime 事件带 title 键；
   *  aw-watcher-android 事件不带。保持默认 false，避免合并时因缺键丢掉全部事件。 */
  isIos?: boolean;
  /** 保留原始（flood 后的）应用事件，不预先按 app 合并。
   *  当事件需要与其它时间线（如多设备、浏览器 URL 融合）合并时必须置 true：
   *  merge_events_by_keys 会把每个应用压成首条时间戳、时长累加的单事件，
   *  后续与其它时间线做周期交集会取错时钟时段。 */
  keep_event_timestamps?: boolean;
}

interface MultiQueryParams extends BaseQueryParams {
  hosts: string[];
  filter_afk: boolean;
  always_active_pattern: string;
  // This can be used to override params on a per-host basis
  host_params: { [host: string]: DesktopQueryParams | AndroidQueryParams };
}

function get_params(
  params: MultiQueryParams,
  host: string
): DesktopQueryParams | AndroidQueryParams {
  // Return the params for a given host, based on the self params and any overrides in host_params.
  // If no overrides are found, return the base params.
  const new_params: DesktopQueryParams = {
    ...params,
    bid_window: 'aw-watcher-window_' + host,
    bid_afk: 'aw-watcher-afk_' + host,
    bid_browsers: [],
    return_variable_suffix: safeHostname(host),
  };

  const host_params = params.host_params[host];
  if (host_params) {
    if (!isDesktopParams(host_params)) {
      console.error(`Invalid host_params for host ${host}: ${JSON.stringify(host_params)}`);
    }
    // Only override the params if they are defined and set to a truthy value
    Object.keys(host_params).forEach(key => {
      if (host_params[key] && host_params[key].length > 0) {
        new_params[key] = host_params[key];
      }
    });
  }
  return new_params;
}

function isDesktopParams(object: any): object is DesktopQueryParams {
  return 'bid_window' in object;
}

function isAndroidParams(object: any): object is AndroidQueryParams {
  return 'bid_android' in object;
}

function isMultiParams(object: any): object is MultiQueryParams {
  return 'hosts' in object;
}

// Use query_bucket directly when we have a full bucket ID (contains hostname after the prefix).
// Fall back to find_bucket only when the ID is partial (ends with '_', meaning hostname is unknown).
// This avoids find_bucket matching wrong buckets when similar names exist (e.g. host vs host.local).
// See: https://github.com/ActivityWatch/aw-webui/issues/590
function queryBucket(bid: string): string {
  if (bid.endsWith('_')) {
    return `query_bucket(find_bucket("${bid}"))`;
  }
  return `query_bucket("${bid}")`;
}

// Constructs a query that returns a fully-detailed list of events from the merging of several sources (window, afk, web).
// Performs:
//  - AFK filtering (if filter_afk is true)
//  - Categorization (if categories specified)
//  - Filters by category (if filter_categories set)
// Puts it's results in `events` and `not_afk` (if not_afk available for platform).
export function canonicalEvents(params: DesktopQueryParams | AndroidQueryParams): string {
  // Needs escaping for regex patterns like '\w' to work (JSON.stringify adds extra unnecessary escaping)
  const categories_str = params.categories
    ? JSON.stringify(params.categories).replace(/\\\\/g, '\\')
    : '';
  const always_active_pattern_str = isDesktopParams(params)
    ? params.always_active_pattern
    : undefined;
  const cat_filter_str = JSON.stringify(params.filter_categories);

  // For simplicity, we assume that bid_window and bid_android are exchangeable (note however it needs special treatment)
  const bid_window = isDesktopParams(params) ? params.bid_window : params.bid_android;

  return [
    // Fetch window/app events
    `events = flood(${queryBucket(bid_window)});`,
    // On Android, merge events to avoid overload of events.
    // keep_event_timestamps 置 true 时（需要与其它时间线做周期交集）保留原始事件；
    // ScreenTime(iOS) 事件带 title，合并键需包含 title，否则缺键会丢掉全部事件。
    isAndroidParams(params) && !params.keep_event_timestamps
      ? params.isIos
        ? 'events = merge_events_by_keys(events, ["app", "title"]);'
        : 'events = merge_events_by_keys(events, ["app"]);'
      : '',
    // Fetch not-afk events
    isDesktopParams(params)
      ? `not_afk = flood(${queryBucket(params.bid_afk)});
         not_afk = filter_keyvals(not_afk, "status", ["not-afk"]);` +
        (always_active_pattern_str
          ? `not_treat_as_afk = filter_keyvals_regex(events, "app", "${always_active_pattern_str}");
             not_afk = period_union(not_afk, not_treat_as_afk);
             not_treat_as_afk = filter_keyvals_regex(events, "title", "${always_active_pattern_str}");
             not_afk = period_union(not_afk, not_treat_as_afk);`
          : '')
      : '',
    // Fetch browser events
    isDesktopParams(params) && params.bid_browsers
      ? browserEvents(params) +
        // Include audible browser events as indications of not-afk.
        // audible_events was collected from ALL browser events (including
        // background tabs) inside browserEvents(), so background audio
        // correctly counts as active. See #852.
        (params.include_audible ? `not_afk = period_union(not_afk, audible_events);` : '')
      : '',
    // Filter out window events when the user was afk
    isDesktopParams(params) && params.filter_afk
      ? 'events = filter_period_intersect(events, not_afk);'
      : '',
    params.bid_stopwatch
      ? `stopwatch_events = query_bucket("${params.bid_stopwatch}");
         events = union_no_overlap(stopwatch_events, events);`
      : 'stopwatch_events = [];',
    // Categorize
    params.categories ? `events = categorize(events, ${categories_str});` : '',
    // Filter out selected categories
    params.filter_categories
      ? `events = filter_keyvals(events, "$category", ${cat_filter_str});`
      : '',
    // "Return" events by setting variable named with return_variable if set
    params.return_variable_suffix
      ? `events_${params.return_variable_suffix} = events;
         not_afk_${params.return_variable_suffix} = not_afk;`
      : '',
  ].join('\n');
}

export function canonicalMultideviceEvents(params: MultiQueryParams): string {
  // First, query each device individually
  const queries: string[] = _.map(params.hosts, hostname => {
    return canonicalEvents(get_params(params, hostname));
  });

  // Now we need to combine the queries to get a single series of events.
  // To do this, we can use the union_no_overlap function, which merges events
  // but avoids overlaps by giving priority according to the order of hosts.
  let query = queries.join('\n');
  query += 'events = [];';
  query += 'not_afk = [];';
  for (let i = 0; i < queries.length; i++) {
    query += `
    events = union_no_overlap(events, events_${safeHostname(params.hosts[i])});
    not_afk = union_no_overlap(not_afk, not_afk_${safeHostname(params.hosts[i])});
    `;
  }

  return query;
}

export const default_limit = 100; // Hardcoded limit per group

export function appQuery(
  appbucket: string,
  categories: Category[],
  filter_categories: string[][]
): string[] {
  appbucket = escape_doublequote(appbucket);
  const params: AndroidQueryParams = {
    bid_android: appbucket,
    categories,
    filter_categories,
  };

  const code = `
    ${canonicalEvents(params)}

    title_events = sort_by_duration(merge_events_by_keys(events, ["app", "classname"]));
    app_events   = sort_by_duration(merge_events_by_keys(title_events, ["app"]));
    cat_events   = sort_by_duration(merge_events_by_keys(events, ["$category"]));

    events = sort_by_timestamp(events);
    app_events  = limit_events(app_events, ${default_limit});
    title_events  = limit_events(title_events, ${default_limit});
    duration = sum_durations(events);
    RETURN  = {"app_events": app_events, "title_events": title_events, "cat_events": cat_events, "duration": duration, "active_events": app_events};
  `;
  return querystr_to_array(code);
}

// Exact app names (Flatpak app IDs and similar reverse-domain identifiers) used for bucket discovery and as a
// fallback for names that don't match the regex patterns below. Process name
// variants (upper/lowercase, spacing, .exe suffix) are handled by
// browser_appname_regex using (?i) flag. See test/unit/queries.test.node.ts for
// the complete list of known app names these patterns cover.
export const browser_appnames: Record<string, string[]> = {
  chrome: [
    // 桌面端（Flatpak / macOS bundle ID）
    'com.google.Chrome',
    'com.google.ChromeDev',
    'org.chromium.Chromium',
    // Android 包名——使用 chrome 扩展桶的 Chromium 系浏览器
    'com.android.chrome',
    'com.chrome.beta',
    'com.chrome.dev',
    'com.chrome.canary',
    'org.bromite.cromite', // Cromite 是 Chromium 分支；其扩展上报为 chrome
  ],
  firefox: [
    // 桌面端
    'org.mozilla.firefox',
    'io.gitlab.librewolf-community',
    'net.waterfox.waterfox',
    // Android
    'org.mozilla.fenix',
    'org.mozilla.firefox_beta',
    'org.mozilla.focus',
  ],
  opera: ['com.opera.Opera', 'com.opera.browser', 'com.opera.browser.beta'],
  brave: [
    'com.brave.Browser',
    'com.brave.browser',
    'com.brave.browser_beta',
    'com.brave.browser_nightly',
  ],
  edge: [
    'com.microsoft.Edge',
    'com.microsoft.EdgeDev',
    'com.microsoft.emmx',
    'com.microsoft.emmx.beta',
    'com.microsoft.emmx.dev',
  ],
  arc: [],
  vivaldi: ['com.vivaldi.Vivaldi', 'com.vivaldi.browser'],
  orion: ['Orion'],
  yandex: ['ru.yandex.Browser', 'ru.yandex.browser'],
  zen: ['app.zen_browser.zen'],
  floorp: ['one.ablaze.floorp'],
  helium: ['net.imput.helium'],
};

// Returns a list of (browserName, bucketId) pairs for found browser buckets
function browsersWithBuckets(browserbuckets: string[]): [string, string][] {
  const browsername_to_bucketid: [string, string | undefined][] = _.map(
    Object.keys(browser_appnames),
    browserName => {
      const bucketId = _.find(browserbuckets, bucket_id => _.includes(bucket_id, browserName));
      return [browserName, bucketId];
    }
  );
  // Skip browsers for which a bucket couldn't be found
  return _.filter(browsername_to_bucketid, ([, bucketId]) => bucketId !== undefined);
}

// Case-insensitive regex patterns covering all OS/platform process name variants
// (Windows .exe, Linux lowercase, macOS capitalized, versioned names like firefox-esr-esr140).
// Used with filter_keyvals_regex in addition to the exact names in browser_appnames.
// The full set of historical app names these patterns replace is documented in the unit tests.
// See: test/unit/queries.test.node.ts, https://github.com/ActivityWatch/aw-webui/issues/749
//
// Ungoogled Chromium runs the Chrome Web Store build of the browser extension like the other
// Chromium forks, so its events land in the chrome bucket too. Its process names
// ("ungoogled-chromium", "ungoogled_chromium", "Ungoogled Chromium") do not start with
// "chromium", so the plain chromium alternative below misses them. It has no dedicated bucket
// of its own, so it belongs with the prefix-matched alternatives rather than an anchored one.
export const browser_appname_regex: Record<string, string> = {
  // Chromium forks (Arc, Dia) run the chrome build of the extension, which announces itself
  // as chrome unless the user overrides the browser name in the extension settings. So by
  // default their events land in the chrome bucket and their app names have to be matched
  // here (#927, ActivityWatch/activitywatch#1094). The standalone arc key below only covers
  // setups where Arc was picked explicitly in the settings, which changes the bucket name.
  chrome:
    '(?i)^(google[-_ ]?chrome|chrome|chromium|arc(\\.exe)?$|dia(\\.exe)?$|ungoogled[-_ ]?chromium)',
  firefox: '(?i)(firefox|librewolf|waterfox|nightly)',
  opera: '(?i)(opera)',
  brave: '(?i)(brave)',
  edge: '(?i)^(microsoft[-_ ]?edge|msedge)',
  arc: '(?i)^arc(\\.exe)?$',
  vivaldi: '(?i)(vivaldi)',
  orion: '(?i)(orion)',
  yandex: '(?i)(yandex)',
  zen: '(?i)(zen)',
  floorp: '(?i)(floorp)',
  helium: '(?i)(helium)',
};

// Returns a list of active browser events (where the browser was the active window) from all browser buckets
function browserEvents(params: DesktopQueryParams): string {
  let code = `
    browser_events = [];
  `;

  // When include_audible is set, collect audible events from ALL browser
  // events (before the focus filter below) so that background audio tabs
  // count as active. The previous approach filtered for audible after the
  // focus filter, which excluded background audio and could fragment the
  // not_afk periods — see #852.
  if (params.include_audible) {
    code += `audible_events = [];`;
  }

  _.each(browsersWithBuckets(params.bid_browsers), ([browserName, bucketId]) => {
    const browser_appnames_str = JSON.stringify(browser_appnames[browserName]);
    code += `events_${browserName} = flood(query_bucket("${bucketId}"));`;

    // Collect audible events from ALL browser events (before focus filter)
    if (params.include_audible) {
      code += `
       audible_${browserName} = filter_keyvals(events_${browserName}, "audible", [true]);
       audible_events = concat(audible_events, audible_${browserName});`;
    }

    code += `
       window_${browserName} = filter_keyvals(events, "app", ${browser_appnames_str});`;

    // Add regex-based matching to cover case/spacing/versioning variants (e.g., Firefox.exe, firefox-esr-esr140)
    const pattern = browser_appname_regex[browserName];
    if (pattern) {
      // JSON.stringify adds extra unnecessary escaping for backslashes (e.g. '\.' becomes '\\.')
      // which breaks regex patterns like arc(\.exe)?$ on Windows. Undo the double-escaping.
      const pattern_str = JSON.stringify(pattern).replace(/\\\\/g, '\\');
      code += `
       window_${browserName}_re = filter_keyvals_regex(events, "app", ${pattern_str});
       window_${browserName} = sort_by_timestamp(concat(window_${browserName}, window_${browserName}_re));`;
    }

    code += `
       events_${browserName} = filter_period_intersect(events_${browserName}, window_${browserName});
       events_${browserName} = split_url_events(events_${browserName});
       browser_events = concat(browser_events, events_${browserName});
       browser_events = sort_by_timestamp(browser_events);`;
  });
  return code;
}

export function fullDesktopQuery(params: DesktopQueryParams): string[] {
  return querystr_to_array(
    `
    ${canonicalEvents({
      ...params,
      // Escape `"`
      bid_window: escape_doublequote(params.bid_window),
      bid_afk: escape_doublequote(params.bid_afk),
      bid_browsers: _.map(params.bid_browsers, escape_doublequote),
    })}
    title_events = sort_by_duration(merge_events_by_keys(events, ["app", "title"]));
    app_events   = sort_by_duration(merge_events_by_keys(title_events, ["app"]));
    cat_events   = sort_by_duration(merge_events_by_keys(events, ["$category"]));

    app_events  = limit_events(app_events, ${default_limit});
    title_events  = limit_events(title_events, ${default_limit});
    duration = sum_durations(events);
    ` + // Browser events are retrieved in canonicalQuery
      `
    browser_events = split_url_events(browser_events);
    browser_urls = merge_events_by_keys(browser_events, ["url"]);
    browser_urls = sort_by_duration(browser_urls);
    browser_urls = limit_events(browser_urls, ${default_limit});
    browser_domains = merge_events_by_keys(browser_events, ["$domain"]);
    browser_domains = sort_by_duration(browser_domains);
    browser_domains = limit_events(browser_domains, ${default_limit});
    browser_titles = merge_events_by_keys(browser_events, ["title"]);
    browser_titles = sort_by_duration(browser_titles);
    browser_titles = limit_events(browser_titles, ${default_limit});
    browser_duration = sum_durations(browser_events);
    stopwatch_events = merge_events_by_keys(stopwatch_events, ["label"]);
    stopwatch_events = sort_by_duration(stopwatch_events);
    stopwatch_events = limit_events(stopwatch_events, ${default_limit});

    RETURN = {
        "window": {
            "app_events": app_events,
            "title_events": title_events,
            "cat_events": cat_events,
            "active_events": not_afk,
            "duration": duration
        },
        "browser": {
            "domains": browser_domains,
            "urls": browser_urls,
            "titles": browser_titles,
            "duration": browser_duration
        },
        "stopwatch": {
            "stopwatch_events": stopwatch_events
        }
    };`
  );
}

// Performs a query that combines data from multiple devices.
// A multidevice-variant of fullDesktopQuery (with limitations).
//
// 1. Performs one canonicalEvents query per device.
// 2. Combines the results into a single list of events using the transform union_no_overlap (which gives priority to events earlier in the list of devices).
// 3. Compute the statistics of interest.
//
// NOTE: Events from devices are picked in the order of the hostnames array, such that if overlaps are detected the conflict will be resolved by choosing events from the earlier device.
// NOTE: Only supports desktop devices (for now)
// NOTE: Doesn't support browser buckets (and therefore not browser audible detection either)
//       This is due to the 'unknown' hostname of browser buckets (will hopefully be fixed soon).
export function multideviceQuery(params: MultiQueryParams): string[] {
  return querystr_to_array(
    `
    ${canonicalMultideviceEvents(params)}
    title_events = sort_by_duration(merge_events_by_keys(events, ["app", "title"]));
    app_events   = sort_by_duration(merge_events_by_keys(title_events, ["app"]));
    cat_events   = sort_by_duration(merge_events_by_keys(events, ["$category"]));

    app_events  = limit_events(app_events, ${default_limit});
    title_events  = limit_events(title_events, ${default_limit});
    duration = sum_durations(events);

    RETURN = {
        "window": {
            "app_events": app_events,
            "title_events": title_events,
            "cat_events": cat_events,
            "active_events": not_afk,
            "duration": duration
        }
    };`
  );
}

export function editorActivityQuery(editorbuckets: string[]): string[] {
  let q = ['events = [];'];
  for (const editorbucket of editorbuckets) {
    q.push(`events = concat(events, flood(query_bucket("${escape_doublequote(editorbucket)}")));`);
  }
  q = q.concat([
    'files = sort_by_duration(merge_events_by_keys(events, ["file", "language"]));',
    `files = limit_events(files, ${default_limit});`,
    'languages = sort_by_duration(merge_events_by_keys(events, ["language"]));',
    `languages = limit_events(languages, ${default_limit});`,
    'projects = sort_by_duration(merge_events_by_keys(events, ["project"]));',
    `projects = limit_events(projects, ${default_limit});`,
    'duration = sum_durations(events);',
    'RETURN = {"files": files, "languages": languages, "projects": projects, "duration": duration};',
  ]);
  return q;
}

// Returns a query that yields a single event with the duration set to
// the sum of all non-afk time in the queried period
// TODO: Would ideally account for `filter_afk` and `always_active_pattern`
// TODO: rename to something like `activeDurationQuery`
// FIXME: Doesn't respect audible-as-active and always-active-pattern
export function activityQuery(afkbuckets: string[]): string[] {
  let q = ['not_afk = [];'];
  for (const afkbucket of afkbuckets) {
    q = q.concat([
      `not_afk_curr = query_bucket("${escape_doublequote(afkbucket)}");`,
      `not_afk_curr = filter_keyvals(not_afk_curr, "status", ["not-afk"]);`,
      `not_afk = union_no_overlap(not_afk, not_afk_curr);`,
    ]);
  }
  q = q.concat(['not_afk = merge_events_by_keys(not_afk, ["status"]);', 'RETURN = not_afk;']);
  return q;
}

// Equivalent function to activityQuery, but for Android (which doesn't have an afk bucket)
export function activityQueryAndroid(androidbucket: string): string[] {
  androidbucket = escape_doublequote(androidbucket);
  return [`events = query_bucket("${androidbucket}");`, 'RETURN = sum_durations(events);'];
}

// 融合 Android 应用数据与浏览器 URL 数据的查询（取交集）。
// 对同时存在 aw-watcher-web 桶与匹配 Android 应用事件的浏览器，URL 事件只保留
// 该浏览器在 Android 设备上处于前台的时段；与桌面端 fullDesktopQuery 融合窗口焦点
// 与浏览器 URL 的方式对应。
//
// 返回 { browser: { domains, urls, titles, duration } }，结构与 fullDesktopQuery
// 的 browser 段一致，可被 query_browser_completed 直接消费。
export function androidBrowserQuery(
  bid_android: string,
  bid_browsers: string[],
  categories: Category[],
  filter_categories: string[][],
  isIos = false
): string[] {
  bid_android = escape_doublequote(bid_android);
  const escaped_browsers = bid_browsers.map(escape_doublequote);
  // keep_event_timestamps：merge_events_by_keys 会把每个应用压成首条时间戳、时长累加的
  // 单事件，URL 交集就会取错时钟时段（Chrome 09:00–09:10 与 10:00–10:10 会变成
  // 09:00 起的 20 分钟事件）。与多设备路径合并 Android 事件时使用同一开关。
  // filter_categories 为与 appQuery 签名对齐而传入，但此处不能应用：选中排除浏览器应用的
  // 类别会丢掉其前台时段（进而丢掉其 URL），即便这些站点本属于所选类别。桌面端是在类别
  // 过滤之前先选浏览器时段；此前的 Android 纯浏览器查询也忽略了类别过滤。
  const params: AndroidQueryParams = {
    bid_android,
    categories,
    filter_categories,
    isIos,
    keep_event_timestamps: true,
  };
  // 与桌面选择器不同，每个浏览器的全部 profile 桶都保留。
  const browsers: [string, string][] = Object.keys(browser_appnames)
    .filter(browserName => browser_appnames[browserName].length > 0)
    .flatMap(browserName =>
      escaped_browsers
        .filter(
          bucketId =>
            bucketId === `aw-watcher-web-${browserName}` ||
            bucketId.startsWith(`aw-watcher-web-${browserName}_`) ||
            bucketId.startsWith(`aw-watcher-web-${browserName}-synced-from-`)
        )
        .map(bucketId => [browserName, bucketId] as [string, string])
    );

  // 仿照 browserEvents()，但依赖 canonicalEvents(AndroidQueryParams) 产出的
  // `events` 变量（即 Android 应用事件）。对 "package" 做精确 filter_keyvals 匹配，
  // 选出浏览器在 Android 前台的时段，形成真正的交集而非原始 URL 累计。
  let browser_code = `browser_events = [];`;
  _.each(browsers, ([browserName, bucketId]) => {
    const appnames_str = JSON.stringify(browser_appnames[browserName]);
    browser_code += `
      events_${browserName} = flood(query_bucket("${bucketId}"));
      window_${browserName} = filter_keyvals(events, "package", ${appnames_str});`;
    // 移动 watcher 事件把展示名放在 app、精确 ID 放在 package；桌面端子串正则
    // 可能误选到别的浏览器（例如 Firefox 的 "nightly" 会匹配 Brave Nightly）。
    browser_code += `
      events_${browserName} = filter_period_intersect(events_${browserName}, window_${browserName});
      events_${browserName} = split_url_events(events_${browserName});
      browser_events = concat(browser_events, events_${browserName});
      browser_events = sort_by_timestamp(browser_events);`;
  });

  // 自定义扩展名没有已知的包名映射；保留此前的纯浏览器行为，避免直接丢弃这些桶。
  const matchedBuckets = new Set(browsers.map(([, bucketId]) => bucketId));
  escaped_browsers
    .filter(bucketId => !matchedBuckets.has(bucketId))
    .forEach((bucketId, i) => {
      browser_code += `
      events_custom_${i} = flood(query_bucket("${bucketId}"));
      events_custom_${i} = split_url_events(events_custom_${i});
      browser_events = concat(browser_events, events_custom_${i});`;
    });

  const code = `
    ${canonicalEvents({
      ...params,
      // 类别过滤在此不应用（见上方注释）；空列表在本地 canonicalEvents 中仍为真值，
      // 故用 undefined 明确跳过该步骤。
      filter_categories: undefined as string[][],
    })}
    ${browser_code}
    browser_urls = merge_events_by_keys(browser_events, ["url"]);
    browser_urls = sort_by_duration(browser_urls);
    browser_domains = merge_events_by_keys(browser_events, ["$domain"]);
    browser_domains = sort_by_duration(browser_domains);
    browser_titles = merge_events_by_keys(browser_events, ["title"]);
    browser_titles = sort_by_duration(browser_titles);
    browser_duration = sum_durations(browser_events);
    RETURN = {
      "browser": {
        "domains": browser_domains,
        "urls": browser_urls,
        "titles": browser_titles,
        "duration": browser_duration
      }
    };
  `;
  return querystr_to_array(code);
}

// Returns a query that yields a dict with a key "cat_events" which is an
// array of one event per category, with the duration of each event set to the sum of the category durations.
export function categoryQuery(
  params: MultiQueryParams | DesktopQueryParams | AndroidQueryParams
): string[] {
  const q = `
  ${isMultiParams(params) ? canonicalMultideviceEvents(params) : canonicalEvents(params)}
  cat_events   = sort_by_duration(merge_events_by_keys(events, ["$category"]));
  RETURN = { "cat_events": cat_events };
`;
  return querystr_to_array(q);
}

export default {
  fullDesktopQuery,
  multideviceQuery,
  appQuery,
  androidBrowserQuery,
  activityQuery,
  activityQueryAndroid,
  categoryQuery,
  editorActivityQuery,
};
