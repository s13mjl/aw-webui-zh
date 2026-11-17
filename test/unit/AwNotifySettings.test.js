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
    expect(wrapper.vm.enabled).toBe(false);
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

  test('保存时把行数据转换为 DTO 并写入服务端设置（旧版数组格式按启用处理）', async () => {
    const reqGet = jest.fn().mockResolvedValue({ data: DTO });
    const reqPost = jest.fn().mockResolvedValue({});
    const wrapper = await mountPanel(reqGet, reqPost);

    await wrapper.vm.save();

    expect(reqPost).toHaveBeenCalledTimes(1);
    expect(reqPost).toHaveBeenCalledWith(
      '/0/settings/aw-notify',
      { enabled: true, alerts: DTO },
      { headers: { 'Content-Type': 'application/json' } }
    );
    expect(wrapper.vm.success).toBe(true);
    expect(wrapper.vm.error).toBe('');
  });

  test('从对象配置中读出 enabled: true', async () => {
    const reqGet = jest.fn().mockResolvedValue({
      data: { enabled: true, alerts: [DTO[0]] },
    });
    const wrapper = await mountPanel(reqGet, jest.fn());

    expect(wrapper.vm.enabled).toBe(true);
    expect(wrapper.vm.alerts).toHaveLength(1);
  });

  test('缺少 enabled 时默认为 false', async () => {
    const reqGet = jest.fn().mockResolvedValue({ data: { alerts: [] } });
    const wrapper = await mountPanel(reqGet, jest.fn());

    expect(wrapper.vm.enabled).toBe(false);
  });

  test('保存时写入 enabled: true 并保留既有提醒', async () => {
    const savedAlert = DTO[0];
    const reqGet = jest.fn().mockResolvedValue({
      data: { enabled: false, alerts: [savedAlert] },
    });
    const reqPost = jest.fn().mockResolvedValue({});
    const wrapper = await mountPanel(reqGet, reqPost);

    wrapper.vm.enabled = true;
    await wrapper.vm.save();

    expect(wrapper.vm.error).toBe('');
    expect(reqPost).toHaveBeenCalledWith(
      expect.stringContaining('aw-notify'),
      expect.objectContaining({
        enabled: true,
        alerts: expect.arrayContaining([expect.objectContaining({ category: null })]),
      }),
      expect.anything()
    );
  });

  test('关闭开关时即便隐藏行存在非法阈值也可保存，载荷使用上次保存的提醒', async () => {
    const savedAlert = DTO[1];
    const reqGet = jest.fn().mockResolvedValue({
      data: { enabled: true, alerts: [savedAlert] },
    });
    const reqPost = jest.fn().mockResolvedValue({});
    const wrapper = await mountPanel(reqGet, reqPost);

    // 模拟关闭后被隐藏的行里存在未保存的非法编辑
    wrapper.vm.alerts[0].thresholdStr = 'not-a-number';
    wrapper.vm.enabled = false;
    await wrapper.vm.save();

    expect(wrapper.vm.error).toBe('');
    expect(reqPost).toHaveBeenCalledWith(
      expect.stringContaining('aw-notify'),
      expect.objectContaining({ enabled: false, alerts: [savedAlert] }),
      expect.anything()
    );
  });

  test('关闭开关时即使是合法的未保存编辑也被丢弃（回退到上次保存状态）', async () => {
    const savedAlert = DTO[1];
    const reqGet = jest.fn().mockResolvedValue({
      data: { enabled: true, alerts: [savedAlert] },
    });
    const reqPost = jest.fn().mockResolvedValue({});
    const wrapper = await mountPanel(reqGet, reqPost);

    wrapper.vm.alerts[0].thresholdStr = '30';
    wrapper.vm.enabled = false;
    await wrapper.vm.save();

    expect(wrapper.vm.error).toBe('');
    expect(reqPost).toHaveBeenCalledWith(
      expect.stringContaining('aw-notify'),
      expect.objectContaining({ enabled: false, alerts: [savedAlert] }),
      expect.anything()
    );
  });

  test('同一会话新增的提醒在再次关闭保存时保留', async () => {
    const reqGet = jest.fn().mockResolvedValue({
      data: { enabled: true, alerts: [] },
    });
    const reqPost = jest.fn().mockResolvedValue({});
    const wrapper = await mountPanel(reqGet, reqPost);

    wrapper.vm.alerts.push({ label: 'Work', category: 'Work', thresholdStr: '60', positive: true });
    await wrapper.vm.save();
    reqPost.mockClear();

    wrapper.vm.enabled = false;
    await wrapper.vm.save();

    expect(wrapper.vm.error).toBe('');
    const [, body] = reqPost.mock.calls[0];
    expect(body.enabled).toBe(false);
    expect(body.alerts).toHaveLength(1);
    expect(body.alerts[0].category).toBe('Work');
  });

  test('保存时保留配置中的未知键（如 http_port）', async () => {
    const reqGet = jest.fn().mockResolvedValue({
      data: { enabled: false, alerts: [], http_port: 5600 },
    });
    const reqPost = jest.fn().mockResolvedValue({});
    const wrapper = await mountPanel(reqGet, reqPost);

    await wrapper.vm.save();

    expect(reqPost).toHaveBeenCalledWith(
      expect.stringContaining('aw-notify'),
      expect.objectContaining({ http_port: 5600 }),
      expect.anything()
    );
  });

  test('关闭时输入框禁用但保留已存值，重新开启后原值恢复', async () => {
    const savedAlert = DTO[0];
    const reqGet = jest.fn().mockResolvedValue({
      data: { enabled: true, alerts: [savedAlert] },
    });
    const wrapper = await mountPanel(reqGet, jest.fn());

    await wrapper.setData({ enabled: false });
    await wrapper.vm.$nextTick();

    const cardInputs = wrapper.findAll('.card input');
    expect(cardInputs.length).toBeGreaterThan(0);
    expect(cardInputs.every(i => i.attributes('disabled') !== undefined)).toBe(true);
    // 总开关本身保持可操作
    const toggle = wrapper.find('input[type="checkbox"]');
    expect(toggle.attributes('disabled')).toBeUndefined();
    expect(wrapper.vm.alerts[0].thresholdStr).toBe('60, 120, 240');

    await wrapper.setData({ enabled: true });
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.alerts[0].thresholdStr).toBe('60, 120, 240');
    expect(cardInputs.every(i => i.attributes('disabled') === undefined)).toBe(true);
  });

  test('保存失败时回滚到上次保存的快照并显示失败提示', async () => {
    const savedAlert = DTO[1];
    const reqGet = jest.fn().mockResolvedValue({
      data: { enabled: true, alerts: [savedAlert] },
    });
    const reqPost = jest.fn().mockRejectedValue(new Error('boom'));
    const wrapper = await mountPanel(reqGet, reqPost);

    // 未保存的改动：改阈值、关开关
    wrapper.vm.alerts[0].thresholdStr = '30';
    wrapper.vm.enabled = false;
    await wrapper.vm.save();

    expect(wrapper.vm.error).toBe(i18n.t('settings.awNotify.saveFailed', { error: 'boom' }));
    // 开关与阈值都回退到加载时的快照
    expect(wrapper.vm.enabled).toBe(true);
    expect(wrapper.vm.alerts[0].thresholdStr).toBe('15, 30, 60');
  });
});
