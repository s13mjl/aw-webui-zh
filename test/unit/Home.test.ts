import { shallowMount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import i18nInstance from '~/i18n';
import { installBootstrapVue } from '~/compat/bootstrap-vue';
import HomeComponent from '~/views/Home.vue';

// Tests call Options API members directly, which the Vue constructor type doesn't expose.
const Home: any = HomeComponent;

describe('Home subscribe CTA src', () => {
  let wrapper: any;

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
      wrapper = null;
    }
  });

  function mountHome(isAndroid: boolean) {
    wrapper = shallowMount(Home, {
      global: {
        plugins: [createTestingPinia(), i18nInstance, { install: installBootstrapVue }],
        mocks: { $isAndroid: isAndroid },
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
    const mounted = mountHome(false);
    expect(mounted.vm.subscribeUrl).toBe('https://activitywatch.net/go/?src=inapp-home');
    expect(subscribeHref(mounted)).toBe('https://activitywatch.net/go/?src=inapp-home');
  });

  test('android href uses inapp-home-android', () => {
    const mounted = mountHome(true);
    expect(mounted.vm.subscribeUrl).toBe('https://activitywatch.net/go/?src=inapp-home-android');
    expect(subscribeHref(mounted)).toBe('https://activitywatch.net/go/?src=inapp-home-android');
  });
});
