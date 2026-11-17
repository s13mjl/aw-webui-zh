import { mount, shallowMount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import i18nInstance, { i18n } from '~/i18n';
import { installBootstrapVue } from '~/compat/bootstrap-vue';
import Header from '~/components/Header.vue';

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

const mockEnsureLoaded = jest.fn().mockResolvedValue(undefined);

jest.mock('~/stores/buckets', () => ({
  useBucketsStore: () => ({
    ensureLoaded: mockEnsureLoaded,
    buckets: [],
  }),
}));

const passthroughStub = {
  template: '<span><slot /><slot name="button-content" /></span>',
};

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { render: h => h('div') } },
      { path: '/timeline', component: { render: h => h('div') } },
      { path: '/stopwatch', component: { render: h => h('div') } },
    ],
  });
}

function mountFullHeader(router) {
  return mount(Header, {
    global: {
      plugins: [installBootstrapVue, i18nInstance, router],
      stubs: { icon: true },
    },
    attachTo: document.body,
  });
}

// Labels shared by the desktop navbar and the phone drawer (zh-CN copy).
const SHARED_LABELS = ['时间线', '秒表', '工具', '搜索', '工作报告', '原始数据', '设置'];

describe('Header 手机导航抽屉', () => {
  let mediaListeners;

  beforeEach(() => {
    setActivePinia(createPinia());
    mockEnsureLoaded.mockClear();
    mediaListeners = [];
    i18n.locale = 'zh-CN';
    window.matchMedia = jest.fn().mockReturnValue({
      matches: false,
      addEventListener: (_event, fn) => mediaListeners.push(fn),
      removeEventListener: jest.fn(),
    });
  });

  afterEach(() => {
    delete window.matchMedia;
    document.body.innerHTML = '';
  });

  test('桌面宽度下抽屉不展开、不渲染面板', async () => {
    window.matchMedia = jest.fn().mockReturnValue({
      matches: true,
      addEventListener: (_event, fn) => mediaListeners.push(fn),
      removeEventListener: jest.fn(),
    });
    const router = makeRouter();
    const wrapper = mountFullHeader(router);
    await flushPromises();

    expect(wrapper.vm.drawerOpen).toBe(false);
    expect(wrapper.find('[data-testid="nav-drawer"]').exists()).toBe(false);
    // Desktop inline navbar is still present.
    expect(wrapper.find('#nav-collapse').exists()).toBe(true);
    expect(wrapper.find('#nav-collapse').text()).toContain('时间线');
    wrapper.unmount();
  });

  test('触发按钮带中文 aria-label，点击后抽屉展开为对话框', async () => {
    const router = makeRouter();
    const wrapper = mountFullHeader(router);
    await flushPromises();

    const toggle = wrapper.find('[data-testid="nav-drawer-toggle"]');
    expect(toggle.attributes('aria-label')).toBe('菜单');
    expect(wrapper.vm.drawerOpen).toBe(false);

    await toggle.trigger('click');
    await flushPromises();

    const drawer = wrapper.find('[data-testid="nav-drawer"]');
    expect(wrapper.vm.drawerOpen).toBe(true);
    expect(drawer.exists()).toBe(true);
    expect(drawer.attributes('aria-modal')).toBe('true');
    expect(drawer.text()).toContain('ActivityWatch');
    wrapper.unmount();
  });

  test('抽屉与桌面导航包含相同的中文导航项', () => {
    const wrapper = shallowMount(Header, {
      global: {
        plugins: [installBootstrapVue, i18nInstance],
        stubs: {
          'b-navbar': passthroughStub,
          'b-navbar-nav': passthroughStub,
          'b-collapse': passthroughStub,
          'b-sidebar': passthroughStub,
          'b-nav-item': passthroughStub,
          'b-nav-item-dropdown': passthroughStub,
          'b-dropdown-item': passthroughStub,
          'b-navbar-brand': true,
          'b-navbar-toggle': true,
          icon: true,
        },
      },
    });

    const desktopText = wrapper.find('#nav-collapse').text();
    const drawerText = wrapper.find('#nav-drawer').text();
    for (const label of SHARED_LABELS) {
      expect(desktopText).toContain(label);
      expect(drawerText).toContain(label);
    }
    wrapper.unmount();
  });

  test('导航到其他页面后抽屉收起', async () => {
    const router = makeRouter();
    const wrapper = mountFullHeader(router);
    await flushPromises();
    await wrapper.setData({ drawerOpen: true });
    await flushPromises();

    await router.push('/stopwatch');
    await flushPromises();

    expect(wrapper.vm.$route.path).toBe('/stopwatch');
    expect(wrapper.vm.drawerOpen).toBe(false);
    wrapper.unmount();
  });

  test('点击关闭按钮后抽屉收起', async () => {
    const router = makeRouter();
    const wrapper = mountFullHeader(router);
    await flushPromises();

    await wrapper.find('[data-testid="nav-drawer-toggle"]').trigger('click');
    await flushPromises();
    expect(wrapper.vm.drawerOpen).toBe(true);

    const closeButton = wrapper.find('.b-sidebar-header .close');
    expect(closeButton.attributes('aria-label')).toBe('关闭');
    await closeButton.trigger('click');
    await flushPromises();

    expect(wrapper.vm.drawerOpen).toBe(false);
    wrapper.unmount();
  });

  test('点击遮罩后抽屉收起', async () => {
    const router = makeRouter();
    const wrapper = mountFullHeader(router);
    await flushPromises();
    await wrapper.setData({ drawerOpen: true });
    await flushPromises();

    const backdrop = wrapper.find('.b-sidebar-backdrop');
    expect(backdrop.exists()).toBe(true);
    await backdrop.trigger('click');
    await flushPromises();

    expect(wrapper.vm.drawerOpen).toBe(false);
    wrapper.unmount();
  });

  test('按下 Escape 后抽屉收起', async () => {
    const router = makeRouter();
    const wrapper = mountFullHeader(router);
    await flushPromises();
    await wrapper.setData({ drawerOpen: true });
    await flushPromises();

    await wrapper.find('[data-testid="nav-drawer"]').trigger('keydown', { key: 'Escape' });
    await flushPromises();

    expect(wrapper.vm.drawerOpen).toBe(false);
    wrapper.unmount();
  });

  test('视口变为桌面宽度时收起抽屉（含旧版 addListener 回退）', async () => {
    const legacyListeners = [];
    const removeListener = jest.fn();
    window.matchMedia = jest.fn().mockReturnValue({
      matches: false,
      addListener: fn => legacyListeners.push(fn),
      removeListener,
    });

    const router = makeRouter();
    const wrapper = mountFullHeader(router);
    await flushPromises();
    await wrapper.setData({ drawerOpen: true });

    legacyListeners.forEach(fn => fn({ matches: true }));
    await flushPromises();

    expect(wrapper.vm.drawerOpen).toBe(false);
    wrapper.unmount();
    expect(removeListener).toHaveBeenCalledWith(legacyListeners[0]);
  });

  test('抽屉开合不会重复触发活动视图懒加载', async () => {
    const router = makeRouter();
    const wrapper = mountFullHeader(router);
    await flushPromises();
    expect(mockEnsureLoaded).toHaveBeenCalledTimes(1);

    await wrapper.find('[data-testid="nav-drawer-toggle"]').trigger('click');
    await flushPromises();
    await wrapper.setData({ drawerOpen: false });
    await flushPromises();

    expect(mockEnsureLoaded).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });
});
