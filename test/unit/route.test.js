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
