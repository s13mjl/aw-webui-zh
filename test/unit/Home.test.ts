import { shallowMount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import i18nInstance from '~/i18n';
import { installBootstrapVue } from '~/compat/bootstrap-vue';
import HomeComponent from '~/views/Home.vue';

const Home: any = HomeComponent;

describe('Home subscribe CTA src', () => {
  let wrapper: any;

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
      wrapper = null;
    }
  });

  function mountHome() {
    wrapper = shallowMount(Home, {
      global: {
        plugins: [createTestingPinia(), i18nInstance, { install: installBootstrapVue }],
        mocks: { $isAndroid: false },
        stubs: ['b-alert', 'b-button', 'router-link'],
      },
    });
    return wrapper;
  }

  function subscribeHref(vmWrapper: any): string {
    const link = vmWrapper
      .findAll('a')
      .find((a: any) => a.text().includes('Support ActivityWatch'));
    expect(link).toBeTruthy();
    return link.attributes('href');
  }

  test('desktop href uses inapp-home', () => {
    const mounted = mountHome();
    expect(subscribeHref(mounted)).toBe('https://activitywatch.net/go/?src=inapp-home');
  });
});
