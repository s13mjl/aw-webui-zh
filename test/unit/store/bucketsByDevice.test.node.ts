import { setActivePinia, createPinia } from 'pinia';
import { useBucketsStore } from '~/stores/buckets';
import { useServerStore } from '~/stores/server';
import { IBucket } from '~/util/interfaces';

function bucket(overrides: Partial<IBucket>): IBucket {
  return {
    id: `${overrides.hostname}-${overrides.type || 'test'}`,
    hostname: 'unknown',
    device_id: '',
    type: 'test',
    data: {},
    last_updated: '2024-01-01T00:00:00Z',
    first_seen: '2024-01-01T00:00:00Z',
    ...overrides,
  } as IBucket;
}

describe('bucketsByDevice', () => {
  let bucketsStore: ReturnType<typeof useBucketsStore>;
  let serverStore: ReturnType<typeof useServerStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    bucketsStore = useBucketsStore();
    serverStore = useServerStore();
  });

  test('groups buckets by device_id and exposes it on the device', () => {
    bucketsStore.update_buckets([
      bucket({ id: 'aw-watcher-window_laptop', hostname: 'laptop', device_id: 'uuid-1' }),
      bucket({ id: 'aw-watcher-afk_laptop', hostname: 'laptop', device_id: 'uuid-1' }),
    ]);

    const devices = bucketsStore.bucketsByDevice;
    expect(Object.keys(devices)).toEqual(['uuid-1']);
    expect(devices['uuid-1'].device_id).toBe('uuid-1');
    expect(devices['uuid-1'].hostname).toBe('laptop');
    expect(devices['uuid-1'].device_ids).toEqual(['uuid-1']);
    expect(devices['uuid-1'].hostnames).toEqual(['laptop']);
    expect(devices['uuid-1'].identityAmbiguous).toBe(false);
  });

  test('exposes a defined id for buckets without a device_id', () => {
    bucketsStore.update_buckets([bucket({ id: 'aw-watcher-window_old', hostname: 'oldhost' })]);

    const devices = bucketsStore.bucketsByDevice;
    expect(Object.keys(devices)).toEqual(['oldhost']);
    expect(devices['oldhost'].device_id).toBeUndefined();
    expect(devices['oldhost'].hostname).toBe('oldhost');
    expect(devices['oldhost'].identityAmbiguous).toBe(false);
  });

  test('flags devices with multiple ids or hostnames as ambiguous', () => {
    bucketsStore.update_buckets([
      bucket({ id: 'a', hostname: 'laptop', device_id: 'uuid-1' }),
      bucket({ id: 'b', hostname: 'laptop-old', device_id: 'uuid-1' }),
    ]);

    const devices = bucketsStore.bucketsByDevice;
    expect(devices['uuid-1'].identityAmbiguous).toBe(true);
    expect(devices['uuid-1'].hostnames).toEqual(['laptop', 'laptop-old']);
  });

  test('puts the current device first (matched by device_id)', () => {
    serverStore.$patch({ info: { hostname: 'renamed-host', device_id: 'uuid-self' } as any });
    bucketsStore.update_buckets([
      bucket({
        id: 'other',
        hostname: 'other',
        device_id: 'uuid-other',
        last_updated: '2024-06-01T00:00:00Z',
      }),
      bucket({
        id: 'self',
        hostname: 'laptop',
        device_id: 'uuid-self',
        last_updated: '2024-01-01T00:00:00Z',
      }),
    ]);

    expect(Object.keys(bucketsStore.bucketsByDevice)).toEqual(['uuid-self', 'uuid-other']);
  });

  test('puts the current device first (matched by hostname)', () => {
    serverStore.$patch({ info: { hostname: 'laptop', device_id: '' } as any });
    bucketsStore.update_buckets([
      bucket({
        id: 'other',
        hostname: 'other',
        device_id: 'uuid-other',
        last_updated: '2024-06-01T00:00:00Z',
      }),
      bucket({
        id: 'self',
        hostname: 'laptop',
        device_id: 'uuid-self',
        last_updated: '2024-01-01T00:00:00Z',
      }),
    ]);

    expect(Object.keys(bucketsStore.bucketsByDevice)).toEqual(['uuid-self', 'uuid-other']);
  });

  test('sorts remaining devices by last_updated desc', () => {
    bucketsStore.update_buckets([
      bucket({
        id: 'old',
        hostname: 'old',
        device_id: 'uuid-old',
        last_updated: '2024-01-01T00:00:00Z',
      }),
      bucket({
        id: 'new',
        hostname: 'new',
        device_id: 'uuid-new',
        last_updated: '2024-06-01T00:00:00Z',
      }),
    ]);

    expect(Object.keys(bucketsStore.bucketsByDevice)).toEqual(['uuid-new', 'uuid-old']);
  });
});
