import { defineStore } from 'pinia';
import moment, { Moment } from 'moment';
import { getClient } from '~/util/awclient';
import { Category, CategorySet, defaultCategories, cleanCategory } from '~/util/classes';
import { SavedQuery } from '~/util/savedQueries';
import { View, defaultViews } from '~/stores/views';
import type { PrivacyFilterRule } from '~/util/privacyFilters';
import { cloneDeep, isEqual } from 'lodash';
import { AppLocale, i18n, isAppLocale, setAppLocale } from '~/i18n';

function jsonEq(a: any, b: any) {
  const jsonA = JSON.parse(JSON.stringify(a));
  const jsonB = JSON.parse(JSON.stringify(b));
  return isEqual(jsonA, jsonB);
}

let settingsLoadPromise: Promise<void> | null = null;

// Backoffs for NewReleaseNotification
export const SHORT_BACKOFF_PERIOD = 24 * 60 * 60;
export const LONG_BACKOFF_PERIOD = 5 * 24 * 60 * 60;

// Initial wait period for UserSatisfactionPoll
export const INITIAL_WAIT_PERIOD = 7 * 24 * 60 * 60;

interface State {
  // Timestamp when user was first seen (first time webapp is run)
  initialTimestamp: Moment;

  startOfDay: string;
  startOfWeek: string;
  durationDefault: number;
  useColorFallback: boolean;
  landingpage: string;
  theme: 'light' | 'dark' | 'auto';
  locale: string;

  newReleaseCheckData: Record<string, any>;
  userSatisfactionPollData: {
    isEnabled: boolean;
    nextPollTime: Moment;
    timesPollIsShown: number;
  };
  uncategorizedNotificationData: {
    isEnabled: boolean;
    // Below this total tracked duration (seconds) the hint is hidden —
    // avoids nagging on quiet days.
    minTotalSeconds: number;
    // Hint shows when the uncategorized fraction crosses this ratio.
    minRatio: number;
  };
  always_active_pattern: string;
  privacy_filters: PrivacyFilterRule[];
  classes: Category[];
  // Named category sets — each set is an independent collection of category rules.
  // The active_set_ids list controls which sets are combined (in priority order).
  category_sets: CategorySet[];
  // Ordered list of active set IDs. First entry has highest priority when merging.
  active_set_ids: string[];
  views: View[];
  saved_queries: SavedQuery[];
  // Words the Category Builder's "Ignore" button hides from its suggestions.
  category_builder_ignored_words: string[];

  // Whether to show certain WIP features
  devmode: boolean;
  useMultidevice: boolean;
  requestTimeout: number;

  // Whether to hide visualizations that lack required data (default: off)
  hideUnsupportedVisualizations: boolean;

  // Auto-export all buckets as JSON for backup. See #406.
  autoBackupEnabled: boolean;
  autoBackupIntervalHours: number;
  autoBackupLastTime: string; // ISO timestamp of last backup

  // Set to true if settings loaded
  _loaded: boolean;
  // 服务端实际已保存过的键（下划线开头，不参与持久化），供通知组件判断是否首次初始化。
  _storedKeys: string[];
}

