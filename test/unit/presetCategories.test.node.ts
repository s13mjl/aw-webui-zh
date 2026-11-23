import { setActivePinia, createPinia } from 'pinia';

import {
  parsePresetCategorySets,
  getPresetCategorySets,
  clearPresetCategorySetsCache,
  PRESET_GLOBAL_NAME,
} from '~/util/presetCategories';
import {
  loadCategories,
  mergeCategorySets,
  getDefaultClasses,
  classifyEvents,
  migrateLegacyDefaultColors,
  defaultCategories,
  Category,
  CategorySet,
} from '~/util/classes';
import { useSettingsStore } from '~/stores/settings';
import { useCategoryStore } from '~/stores/categories';

const presetSet: CategorySet = {
  id: 'study',
  categories: [
    { name: ['Music & Audio'], rule: { type: 'regex', regex: '^Music & Audio$' } },
    { name: ['Video Streaming'], rule: { type: 'regex', regex: '^Video Streaming$' } },
    { name: ['Excluded'], rule: { type: 'regex', regex: '^Excluded$' } },
  ],
};

const extraSet: CategorySet = {
  id: 'extra',
  categories: [{ name: ['Extra'], rule: { type: 'regex', regex: '^Extra$' } }],
};

function setPresetGlobal(value: unknown) {
  if (value === undefined) {
    delete (globalThis as Record<string, unknown>)[PRESET_GLOBAL_NAME];
  } else {
    (globalThis as Record<string, unknown>)[PRESET_GLOBAL_NAME] = value;
  }
  clearPresetCategorySetsCache();
}

beforeEach(() => {
  setPresetGlobal(undefined);
  setActivePinia(createPinia());
});

afterAll(() => {
  setPresetGlobal(undefined);
});

