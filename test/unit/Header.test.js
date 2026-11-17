import { mount, shallowMount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import Header from '~/components/Header.vue';
import i18nInstance, { i18n } from '~/i18n';
import { installBootstrapVue } from '~/compat/bootstrap-vue';

const mockEnsureLoaded = jest.fn().mockResolvedValue(undefined);
const passthroughStub = { template: '<div><slot /></div>' };

jest.mock('~/stores/buckets', () => ({
  useBucketsStore: () => ({
    ensureLoaded: mockEnsureLoaded,
    buckets: [],
  }),
}));

const RouterLinkStub = {
  props: ['to'],
  template: '<a :href="to"><slot /></a>',
};

async function mountFullHeader() {
  const wrapper = mount(Header, {
    global: {
      plugins: [i18nInstance, createTestingPinia(), { install: installBootstrapVue }],
      stubs: { icon: true, 'router-link': RouterLinkStub },
    },
  });
  await wrapper.vm.$nextTick();
  // mounted() 内异步等待 ensureLoaded；放行微任务以完成主机列表初始化。
  await Promise.resolve();
  await wrapper.vm.$nextTick();
  return wrapper;
}

describe('Header 工具下拉菜单', () => {
  test('包含 /billing 菜单项，文案来自 nav.billing', async () => {
    const wrapper = await mountFullHeader();

    const toolsToggle = wrapper
      .findAll('a.dropdown-toggle')
      .find(toggle => toggle.text().includes(i18n.t('nav.tools')));
    expect(toolsToggle).toBeTruthy();
    await toolsToggle.trigger('click');

    const billingLink = wrapper.find('a[href="/billing"]');
    expect(billingLink.exists()).toBe(true);
    expect(billingLink.text()).toBe(i18n.t('nav.billing'));
  });

  test('既有 /work-report 菜单项保持不变', async () => {
    const wrapper = await mountFullHeader();

    const toolsToggle = wrapper
      .findAll('a.dropdown-toggle')
      .find(toggle => toggle.text().includes(i18n.t('nav.tools')));
    await toolsToggle.trigger('click');

    const workReportLink = wrapper.find('a[href="/work-report"]');
    expect(workReportLink.exists()).toBe(true);
    expect(workReportLink.text()).toBe(i18n.t('nav.workReport'));
  });
});

describe('Header research edition badge', () => {
  afterEach(() => {
    delete global.AW_RESEARCH_EDITION;
  });

  beforeEach(() => {
    mockEnsureLoaded.mockClear();
  });

  function mountHeader(buildFlag) {
    if (buildFlag === undefined) {
      delete global.AW_RESEARCH_EDITION;
    } else {
      global.AW_RESEARCH_EDITION = buildFlag;
    }

    return shallowMount(Header, {
      global: {
        plugins: [i18nInstance, createTestingPinia()],
        stubs: {
          'b-navbar': passthroughStub,
          'b-navbar-nav': passthroughStub,
          'b-navbar-brand': passthroughStub,
          'b-navbar-toggle': passthroughStub,
          'b-collapse': passthroughStub,
          'b-nav-item': passthroughStub,
          'b-nav-item-dropdown': passthroughStub,
          'b-dropdown-item': passthroughStub,
          'b-badge': passthroughStub,
          icon: passthroughStub,
        },
      },
    });
  }

  test('renders a badge in both brand sites for research builds', () => {
    const wrapper = mountHeader(true);

    expect(wrapper.findAll('[data-testid="research-edition-badge"]')).toHaveLength(2);
  });

  test('renders no badge for standard builds', () => {
    const wrapper = mountHeader(false);

    expect(wrapper.findAll('[data-testid="research-edition-badge"]')).toHaveLength(0);
  });

  test('renders no badge when the build flag is absent', () => {
    const wrapper = mountHeader(undefined);

    expect(wrapper.findAll('[data-testid="research-edition-badge"]')).toHaveLength(0);
  });
});
