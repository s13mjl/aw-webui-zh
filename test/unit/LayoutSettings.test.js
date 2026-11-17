const mockGetSettings = jest.fn();
const mockPost = jest.fn();
jest.mock('~/util/awclient', () => ({
  getClient: () => ({
    get_settings: mockGetSettings,
    req: { defaults: { timeout: 0 }, post: mockPost },
  }),
}));
jest.mock('~/stores/server', () => ({ useServerStore: () => ({ getInfo: jest.fn() }) }));

import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { mount, shallowMount } from '@vue/test-utils';
import { useSettingsStore } from '~/stores/settings';
import i18nInstance, { i18n } from '~/i18n';

import App from '~/App.vue';
import LayoutSettings from '~/views/settings/LayoutSettings.vue';

const flush = async () => {
  await new Promise(resolve => setTimeout(resolve, 0));
  await nextTick();
};

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
  mockGetSettings.mockReset().mockResolvedValue({});
  mockPost.mockReset();
  i18n.locale = 'en';
  jest.spyOn(console, 'log').mockImplementation(jest.fn());
});
afterEach(() => jest.restoreAllMocks());

async function persistentStore() {
  const store = useSettingsStore();
  await store.load();
  const server = { ...store.$state };
  mockGetSettings.mockImplementation(async () => ({ ...server }));
  mockPost.mockImplementation(async (url, value) => {
    server[url.split('/').pop()] = value;
  });
  return store;
}

function mountPanel() {
  return mount(LayoutSettings, {
    global: {
      plugins: [i18nInstance],
    },
  });
}