describe('parsePresetCategorySets', () => {
  test('parses a JSON string holding a list of sets', () => {
    const sets = parsePresetCategorySets(JSON.stringify([presetSet]));
    expect(sets).toHaveLength(1);
    expect(sets[0].id).toEqual('study');
    expect(sets[0].categories).toHaveLength(3);
  });

  test('accepts an already-parsed value and a single set', () => {
    expect(parsePresetCategorySets([presetSet])).toHaveLength(1);
    expect(parsePresetCategorySets(presetSet)).toHaveLength(1);
  });

  test('returns empty list for absent or empty input', () => {
    expect(parsePresetCategorySets(undefined)).toEqual([]);
    expect(parsePresetCategorySets(null)).toEqual([]);
    expect(parsePresetCategorySets('')).toEqual([]);
    expect(parsePresetCategorySets('   ')).toEqual([]);
    expect(parsePresetCategorySets('[]')).toEqual([]);
  });

  test('never throws on malformed input', () => {
    expect(parsePresetCategorySets('not json')).toEqual([]);
    expect(parsePresetCategorySets(42)).toEqual([]);
    expect(parsePresetCategorySets([{ categories: [] }])).toEqual([]);
    expect(parsePresetCategorySets([{ id: 'x' }])).toEqual([]);
    expect(parsePresetCategorySets([{ id: '', categories: [] }])).toEqual([]);
  });

  test('drops invalid categories but keeps the valid ones', () => {
    const sets = parsePresetCategorySets([
      {
        id: 'mixed',
        categories: [
          { name: ['Good'], rule: { type: 'regex', regex: '^Good$' } },
          { name: [], rule: { type: 'regex', regex: 'x' } }, // empty name
          { name: ['Bad regex'], rule: { type: 'regex', regex: '[' } }, // uncompilable
          { name: ['JS only'], rule: { type: 'regex', regex: '(?<year>\\d{4})' } }, // invalid in Python
          { name: ['No rule'] }, // missing rule
          { name: ['Weird'], rule: { type: 'glob' } }, // unknown rule type
          'nonsense',
        ],
      },
    ]);
    expect(sets).toHaveLength(1);
    expect(sets[0].categories.map(c => c.name[0])).toEqual(['Good']);
  });

  test('drops sets left without any valid category', () => {
    expect(
      parsePresetCategorySets([{ id: 'empty', categories: [{ name: ['x'], rule: { type: 42 } }] }])
    ).toEqual([]);
  });

  test('normalizes legacy null rule type to none, and keeps data/ignore_case', () => {
    const sets = parsePresetCategorySets([
      {
        id: 'set',
        categories: [
          { name: ['Parent'], rule: { type: null } },
          {
            name: ['Child'],
            rule: { type: 'regex', regex: 'x', ignore_case: true },
            data: { color: '#FFF' },
          },
        ],
      },
    ]);
    expect(sets[0].categories[0].rule).toEqual({ type: 'none' });
    expect(sets[0].categories[1].rule.ignore_case).toBe(true);
    expect(sets[0].categories[1].data).toEqual({ color: '#FFF' });
  });

  test('preserves select_keys on regex rules and drops empty/duplicate lists', () => {
    const sets = parsePresetCategorySets([
      {
        id: 'set',
        categories: [
          {
            name: ['App only'],
            rule: { type: 'regex', regex: 'Chrome', select_keys: ['app'] },
          },
          {
            name: ['Empty keys'],
            rule: { type: 'regex', regex: 'x', select_keys: [] },
          },
          {
            name: ['Dup keys'],
            rule: { type: 'regex', regex: 'x', select_keys: ['title', 'app', 'title', ''] },
          },
        ],
      },
    ]);
    expect(sets[0].categories[0].rule.select_keys).toEqual(['app']);
    expect(sets[0].categories[1].rule.select_keys).toBeUndefined();
    expect(sets[0].categories[2].rule.select_keys).toEqual(['title', 'app']);
  });

  test('preserves integer priority and the weight alias on regex rules', () => {
    const sets = parsePresetCategorySets([
      {
        id: 'set',
        categories: [
          {
            name: ['Priority'],
            rule: { type: 'regex', regex: 'x', priority: 25 },
          },
          {
            name: ['Weight'],
            rule: { type: 'regex', regex: 'y', weight: -5 },
          },
        ],
      },
    ]);
    expect(sets[0].categories[0].rule.priority).toBe(25);
    expect(sets[0].categories[1].rule.priority).toBe(-5);
    expect(sets[0].categories[1].rule.weight).toBeUndefined();
  });

  test('drops preset categories with non-integer priority values', () => {
    const sets = parsePresetCategorySets([
      {
        id: 'set',
        categories: [
          {
            name: ['Bad'],
            rule: { type: 'regex', regex: 'x', priority: 1.5 },
          },
        ],
      },
    ]);
    expect(sets).toEqual([]);
  });

  test('drops preset categories with non-integer weight values', () => {
    const sets = parsePresetCategorySets([
      {
        id: 'set',
        categories: [
          {
            name: ['Bad'],
            rule: { type: 'regex', regex: 'x', weight: 'high' },
          },
        ],
      },
    ]);
    expect(sets).toEqual([]);
  });

  test('keeps the first of duplicate set ids', () => {
    const sets = parsePresetCategorySets([
      presetSet,
      { id: 'study', categories: [{ name: ['Other'], rule: { type: 'none' } }] },
    ]);
    expect(sets).toHaveLength(1);
    expect(sets[0].categories).toHaveLength(3);
  });
});

describe('getPresetCategorySets', () => {
  test('is empty on a stock build', () => {
    expect(getPresetCategorySets()).toEqual([]);
  });

  test('reads presets injected on the global', () => {
    setPresetGlobal(JSON.stringify([presetSet]));
    expect(getPresetCategorySets().map(s => s.id)).toEqual(['study']);
  });

  test('does not hand out a mutable reference to its cache', () => {
    setPresetGlobal([presetSet]);
    const first = getPresetCategorySets();
    first[0].categories[0].name[0] = 'mutated';
    first[0].categories.pop();
    expect(getPresetCategorySets()[0].categories.map(c => c.name[0])).toEqual([
      'Music & Audio',
      'Video Streaming',
      'Excluded',
    ]);
  });
});

