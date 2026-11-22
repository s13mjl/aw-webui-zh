import { shallowMount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import i18nInstance from '~/i18n';
import { installBootstrapVue } from '~/compat/bootstrap-vue';
import { useSettingsStore } from '~/stores/settings';
import HomeComponent from '~/views/Home.vue';

const Home = HomeComponent;

describe('Home subscribe CTA src', () => {
  let wrapper;

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
        stubs: ['b-alert', 'b-button', 'router-link'],
      },
    });
    return wrapper;
  }

  function subscribeHref(vmWrapper) {
    const link = vmWrapper.findAll('a').find(a => a.text().includes('Support ActivityWatch'));
    expect(link).toBeTruthy();
    return link.attributes('href');
  }

  function hasSubscribeCta(vmWrapper) {
    return vmWrapper.findAll('a').some(a => a.text().includes('Support ActivityWatch'));
  }

  test('hides the subscribe CTA when marked supporter in the settings store', async () => {
    mountHome();
    const store = useSettingsStore();
    store.$patch({ supporter: true });
    await wrapper.vm.$nextTick();

    expect(hasSubscribeCta(wrapper)).toBe(false);
  });

  test('hides the CTA reactively once the supporter flag is set', async () => {
    mountHome();
    expect(hasSubscribeCta(wrapper)).toBe(true);

    const store = useSettingsStore();
    store.$patch({ supporter: true });
    await wrapper.vm.$nextTick();

    expect(hasSubscribeCta(wrapper)).toBe(false);
  });

  test('honours the legacy localStorage supporter flag', () => {
    localStorage.setItem('aw-supporter', 'true');
    mountHome();

    expect(hasSubscribeCta(wrapper)).toBe(false);
    localStorage.removeItem('aw-supporter');
  });

  test('desktop href uses inapp-home', () => {
    const mounted = mountHome();
    expect(subscribeHref(mounted)).toBe('https://activitywatch.net/go/?src=inapp-home');
  });
});
