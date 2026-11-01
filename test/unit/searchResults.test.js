import moment from 'moment';

import Search from '~/views/Search.vue';

describe('search results', () => {
  const makeVm = hits => ({
    $aw: { query: jest.fn().mockResolvedValue([hits]) },
    pattern: 'firefox',
    events: null,
    status: null,
    error: null,
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
});