describe('mergeCategorySets', () => {
  const setA: CategorySet = {
    id: 'a',
    categories: [
      { name: ['Shared'], rule: { type: 'regex', regex: 'from-a' } },
      { name: ['OnlyA'], rule: { type: 'regex', regex: 'a' } },
    ],
  };
  const setB: CategorySet = {
    id: 'b',
    categories: [
      { name: ['Shared'], rule: { type: 'regex', regex: 'from-b' } },
      { name: ['OnlyB'], rule: { type: 'regex', regex: 'b' } },
    ],
  };

  test('first set wins on name collision', () => {
    const merged = mergeCategorySets([setA, setB]);
    const shared = merged.filter(c => c.name[0] === 'Shared');
    expect(shared).toHaveLength(1);
    expect(shared[0].rule.regex).toEqual('from-a');
  });

  test('priority follows argument order', () => {
    const merged = mergeCategorySets([setB, setA]);
    expect(merged.find(c => c.name[0] === 'Shared').rule.regex).toEqual('from-b');
  });

  test('keeps non-colliding categories from every set, in order', () => {
    const merged = mergeCategorySets([setA, setB]);
    expect(merged.map(c => c.name[0])).toEqual(['Shared', 'OnlyA', 'OnlyB']);
  });

  test('collision is on the full category path, not just the leaf name', () => {
    const merged = mergeCategorySets([
      { id: 'a', categories: [{ name: ['Work', 'Email'], rule: { type: 'regex', regex: 'a' } }] },
      { id: 'b', categories: [{ name: ['Comms', 'Email'], rule: { type: 'regex', regex: 'b' } }] },
    ]);
    expect(merged).toHaveLength(2);
  });

  test('only the primary masks inherited names, without masking its own categories', () => {
    const primary = {
      ...setA,
      tombstones: [JSON.stringify(['Shared']), JSON.stringify(['OnlyB'])],
    };
    const secondary = { ...setB, tombstones: [JSON.stringify(['OnlyA'])] };
    expect(mergeCategorySets([primary, secondary]).map(c => c.name[0])).toEqual([
      'Shared',
      'OnlyA',
    ]);
    // Masks are contextual: the untouched source can still be used alone.
    expect(mergeCategorySets([secondary]).map(c => c.name[0])).toEqual(['Shared', 'OnlyB']);
  });

  test('tombstones distinguish a literal separator from nested category paths', () => {
    const sets: CategorySet[] = [
      { id: 'mine', categories: [], tombstones: [JSON.stringify(['Work', 'Email'])] },
      {
        id: 'shared',
        categories: [
          { name: ['Work', 'Email'], rule: { type: 'none' } },
          { name: ['Work>Email'], rule: { type: 'none' } },
        ],
      },
    ];
    expect(mergeCategorySets(sets).map(c => c.name)).toEqual([['Work>Email']]);
  });

  test('empty input yields no categories', () => {
    expect(mergeCategorySets([])).toEqual([]);
  });
});

describe('getDefaultClasses', () => {
  test('falls back to the built-in categories without presets', () => {
    expect(getDefaultClasses()).toEqual(defaultCategories);
  });

  test('uses the preset when the build ships one', () => {
    setPresetGlobal([presetSet]);
    expect(getDefaultClasses().map(c => c.name[0])).toEqual([
      'Music & Audio',
      'Video Streaming',
      'Excluded',
    ]);
  });

  test('uses only the first preset — the one activated on a fresh install', () => {
    // Otherwise "Restore defaults" + save would fold inactive presets into the
    // active set via syncToPrimarySet().
    setPresetGlobal([presetSet, extraSet]);
    expect(getDefaultClasses().map(c => c.name[0])).not.toContain('Extra');
  });

  test('restores the categories of the named preset set', () => {
    setPresetGlobal([presetSet, extraSet]);
    expect(getDefaultClasses('extra').map(c => c.name[0])).toEqual(['Extra']);
  });

  test('restores the built-in categories for a set the build does not ship', () => {
    // Never hand one set's categories to another set — the caller writes these
    // into the active set on save.
    setPresetGlobal([presetSet, extraSet]);
    expect(getDefaultClasses('my-own-set')).toEqual(defaultCategories);
  });
});

