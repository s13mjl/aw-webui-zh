import { buildMultideviceHostParams } from '~/util/multidevice';
import { multideviceActivityQuery, multideviceQuery, safeHostname } from '~/queries';

const baseParams = {
  hosts: ['host1', 'host2'],
  filter_afk: true,
  categories: [],
  filter_categories: null,
  host_params: {},
  always_active_pattern: '',
};

describe('multidevice host params', () => {
  test('keeps the actual synced bucket IDs instead of reconstructed hostnames', () => {
    const bucketsWindow = (host: string) =>
      host === 'host1' ? ['aw-watcher-window_host1-synced-from-host2'] : [];
    const bucketsAFK = (host: string) =>
      host === 'host1' ? ['aw-watcher-afk_host1-synced-from-host2'] : [];

    const { host_params, hosts_with_buckets } = buildMultideviceHostParams(
      ['host1'],
      bucketsWindow,
      bucketsAFK
    );

    expect(hosts_with_buckets).toEqual(['host1']);
    expect(host_params.host1).toEqual({
      bid_window: 'aw-watcher-window_host1-synced-from-host2',
      bid_afk: 'aw-watcher-afk_host1-synced-from-host2',
    });
  });

  test('skips hosts without a window/afk pair', () => {
    const { host_params, hosts_with_buckets } = buildMultideviceHostParams(
      ['host1', 'host2'],
      () => ['aw-watcher-window_host1'],
      () => []
    );
    expect(hosts_with_buckets).toEqual([]);
    expect(host_params).toEqual({});
  });
});

describe('multidevice query', () => {
  test('uses an index-based variable suffix so colliding safe hostnames stay distinct', () => {
    const params = { ...baseParams, hosts: ['work-laptop', 'worklaptop'] };
    expect(safeHostname('work-laptop')).toBe(safeHostname('worklaptop'));

    const query = multideviceQuery(params).join('\n');
    expect(query).toContain('events_worklaptop_0');
    expect(query).toContain('events_worklaptop_1');
  });

  test('per-host bucket overrides are applied to the host query', () => {
    const params = {
      ...baseParams,
      hosts: ['host1'],
      host_params: {
        host1: { bid_window: 'custom-window', bid_afk: 'custom-afk' },
      },
    };

    const query = multideviceQuery(params).join('\n');
    expect(query).toContain('query_bucket("custom-window")');
    expect(query).toContain('query_bucket("custom-afk")');
  });

  test('active-time query unions not-afk periods and returns total duration', () => {
    const query = multideviceActivityQuery(['aw-watcher-afk_host1', 'aw-watcher-afk_host2']);
    expect(query.join('\n')).toContain('period_union(not_afk, not_afk_curr)');
    expect(query.join('\n')).toContain('RETURN = sum_durations(not_afk);');
  });
});
