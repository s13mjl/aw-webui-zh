import { mount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import i18nInstance from '~/i18n';
import router from '~/route';
import { installBootstrapVue } from '~/compat/bootstrap-vue';
import Header from '~/components/Header.vue';

jest.mock('~/stores/buckets', () => ({
  useBucketsStore: () => ({
    ensureLoaded: jest.fn().mockResolvedValue(undefined),
    buckets: [],
  }),
}));

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

describe('Header tools menu', () => {
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