describe('loadCategories with presets', () => {
  test('first run with no stored settings activates the presets', () => {
    setPresetGlobal([presetSet]);
    const { sets, activeIds } = loadCategories();
    expect(activeIds).toEqual(['study']);
    expect(sets.map(s => s.id)).toEqual(['study']);
  });

  test('first run with multiple presets activates only the first (syncToPrimarySet invariant)', () => {
    const presetSet2: CategorySet = {
      id: 'work',
      categories: [{ name: ['Work'], rule: { type: 'regex', regex: '^Work$' } }],
    };
    setPresetGlobal([presetSet, presetSet2]);
    const { sets, activeIds } = loadCategories();
    // Only the first preset is active on first run — activating all would break
    // syncToPrimarySet, which skips sync when multiple sets are active, causing
    // category edits to be silently lost on reload.
    expect(activeIds).toEqual(['study']);
    // Both presets are available in the UI
    expect(sets.map(s => s.id)).toEqual(['study', 'work']);
  });

  test('first run without presets keeps the legacy default set', () => {
    const { sets, activeIds } = loadCategories();
    expect(activeIds).toEqual(['default']);
    expect(sets).toHaveLength(1);
    expect(sets[0].categories).toEqual(defaultCategories);
  });

  test('a user with stored classes keeps them; presets are available but inactive', () => {
    setPresetGlobal([presetSet]);
    const myClasses: Category[] = [{ name: ['Mine'], rule: { type: 'regex', regex: 'mine' } }];
    const settingsStore = useSettingsStore();
    settingsStore.$patch({ classes: myClasses, _storedKeys: ['classes'] });

    const { sets, activeIds } = loadCategories();
    expect(activeIds).toEqual(['default']);
    expect(sets.find(s => s.id === 'default').categories).toEqual(myClasses);
    // still selectable by the user
    expect(sets.map(s => s.id)).toContain('study');
  });

  test('stored sets take precedence over a preset with the same id', () => {
    setPresetGlobal([presetSet]);
    const edited: CategorySet = {
      id: 'study',
      categories: [{ name: ['Edited'], rule: { type: 'regex', regex: 'edited' } }],
    };
    const settingsStore = useSettingsStore();
    settingsStore.$patch({
      category_sets: [edited],
      active_set_ids: ['study'],
      _storedKeys: ['category_sets', 'active_set_ids'],
    });

    const { sets, activeIds } = loadCategories();
    expect(activeIds).toEqual(['study']);
    expect(sets).toHaveLength(1);
    expect(sets[0].categories.map(c => c.name[0])).toEqual(['Edited']);
  });

  test('presets are appended to stored sets without changing the active selection', () => {
    setPresetGlobal([presetSet]);
    const settingsStore = useSettingsStore();
    settingsStore.$patch({
      category_sets: [{ id: 'mine', categories: defaultCategories }],
      active_set_ids: ['mine'],
      _storedKeys: ['category_sets'],
    });

    const { sets, activeIds } = loadCategories();
    expect(activeIds).toEqual(['mine']);
    expect(sets.map(s => s.id)).toEqual(['mine', 'study']);
  });

  test('drops active ids that no longer resolve to a set', () => {
    const settingsStore = useSettingsStore();
    settingsStore.$patch({
      category_sets: [{ id: 'mine', categories: defaultCategories }],
      active_set_ids: ['gone'],
      _storedKeys: ['category_sets'],
    });

    expect(loadCategories().activeIds).toEqual(['mine']);
  });
});

