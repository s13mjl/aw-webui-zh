import WatcherLivenessBanner from '~/components/WatcherLivenessBanner.vue';

const NOW = Date.parse('2026-10-08T12:00:00Z');
const bucket = (id, type, age, hostname = 'desktop') => ({
  id,
  type,
  hostname,
  last_updated: new Date(NOW - age * 60000).toISOString(),
});

function makeVm({ host = 'desktop', buckets = [], dismissed = [] } = {}) {
  const byId = new Map(buckets.map(b => [b.id, b]));
  return {
    host,
    now: NOW,
    metadataFresh: true,
    dismissed,
    bucketsStore: {
      bucketsWindow: h =>
        buckets.filter(b => b.hostname === h && b.type === 'currentwindow').map(b => b.id),
      bucketsAFK: h =>
        buckets.filter(b => b.hostname === h && b.type === 'afkstatus').map(b => b.id),
      getBucket: id => byId.get(id),
    },
  };
}

const staleWatchers = vm => WatcherLivenessBanner.computed.staleWatchers.call(vm);

describe('watcher 停止上报提示（同步上游 #1083）', () => {
  test('核心 watcher 最新、AFK 落后时提示 AFK 已停止', () => {
    const vm = makeVm({
      buckets: [bucket('window', 'currentwindow', 0), bucket('afk', 'afkstatus', 10)],
    });

    expect(staleWatchers(vm)).toEqual([{ type: 'afk', name: 'aw-watcher-afk', minutesAgo: 10 }]);
  });

  test('window watcher 落后时提示 window 已停止', () => {
    const vm = makeVm({
      buckets: [bucket('window', 'currentwindow', 30), bucket('afk', 'afkstatus', 0)],
    });

    expect(staleWatchers(vm)).toEqual([
      { type: 'window', name: 'aw-watcher-window', minutesAgo: 30 },
    ]);
  });

  test('两个 watcher 都落后时不提示，避免整机长时间空闲误报', () => {
    const vm = makeVm({
      buckets: [bucket('window', 'currentwindow', 60), bucket('afk', 'afkstatus', 60)],
    });

    expect(staleWatchers(vm)).toEqual([]);
  });

  test('主机没有核心存储桶时不提示', () => {
    expect(staleWatchers(makeVm())).toEqual([]);
  });

  test('元数据未刷新完成前不判断', () => {
    const vm = makeVm({
      buckets: [bucket('window', 'currentwindow', 0), bucket('afk', 'afkstatus', 10)],
    });
    vm.metadataFresh = false;

    expect(staleWatchers(vm)).toEqual([]);
  });

  test('忽略项按主机隔离，切换主机后重新提示', () => {
    const desktop = makeVm({
      buckets: [bucket('window', 'currentwindow', 0), bucket('afk', 'afkstatus', 10)],
      dismissed: ['desktop:afk'],
    });
    expect(staleWatchers(desktop)).toEqual([]);

    const other = makeVm({
      host: 'other',
      buckets: [
        bucket('other-window', 'currentwindow', 0, 'other'),
        bucket('other-afk', 'afkstatus', 10, 'other'),
      ],
    });
    expect(staleWatchers(other)).toHaveLength(1);
  });

  test('单复数文案按分钟数选择', () => {
    const vm = makeVm();
    vm.$t = jest.fn((key, params) => `${key}:${params.minutes}`);
    expect(WatcherLivenessBanner.methods.messageFor.call(vm, { minutesAgo: 1 })).toBe(
      'watcherLiveness.messageOne:1'
    );
    expect(WatcherLivenessBanner.methods.messageFor.call(vm, { minutesAgo: 6 })).toBe(
      'watcherLiveness.messageMany:6'
    );
  });
});
