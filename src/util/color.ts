import _ from 'lodash';
import { Category, matchStrings, loadClasses } from './classes';
import Color from 'color';
import * as d3 from 'd3';
import { IEvent, IBucket } from './interfaces';

// See here for examples:
//   https://bl.ocks.org/pstuffa/3393ff2711a53975040077b7453781a9
//

const COLOR_UNCAT = '#CCC';

// Returns a text color that contrasts with the given background color.
// Used for labels drawn on top of colored category bars — the dark-mode
// CSS rule `svg text { fill: #fff !important }` would otherwise force
// white text on light-colored bars (e.g. #CCC, #FFE082), making labels
// unreadable. See #1007.
export function getContrastTextColor(bgColor: string): string {
  const luminosity = Color(bgColor).luminosity();
  return luminosity > 0.5 ? '#333' : '#fff';
}

export function getContrastSubTextColor(bgColor: string): string {
  const luminosity = Color(bgColor).luminosity();
  return luminosity > 0.5 ? '#666' : '#ccc';
}

const scale = d3.scaleOrdinal(['#90CAF9', '#FFE082', '#EF9A9A', '#A5D6A7']);

// Needed to prewarm the color table
scale.domain(
  '0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20'.split(/, /)
);

const customColors = {
  afk: '#EEE',
  'not-afk': '#7F6',
  hibernating: '#DD6',

  'google-chrome': '#6AA7FE', // Google Blue: "#4885ed"
  chromium: '#8CF', // Google Blue: "#4885ed"
  firefox: '#F94', // Firefox Orange: "#E55B0A"
  spotify: '#5FA', // Spotify Green: "#1ED760"
  alacritty: '#FD8',

  vue: '#5d9', // Vue teal #4fc08d
  python: '#369', // Python blue #2b5b84
  javascript: '#f6b', // JavaScript pink #eb47a5

  // Developer domains
  localhost: '#CCC',
  'github.com': '#EBF',
  'stackoverflow.com': Color('#F48024').lighten(0.3),

  'google.com': '#0AF',
  'google.se': '#0AF',

  // Social media sites
  'messenger.com': Color('#3b5998').lighten(0.5),
  'facebook.com': Color('#3b5998').lighten(0.5),

  // Categories
  uncategorized: COLOR_UNCAT,
};

function hashcode(str: string): number {
  let hash = 0;
  if (str.length === 0) {
    return hash;
  }
  for (let i = 0; i < str.length; i++) {
    const character = str.charCodeAt(i);
    hash = (hash << 5) - hash + character;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

export function getColorFromString(appname: string): string {
  appname = appname || '';
  appname = appname.toLowerCase();
  return customColors[appname] || scale(Math.abs(hashcode(appname) % 20).toString());
}

// TODO: Move into vuex?
export function getColorFromCategory(c: Category, allCats: Category[]): string {
  // Returns the color for a certain category, falling back to parents if none set
  if (c && c.data && c.data.color) {
    return c.data.color;
  } else if (c && c.name.slice(0, -1).length > 0) {
    // If no color is set on category, traverse parents until one is found
    const parent = c.name.slice(0, -1);
    const parentCat = allCats.find(cc => _.isEqual(cc.name, parent));
    if (parentCat === undefined) {
      console.error("Couldn't find parent!", parent);
    }
    return getColorFromCategory(parentCat, allCats);
  } else {
    return COLOR_UNCAT;
  }
}

// TODO: Move into vuex?
export function getCategoryColorFromString(str: string): string {
  // TODO: Don't load classes on every call
  const allCats = loadClasses();
  const c = matchStrings([str], allCats);
  if (c !== null) {
    return getColorFromCategory(c, allCats);
  } else {
    return fallbackColor(str);
  }
}

function fallbackColor(str: string): string {
  // Get fallback color
  // TODO: Fetch setting from somewhere better, where defaults are respected
  const useColorFallback =
    localStorage !== undefined ? localStorage.useColorFallback === 'true' : true;
  if (useColorFallback) {
    return getColorFromString(str);
  } else {
    return COLOR_UNCAT;
  }
}

export function getTitleAttr(bucket: { type?: string }, e: IEvent) {
  if (bucket.type == 'currentwindow') {
    return e.data.app;
  } else if (bucket.type == 'web.tab.current') {
    const domainRegex = /^.+:\/\/(?:www.)?([^/]+)/;
    const match = e.data.url.match(domainRegex);
    return match ? match[1] : e.data.url;
  } else if (bucket.type == 'afkstatus') {
    return e.data.status;
  } else if (bucket.type?.startsWith('app.editor')) {
    return _.last(e.data.file.split('/'));
  } else if (bucket.type?.startsWith('general.stopwatch')) {
    return e.data.label;
  } else {
    const title = e.data.title;
    if (title && typeof title === 'string') {
      return title;
    }

    const keys = Object.keys(e.data);
    if (keys.length === 1) {
      const val = e.data[keys[0]];
      if (typeof val === 'string') {
        return val.length > 50 ? val.slice(0, 50) : val;
      }
    }

    return '';
  }
}

export function getCategorizationStringFromEvent(bucket: IBucket, e: IEvent): string | null {
  if (bucket.type == 'currentwindow') {
    // using linebreak and "m" regex flag to make `$` and `^` work
    return e.data.app + '\n' + e.data.title;
  } else if (bucket.type == 'web.tab.current') {
    // same as above
    return e.data.title + '\n' + e.data.url;
  } else if (bucket.type?.startsWith('app.editor')) {
    return e.data.file;
  } else if (bucket.type?.startsWith('general.stopwatch')) {
    return e.data.label;
  }

  return null;
}

/**
 * Returns the individual data field values of an event that should be tested
 * against category rules. Unlike getCategorizationStringFromEvent (which
 * concatenates fields with '\n'), this returns separate strings so each field
 * is tested independently — matching the server-side categorize() behaviour.
 * See #646.
 */
export function getCategorizationStringsFromEvent(bucket: IBucket, e: IEvent): string[] | null {
  if (bucket.type == 'currentwindow') {
    return [e.data.app, e.data.title].filter(s => s != null);
  } else if (bucket.type == 'web.tab.current') {
    return [e.data.title, e.data.url].filter(s => s != null);
  } else if (bucket.type?.startsWith('app.editor')) {
    return e.data.file ? [e.data.file] : null;
  } else if (bucket.type?.startsWith('general.stopwatch')) {
    return e.data.label ? [e.data.label] : null;
  }

  return null;
}

export function getCategoryColorFromEvent(bucket: IBucket, e: IEvent) {
  const categorizationStrings = getCategorizationStringsFromEvent(bucket, e);
  if (categorizationStrings !== null) {
    // Test each field individually against the category rules, matching
    // the server-side categorize() behaviour. See #646.
    const allCats = loadClasses();
    const c = matchStrings(categorizationStrings, allCats);
    if (c !== null) {
      return getColorFromCategory(c, allCats);
    }
    // Fall back to hashing on the first field (app/title) for a stable color
    return fallbackColor(categorizationStrings[0] || getTitleAttr(bucket, e));
  }

  if (bucket.type == 'afkstatus') {
    return getColorFromString(e.data.status);
  }

  return getColorFromString(getTitleAttr(bucket, e));
}