describe('categories store with presets', () => {
  test('loads preset categories on first run', () => {
    setPresetGlobal([presetSet]);
    const categoryStore = useCategoryStore();
    categoryStore.load();

    expect(categoryStore.active_set_ids).toEqual(['study']);
    expect(categoryStore.classes.map(c => c.name[0])).toEqual([
      'Music & Audio',
      'Video Streaming',
      'Excluded',
    ]);
    // ids are assigned so the editor can address them
    expect(categoryStore.classes.every(c => typeof c.id === 'number')).toBe(true);
    expect(categoryStore.classes_unsaved_changes).toBe(false);
  });

  test('rules match on app name, as written by the watcher', () => {
    setPresetGlobal([presetSet]);
    const categoryStore = useCategoryStore();
    categoryStore.load();

    const events = [
      { timestamp: new Date().toISOString(), duration: 0, data: { app: 'Video Streaming' } },
      { timestamp: new Date().toISOString(), duration: 0, data: { app: 'Something else' } },
    ];
    const classified = classifyEvents(events, categoryStore.classes);
    expect(classified[0].data.$category).toEqual(['Video Streaming']);
    expect(classified[1].data.$category).toEqual(['Uncategorized']);
  });

  test('field-scoped preset rules do not match other string fields', () => {
    setPresetGlobal([
      {
        id: 'study',
        categories: [
          {
            name: ['Docs'],
            rule: { type: 'regex', regex: 'Google Docs', select_keys: ['app'] },
          },
        ],
      },
    ]);
    const categoryStore = useCategoryStore();
    categoryStore.load();

    const events = [
      {
        timestamp: new Date().toISOString(),
        duration: 0,
        data: { app: 'Google Docs', title: 'Inbox' },
      },
      {
        timestamp: new Date().toISOString(),
        duration: 0,
        data: { app: 'Chrome', title: 'Google Docs' },
      },
    ];
    const classified = classifyEvents(events, categoryStore.classes);
    expect(classified[0].data.$category).toEqual(['Docs']);
    expect(classified[1].data.$category).toEqual(['Uncategorized']);
  });

  test('restore defaults restores the preset, not the built-in categories', () => {
    setPresetGlobal([presetSet]);
    const categoryStore = useCategoryStore();
    categoryStore.load();
    categoryStore.clearAll();
    categoryStore.restoreDefaultClasses();

    expect(categoryStore.classes.map(c => c.name[0])).toEqual([
      'Music & Audio',
      'Video Streaming',
      'Excluded',
    ]);
  });

  test('restore defaults + save keeps inactive presets out of the active set', () => {
    setPresetGlobal([presetSet, extraSet]);
    const categoryStore = useCategoryStore();
    categoryStore.load();
    categoryStore.restoreDefaultClasses();
    categoryStore.save();

    const activeSet = categoryStore.category_sets.find(s => s.id === 'study');
    expect(activeSet.categories.map(c => c.name[0])).not.toContain('Extra');
    expect(categoryStore.category_sets.find(s => s.id === 'extra').categories).toEqual(
      extraSet.categories
    );
  });

  test('restore defaults on a non-preset set does not overwrite it with a preset', () => {
    setPresetGlobal([presetSet, extraSet]);
    const settingsStore = useSettingsStore();
    settingsStore.$patch({
      category_sets: [{ id: 'mine', categories: [{ name: ['Mine'], rule: { type: 'none' } }] }],
      active_set_ids: ['mine'],
      _storedKeys: ['category_sets'],
    });
    const categoryStore = useCategoryStore();
    categoryStore.load();
    expect(categoryStore.active_set_ids).toEqual(['mine']);

    categoryStore.restoreDefaultClasses();
    categoryStore.save();

    const names = categoryStore.category_sets
      .find(s => s.id === 'mine')
      .categories.map(c => c.name[0]);
    expect(names).not.toContain('Music & Audio');
    expect(names).toContain('Work');
    // the preset sets themselves are untouched
    expect(categoryStore.category_sets.find(s => s.id === 'study').categories).toEqual(
      presetSet.categories
    );
  });

  test('restore defaults is unchanged on a stock build', () => {
    const categoryStore = useCategoryStore();
    categoryStore.restoreDefaultClasses();
    expect(categoryStore.get_category(['Work'])).toBeTruthy();
    expect(categoryStore.classes.length).toBeGreaterThan(defaultCategories.length - 1);
  });
});

