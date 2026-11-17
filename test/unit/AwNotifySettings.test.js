import { mount } from '@vue/test-utils';
import AwNotifySettings from '~/views/settings/AwNotifySettings.vue';
import i18nInstance, { i18n } from '~/i18n';
import { installBootstrapVue } from '~/compat/bootstrap-vue';
import { getClient } from '~/util/awclient';

jest.mock('~/util/awclient', () => ({ getClient: jest.fn() }));

const DTO = [
  { label: 'All', category: null, thresholdMinutes: [60, 120, 240], positive: false },
  { label: 'Work', category: 'Work', thresholdMinutes: [15, 30, 60], positive: true },
];

function flush() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

async function mountPanel(reqGet, reqPost) {
  getClient.mockReturnValue({ req: { get: reqGet, post: reqPost } });
  const wrapper = mount(AwNotifySettings, {
    global: {
      plugins: [i18nInstance, { install: installBootstrapVue }],
      stubs: { icon: true },
    },
  });
  await flush();
  return wrapper;
}

describe('AwNotifySettings 通知阈值面板', () => {
  test('404 时加载默认提醒并渲染面板，保存按钮可用', async () => {
    const reqGet = jest.fn().mockRejectedValue({ response: { status: 404 }, message: 'Not Found' });
    const wrapper = await mountPanel(reqGet, jest.fn());

    expect(wrapper.vm.loading).toBe(false);
    expect(wrapper.vm.alerts).toHaveLength(2);
    expect(wrapper.text()).toContain(i18n.t('settings.awNotify.title'));

    const saveBtn = wrapper.find('button.btn-primary');
    expect(saveBtn.exists()).toBe(true);
    expect(saveBtn.attributes('disabled')).toBeUndefined();
  });

  test('非法阈值禁用保存按钮并显示校验错误，点击保存不发起请求', async () => {
    const reqGet = jest.fn().mockResolvedValue({ data: DTO });
    const reqPost = jest.fn();
    const wrapper = await mountPanel(reqGet, reqPost);
    expect(wrapper.vm.alerts).toHaveLength(2);

    await wrapper.setData({
      alerts: [{ ...wrapper.vm.alerts[0], thresholdStr: 'abc' }, wrapper.vm.alerts[1]],
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.hasInvalid).toBe(true);
    expect(wrapper.vm.canSave).toBe(false);

    const saveBtn = wrapper.find('button.btn-primary');
    expect(saveBtn.attributes('disabled')).toBeDefined();

    const invalidFeedback = wrapper.find('.invalid-feedback');
    expect(invalidFeedback.exists()).toBe(true);
    expect(invalidFeedback.text()).toBe(i18n.t('settings.awNotify.thresholdsInvalid'));

    await wrapper.vm.save();
    expect(wrapper.vm.error).toBe(i18n.t('settings.awNotify.invalidThresholds'));
    expect(reqPost).not.toHaveBeenCalled();
  });

  test('保存时把行数据转换为 DTO 并写入服务端设置', async () => {
    const reqGet = jest.fn().mockResolvedValue({ data: DTO });
    const reqPost = jest.fn().mockResolvedValue({});
    const wrapper = await mountPanel(reqGet, reqPost);

    await wrapper.vm.save();

    expect(reqPost).toHaveBeenCalledTimes(1);
    expect(reqPost).toHaveBeenCalledWith('/0/settings/aw-notify', DTO, {
      headers: { 'Content-Type': 'application/json' },
    });
    expect(wrapper.vm.success).toBe(true);
    expect(wrapper.vm.error).toBe('');
  });
});
