import _ from 'lodash';

import { IBucket } from '~/util/interfaces';
import { defineStore } from 'pinia';
import { getClient, getEventsLong } from '~/util/awclient';
import { useServerStore } from '~/stores/server';

function select_buckets(
  buckets: IBucket[],
  { host, type }: { host?: string; type?: string }
): string[] {
  return _.map(
    _.filter(
      buckets,
      bucket => (!type || bucket.type === type) && (!host || bucket.hostname == host)
    ),
    bucket => bucket['id']
  );
}

interface State {
  buckets: IBucket[];
}

export const useBucketsStore = defineStore('buckets', {
  state: (): State => ({
    buckets: [],
  }),

  getters: {
    hosts(state: State): string[] {
      // TODO: Include consideration of device_id UUID
      let hosts = _.uniq(_.map(state.buckets, bucket => bucket.hostname || bucket.data.hostname));

      // Sort priority:
      //   1. Host that matches the server's own hostname (the device the
      //      webui is running on) — almost always what the user wants by
      //      default in views like Alerts/Trends.
      //   2. Hosts that actually have the buckets we typically query against
      //      (window + AFK), so views don't pick a stale legacy hostname
      //      with only one orphan bucket and then immediately error out.
      //   3. Then by last_updated, newest first (legacy behavior).
      const serverStore = useServerStore();
      const selfHost = serverStore.info && serverStore.info.hostname;
      hosts = _.orderBy(
        hosts,
        [
          host => (host && host === selfHost ? 1 : 0),
          host => {
            const hasWindow = this.bucketsWindow(host).length > 0;
            const hasAfk = this.bucketsAFK(host).length > 0;
            return hasWindow && hasAfk ? 2 : hasWindow || hasAfk ? 1 : 0;
          },
          host => _.max(_.map(this.bucketsByHostname[host], b => b.last_updated)) || '',
        ],
        ['desc', 'desc', 'desc']
      );
      return hosts;
    },
    // Uses device_id instead of hostname
    devices(this: State): string[] {
      // TODO: Include consideration of device_id UUID
      return _.uniq(_.map(this.buckets, bucket => bucket.device_id || bucket.data.device_id));
    },

    available(): (hostname: string) => {
      window: boolean;
      browser: boolean;
      editor: boolean;
      android: boolean;
      category: boolean;
      stopwatch: boolean;
    } {
      // Returns a map of which kinds of buckets are available
      //
      // 'window' requires ((currentwindow + afkstatus) or android) buckets
      // 'browser' requires (currentwindow + afk + browser) buckets
      // 'editor' requires editor buckets
      return hostname => {
        const windowAvail =
          this.bucketsWindow(hostname).length > 0 && this.bucketsAFK(hostname).length > 0;
        const androidAvail = this.bucketsAndroid(hostname).length > 0;

        return {
          window: windowAvail,
          browser: windowAvail && this.bucketsBrowser(hostname).length > 0,
          editor: this.bucketsEditor(hostname).length > 0,
          android: androidAvail,
          category: windowAvail || androidAvail,
          stopwatch: this.bucketsStopwatch(hostname).length > 0,
        };
      };
    },

    bucketsByType(
      this: State
    ): (host: string, type: string, fallback_unknown_host?: boolean) => string[] {
      return (host, type, fallback_unknown_host) => {
        let buckets = select_buckets(this.buckets, { host, type });
        if (fallback_unknown_host && buckets.length == 0) {
          buckets = select_buckets(this.buckets, { host: 'unknown', type });
          //console.log('fallback: ', buckets);
        }
        return buckets;
      };
    },

    // Convenience getters for bucketsByType
    bucketsAFK(): (host: string) => string[] {
      return host => this.bucketsByType(host, 'afkstatus');
    },
    bucketsWindow(): (host: string) => string[] {
      return host =>
        this.bucketsByType(host, 'currentwindow').filter(
          (id: string) => !id.startsWith('aw-watcher-android')
        );
    },
    bucketsAndroid(): (host: string) => string[] {
      return host =>
        this.bucketsByType(host, 'currentwindow').filter((id: string) =>
          id.startsWith('aw-watcher-android')
        );
    },
    bucketsEditor(): (host: string) => string[] {
      // fallback to a bucket with 'unknown' host, if one exists.
      // TODO: This needs a fix so we can get rid of this workaround.
      return host => this.bucketsByType(host, 'app.editor.activity', true);
    },
    bucketsBrowser(): (host: string) => string[] {
      // fallback to a bucket with 'unknown' host, if one exists.
      // TODO: This needs a fix so we can get rid of this workaround.
      return host => this.bucketsByType(host, 'web.tab.current', true);
    },
    bucketsStopwatch(): (host: string) => string[] {
      // fallback to a bucket with 'unknown' host, if one exists.
      // TODO: This needs a fix so we can get rid of this workaround.
      return (host: string) => this.bucketsByType(host, 'general.stopwatch', true);
    },

    getBucket(this: State): (id: string) => IBucket {
      return id => _.filter(this.buckets, b => b.id === id)[0];
    },
    bucketsByHostname(this: State): Record<string, IBucket[]> {
      return _.groupBy(this.buckets, 'hostname');
    },

    // Group all buckets by their device.
    // Returns a dict with buckets by device, keyed by device_id (or hostname
    // for buckets that don't report a device_id).
    //
    // First element will be the current device, if present.
    // Others sorted by last_updated.
    bucketsByDevice: function () {
      const bucketHostname = (b: IBucket) => b.hostname || b.data?.hostname;
      const bucketDeviceId = (b: IBucket) => b.device_id || b.data?.device_id;
      // Buckets without a device_id are grouped by hostname, so that their
      // hostname and id end up being the same and the UI doesn't show a bogus
      // "ID: undefined".
      const bucketGroupKey = (b: IBucket) => bucketDeviceId(b) || bucketHostname(b);

      let devices = _.mapValues(_.groupBy(this.buckets, bucketGroupKey), d => {
        const hostnames = _.uniq(_.compact(_.map(d, bucketHostname)));
        const device_ids = _.uniq(_.compact(_.map(d, bucketDeviceId)));
        const device_id = device_ids[0];
        return {
          buckets: d,
          device_id,
          device_ids,
          hostname: hostnames[0],
          hostnames,
          first_seen: _.min(_.map(d, b => b.first_seen)),
          last_updated: _.max(_.map(d, b => b.last_updated)),
          // Whether anything about this device's identity is ambiguous.
          // A device without a device_id is its own ID (the hostname), so it
          // is not considered ambiguous.
          identityAmbiguous: device_ids.length > 1 || hostnames.length > 1,
        };
      });

      // Sort by last_updated
      const sortObjectByUpdated = _.flow([
        _.toPairs,
        pairs => _.orderBy(pairs, pair => pair[1].last_updated, ['desc']),
        _.fromPairs,
      ]);
      devices = sortObjectByUpdated(devices);

      // find self-device and put first
      const serverStore = useServerStore();
      const info = serverStore.info;
      if (!info) {
        return devices;
      }
      const selfKeys: string[] = _.compact([
        info.device_id,
        info.hostname,
        _.findKey(devices, (d: any) => d.device_ids.includes(info.device_id)),
        _.findKey(devices, (d: any) => d.hostnames.includes(info.hostname)),
      ]);
      const currentKey = selfKeys.find(key => Object.prototype.hasOwnProperty.call(devices, key));
      if (currentKey) {
        const currentDevice = devices[currentKey];
        // remove self from list
        delete devices[currentKey];
        // add self-device back to the top;
        devices = { [currentKey]: currentDevice, ...devices };
      }
      return devices;
    },
  },

  actions: {
    async ensureLoaded(): Promise<void> {
      if (this.buckets.length === 0) {
        await this.loadBuckets();
      }
    },

    async loadBuckets(): Promise<void> {
      const buckets = await getClient().getBuckets();
      this.update_buckets(buckets);
    },

    async getBucketWithEvents({
      id,
      start,
      end,
      limit,
      timeoutMs,
    }: {
      id: string;
      start?: Date;
      end?: Date;
      limit?: number;
      timeoutMs?: number;
    }) {
      await this.ensureLoaded();
      const bucket = _.cloneDeep(this.getBucket(id));
      if (timeoutMs) {
        // Use extended timeout for large fetches (exports, long ranges) — see #847
        bucket.events = await getEventsLong(
          bucket.id,
          { start, end, limit: limit || -1 },
          timeoutMs
        );
      } else {
        bucket.events = await getClient().getEvents(bucket.id, {
          start,
          end,
          limit: limit || -1,
        });
      }
      return bucket;
    },

    async getBucketsWithEvents({
      start,
      end,
      timeoutMs,
    }: {
      start?: Date;
      end?: Date;
      timeoutMs?: number;
    }) {
      await this.ensureLoaded();
      const buckets = await Promise.all(
        _.map(
          this.buckets,
          async bucket => await this.getBucketWithEvents({ id: bucket.id, start, end, timeoutMs })
        )
      );
      return _.orderBy(buckets, [b => b.id], ['asc']);
    },

    async deleteBucket({ bucketId }: { bucketId: string }) {
      console.log(`Deleting bucket ${bucketId}`);
      await getClient().deleteBucket(bucketId);
      await this.loadBuckets();
    },

    async deleteBucketsByHost({ bucketIds }: { bucketIds: string[] }): Promise<string[]> {
      console.log(`Deleting ${bucketIds.length} buckets`);
      try {
        for (const bucketId of bucketIds) {
          await getClient().deleteBucket(bucketId);
        }
      } finally {
        await this.loadBuckets().catch(err => {
          console.warn('Failed to reload buckets after deletion:', err);
        });
      }
      return bucketIds;
    },

    // mutations
    update_buckets(this: State, buckets: IBucket[]): void {
      this.buckets = _.orderBy(buckets, [b => b.id], ['asc']).map(b => {
        // Some harmonization as aw-server-rust and aw-server-python APIs diverge slightly
        if (!b.last_updated && b.metadata && b.metadata.end) {
          b.last_updated = b.metadata.end;
        }
        if (!b.first_seen && b.metadata && b.metadata.start) {
          b.first_seen = b.metadata.start;
        }
        if (!b.first_seen && b.created) {
          b.first_seen = b.created;
        }

        return b;
      });
    },
  },
});