describe('default palette change (#1058, upstream #1065)', () => {
  // The colors the stock categories had before the palette was softened.
  const OLD_COLORS: Record<string, string> = {
    Work: '#0F0',
    Media: '#F33',
    'Media>Games': '#F80',
    'Media>Video': '#F33',
    'Media>Social Media': '#FCC400',
    'Media>Music': '#A8FC00',
    Comms: '#9FF',
  };
  const withOldColors = (overrides: Record<string, string> = {}): Category[] =>
    defaultCategories.map(c => {
      const key = c.name.join('>');
      const color = overrides[key] ?? OLD_COLORS[key];
      return color ? { ...c, data: { ...c.data, color } } : c;
    });
  const colorOf = (cats: Category[], key: string) =>
    cats.find(c => c.name.join('>') === key)?.data?.color;

  test('every legacy entry matches a built-in category and receives a new-palette color', () => {
    for (const [key, oldColor] of Object.entries(OLD_COLORS)) {
      const ref = defaultCategories.find(c => c.name.join('>') === key);
      if (!ref) throw new Error(`built-in category missing for ${key}`);
      const newColor = ref.data?.color;
      expect(typeof newColor).toBe('string');
      expect((newColor as string).length).toBeGreaterThan(0);
      expect((newColor as string).toUpperCase()).not.toEqual(oldColor.toUpperCase());
      // 新色以 defaultCategories 为唯一来源，迁移结果与参考默认分类一致。
      const migrated = migrateLegacyDefaultColors([
        { ...ref, data: { ...ref.data, color: oldColor } },
      ]);
      expect(migrated[0].data?.color).toBe(newColor);
    }
  });

  test('the new palette has no unintended duplicate colors (parent/child sharing is allowed)', () => {
    const byColor = new Map<string, string[]>();
    for (const c of defaultCategories) {
      const color = c.data?.color;
      if (!color) continue;
      byColor.set(color, [...(byColor.get(color) ?? []), c.name.join('>')]);
    }
    for (const [, names] of byColor) {
      if (names.length < 2) continue;
      for (const name of names) {
        const ancestorPrefix = name.split('>').slice(0, -1).join('>');
        const other = names.find(n => n !== name);
        const ancestorSharesColor = ancestorPrefix !== '' && other.startsWith(ancestorPrefix);
        const descendantSharesColor = other.startsWith(name + '>');
        expect(ancestorSharesColor || descendantSharesColor).toBe(true);
      }
    }
  });

  test('migration is idempotent: running twice yields the same result', () => {
    const once = migrateLegacyDefaultColors(withOldColors({ Media: '#123456' }));
    const twice = migrateLegacyDefaultColors(once);
    expect(twice).toEqual(once);
  });

  test('stored old default colors are shown in the new palette', () => {
    const settingsStore = useSettingsStore();
    settingsStore.$patch({ classes: withOldColors(), _storedKeys: ['classes'] });

    const { sets } = loadCategories();
    const cats = sets.find(s => s.id === 'default')!.categories;
    for (const key of Object.keys(OLD_COLORS)) {
      expect(colorOf(cats, key)).toBe(colorOf(defaultCategories, key));
    }
  });

  test('a color the user picked is kept while untouched ones move to the new palette', () => {
    const settingsStore = useSettingsStore();
    settingsStore.$patch({
      category_sets: [{ id: 'default', categories: withOldColors({ Media: '#123456' }) }],
      active_set_ids: ['default'],
      _storedKeys: ['category_sets', 'active_set_ids'],
    });

    const { sets } = loadCategories();
    const cats = sets.find(s => s.id === 'default')!.categories;
    expect(colorOf(cats, 'Media')).toBe('#123456');
    expect(colorOf(cats, 'Work')).toBe(colorOf(defaultCategories, 'Work'));
  });

  test('legacy colors are matched case-insensitively', () => {
    const upper = withOldColors();
    upper.forEach(c => {
      if (c.data?.color) c.data.color = c.data.color.toUpperCase();
    });
    const migrated = migrateLegacyDefaultColors(upper);
    for (const key of Object.keys(OLD_COLORS)) {
      expect(colorOf(migrated, key)).toBe(colorOf(defaultCategories, key));
    }
  });

  test('category names that are Object.prototype keys load normally', () => {
    const settingsStore = useSettingsStore();
    const mine: Category[] = ['constructor', 'toString', '__proto__'].map(name => ({
      name: [name],
      rule: { type: 'regex', regex: name },
      data: { color: '#123456' },
    }));
    settingsStore.$patch({ classes: mine, _storedKeys: ['classes'] });

    const { sets } = loadCategories();
    expect(sets.find(s => s.id === 'default')!.categories).toEqual(mine);
  });

  test('preset-provided colors are preserved and never overwritten by migration', () => {
    const coloredPreset: CategorySet = {
      id: 'study',
      categories: [
        { name: ['Work'], rule: { type: 'regex', regex: '^Work$' }, data: { color: '#123456' } },
        { name: ['Media'], rule: { type: 'none' }, data: { color: '#ABCDEF' } },
      ],
    };
    setPresetGlobal([coloredPreset]);
    const presets = getPresetCategorySets();
    expect(migrateLegacyDefaultColors(presets[0].categories)).toEqual(presets[0].categories);

    // 内置默认色仍走新调色板，与预设色互不污染。
    expect(colorOf(defaultCategories, 'Work')).toBe('#4ADE80');
    setPresetGlobal(undefined);
    expect(getDefaultClasses()).toEqual(defaultCategories);
  });

  test('stored legacy-default classes keep the default active set; the preset stays available', () => {
    // 本地 #936 以 _storedKeys 判断是否已有用户分类（对应上游 classesLookUnconfigured），
    // 因此只要 classes 被持久化过，就仍由 default 集接管；预设集仅作为可切换项追加。
    setPresetGlobal([presetSet]);
    const settingsStore = useSettingsStore();
    settingsStore.$patch({
      classes: withOldColors(),
      category_sets: [],
      active_set_ids: ['default'],
      _storedKeys: ['classes', 'category_sets', 'active_set_ids'],
    });

    const { sets, activeIds } = loadCategories();
    expect(activeIds).toEqual(['default']);
    expect(sets.map(s => s.id)).toEqual(['default', 'study']);
    const cats = sets.find(s => s.id === 'default')!.categories;
    for (const key of Object.keys(OLD_COLORS)) {
      expect(colorOf(cats, key)).toBe(colorOf(defaultCategories, key));
    }
  });
});

