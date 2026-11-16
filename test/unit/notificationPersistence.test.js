const mockGetSettings = jest.fn();
const mockPost = jest.fn();
const mockGetInfo = jest.fn();
const mockGetRelease = jest.fn();

jest.mock('~/util/awclient', () => ({
  getClient: () => ({
    get_settings: mockGetSettings,
    getInfo: mockGetInfo,
    req: { post: mockPost, defaults: { timeout: 0 } },
  }),
  createClient: jest.fn(),
}));
jest.mock('axios', () => ({ get: (...args) => mockGetRelease(...args) }));

import { shallowMount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import NewReleaseNotification from '~/components/NewReleaseNotification.vue';
import UserSatisfactionPoll from '~/components/UserSatisfactionPoll.vue';
import { useSettingsStore } from '~/stores/settings';

const copy = value => JSON.parse(JSON.stringify(value));
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('通知偏好与退避持久化', () => {
  let server;
  let pinia;
  const newSession = () => {
    pinia = createPinia();
    setActivePinia(pinia);
    return useSettingsStore();
  };
  const mount = component =>
    shallowMount(component, {
      global: { plugins: [pinia], mocks: { $t: key => key } },
    });

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    server = { theme: 'dark' };
    localStorage.clear();
    newSession();
    mockGetSettings.mockReset().mockImplementation(async () => copy(server));
    mockPost.mockReset().mockImplementation(async (url, value) => {
      server[url.replace('/0/settings/', '')] = copy(value);
      return {};
    });
    mockGetInfo.mockReset().mockResolvedValue({ version: 'v1.0.0' });
    mockGetRelease.mockReset().mockResolvedValue({
      data: {
        tag_name: 'v2.0.0',
        published_at: new Date(Date.now() - 8 * 86400 * 1000).toISOString(),
      },
    });
  });
  afterEach(() => jest.restoreAllMocks());

  test('首次挂载持久化初始截止时间，新会话重挂载不再顺延', async () => {
    const first = mount(NewReleaseNotification);
    await flush();
    expect(server.newReleaseCheckData).toBeDefined();
    const deadline = server.newReleaseCheckData.nextCheckTime;
    expect(deadline).toBeDefined();
    first.unmount();

    newSession();
    mockPost.mockClear();
    const second = mount(NewReleaseNotification);
    await flush();
    expect(server.newReleaseCheckData.nextCheckTime).toBe(deadline);
    expect(mockPost).not.toHaveBeenCalled();
    second.unmount();
  });

  test('首次保存失败时回滚且不显示，可重试', async () => {
    let reject = true;
    mockPost.mockImplementation(async (url, value) => {
      const key = url.replace('/0/settings/', '');
      if (key === 'newReleaseCheckData' && reject) {
        reject = false;
        throw new Error('offline');
      }
      server[key] = copy(value);
      return {};
    });
    const failed = mount(NewReleaseNotification);
    await flush();
    expect(server.newReleaseCheckData).toBeUndefined();
    expect(failed.vm.isVisible).toBe(false);
    expect(mockGetInfo).not.toHaveBeenCalled();
    failed.unmount();

    newSession();
    const retried = mount(NewReleaseNotification);
    await flush();
    expect(server.newReleaseCheckData).toBeDefined();
    retried.unmount();
  });

  test('disableCheck 先持久化关闭偏好再显示后续提示', async () => {
    server.newReleaseCheckData = {
      isEnabled: true,
      nextCheckTime: new Date(0).toISOString(),
      howOftenToCheck: 86400,
      timesChecked: 0,
    };
    const wrapper = mount(NewReleaseNotification);
    await flush();
    expect(wrapper.vm.isVisible).toBe(true);
    await wrapper.vm.disableCheck();
    expect(server.newReleaseCheckData.isEnabled).toBe(false);
    expect(wrapper.vm.isVisible).toBe(false);
    expect(wrapper.vm.isFollowUpVisible).toBe(true);
    wrapper.unmount();
  });

  test('调查已展示达到上限时关闭且不再显示', async () => {
    server.userSatisfactionPollData = {
      isEnabled: true,
      nextPollTime: new Date(Date.now() - 86400 * 1000).toISOString(),
      timesPollIsShown: 3,
    };
    const wrapper = mount(UserSatisfactionPoll);
    await flush();
    expect(wrapper.vm.isPollVisible).toBe(false);
    expect(server.userSatisfactionPollData.isEnabled).toBe(false);
    wrapper.unmount();
  });
});
