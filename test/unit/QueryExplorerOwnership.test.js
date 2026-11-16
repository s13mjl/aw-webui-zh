import QueryExplorer from '~/views/QueryExplorer.vue';
import { i18n } from '~/i18n';
import { buildSavedQuery } from '~/util/savedQueries';

const a = { id: 'a', name: 'A', query_code: 'RETURN = "A";' };
const b = { id: 'b', name: 'B', query_code: 'RETURN = "B";' };

function deferred() {
  let resolve;
  const promise = new Promise(done => (resolve = done));
  return { promise, resolve };
}

const event = () => ({ preventDefault: jest.fn() });

function context() {
  const persistence = deferred();
  const vm = {
    ...QueryExplorer.methods,
    $t: (key, values) => i18n.t(key, values),
    enddate: '2026-05-21',
    event_type: 'currentwindow',
    persistSavedQueries: jest.fn(() => persistence.promise),
    query_code: a.query_code,
    renameQueryName: '',
    renameQueryTarget: null,
    saveQueryDraft: null,
    saveQueryName: '',
    savedQueries: [a, b],
    saved_query_pending: false,
    saved_query_error: '',
    selected_saved_query_id: 'a',
    showRenameQueryModal: false,
    showSaveQueryModal: false,
    startdate: '2026-05-20',
  };
  Object.defineProperty(vm, 'selectedSavedQuery', {
    get: () => vm.savedQueries.find(query => query.id === vm.selected_saved_query_id) || null,
  });
  return { vm, persistence };
}

describe('已保存查询操作的快照归属', () => {
  let confirmSpy;
  beforeEach(() => {
    confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
  });
  afterEach(() => confirmSpy.mockRestore());

  test('确认删除时按调用时的目标删除，完成后不覆盖更新的选择', async () => {
    const { vm, persistence } = context();
    const operation = vm.deleteSelectedQuery();
    expect(confirmSpy).toHaveBeenCalledWith(i18n.t('queryExplorer.deletePrompt', { name: 'A' }));
    vm.selected_saved_query_id = 'b';
    persistence.resolve(true);
    await operation;
    expect(vm.persistSavedQueries).toHaveBeenCalledWith([b]);
    expect(vm.selected_saved_query_id).toBe('b');
  });

  test('正常确认删除会清空仍指向目标的当前选择', async () => {
    const { vm, persistence } = context();
    const operation = vm.deleteSelectedQuery();
    persistence.resolve(true);
    await operation;
    expect(vm.selected_saved_query_id).toBe('');
  });

  test.each(['query_code', 'startdate', 'enddate', 'event_type'])(
    '更新操作在确认前固定 A 的快照：%s 变化不影响结果',
    async field => {
      const { vm, persistence } = context();
      const expected = buildSavedQuery({ ...vm, id: 'a', name: 'A' });
      const operation = vm.saveCurrentQuery();
      vm[field] = field.includes('date') ? '2020-01-01' : 'changed';
      expect(vm.persistSavedQueries).toHaveBeenCalledWith([expected, b]);
      vm.selected_saved_query_id = 'b';
      persistence.resolve(true);
      await operation;
      expect(vm.selected_saved_query_id).toBe('b');
    }
  );

  test('等待持久化期间只运行一个预设变更操作', async () => {
    const { vm, persistence } = context();
    const first = vm.deleteSelectedQuery();
    await vm.saveCurrentQuery();
    await vm.renameSelectedQuery();
    await vm.deleteSelectedQuery();
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(vm.showRenameQueryModal).toBe(false);
    expect(vm.saved_query_pending).toBe(true);
    persistence.resolve(true);
    await first;
    expect(vm.saved_query_pending).toBe(false);
  });

  test('重命名绑定到打开弹窗时的目标，后续选择变化不串改', async () => {
    const { vm, persistence } = context();
    await vm.renameSelectedQuery();
    vm.selected_saved_query_id = 'b';
    vm.renameQueryName = 'Renamed A';
    const operation = vm.onRenameQueryConfirm(event());
    expect(vm.persistSavedQueries).toHaveBeenCalledWith([{ ...a, name: 'Renamed A' }, b]);
    persistence.resolve(true);
    await operation;
    expect(vm.selected_saved_query_id).toBe('b');
    expect(vm.showRenameQueryModal).toBe(false);
  });

  test('过期的重命名完成不会关闭新的弹窗', async () => {
    const { vm, persistence } = context();
    await vm.renameSelectedQuery();
    vm.renameQueryName = 'Renamed A';
    const operation = vm.onRenameQueryConfirm(event());
    vm.renameQueryTarget = { ...b };
    vm.renameQueryName = 'Renamed B';
    vm.showRenameQueryModal = true;
    persistence.resolve(true);
    await operation;
    expect(vm.showRenameQueryModal).toBe(true);
    expect(vm.renameQueryName).toBe('Renamed B');
  });

  test('另存为固定打开时的草稿并保留更新的选择', async () => {
    const { vm, persistence } = context();
    vm.selected_saved_query_id = '';
    const expected = buildSavedQuery({ ...vm, id: 'new', name: 'New' });
    await vm.saveCurrentQuery();
    vm.query_code = b.query_code;
    vm.startdate = '2020-01-01';
    vm.event_type = 'changed';
    vm.selected_saved_query_id = 'b';
    vm.saveQueryName = 'New';
    const operation = vm.onSaveQueryConfirm(event());
    expect(vm.persistSavedQueries).toHaveBeenCalledWith([a, b, expected]);
    persistence.resolve(true);
    await operation;
    expect(vm.selected_saved_query_id).toBe('b');
  });

  test('保存失败时保留草稿以便重试，并阻止重复确认', async () => {
    const { vm, persistence } = context();
    vm.selected_saved_query_id = '';
    await vm.saveCurrentQuery();
    const draft = vm.saveQueryDraft;
    vm.saveQueryName = 'Retry';
    const operation = vm.onSaveQueryConfirm(event());
    await vm.onSaveQueryConfirm(event());
    expect(vm.persistSavedQueries).toHaveBeenCalledTimes(1);
    persistence.resolve(false);
    await operation;
    expect(vm.showSaveQueryModal).toBe(true);
    expect(vm.saveQueryDraft).toBe(draft);
    expect(vm.selected_saved_query_id).toBe('');
    expect(vm.saved_query_pending).toBe(false);
  });
});
