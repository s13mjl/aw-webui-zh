import router from '~/route';

describe('router', () => {
  test('root redirect uses localStorage landingpage when set', () => {
    const rootRoute = router.options.routes.find(route => route.path === '/');

    localStorage.landingpage = '/work-report';
    expect(rootRoute.redirect({})).toBe('/work-report');
  });

  test('root redirect falls back to /home when localStorage landingpage is missing', () => {
    const rootRoute = router.options.routes.find(route => route.path === '/');

    delete localStorage.landingpage;
    expect(rootRoute.redirect({})).toBe('/home');
  });

  test('opens Category Builder as a standalone page and redirects its legacy URL', () => {
    const builderRoute = router.options.routes.find(route => route.path === '/category-builder');
    const legacyRoute = router.options.routes.find(
      route => route.path === '/settings/category-builder'
    );

    expect(builderRoute).toBeTruthy();
    expect(typeof builderRoute.component).toBe('function');
    expect(legacyRoute).toBeTruthy();
    expect(legacyRoute.redirect).toBe('/category-builder');
    expect(router.resolve('/category-builder').path).toBe('/category-builder');
    expect(router.resolve('/settings/categorization').path).toBe('/settings/categorization');
  });

  test('includes the work report route', () => {
    const workReportRoute = router.options.routes.find(route => route.path === '/work-report');

    expect(workReportRoute).toBeTruthy();
    expect(typeof workReportRoute.component).toBe('function');
  });
});

describe('activity route exact interval segment', () => {
  test('keeps the RFC3339 instants and the ".." separator in the interval segment', () => {
    const interval = '2026-10-20T13:00:00Z..2026-10-20T14:00:00Z';
    const resolved = router.resolve({
      name: 'activity-view',
      params: { host: 'testhost', periodLength: 'interval', date: interval },
    });
    expect(resolved.params.date).toBe(interval);
    expect(resolved.path).toBe(`/activity/testhost/interval/${interval}/view`);
  });

  test('keeps timezone offsets, colons and plus signs in instants', () => {
    const interval = '2026-10-20T13:00:00+02:00..2026-10-20T14:00:00-04:00';
    const resolved = router.resolve({
      name: 'activity-view',
      params: { host: 'testhost', periodLength: 'interval', date: interval },
    });
    expect(resolved.params.date).toBe(interval);
    expect(resolved.path).toContain('2026-10-20T13:00:00+02:00');
    expect(resolved.path).toContain('2026-10-20T14:00:00-04:00');
  });

  test('an interval is not confused with a date-range segment', () => {
    const resolved = router.resolve({
      name: 'activity-view',
      params: {
        host: 'testhost',
        periodLength: 'interval',
        date: '2026-10-20T13:00:00Z..2026-10-20T14:00:00Z',
      },
    });
    expect(resolved.params.periodLength).toBe('interval');
    expect(resolved.params.date).toBe('2026-10-20T13:00:00Z..2026-10-20T14:00:00Z');
  });
});
