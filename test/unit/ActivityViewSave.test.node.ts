import { createPinia, setActivePinia } from 'pinia';
import ActivityView from '~/views/activity/ActivityView.vue';
import Activity from '~/views/activity/Activity.vue';
import { useViewsStore } from '~/stores/views';
import { useSettingsStore } from '~/stores/settings';

// 上游 #1222：保存/取消要等待确认，草稿编辑在保存期间不得污染视图。
// 本地以纯逻辑方式驱动组件方法，覆盖异步完成语义。
const confirmed = () => [{ id: 'summary', name: 'Summary', elements: [{ type: 'top_apps' }] }];

function viewVm(overrides: Record<string, any> = {}) {
  return {
    pendingAction: false,
    saveError: '',
    layoutRevision: 0,
    editing: true,
    saving: false,
    save: ActivityView.methods.save,
    discard: ActivityView.methods.discard,
    ...overrides,
  } as any;
}

beforeEach(() => {
  setActivePinia(createPinia());
  const settings = useSettingsStore();
  settings.$patch({ views: confirmed(), _loaded: true });
});

afterEach(() => jest.restoreAllMocks());

describe('ActivityView 保存与取消的完成语义', () => {
  test('Save 等到持久化成功后才退出编辑态', async () => {
    jest.spyOn(useSettingsStore(), 'save').mockResolvedValue(undefined);
    const vm = viewVm();
    await vm.save();
    expect(vm.editing).toBe(false);
    expect(vm.saveError).toBe('');
    expect(vm.pendingAction).toBe(false);
  });

  test('Save 失败保持可重试并展示错误，重试可成功', async () => {
    jest
      .spyOn(useSettingsStore(), 'save')
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    const vm = viewVm();
    await vm.save();
    expect(vm.editing).toBe(true);
    expect(vm.saveError).toBe('offline');
    await vm.save();
    expect(vm.editing).toBe(false);
    expect(vm.saveError).toBe('');
  });

  test('Discard 等确认布局重新加载后才退出并递增布局版本号', async () => {
    const views = useViewsStore();
    await views.load();
    views.views[0].name = 'Draft';
    const vm = viewVm();
    await vm.discard();
    expect(vm.layoutRevision).toBe(1);
    expect(vm.editing).toBe(false);
    expect(views.views[0].name).toBe('Summary');
  });
});

describe('Activity 新建视图表单', () => {
  function formVm(overrides: Record<string, any> = {}) {
    return {
      new_view: { id: 'custom', name: 'Custom' },
      newViewSaving: false,
      newViewError: '',
      viewSavePending: false,
      checkFormValidity: jest.fn(() => true),
      $refs: { new_view: { hide: jest.fn() } },
      handleSubmit: Activity.methods.handleSubmit,
      ...overrides,
    } as any;
  }

  test('有其他保存待完成时不再改动草稿', async () => {
    jest.spyOn(useSettingsStore(), 'save').mockResolvedValue(undefined);
    const vm = formVm({ viewSavePending: true });
    await vm.handleSubmit();
    expect(vm.newViewSaving).toBe(false);
    expect(vm.$refs.new_view.hide).not.toHaveBeenCalled();
    expect(useViewsStore().views.map((v: any) => v.id)).toEqual([]);
  });

  test('等待持久化后关闭；失败回滚未确认的插入并保留表单', async () => {
    const settings = useSettingsStore();
    jest
      .spyOn(settings, 'save')
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    const vm = formVm();
    await vm.handleSubmit();
    expect(vm.$refs.new_view.hide).not.toHaveBeenCalled();
    expect(vm.newViewError).toBe('offline');
    expect(vm.new_view).toEqual({ id: 'custom', name: 'Custom' });
    expect(useViewsStore().views.map((v: any) => v.id)).toEqual([]);

    await vm.handleSubmit();
    expect(vm.$refs.new_view.hide).toHaveBeenCalledTimes(1);
    expect(vm.newViewError).toBe('');
    expect(settings.views.map((v: any) => v.id)).toEqual(['custom']);
  });
});
