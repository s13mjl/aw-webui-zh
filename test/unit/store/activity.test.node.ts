import { setActivePinia, createPinia } from 'pinia';
import moment from 'moment';

import { chunkPeriodsBySpan, useActivityStore } from '~/stores/activity';
import { useCategoryStore } from '~/stores/categories';
import { createClient, getClient } from '~/util/awclient';

describe('activity store', () => {
  setActivePinia(createPinia());
  createClient();

  const activityStore = useActivityStore();
  const categoryStore = useCategoryStore();

  beforeEach(async () => {
    await activityStore.reset();
    await activityStore.load_demo();
  });

  test('loads demo data', async () => {
    // Load
    expect(categoryStore.classes).toHaveLength(0);
    categoryStore.restoreDefaultClasses();
    expect(categoryStore.classes_unsaved_changes).toBeTruthy();
    await categoryStore.save();
    expect(categoryStore.classes_unsaved_changes).toBeFalsy();
    expect(categoryStore.classes).not.toHaveLength(0);

    // Retrieve class
    let workCat = categoryStore.get_category(['Work']);
    expect(workCat).not.toBeUndefined();
    workCat = JSON.parse(JSON.stringify(workCat)); // copy

    // Modify class
    const newRegex = 'Just testing';
    workCat.rule.regex = newRegex;
    categoryStore.updateClass(workCat);
    expect(categoryStore.get_category(['Work']).rule.regex).toEqual(newRegex);

    // Check that getters behave somewhat
    expect(categoryStore.all_categories).not.toHaveLength(0);
    expect(categoryStore.classes_hierarchy).not.toHaveLength(0);
  });

  test('chunkPeriodsBySpan keeps each chunk within maxDays', () => {
    const periods = [
      '2020-01-01T00:00:00Z/2020-07-01T00:00:00Z',
      '2020-07-01T00:00:00Z/2021-01-01T00:00:00Z',
      '2021-01-01T00:00:00Z/2021-01-02T00:00:00Z',
      '2021-01-02T00:00:00Z/2022-06-01T00:00:00Z',
    ];
    expect(chunkPeriodsBySpan(periods)).toEqual([
      periods.slice(0, 2),
      [periods[2]],
      [periods[3]], // longer than maxDays on its own, still sent
    ]);
    expect(chunkPeriodsBySpan([])).toEqual([]);
  });

  test('active history requests are chunked to roughly one year each', async () => {
    activityStore.active.history = {};
    activityStore.buckets.afk = ['aw-watcher-afk_test'];
    const querySpy = jest
      .spyOn(getClient(), 'query')
      .mockImplementation(async periods => periods.map(() => []));

    await activityStore.query_active_history({
      host: 'test',
      timeperiod: { start: '2020-01-01T00:00:00+00:00', length: [1, 'year'] },
    });

    const requested = querySpy.mock.calls.flatMap(call => call[0]);
    for (const call of querySpy.mock.calls) {
      const periods = call[0] as string[];
      const span = periods.reduce((sum, p) => {
        const [start, end] = p.split('/');
        return sum + moment(end).diff(moment(start), 'days', true);
      }, 0);
      expect(span).toBeLessThanOrEqual(366 + 1);
    }
    expect(Object.keys(activityStore.active.history).sort()).toEqual([...requested].sort());
    querySpy.mockRestore();
  });
});
