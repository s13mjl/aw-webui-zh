import { createI18n } from 'vue-i18n';
import moment from 'moment';
import 'moment/locale/uk';
import 'moment/locale/de';
import 'moment/locale/ru';
import 'moment/locale/zh-cn';

import en from './locales/en';
import uk from './locales/uk';
import de from './locales/de';
import ru from './locales/ru';
import zhCN from './locales/zh-CN';

export type AppLocale = 'en' | 'uk' | 'de' | 'ru' | 'zh-CN';

const SUPPORTED: AppLocale[] = ['en', 'uk', 'de', 'ru', 'zh-CN'];

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return SUPPORTED.includes(value as AppLocale);
}

const HTML_LANG: Record<AppLocale, string> = {
  en: 'en',
  uk: 'uk',
  de: 'de',
  ru: 'ru',
  'zh-CN': 'zh-CN',
};

function detectBrowserLocale(): AppLocale | null {
  if (typeof navigator === 'undefined') {
    return null;
  }
  const lang = (navigator.language || '').toLowerCase();
  if (lang.startsWith('uk')) return 'uk';
  if (lang.startsWith('de')) return 'de';
  if (lang.startsWith('ru')) return 'ru';
  if (lang.startsWith('zh')) return 'zh-CN';
  if (lang.startsWith('en')) return 'en';
  return null;
}

export function getInitialLocale(): AppLocale {
  try {
    const saved = localStorage.getItem('locale');
    if (saved !== null && isAppLocale(saved)) {
      return saved;
    }
  } catch {
    /* ignore */
  }
  return detectBrowserLocale() ?? 'en';
}

const MOMENT_LOCALE: Record<AppLocale, string> = {
  en: 'en',
  uk: 'uk',
  de: 'de',
  ru: 'ru',
  'zh-CN': 'zh-cn',
};

const initialLocale = getInitialLocale();
const isProduction = process.env.NODE_ENV === 'production';

const i18nInstance = createI18n({
  legacy: true,
  locale: initialLocale,
  fallbackLocale: 'en',
  messages: { en, uk, de, ru, 'zh-CN': zhCN },
  missingWarn: !isProduction,
  fallbackWarn: !isProduction,
});

const i18nGlobal: any = i18nInstance.global;

// Small compatibility facade so existing non-component code can keep using
// `i18n.t()` / `i18n.locale` as it did with vue-i18n v8.
export const i18n = {
  t(key: string, ...args: any[]): string {
    return i18nGlobal.t(key, ...args) as string;
  },
  get locale(): string {
    return i18nGlobal.locale as string;
  },
  set locale(value: string) {
    i18nGlobal.locale = value;
  },
};

export default i18nInstance;

moment.locale(MOMENT_LOCALE[initialLocale]);

export function setAppLocale(locale: string): void {
  const next = isAppLocale(locale) ? locale : 'en';
  i18nInstance.global.locale = next;
  moment.locale(MOMENT_LOCALE[next]);
  document.documentElement.lang = HTML_LANG[next];
  try {
    localStorage.setItem('locale', next);
  } catch {
    /* ignore */
  }
}