describe('布局草稿控件', () => {
  test('渲染带边界标注的数字输入框，草稿保存前不写库，提交后独立保存', async () => {
    const store = await persistentStore();
    await store.update({ contentWidth: 1800 });
    const wrapper = mountPanel();
    const text = wrapper.find('#layout-text-size');
    const width = wrapper.find('#layout-content-width');
    expect(text.attributes()).toMatchObject({ type: 'number', min: '80', max: '150', step: '1' });
    expect(width.attributes()).toMatchObject({
      type: 'number',
      min: '600',
      max: '2400',
      step: '1',
    });
    expect(wrapper.find('label[for="layout-text-size"]').exists()).toBe(true);
    expect(wrapper.find('label[for="layout-content-width"]').exists()).toBe(true);
    await text.setValue('125');
    expect(store.textSize).toBe(100);
    await wrapper.find('form').trigger('submit');
    await flush();
    expect([store.textSize, store.contentWidth]).toEqual([125, 1800]);
    expect(wrapper.find('[role="status"]').text()).toContain('saved');
    wrapper.unmount();
  });

  test.each(['textSize', 'contentWidth'])(
    '保存一项草稿时保留另一项在别处已保存的值（%s）',
    async remoteKey => {
      const store = await persistentStore();
      const wrapper = mountPanel();
      const remoteValue = remoteKey === 'textSize' ? 140 : 1800;
      const server = { ...store.$state, [remoteKey]: remoteValue };
      mockGetSettings.mockImplementation(async () => ({ ...server }));
      mockPost.mockImplementation(async (url, value) => {
        server[url.split('/').pop()] = value;
      });
      if (remoteKey === 'textSize') {
        await wrapper.find('#layout-automatic-width').setChecked(false);
        await wrapper.find('#layout-content-width').setValue('2100');
      } else {
        await wrapper.find('#layout-text-size').setValue('125');
      }
      await wrapper.find('form').trigger('submit');
      await flush();
      expect(server[remoteKey]).toBe(remoteValue);
      expect(store[remoteKey]).toBe(remoteValue);
      expect([store.textSize, store.contentWidth]).toEqual(
        remoteKey === 'textSize' ? [140, 2100] : [125, 1800]
      );
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
      expect(wrapper.find('[role="status"]').text()).toContain('saved');
      wrapper.unmount();
    }
  );

  test.each([true, false])('提交布局时不覆盖无关的远端设置（是否改动：%s）', async edited => {
    const store = await persistentStore();
    store.$patch({ theme: 'light' });
    const wrapper = mountPanel();
    const server = { ...store.$state, theme: 'dark', landingpage: 'timeline' };
    mockGetSettings.mockImplementation(async () => ({ ...server }));
    mockPost.mockImplementation(async (url, value) => {
      server[url.split('/').pop()] = value;
    });
    if (edited) await wrapper.find('#layout-text-size').setValue('125');
    await wrapper.find('form').trigger('submit');
    await flush();
    expect(server.theme).toBe('dark');
    expect(server.landingpage).toBe('timeline');
    expect(store.theme).toBe('dark');
    expect(store.textSize).toBe(edited ? 125 : 100);
    expect(mockPost.mock.calls.map(([url]) => url)).toEqual(edited ? ['/0/settings/textSize'] : []);
    expect(wrapper.find('[role="status"]').text()).toContain('saved');
    wrapper.unmount();
  });

  test('最终重载被另一写入方抢占时不声称保存成功，提示在别处变更', async () => {
    await persistentStore();
    const wrapper = mountPanel();
    mockPost.mockImplementation(async () => {
      mockGetSettings.mockResolvedValue({ textSize: 140, contentWidth: 0 });
    });
    await wrapper.find('#layout-text-size').setValue('130');
    await wrapper.find('form').trigger('submit');
    await flush();
    const store = useSettingsStore();
    expect(store.textSize).toBe(140);
    expect(wrapper.find('#layout-text-size').element.value).toBe('140');
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    expect(wrapper.find('[role="alert"]').text()).toContain('changed elsewhere');
    wrapper.unmount();
  });

  test('越界草稿拦截且不提交，重置按钮恢复两项持久化值', async () => {
    const store = await persistentStore();
    await store.update({ textSize: 150, contentWidth: 2400 });
    const wrapper = mountPanel();
    await wrapper.find('#layout-text-size').setValue('151');
    mockPost.mockClear();
    await wrapper.find('form').trigger('submit');
    await flush();
    expect(mockPost).not.toHaveBeenCalled();
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    await wrapper.find('[data-testid="layout-reset"]').trigger('click');
    await flush();
    expect([store.textSize, store.contentWidth]).toEqual([100, 0]);
    wrapper.unmount();
  });

  test('宽度单独保存不改文字；自动模式恢复路由默认宽度', async () => {
    const store = await persistentStore();
    await store.update({ textSize: 140 });
    const wrapper = mountPanel();
    await wrapper.find('#layout-automatic-width').setChecked(false);
    await wrapper.find('#layout-content-width').setValue('2100');
    await wrapper.find('form').trigger('submit');
    await flush();
    expect([store.textSize, store.contentWidth]).toEqual([140, 2100]);
    await wrapper.find('#layout-automatic-width').setChecked(true);
    await wrapper.find('form').trigger('submit');
    await flush();
    expect([store.textSize, store.contentWidth]).toEqual([140, 0]);
    wrapper.unmount();
  });

  test('请求挂起期间不报告成功；草稿改动后成功状态被清除', async () => {
    await persistentStore();
    const wrapper = mountPanel();
    let finish;
    const originalPost = mockPost.getMockImplementation();
    mockPost.mockImplementation(async (...args) => {
      await new Promise(resolve => {
        finish = resolve;
      });
      return originalPost(...args);
    });
    await wrapper.find('#layout-text-size').setValue('110');
    await wrapper.find('form').trigger('submit');
    await flush();
    expect(wrapper.find('fieldset').attributes('disabled')).toBeDefined();
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    finish();
    await flush();
    expect(useSettingsStore().textSize).toBe(110);
    expect(wrapper.find('[role="status"]').exists()).toBe(true);
    await wrapper.find('#layout-text-size').setValue('120');
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    wrapper.unmount();
  });

  test('部分拒绝的保存恢复两项已应用值，并提示服务端不确定性', async () => {
    const store = await persistentStore();
    const wrapper = mountPanel();
    const originalPost = mockPost.getMockImplementation();
    mockPost.mockImplementation((url, ...args) => {
      if (url.endsWith('/contentWidth')) return Promise.reject(new Error('offline'));
      return originalPost(url, ...args);
    });
    await wrapper.find('#layout-text-size').setValue('130');
    await wrapper.find('#layout-automatic-width').setChecked(false);
    await wrapper.find('#layout-content-width').setValue('1800');
    await wrapper.find('form').trigger('submit');
    await flush();
    expect([store.textSize, store.contentWidth]).toEqual([100, 0]);
    expect(wrapper.find('[role="alert"]').text()).toContain('may have reached the server');
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    wrapper.unmount();
  });

  test.each(['textSize', 'contentWidth'])(
    '部分保存回滚后重试可把 %s 恢复到选定值',
    async revertedKey => {
      const store = await persistentStore();
      const wrapper = mountPanel();
      const originalPost = mockPost.getMockImplementation();
      let calls = 0;
      mockPost.mockImplementation((url, ...args) => {
        if (++calls === 2) return Promise.reject(new Error('offline'));
        return originalPost(url, ...args);
      });
      await wrapper.find('#layout-text-size').setValue('130');
      await wrapper.find('#layout-automatic-width').setChecked(false);
      await wrapper.find('#layout-content-width').setValue('1800');
      await wrapper.find('form').trigger('submit');
      await flush();
      expect([store.textSize, store.contentWidth]).toEqual([100, 0]);
      expect(wrapper.find('[role="alert"]').exists()).toBe(true);
      if (revertedKey === 'textSize') {
        await wrapper.find('#layout-text-size').setValue('100');
      } else {
        await wrapper.find('#layout-automatic-width').setChecked(true);
      }
      mockPost.mockImplementation(originalPost);
      await wrapper.find('form').trigger('submit');
      await flush();
      const expected = revertedKey === 'textSize' ? [100, 1800] : [130, 0];
      expect([store.textSize, store.contentWidth]).toEqual(expected);
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
      expect(wrapper.find('[role="status"]').text()).toContain('saved');
      await store.load();
      expect([store.textSize, store.contentWidth]).toEqual(expected);
      wrapper.unmount();
    }
  );

  test('部分拒绝的重置恢复已应用布局且不声称成功', async () => {
    const store = await persistentStore();
    await store.update({ textSize: 150, contentWidth: 2400 });
    const wrapper = mountPanel();
    const originalPost = mockPost.getMockImplementation();
    mockPost.mockImplementation((url, ...args) => {
      if (url.endsWith('/contentWidth')) return Promise.reject(new Error('offline'));
      return originalPost(url, ...args);
    });
    await wrapper.find('[data-testid="layout-reset"]').trigger('click');
    await flush();
    expect([store.textSize, store.contentWidth]).toEqual([150, 2400]);
    expect(wrapper.find('[role="alert"]').text()).toContain('may have reached the server');
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    // 后端按键提交而非事务：文字已到达服务端。
    await store.load();
    expect([store.textSize, store.contentWidth]).toEqual([100, 2400]);
    wrapper.unmount();
  });

  test.each([false, true])('重置失败后再次保存重试默认值（部分写入：%s）', async partialWrites => {
    const store = await persistentStore();
    await store.update({ textSize: 150, contentWidth: 2400 });
    const wrapper = mountPanel();
    const originalPost = mockPost.getMockImplementation();
    mockPost.mockImplementation((url, ...args) => {
      if (!partialWrites || url.endsWith('/contentWidth')) {
        return Promise.reject(new Error('offline'));
      }
      return originalPost(url, ...args);
    });
    await wrapper.find('[data-testid="layout-reset"]').trigger('click');
    await flush();
    expect([store.textSize, store.contentWidth]).toEqual([150, 2400]);
    expect(wrapper.find('[role="alert"]').text()).toContain('Could not save');
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    expect(wrapper.find('#layout-text-size').element.value).toBe('100');
    expect(wrapper.find('#layout-automatic-width').element.checked).toBe(true);
    expect(wrapper.find('#layout-content-width').attributes('disabled')).toBeDefined();

    mockPost.mockImplementation(originalPost);
    await wrapper.find('form').trigger('submit');
    await flush();
    expect([store.textSize, store.contentWidth]).toEqual([100, 0]);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.find('[role="status"]').text()).toContain('saved');
    await store.load();
    expect([store.textSize, store.contentWidth]).toEqual([100, 0]);
    wrapper.unmount();
  });

  test.each(['textSize', 'contentWidth'])('无关设置重载期间保留未提交的 %s 草稿', async key => {
    const store = await persistentStore();
    const wrapper = mountPanel();
    if (key === 'textSize') {
      await wrapper.find('#layout-text-size').setValue('125');
    } else {
      await wrapper.find('#layout-automatic-width').setChecked(false);
      await wrapper.find('#layout-content-width').setValue('1800');
    }
    const originalPost = mockPost.getMockImplementation();
    await originalPost('/0/settings/' + key, key === 'textSize' ? 140 : 2100);
    await store.update({ theme: 'dark' });
    await flush();
    expect(wrapper.find('#layout-text-size').element.value).toBe(
      key === 'textSize' ? '125' : '100'
    );
    if (key === 'contentWidth') {
      expect(wrapper.find('#layout-automatic-width').element.checked).toBe(false);
      expect(wrapper.find('#layout-content-width').element.value).toBe('1800');
    }
    await wrapper.find('form').trigger('submit');
    await flush();
    expect(store[key]).toBe(key === 'textSize' ? 125 : 1800);
    expect(wrapper.find('[role="status"]').exists()).toBe(true);
    wrapper.unmount();
  });

  test('en 以外语言使用英文回退，zh-CN 使用真实中文', () => {
    i18n.locale = 'de';
    expect(i18n.t('settings.layout.textSize')).toBe('Text size (%)');
    i18n.locale = 'zh-CN';
    expect(i18n.t('settings.layout.textSize')).toBe('文字大小（%）');
    expect(i18n.t('settings.layout.save')).toBe('保存布局');
    i18n.locale = 'en';
  });

  test('整体保存失败时显示错误、不报告成功、回滚已应用值并保留草稿', async () => {
    await persistentStore();
    const wrapper = mountPanel();
    await wrapper.find('#layout-text-size').setValue('130');
    mockPost.mockRejectedValue(new Error('offline'));
    await wrapper.find('form').trigger('submit');
    await flush();
    expect(wrapper.find('[role="alert"]').text()).toContain('Could not save');
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    expect(useSettingsStore().textSize).toBe(100);
    expect(wrapper.find('#layout-text-size').element.value).toBe('130');
    wrapper.unmount();
  });
});