export const useSettingsStore = defineStore('settings', {
  state: (): State => ({
    initialTimestamp: moment(),

    startOfDay: '04:00',
    startOfWeek: 'Monday',
    durationDefault: 4 * 60 * 60,
    useColorFallback: false,
    landingpage: '/home',

    theme: 'auto',
    locale: 'en',

    newReleaseCheckData: {
      isEnabled: true,
      nextCheckTime: moment().add(SHORT_BACKOFF_PERIOD, 'seconds'),
      howOftenToCheck: SHORT_BACKOFF_PERIOD,
      timesChecked: 0,
    },
    userSatisfactionPollData: {
      isEnabled: true,
      nextPollTime: moment().add(INITIAL_WAIT_PERIOD, 'seconds'),
      timesPollIsShown: 0,
    },
    uncategorizedNotificationData: {
      isEnabled: true,
      minTotalSeconds: 60 * 60, // 1 hour
      minRatio: 0.3, // 30%
    },

    always_active_pattern: '',
    privacy_filters: [],
    classes: defaultCategories,
    category_sets: [],
    active_set_ids: ['default'],
    views: defaultViews,
    saved_queries: [],
    category_builder_ignored_words: [],

    // Developer settings
    // NOTE: PRODUCTION might be undefined (in tests, for example)
    devmode: typeof PRODUCTION === 'undefined' ? true : !PRODUCTION,
    useMultidevice: false,
    requestTimeout: 30,
    hideUnsupportedVisualizations: false,

    // Auto-export backup (disabled by default, weekly). See #406.
    autoBackupEnabled: false,
    autoBackupIntervalHours: 24 * 7,
    autoBackupLastTime: '',

    _loaded: false,
    _storedKeys: [],
  }),

  getters: {
    loaded(state: State) {
      return state._loaded;
    },
  },

  actions: {
    async ensureLoaded() {
      if (this.loaded) {
        return;
      }

      if (!settingsLoadPromise) {
        settingsLoadPromise = this.load().finally(() => {
          settingsLoadPromise = null;
        });
      }

      await settingsLoadPromise;
    },
    async load({ save }: { save?: boolean } = {}) {
      if (typeof localStorage === 'undefined') {
        console.error('localStorage is not supported');
        return;
      }
      const client = getClient();

      // Fetch from server, fall back to localStorage
      const server_settings = await client.get_settings();

      // 记录服务端已保存的键，供通知组件区分首次初始化与后续加载。
      this._storedKeys = Object.keys(server_settings).filter(key => !key.startsWith('_'));

      // Build a unified map: server value wins, localStorage is fallback.
      // Skip keys that are missing from BOTH sources — otherwise `null` from
      // localStorage.getItem overrides the defaults defined in `state()`.
      const storage: Record<string, unknown> = {};
      const used = new Set<string>();

      // 1. Server settings take priority
      for (const key of Object.keys(server_settings)) {
        if (key.startsWith('_')) continue;
        if (key === 'locale' && !isAppLocale(server_settings[key])) {
          console.warn('Ignoring invalid locale from server:', server_settings[key]);
          continue;
        }
        storage[key] = server_settings[key];
        used.add(key);
      }

      // 2. localStorage fills in gaps, but skip missing keys (null)
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('_') || used.has(key)) continue;
        const raw = localStorage.getItem(key);
        if (raw === null || raw === 'null') continue; // key absent or stored as null → keep state() default

        // Keys ending with 'Data' are JSON-serialized objects in localStorage
        const isJsonKey =
          key.endsWith('Data') ||
          key == 'views' ||
          key == 'classes' ||
          key == 'category_sets' ||
          key == 'active_set_ids' ||
          key == 'saved_queries' ||
          key == 'category_builder_ignored_words';
        try {
          if (isJsonKey) {
            let parsed = JSON.parse(raw);
            if (key == 'classes') {
              parsed = parsed.map(cleanCategory);
            }
            storage[key] = parsed;
          } else if (raw === 'true' || raw === 'false') {
            storage[key] = raw === 'true';
          } else if (key === 'locale') {
            if (isAppLocale(raw)) {
              storage[key] = raw;
            } else {
              console.warn('Ignoring invalid locale from storage:', raw);
            }
          } else {
            storage[key] = raw;
          }
        } catch (e) {
          console.error('failed to parse', key, raw, e);
        }
      }
      this.$patch({ ...storage, _loaded: true });

      const localeFromServer = 'locale' in server_settings;
      const localeFromLocalStorage = localStorage.getItem('locale') != null;

      if ((localeFromServer || localeFromLocalStorage) && isAppLocale(this.locale)) {
        setAppLocale(this.locale);
      } else if (isAppLocale(i18n.locale)) {
        this.$patch({ locale: i18n.locale as AppLocale });
      }

      // Since `requestTimeout` is used to initialize the client, we need to set it again
      // https://github.com/ActivityWatch/activitywatch/issues/979
      client.req.defaults.timeout = this.requestTimeout * 1000;

      if (save) {
        await this.save();
      }
    },
    // 省略 keys 时保留全量保存/迁移行为；传入 [] 表示本次不保存任何键。
    async save(explicitKeys?: string[]) {
      // Important check, to avoid saving settings before they are loaded (potentially overwriting them with defaults)
      if (!this.loaded) {
        console.error('Settings not loaded, not saving');
        return;
      }
      // 在等待网络前先捕获本次保存的意图：另一个保存操作的 reload 可能在本保存
      // 仍在进行时替换共享状态，快照可避免过期会话覆盖别处已确认的设置。
      const settings = cloneDeep(this.$state);
      const keys = explicitKeys?.slice();

      // We want to avoid saving to localStorage to not accidentally mess up pre-migration data
      // For example, if the user is using several browsers, and opened in their non-main browser on first run after upgrade.
      const saveToLocalStorage = false;

      // Save to localStorage and backend
      // NOTE: localStorage deprecated, will be removed in future
      const client = getClient();

      // Fetch current settings from server
      const server_settings = await client.get_settings();

      // Save settings
      for (const key of Object.keys(settings)) {
        // 指定了 keys 时，只保存调用方显式更新的键，避免过期会话覆盖无关设置。
        if (keys && !keys.includes(key)) continue;

        // Skip keys starting with underscore, as they are local to the vuex store.
        if (key.startsWith('_')) {
          continue;
        }

        const value = settings[key];

        // Save to localStorage
        // NOTE: we always save the theme and landingpage to localStorage, since they are used before the settings are loaded
        if (saveToLocalStorage || key == 'theme' || key == 'landingpage') {
          if (typeof value === 'object') {
            localStorage.setItem(key, JSON.stringify(value));
          } else {
            localStorage.setItem(key, value);
          }
        }

        // Save changed settings to backend
        if (server_settings[key] === undefined || !jsonEq(server_settings[key], value)) {
          if (server_settings[key] === undefined && value === false) {
            // Skip saving settings that are set to false and not already saved on the server
            continue;
          }
          console.log('Saving', { [key]: value });
          //console.log('Was:', server_settings[key]);
          //console.log('Now:', value);
          await client.req.post('/0/settings/' + key, value, {
            headers: {
              'Content-Type': 'application/json',
            },
          });
        }
      }

      // After save, reload
      await this.load({ save: false });
    },
    async update(new_state: Record<string, any>) {
      console.log('Updating state', new_state);
      await this.ensureLoaded();
      this.$patch(new_state);
      // 仅持久化本次显式更新的键，避免把整份本地状态回写到服务端。
      await this.save(Object.keys(new_state));
    },
  },
});
