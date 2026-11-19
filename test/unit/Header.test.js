import { mount, shallowMount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import i18nInstance from '~/i18n';
import router from '~/route';
import { installBootstrapVue } from '~/compat/bootstrap-vue';
import Header from '~/components/Header.vue';

const mockEnsureLoaded = jest.fn().mockResolvedValue(undefined);
const passthroughStub = { template: '<div><slot /></div>' };

jest.mock('~/stores/buckets', () => ({
  useBucketsStore: () => ({
    ensureLoaded: mockEnsureLoaded,
    buckets: [],
  }),
}));

describe('Header tools menu', () => {
  function mountHeader() {
    return mount(Header, {
      global: {
        plugins: [
          createTestingPinia({ createSpy: jest.fn() }),
          router,
          i18nInstance,
          { install: installBootstrapVue },
        ],
        stubs: { icon: true },
      },
    });
  }

  test('links to the standalone Category Builder from the tools menu', async () => {
    const wrapper = mountHeader();
    await wrapper.vm.$nextTick();

    // The dropdown menu is lazy: open the Tools menu before querying items.
    await wrapper.find('.navbar-nav.ml-auto .dropdown-toggle').trigger('click');
    await wrapper.vm.$nextTick();

    const item = wrapper.find('[data-testid="nav-category-builder"]');
    expect(item.exists()).toBe(true);
    expect(item.find('a').attributes('href')).toBe('#/category-builder');
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
