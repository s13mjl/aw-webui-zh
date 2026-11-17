import { mount } from '@vue/test-utils';
import Header from '~/components/Header.vue';
import i18nInstance, { i18n } from '~/i18n';
import { installBootstrapVue } from '~/compat/bootstrap-vue';

jest.mock('~/stores/settings', () => ({
  useSettingsStore: () => ({ devmode: false }),
}));
jest.mock('~/stores/buckets', () => ({
  useBucketsStore: () => ({
    ensureLoaded: jest.fn().mockResolvedValue(undefined),
    buckets: [],
  }),
}));

const RouterLinkStub = {
  props: ['to'],
  template: '<a :href="to"><slot /></a>',
};

async function mountHeader() {
  const wrapper = mount(Header, {
    global: {
      plugins: [i18nInstance, { install: installBootstrapVue }],
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
    const wrapper = await mountHeader();

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
    const wrapper = await mountHeader();

    const toolsToggle = wrapper
      .findAll('a.dropdown-toggle')
      .find(toggle => toggle.text().includes(i18n.t('nav.tools')));
    await toolsToggle.trigger('click');

    const workReportLink = wrapper.find('a[href="/work-report"]');
    expect(workReportLink.exists()).toBe(true);
    expect(workReportLink.text()).toBe(i18n.t('nav.workReport'));
  });
});
