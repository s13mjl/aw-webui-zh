import { mergeEditorResults, mergeAppQueryResults } from '~/stores/activity';
import { IEvent } from '~/util/interfaces';

function ev(
  data: Record<string, unknown>,
  duration: number,
  timestamp = '2026-02-01T00:00:00Z'
): IEvent {
  return { timestamp, duration, data } as IEvent;
}

describe('mergeEditorResults', () => {
  test('merges and sums top-level lists across chunks', () => {
    const merged = mergeEditorResults([
      {
        files: [ev({ file: 'a.ts', language: 'TS' }, 60)],
        languages: [ev({ language: 'TS' }, 60)],
        projects: [ev({ project: 'proj-a' }, 60)],
        duration: 60,
      },
      {
        files: [ev({ file: 'a.ts', language: 'TS' }, 30), ev({ file: 'b.js', language: 'JS' }, 15)],
        languages: [ev({ language: 'TS' }, 30), ev({ language: 'JS' }, 15)],
        projects: [ev({ project: 'proj-a' }, 30)],
        duration: 45,
      },
    ]);

    expect(merged.duration).toBe(105);
    expect(merged.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ data: expect.objectContaining({ file: 'a.ts' }), duration: 90 }),
        expect.objectContaining({ data: expect.objectContaining({ file: 'b.js' }), duration: 15 }),
      ])
    );
    expect(merged.languages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({ language: 'TS' }),
          duration: 90,
        }),
        expect.objectContaining({
          data: expect.objectContaining({ language: 'JS' }),
          duration: 15,
        }),
      ])
    );
    expect(merged.projects[0].duration).toBe(90);
  });

  test('handles a single chunk (no duplicate top-level lists)', () => {
    const one = {
      files: [ev({ file: 'a.ts' }, 20)],
      languages: [ev({ language: 'TS' }, 20)],
      projects: [ev({ project: 'x' }, 20)],
      duration: 20,
    };
    expect(mergeEditorResults([one])).toEqual(one);
  });
});

describe('mergeAppQueryResults', () => {
  test('keeps a single result as-is', () => {
    const one = {
      app_events: [ev({ app: 'Firefox' }, 10)],
      title_events: [ev({ app: 'Firefox', classname: 'Window' }, 10)],
      cat_events: [ev({ $category: ['Work'] }, 10)],
      duration: 10,
      active_events: [],
    };
    expect(mergeAppQueryResults([one])).toBe(one);
  });

  test('merges app/title/category events and sums duration', () => {
    const merged = mergeAppQueryResults([
      {
        app_events: [ev({ app: 'Firefox' }, 10)],
        title_events: [ev({ app: 'Firefox', classname: 'A' }, 10)],
        cat_events: [ev({ $category: ['Work'] }, 10)],
        duration: 10,
        active_events: [],
      },
      {
        app_events: [ev({ app: 'Firefox' }, 7), ev({ app: 'Code' }, 3)],
        title_events: [
          ev({ app: 'Firefox', classname: 'A' }, 7),
          ev({ app: 'Code', classname: 'B' }, 3),
        ],
        cat_events: [ev({ $category: ['Work'] }, 7), ev({ $category: ['Media'] }, 3)],
        duration: 10,
        active_events: [],
      },
    ]);

    expect(merged.duration).toBe(20);
    expect(merged.app_events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({ app: 'Firefox' }),
          duration: 17,
        }),
        expect.objectContaining({ data: expect.objectContaining({ app: 'Code' }), duration: 3 }),
      ])
    );
    expect(merged.title_events).toHaveLength(2);
    expect(merged.cat_events).toHaveLength(2);
    // active_events mirror the merged app events (used by the store to skip inactive periods)
    expect(merged.active_events).toBe(merged.app_events);
  });
});
