import QueryExplorer from '~/views/QueryExplorer.vue';
import { i18n } from '~/i18n';
import { buildSavedQuery } from '~/util/savedQueries';

const saveQueryDraft = () =>
  buildSavedQuery({
    id: '',
    name: '',
    query_code: 'RETURN = [];',
    startdate: '2026-05-20',
    enddate: '2026-05-21',
    event_type: 'currentwindow',
  });

describe('QueryExplorer saveCurrentQuery', () => {
  test('canceling an overwrite confirm aborts without opening the save-as-new prompt', async () => {
    const msgBoxConfirm = jest.fn().mockResolvedValue(false);
    const persistSavedQueries = jest.fn();
    const vm = {
      $t: (key, values) => i18n.t(key, values),
      $bvModal: { msgBoxConfirm },
      enddate: '2026-05-21',
      event_type: 'currentwindow',
      persistSavedQueries,
      query_code: 'RETURN = [];',
      savedQueries: [
        {
          id: 'daily-coding-time',
          name: 'Daily Coding Time',
          query_code: 'RETURN = [];',
          start_day_offset: 0,
          end_day_offset: -1,
          event_type: 'currentwindow',
        },
      ],
      selectedSavedQuery: {
        id: 'daily-coding-time',
        name: 'Daily Coding Time',
        query_code: 'RETURN = [];',
        start_day_offset: 0,
        end_day_offset: -1,
        event_type: 'currentwindow',
      },
      selected_saved_query_id: 'daily-coding-time',
      startdate: '2026-05-20',
    };

    await QueryExplorer.methods.saveCurrentQuery.call(vm);

    expect(msgBoxConfirm).toHaveBeenCalled();
    expect(persistSavedQueries).not.toHaveBeenCalled();
  });

  test('keeps save modal open when the query name is blank', async () => {
    const event = { preventDefault: jest.fn() };
    const vm = {
      $t: (key, values) => i18n.t(key, values),
      saveQueryName: '   ',
      saved_query_error: '',
    };

    await QueryExplorer.methods.onSaveQueryConfirm.call(vm, event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(vm.saved_query_error).toBe(i18n.t('queryExplorer.emptyNameAlert'));
  });

  test('cancels save modal closure before awaiting persistence failure', async () => {
    const event = { preventDefault: jest.fn() };
    let resolvePersistence;
    const persistence = new Promise(resolve => {
      resolvePersistence = resolve;
    });
    const vm = {
      enddate: '2026-05-21',
      event_type: 'currentwindow',
      persistSavedQueries: jest.fn().mockReturnValue(persistence),
      query_code: 'RETURN = [];',
      saveQueryDraft: saveQueryDraft(),
      saved_query_pending: false,
      saveQueryName: 'Daily Coding Time',
      savedQueries: [],
      selected_saved_query_id: '',
      showSaveQueryModal: true,
      startdate: '2026-05-20',
    };

    const confirmation = QueryExplorer.methods.onSaveQueryConfirm.call(vm, event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(vm.showSaveQueryModal).toBe(true);

    resolvePersistence(false);
    await confirmation;

    expect(vm.selected_saved_query_id).toBe('');
    expect(vm.showSaveQueryModal).toBe(true);
  });

  test('closes save modal after persistence succeeds', async () => {
    const event = { preventDefault: jest.fn() };
    const vm = {
      enddate: '2026-05-21',
      event_type: 'currentwindow',
      persistSavedQueries: jest.fn().mockResolvedValue(true),
      query_code: 'RETURN = [];',
      saveQueryDraft: saveQueryDraft(),
      saved_query_pending: false,
      saveQueryName: 'Daily Coding Time',
      savedQueries: [],
      selected_saved_query_id: '',
      showSaveQueryModal: true,
      startdate: '2026-05-20',
    };

    await QueryExplorer.methods.onSaveQueryConfirm.call(vm, event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(vm.selected_saved_query_id).not.toBe('');
    expect(vm.showSaveQueryModal).toBe(false);
  });

  test('keeps rename modal open when the query name is blank', async () => {
    const event = { preventDefault: jest.fn() };
    const vm = {
      $t: (key, values) => i18n.t(key, values),
      renameQueryName: '   ',
      saved_query_error: '',
      selectedSavedQuery: { id: 'daily-coding-time', name: 'Daily Coding Time' },
    };

    await QueryExplorer.methods.onRenameQueryConfirm.call(vm, event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(vm.saved_query_error).toBe(i18n.t('queryExplorer.emptyNameAlert'));
  });

  test('cancels rename modal closure before awaiting persistence failure', async () => {
    const event = { preventDefault: jest.fn() };
    let resolvePersistence;
    const persistence = new Promise(resolve => {
      resolvePersistence = resolve;
    });
    const selectedSavedQuery = { id: 'daily-coding-time', name: 'Daily Coding Time' };
    const vm = {
      persistSavedQueries: jest.fn().mockReturnValue(persistence),
      renameQueryName: 'Coding Time',
      renameQueryTarget: { ...selectedSavedQuery },
      saved_query_pending: false,
      savedQueries: [selectedSavedQuery],
      selectedSavedQuery,
      showRenameQueryModal: true,
    };

    const confirmation = QueryExplorer.methods.onRenameQueryConfirm.call(vm, event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(vm.showRenameQueryModal).toBe(true);

    resolvePersistence(false);
    await confirmation;

    expect(vm.showRenameQueryModal).toBe(true);
  });

  test('closes rename modal after persistence succeeds', async () => {
    const event = { preventDefault: jest.fn() };
    const selectedSavedQuery = { id: 'daily-coding-time', name: 'Daily Coding Time' };
    const vm = {
      persistSavedQueries: jest.fn().mockResolvedValue(true),
      renameQueryName: 'Coding Time',
      renameQueryTarget: { ...selectedSavedQuery },
      saved_query_pending: false,
      savedQueries: [selectedSavedQuery],
      selectedSavedQuery,
      showRenameQueryModal: true,
    };

    await QueryExplorer.methods.onRenameQueryConfirm.call(vm, event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(vm.showRenameQueryModal).toBe(false);
  });
});

describe('QueryExplorer eventcount_str', () => {
  const event = { timestamp: '2026-10-31T12:00:00Z', duration: 10, data: { title: 'Code' } };
  const count = value => QueryExplorer.computed.eventcount_str.call({ events: value, $t: (key, values) => i18n.t(key, values) });

  test('统计普通与空事件数组', () => {
    expect(count([event])).toBe(i18n.t('queryExplorer.numberOfEvents') + '1');
    expect(count([])).toBe(i18n.t('queryExplorer.numberOfEvents') + '0');
  });

  test.each([[42], [{ total: 42 }], [null], [[1, 2]], [[{ duration: 5, label: 'total' }]]])(
    '非事件结果 %p 不标注为事件',
    value => {
      expect(count(value)).toBe('');
    }
  );
});
