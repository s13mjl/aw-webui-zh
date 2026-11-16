import moment from 'moment';

import Search from '~/views/Search.vue';

describe('search results', () => {
  const makeVm = hits => ({
    $aw: { query: jest.fn().mockResolvedValue([hits]) },
    pattern: 'firefox',
    events: null,
    status: null,
    error: null,
    searchSequence: 0,
    queryOptions: {
      hostname: 'some-host',
      filter_afk: true,
      start: moment('2026-05-20T00:00:00Z'),
      stop: moment('2026-05-21T00:00:00Z'),
    },
  });

  test('drops the synthetic searched category from every hit', async () => {
    const hits = [
      {
        timestamp: '2026-05-20T10:00:00.000Z',
        duration: 5,
        data: { app: 'Firefox', title: 'searched page', $category: ['searched'] },
      },
    ];
    const vm = makeVm(hits);

    await Search.methods.search.call(vm);

    expect(vm.error).toBe('');
    expect(vm.events).toHaveLength(1);
    // The category the query uses for filtering must not leak into the results
    expect(vm.events[0].data).not.toHaveProperty('$category');
    expect(vm.events[0].data).toMatchObject({ app: 'Firefox', title: 'searched page' });
    // The original query payload must stay untouched
    expect(hits[0].data).toHaveProperty('$category');
  });

  test('still sorts hits newest first', async () => {
    const hits = [
      {
        timestamp: '2026-05-20T09:00:00.000Z',
        duration: 1,
        data: { title: 'older', $category: ['searched'] },
      },
      {
        timestamp: '2026-05-20T11:00:00.000Z',
        duration: 1,
        data: { title: 'newer', $category: ['searched'] },
      },
    ];
    const vm = makeVm(hits);

    await Search.methods.search.call(vm);

    expect(vm.events.map(e => e.data.title)).toEqual(['newer', 'older']);
  });

  test('tolerates a payload without results', async () => {
    const vm = makeVm(undefined);

    await Search.methods.search.call(vm);

    expect(vm.error).toBe('');
    expect(vm.events).toEqual([]);
  });

  const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
  const flush = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  };
  const hit = title => ({
    timestamp: '2026-05-20T10:00:00.000Z',
    duration: 5,
    data: { title, $category: ['searched'] },
  });

  test('an older success cannot replace newer results', async () => {
    const old = deferred();
    const vm = makeVm([]);
    vm.$aw.query = jest.fn().mockReturnValueOnce(old.promise).mockResolvedValueOnce([[hit('new')]]);

    const older = Search.methods.search.call(vm);
    await flush();
    await Search.methods.search.call(vm);
    const latest = { events: vm.events, error: vm.error };

    old.resolve([[hit('old')]]);
    await older;

    expect(latest.events[0].data.title).toBe('new');
    expect({ events: vm.events, error: vm.error }).toEqual(latest);
    expect(vm.status).toBeNull();
  });

  test('an older failure cannot clear loading or erase a newer success', async () => {
    const old = deferred();
    const current = deferred();
    const vm = makeVm([]);
    vm.$aw.query = jest.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);

    const older = Search.methods.search.call(vm);
    await flush();
    const newer = Search.methods.search.call(vm);
    await flush();

    old.reject(new Error('obsolete failure'));
    await older;
    expect(vm.status).toBe('searching');
    expect(vm.events).toBeNull();
    expect(vm.error).toBe('');

    current.resolve([[hit('new')]]);
    await newer;
    expect(vm.events[0].data.title).toBe('new');
    expect(vm.status).toBeNull();
  });

  test('beforeUnmount invalidates a pending completion', async () => {
    const pending = deferred();
    const vm = makeVm([]);
    vm.$aw.query = jest.fn().mockReturnValue(pending.promise);

    const search = Search.methods.search.call(vm);
    await flush();
    Search.beforeUnmount.call(vm);
    pending.resolve([[hit('gone')]]);
    await search;

    expect(vm.events).toBeNull();
    expect(vm.error).toBe('');
    expect(vm.status).toBe('searching');
  });

  test('errors without a response payload are reported and permit retry', async () => {
    const vm = makeVm([]);
    vm.$aw.query.mockRejectedValueOnce(new Error('no response'));
    await expect(Search.methods.search.call(vm)).resolves.toBeUndefined();
    expect(vm.error).toContain('no response');
    expect(vm.status).toBeNull();

    vm.$aw.query.mockResolvedValue([[hit('ok')]]);
    await Search.methods.search.call(vm);
    expect(vm.error).toBe('');
    expect(vm.events[0].data.title).toBe('ok');
  });
});
