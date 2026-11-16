const mockLoadBuckets = jest.fn();
jest.mock('~/stores/buckets', () => ({
  useBucketsStore: () => ({
    bucketsByDevice: [],
    available: jest.fn(() => ({})),
    loadBuckets: mockLoadBuckets,
  }),
}));
jest.mock('~/stores/server', () => ({ useServerStore: () => ({ info: null }) }));
jest.mock('~/util/awclient', () => ({
  exportBucketLong: jest.fn(),
  exportAllBucketsLong: jest.fn(),
  LONG_TIMEOUT_MS: 1,
}));
jest.mock('~/util/export', () => ({ downloadFile: jest.fn() }));

import { shallowMount } from '@vue/test-utils';
import i18nInstance from '~/i18n';
import { installBootstrapVue } from '~/compat/bootstrap-vue';
import Buckets from '~/views/Buckets.vue';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const file = name => new File(['{"buckets":{}}'], name, { type: 'application/json' });
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

let wrapper;
let post;

async function mountBuckets() {
  post = jest.fn();
  wrapper = shallowMount(Buckets, {
    global: {
      plugins: [i18nInstance, { install: installBootstrapVue }],
      mocks: { $aw: { req: { post } } },
      config: {
        globalProperties: { $filters: { friendlytime: v => String(v) } },
        errorHandler: () => {},
      },
      stubs: {
        'b-card': true,
        'b-card-group': true,
        'b-modal': true,
        'b-alert': true,
        'b-button': true,
        'b-form-file': true,
        'b-spinner': true,
        'b-table': true,
        'b-dropdown': true,
        'b-dropdown-item': true,
        'b-dropdown-item-button': true,
        'b-dropdown-divider': true,
        'b-button-group': true,
        'b-badge': true,
        'aw-devonly': true,
        'aw-bucket-merge': true,
        'aw-bucket-validate': true,
        icon: true,
      },
    },
  });
  await flush();
  mockLoadBuckets.mockClear();
}

function select(value) {
  return wrapper.vm.onImportFile(value);
}

function expectPending(selected) {
  expect(wrapper.vm.import_file).toBe(selected);
  expect(wrapper.vm.import_success).toBeFalsy();
  expect(wrapper.vm.import_error).toBeNull();
}

describe('bucket import selection ownership', () => {
  beforeEach(async () => {
    mockLoadBuckets.mockReset().mockResolvedValue(undefined);
    await mountBuckets();
  });
  afterEach(() => wrapper.unmount());

  test.each(['success', 'failure'])(
    'an older %s cannot clear a pending newer import',
    async outcome => {
      const a = deferred();
      const b = deferred();
      const first = file('a.json');
      const second = file('b.json');
      post.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
      select(first);
      await flush();
      select(second);
      await flush();
      expect(post.mock.calls.map(call => call[1].get('buckets.json'))).toEqual([first, second]);

      if (outcome === 'success') a.resolve({});
      else a.reject(new Error('old import failed'));
      await flush();
      expectPending(second);
      expect(mockLoadBuckets).toHaveBeenCalledTimes(1);

      b.resolve({});
      await flush();
      expect(wrapper.vm.import_file).toBeNull();
      expect(wrapper.vm.import_success).toBeTruthy();
      expect(mockLoadBuckets).toHaveBeenCalledTimes(2);
    }
  );

  test('an older failure cannot overwrite a newer failure', async () => {
    const a = deferred();
    const b = deferred();
    post.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    select(file('a.json'));
    await flush();
    select(file('b.json'));
    await flush();
    b.reject({ response: { data: { message: 'B was rejected' } } });
    await flush();
    a.resolve({});
    await flush();

    expect(wrapper.vm.import_success).toBeFalsy();
    expect(wrapper.vm.import_error).toContain('B was rejected');
    expect(wrapper.vm.import_file).toBeNull();
    expect(mockLoadBuckets).toHaveBeenCalledTimes(2);
  });

  test('clearing a selection ignores its later result', async () => {
    const request = deferred();
    post.mockReturnValueOnce(request.promise);
    select(file('a.json'));
    await flush();
    select(null);
    await flush();
    request.resolve({});
    await flush();

    expect(wrapper.vm.import_file).toBeNull();
    expect(wrapper.vm.import_success).toBeFalsy();
    expect(wrapper.vm.import_error).toBeNull();
    expect(post).toHaveBeenCalledTimes(1);
    // The submitted import still reconciles the catalogue; only UI writes are
    // suppressed for the cleared selection.
    expect(mockLoadBuckets).toHaveBeenCalledTimes(1);
  });

  test('an older successful refresh cannot clear a pending newer import', async () => {
    const refresh = deferred();
    const newer = deferred();
    mockLoadBuckets.mockReturnValueOnce(refresh.promise);
    post.mockResolvedValueOnce({}).mockReturnValueOnce(newer.promise);
    select(file('a.json'));
    await flush();
    const second = file('b.json');
    select(second);
    await flush();
    expectPending(second);

    refresh.resolve();
    await flush();
    expectPending(second);

    newer.resolve({});
    await flush();
    expect(wrapper.vm.import_success).toBeTruthy();
    expect(wrapper.vm.import_file).toBeNull();
  });

  test('a rejected import stays failed and can be retried', async () => {
    const selected = file('retry.json');
    const retry = deferred();
    post.mockRejectedValueOnce(new Error('network failure')).mockReturnValueOnce(retry.promise);
    select(selected);
    await flush();
    expect(wrapper.vm.import_error).toBeTruthy();
    expect(wrapper.vm.import_success).toBeFalsy();
    expect(wrapper.vm.import_file).toBeNull();

    select(selected);
    await flush();
    expect(post).toHaveBeenCalledTimes(2);
    expectPending(selected);
    retry.resolve({});
    await flush();
    expect(wrapper.vm.import_error).toBeNull();
    expect(wrapper.vm.import_success).toBeTruthy();
    expect(wrapper.vm.import_file).toBeNull();
  });
});
