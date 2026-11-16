import { setActivePinia, createPinia } from 'pinia';
import { useViewsStore, defaultViews } from '~/stores/views';
import { useSettingsStore } from '~/stores/settings';

describe('views store', () => {
  setActivePinia(createPinia());
  const viewsStore = useViewsStore();

  beforeEach(() => {
    viewsStore.clearViews();
  });

  test('load default views', async () => {
    expect(viewsStore.views).toHaveLength(0);
    await viewsStore.load();
    expect(viewsStore.views).not.toHaveLength(0);
  });

  test('loads specific views', () => {
    expect(viewsStore.views).toHaveLength(0);
    viewsStore.loadViews([{ id: 'something', name: 'Something', elements: [] }]);
    expect(viewsStore.views).not.toHaveLength(0);
  });
});

// 上游 #1222：布局草稿与已确认设置隔离，保存期间独占锁，失败可回滚。
describe('views store 草稿隔离与保存归属', () => {
  const copy = (value: any) => JSON.parse(JSON.stringify(value));
  const confirmed = () => [
    {
      id: 'custom',
      name: 'Custom',
      elements: [
        { type: 'top_apps', size: 3, props: { nested: { limit: 5 } } },
        { type: 'top_titles', size: 6 },
      ],
    },
  ];

  beforeEach(() => {
    setActivePinia(createPinia());
    jest.restoreAllMocks();
  });

  async function setup() {
    const settings = useSettingsStore();
    settings.$patch({ views: confirmed(), _loaded: true });
    const views = useViewsStore();
    await views.load();
    return { settings, views };
  }

  test('各类草稿编辑都不会改动已确认设置，load 可恢复', async () => {
    const { settings, views } = await setup();
    views.views[0].elements[0].props!.nested['limit'] = 20;
    views.editView({ view_id: 'custom', el_id: '1', type: 'top_domains', props: { limit: 10 } });
    views.setElements({ view_id: 'custom', elements: [...views.views[0].elements].reverse() });
    views.addVisualization({ view_id: 'custom', type: 'top_urls' });
    views.removeVisualization({ view_id: 'custom', el_id: 1 });
    expect(settings.views).toEqual(confirmed());
    await views.load();
    expect(views.views).toEqual(confirmed());
  });

  test('loadViews/restoreDefaults 深拷贝，避免草稿与默认视图共享引用', async () => {
    const { views } = await setup();
    const pristine = copy(defaultViews);
    views.restoreDefaults();
    views.removeVisualization({ view_id: 'summary', el_id: 0 });
    views.restoreDefaults();
    expect(views.views).toEqual(pristine);
    expect(defaultViews).toEqual(pristine);

    const input = [{ id: 'a', name: 'A', elements: [] }];
    views.loadViews(input);
    input[0].name = 'mutated';
    expect(views.views[0].name).toBe('A');
  });

  test('保存进行中时第二个保存被拒绝，完成后可再次保存', async () => {
    const { settings, views } = await setup();
    let finish!: () => void;
    const write = jest
      .spyOn(settings, 'save')
      .mockImplementationOnce(
        () => new Promise<void>(resolve => { finish = resolve; })
      )
      .mockResolvedValue(undefined);
    views.addVisualization({ view_id: 'custom', type: 'top_urls' });
    const first = views.save().catch(error => error);
    await expect(views.save()).rejects.toThrow('already in progress');
    expect(write).toHaveBeenCalledTimes(1);
    finish();
    expect(await first).toBeUndefined();
    await views.save();
    expect(write).toHaveBeenCalledTimes(2);
    expect(views.views).toEqual(settings.views);
  });

  test('持久化失败回滚已确认快照，但保留可重试的草稿', async () => {
    const { settings, views } = await setup();
    jest.spyOn(settings, 'save').mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    views.addVisualization({ view_id: 'custom', type: 'top_urls' });
    const draft = copy(views.views);
    await expect(views.save()).rejects.toThrow('offline');
    // update 先 patch 了草稿，失败后必须回滚到基线；草稿本身仍可编辑。
    expect(settings.views).toEqual(confirmed());
    expect(views.views).toEqual(draft);
    await views.save();
    expect(settings.views).toEqual(draft);
    expect(views.saving).toBe(false);
  });
});
