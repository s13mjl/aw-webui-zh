import moment from 'moment';
import Trends from '~/views/Trends.vue';
import { getClient, queryLong } from '~/util/awclient';

jest.mock('~/util/awclient', () => ({ getClient: jest.fn(), queryLong: jest.fn() }));

describe('Trends view', () => {
  describe('host computed', () => {
    test('returns the :host route param when present', () => {
      const vm = {
        $route: { params: { host: 'laptop' } },
        bucketsStore: { hosts: ['desktop'] },
      };
      expect(Trends.computed.host.call(vm)).toBe('laptop');
    });

    test('falls back to the first available host when no :host param', () => {
      // Regression: navigating to /trends without :host used to throw
      // "TypeError: can't access property endsWith, bid is undefined"
      // because the route param was undefined and queries got built with
      // bid_window=undefined.
      const vm = {
        $route: { params: {} },
        bucketsStore: { hosts: ['desktop', 'laptop'] },
      };
      expect(Trends.computed.host.call(vm)).toBe('desktop');
    });

    test('returns undefined when there are no hosts at all', () => {
      const vm = {
        $route: { params: {} },
        bucketsStore: { hosts: [] },
      };
      expect(Trends.computed.host.call(vm)).toBeUndefined();
    });
  });

  describe('dayPeriods', () => {
    test('slices days at the configured start of day, not calendar midnight', () => {
      // Regression: with startOfDay 04:00 the Activity view counts 00:00-04:00
      // as the previous day, but Trends sliced every period at midnight, so
      // after-midnight activity fell outside the current window and each bar
      // was offset by four hours.
      const vm = { settingsStore: { startOfDay: '04:00' } };
      const periods = Trends.methods.dayPeriods.call(
        vm,
        moment('2026-10-18'),
        moment('2026-10-20')
      );
      expect(periods).toEqual([
        `${moment('2026-10-18T04:00:00').format()}/${moment('2026-10-19T04:00:00').format()}`,
        `${moment('2026-10-19T04:00:00').format()}/${moment('2026-10-20T04:00:00').format()}`,
      ]);
    });

    test('keeps midnight slices when start of day is 00:00', () => {
      const vm = { settingsStore: { startOfDay: '00:00' } };
      const periods = Trends.methods.dayPeriods.call(
        vm,
        moment('2026-10-19'),
        moment('2026-10-20')
      );
      expect(periods).toEqual([
        `${moment('2026-10-19').format()}/${moment('2026-10-20').format()}`,
      ]);
    });
  });

  describe('query windows', () => {
    test('previous totals end where current day queries begin at 04:00', async () => {
      const events = [{ cat_events: [{ data: { $category: ['Work'] }, duration: 600 }] }];
      const query = jest.fn().mockResolvedValue(events);
      // This repo sends the whole-window totals through queryLong() (extended
      // timeout, see #1099) instead of getClient().query(), so the two windows
      // are asserted on their respective mocks.
      queryLong.mockResolvedValue(events);
      getClient.mockReturnValue({ query });
      const vm = {
        settingsStore: { startOfDay: '04:00' },
        buildCategoryQuery: () => ['RETURN = {};'],
      };
      vm.dayPeriods = Trends.methods.dayPeriods.bind(vm);

      const previous = await Trends.methods.queryTotals.call(
        vm,
        moment('2026-10-05'),
        moment('2026-10-12')
      );
      const current = await Trends.methods.queryByDay.call(
        vm,
        moment('2026-10-12'),
        moment('2026-10-19')
      );

      const boundary = moment('2026-10-12T04:00:00').format();
      expect(queryLong).toHaveBeenCalledWith(
        [`${moment('2026-10-05T04:00:00').format()}/${boundary}`],
        ['RETURN = {};']
      );
      expect(query).toHaveBeenNthCalledWith(
        1,
        [`${boundary}/${moment('2026-10-13T04:00:00').format()}`],
        ['RETURN = {};'],
        { name: 'trendsByDay', verbose: true }
      );
      expect(query).toHaveBeenCalledTimes(7);
      expect(queryLong.mock.calls[0][0][0].split('/')[1]).toBe(
        query.mock.calls[0][0][0].split('/')[0]
      );
      expect(Object.keys(current.byPeriod)).toHaveLength(7);
      expect(previous).toEqual({ '["Work"]': 600 });
      expect(current.totals).toEqual({ '["Work"]': 4200 });
    });
  });

  describe('refresh', () => {
    test('bails out without querying when no host is resolvable', async () => {
      const ensureLoaded = jest.fn();
      const vm = {
        host: undefined,
        activityStore: { ensure_loaded: ensureLoaded },
        timeperiod: { start: new Date(), length: [7, 'day'] },
      };
      await Trends.methods.refresh.call(vm);
      expect(ensureLoaded).not.toHaveBeenCalled();
    });

    // Regression for the original bid.endsWith crash used to assert that
    // refresh() forwarded to activityStore.ensure_loaded. That code path
    // no longer exists — Trends now queries the aw-server directly via
    // getClient() and ensure_loaded() is not involved. The host-fallback
    // and no-host-bail-out tests above still cover the bug class.
  });
});
