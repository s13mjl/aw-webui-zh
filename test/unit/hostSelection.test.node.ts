import {
  ALL_DEVICES,
  eligibleMultideviceHosts,
  formatHostParam,
  parseHostParam,
  resolveHostSelection,
  toggleHostInSelection,
} from '~/util/multidevice';

const hosts = ['server', 'desktop', 'laptop'];

function bucketsWindow(host: string): string[] {
  return host === 'desktop' || host === 'laptop' ? [`aw-watcher-window_${host}`] : [];
}

function bucketsAFK(host: string): string[] {
  return host === 'desktop' || host === 'laptop' ? [`aw-watcher-afk_${host}`] : [];
}

describe('host selection parsing/formatting', () => {
  test('empty param parses to an empty single-host selection', () => {
    expect(parseHostParam('', hosts)).toEqual({ all: false, hosts: [] });
  });

  test('plain hostname is its own single-host selection', () => {
    expect(parseHostParam('desktop', hosts)).toEqual({ all: false, hosts: ['desktop'] });
  });

  test('@all parses to the all-devices selection', () => {
    expect(parseHostParam(ALL_DEVICES, hosts)).toEqual({ all: true, hosts: [] });
  });

  test('comma list of known hosts parses to a multi-host selection', () => {
    expect(parseHostParam('desktop,laptop', hosts)).toEqual({
      all: false,
      hosts: ['desktop', 'laptop'],
    });
  });

  test('unknown single host is kept literally rather than split', () => {
    expect(parseHostParam('some-unknown-host', hosts)).toEqual({
      all: false,
      hosts: ['some-unknown-host'],
    });
  });

  test('format round-trips single hosts and @all', () => {
    for (const host of hosts) {
      expect(formatHostParam({ all: false, hosts: [host] })).toBe(host);
    }
    expect(formatHostParam({ all: true, hosts: [] })).toBe(ALL_DEVICES);
  });

  test('format round-trips a multi-host list', () => {
    const encoded = formatHostParam({ all: false, hosts: ['desktop', 'laptop'] });
    expect(parseHostParam(encoded, hosts)).toEqual({
      all: false,
      hosts: ['desktop', 'laptop'],
    });
  });

  test('hostnames containing a comma are encoded so the separator is unambiguous', () => {
    const tricky = 'host,name';
    const encoded = formatHostParam({ all: false, hosts: [tricky] });
    expect(encoded).not.toContain(',');
    // The router decodes the segment once before parseHostParam sees it
    const afterRouterDecode = decodeURIComponent(encoded);
    expect(parseHostParam(afterRouterDecode, [tricky])).toEqual({ all: false, hosts: [tricky] });
  });
});

describe('eligible multidevice hosts', () => {
  test('keeps desktop hosts with a window+afk bucket pair only', () => {
    expect(eligibleMultideviceHosts(hosts, bucketsWindow, bucketsAFK)).toEqual([
      'desktop',
      'laptop',
    ]);
  });

  test('excludes fakedata hosts by default', () => {
    const hostsWithFakedata = ['fakedata-host', 'desktop'];
    expect(
      eligibleMultideviceHosts(
        hostsWithFakedata,
        h => [`aw-watcher-window_${h}`],
        h => [`aw-watcher-afk_${h}`]
      )
    ).toEqual(['desktop']);
  });

  test('includes fakedata hosts when includeFakedata is set', () => {
    const hostsWithFakedata = ['fakedata-host', 'desktop'];
    expect(
      eligibleMultideviceHosts(
        hostsWithFakedata,
        h => [`aw-watcher-window_${h}`],
        h => [`aw-watcher-afk_${h}`],
        { includeFakedata: true }
      )
    ).toEqual(['fakedata-host', 'desktop']);
  });

  test('resolves all devices to eligible hosts in priority order', () => {
    const eligible = eligibleMultideviceHosts(hosts, bucketsWindow, bucketsAFK);
    expect(resolveHostSelection({ all: true, hosts: [] }, eligible)).toEqual(eligible);
  });

  test('intersects an explicit list with eligible hosts, keeping priority order', () => {
    const eligible = eligibleMultideviceHosts(hosts, bucketsWindow, bucketsAFK);
    expect(resolveHostSelection({ all: false, hosts: ['laptop', 'desktop'] }, eligible)).toEqual([
      'desktop',
      'laptop',
    ]);
  });

  test('toggle adds and removes a host, and keeps the all-devices state when all eligible are selected', () => {
    const eligible = eligibleMultideviceHosts(hosts, bucketsWindow, bucketsAFK);
    let sel = toggleHostInSelection({ all: false, hosts: ['desktop'] }, 'laptop', eligible);
    expect(sel).toEqual({ all: true, hosts: [] });
    sel = toggleHostInSelection(sel, 'desktop', eligible);
    expect(sel).toEqual({ all: false, hosts: ['laptop'] });
  });
});