describe('App 应用布局样式', () => {
  test.each([false, true])(
    '保留路由 fullContainer=%s，仅在手动宽度时附加受限容器覆盖',
    async fullContainer => {
      const store = await persistentStore();
      document.documentElement.style.setProperty('font-size', '17px', 'important');
      const wrapper = shallowMount(App, {
        global: {
          mocks: { $route: { meta: { fullContainer } } },
          stubs: [
            'aw-header',
            'aw-footer',
            'error-boundary',
            'user-satisfaction-poll',
            'new-release-notification',
            'router-view',
          ],
        },
      });
      await flush();
      const container = wrapper.find('.aw-content');
      expect(container.classes()).toContain(fullContainer ? 'container-fluid' : 'container');
      expect(container.element.style.maxWidth).toBe('');
      store.$patch({ textSize: 150, contentWidth: 1800 });
      await nextTick();
      expect(document.documentElement.style.fontSize).toBe('150%');
      expect(container.element.style.maxWidth).toBe('1800px');
      expect(container.element.style.width).toBe('100%');
      store.$patch({ contentWidth: 0 });
      await nextTick();
      expect(container.element.style.maxWidth).toBe('');
      wrapper.unmount();
      expect(document.documentElement.style.fontSize).toBe('17px');
      expect(document.documentElement.style.getPropertyPriority('font-size')).toBe('important');
      store.$patch({ textSize: 80 });
      await nextTick();
      expect(document.documentElement.style.fontSize).toBe('17px');
      document.documentElement.style.removeProperty('font-size');
    }
  );
});
