import * as classes from '~/util/classes';
import { IEvent } from '~/util/interfaces';
import { Category } from '~/util/classes';

const testClasses: Category[] = [
  { name: ['Test', 'Subtest'], rule: { type: 'regex', regex: 'subtest' } },
  { name: ['Test', 'Subtest', 'Subsubtest'], rule: { type: 'regex', regex: 'subsubtest' } },
];

test('correctly builds hierarchy', () => {
  const result = classes.build_category_hierarchy(testClasses);
  expect(result).toHaveLength(1);
  const cat_root = result[0];
  expect(cat_root.subname).toEqual('Test');
  expect(cat_root.children).toHaveLength(1);
  expect(result[0].children[0].children).toHaveLength(1);
});

test('correctly flatten hierarchy', () => {
  const result = classes.flatten_category_hierarchy(classes.build_category_hierarchy(testClasses));
  expect(result).toHaveLength(3);
});

test('matches string to category', () => {
  const cat = classes.matchString('subsubtest', testClasses);
  expect(cat).toEqual(testClasses[1]);
});

test('matches events to category', () => {
  let events: IEvent[] = [
    { timestamp: new Date().toISOString(), duration: 0, data: { title: 'subsubtest' } },
    { timestamp: new Date().toISOString(), duration: 0, data: { title: 'subtest' } },
    { timestamp: new Date().toISOString(), duration: 0, data: { title: 'no matching' } },
  ];
  events = classes.classifyEvents(events, testClasses);
  expect(events[0].data.$category).toEqual(testClasses[1].name);
  expect(events[1].data.$category).toEqual(testClasses[0].name);
  expect(events[2].data.$category).toEqual(['Uncategorized']);
});

// #382: a blank regex must not match everything client-side, matching how
// aw-core's server-side categorize() treats it.
test('blank regex category never matches, children still do', () => {
  const cats: Category[] = [
    { name: ['Work'], rule: { type: 'regex', regex: '' } },
    { name: ['Work', 'Programming'], rule: { type: 'regex', regex: 'vim' } },
  ];
  expect(classes.matchString('firefox', cats)).toBeNull();
  expect(classes.matchString('vim', cats)?.name).toEqual(['Work', 'Programming']);

  const events = classes.classifyEvents(
    [
      { timestamp: '', duration: 1, data: { app: 'firefox', title: 'x' } },
      { timestamp: '', duration: 1, data: { app: 'vim', title: 'x' } },
    ] as IEvent[],
    cats
  );
  expect(events.map(e => e.data.$category)).toEqual([['Uncategorized'], ['Work', 'Programming']]);
});

// 同步上游 #1184：模糊的 'kate' 分支应只匹配整个应用/标题字段，
// 而不是无关标题的子串（例如 'Skateboarding tips'）。
test.each<[string, string, string[] | null]>([
  ['Firefox', 'Skateboarding tips', null],
  ['Firefox', 'Dinner with kate', null],
  ['kate', 'notes.txt', ['Work', 'Programming']],
  ['vim', 'main.c', ['Work', 'Programming']],
  ['Firefox', 'GitHub - owner/repo', ['Work', 'Programming']],
])('默认 Programming 规则 app=%s title=%s', (app, title, expected) => {
  const cat = classes.matchStrings([app, title], classes.defaultCategories);
  expect(cat?.name ?? null).toEqual(expected);

  const event: IEvent = { timestamp: '', duration: 1, data: { app, title } };
  const [classified] = classes.classifyEvents([event], classes.defaultCategories);
  expect(classified.data.$category).toEqual(expected ?? ['Uncategorized']);
});