// Frozen pre-#495 regexes (上游 #1166): comparing a fixture copied from the
// current defaults would miss upgrade regressions whenever an install default
// changes.
const preCommonAppRules = new Map<string, string>([
  ['Work', 'Google Docs|libreoffice|ReText'],
  ['Work>Programming', 'GitHub|Stack Overflow|BitBucket|Gitlab|vim|Spyder|kate|Ghidra|Scite'],
  ['Media>Social Media', 'reddit|Facebook|Twitter|Instagram|devRant'],
  ['Media>Music', 'Spotify|Deezer'],
  [
    'Comms>IM',
    'Messenger|Telegram|Signal|WhatsApp|Rambox|Slack|Riot|Element|Discord|Nheko|NeoChat|Mattermost',
  ],
  ['Comms>Email', 'Gmail|Thunderbird|mutt|alpine'],
]);

function preCommonAppDefaults(): Category[] {
  return JSON.parse(JSON.stringify(defaultCategories)).map((cat: Category) => {
    const oldRegex = preCommonAppRules.get(cat.name.join('>'));
    if (oldRegex !== undefined) cat.rule.regex = oldRegex;
    return cat;
  });
}

describe('persisted defaults from before the common-app expansion (#1166)', () => {
  test('still activate a shipped preset without rewriting the saved classes', () => {
    setPresetGlobal([presetSet]);
    const stored = preCommonAppDefaults();
    const settingsStore = useSettingsStore();
    settingsStore.$patch({ classes: stored, _storedKeys: ['classes'] });
    const before = JSON.stringify(settingsStore.classes);

    expect(loadCategories().activeIds).toEqual(['study']);
    expect(JSON.stringify(settingsStore.classes)).toBe(before);
  });

  test.each(['regex', 'color', 'priority', 'score'])(
    'keeps a legacy taxonomy with a %s edit',
    field => {
      setPresetGlobal([presetSet]);
      const stored = preCommonAppDefaults();
      const work = stored.find(cat => cat.name.join('>') === 'Work');
      if (!work) throw new Error('Work category missing');
      if (field === 'regex') work.rule.regex += '|MyPrivateApp';
      if (field === 'color') work.data = { ...work.data, color: '#123456' };
      if (field === 'priority') work.rule.priority = 99;
      if (field === 'score') work.data = { ...work.data, score: -7 };
      const settingsStore = useSettingsStore();
      settingsStore.$patch({ classes: stored, _storedKeys: ['classes'] });

      const loaded = loadCategories();
      expect(loaded.activeIds).toEqual(['default']);
      const defaultSet = loaded.sets.find(set => set.id === 'default');
      expect(defaultSet?.categories).toEqual(stored);
    }
  );
});
