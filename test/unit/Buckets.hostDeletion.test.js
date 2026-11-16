const mockGetBuckets = jest.fn();
const mockDeleteBucket = jest.fn();
jest.mock('~/util/awclient', () => ({
  ...jest.requireActual('~/util/awclient'),
  getClient: () => ({ getBuckets: mockGetBuckets, deleteBucket: mockDeleteBucket }),
}));
jest.mock('~/util/export', () => ({ downloadFile: jest.fn() }));

import { shallowMount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import i18nInstance from '~/i18n';
import { installBootstrapVue } from '~/compat/bootstrap-vue';
import Buckets from '~/views/Buckets.vue';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const bucket = id => ({
  id,
  hostname: 'host',
  type: 'currentwindow',
  created: new Date('2026-10-28T10:00:00Z'),
  data: {},
});
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const stubs = [
  'b-card',
  'b-card-group',
  'b-badge',
  'b-dropdown',
  'b-dropdown-item',
  'b-dropdown-item-button',
  'b-dropdown-divider',
  'b-modal',
  'b-button',
  'b-button-group',
  'b-alert',
  'b-form-file',
  'b-spinner',
  'b-table',
  'icon',
  'router-link',
  'aw-devonly',
  'aw-bucket-merge',
  'aw-bucket-validate',
].reduce((acc, name) => ({ ...acc, [name]: true }), {});

describe('Buckets host deletion reconciliation', () => {
  let wrapper;
  let catalogue;
  let hideModal;

  const calls = () => mockDeleteBucket.mock.calls.map(([id]) => id);
  const pendingIds = () => wrapper.vm.delete_host_selected.bucketIds;
  const device = () => ({
    hostname: 'host',
    buckets: [...catalogue.values()],
  });
  const deleteOnServer = async id => {
    if (!catalogue.has(id)) throw new Error(`Bucket ${id} does not exist`);
    catalogue.delete(id);
  };
  async function openConfirmation() {
    wrapper.vm.openDeleteHostModal(device());
    await wrapper.vm.$nextTick();
  }
  const submit = () => wrapper.vm.deleteBucketsForSelectedHost();

  beforeEach(async () => {
    mockGetBuckets.mockReset();
    mockDeleteBucket.mockReset();
    catalogue = new Map(['A', 'B', 'C'].map(id => [id, bucket(id)]));
    mockGetBuckets.mockImplementation(async () => [...catalogue.values()]);
    mockDeleteBucket.mockImplementation(deleteOnServer);
    setActivePinia(createPinia());
    hideModal = jest.fn();
    wrapper = shallowMount(Buckets, {
      global: {
        plugins: [i18nInstance, { install: installBootstrapVue }],
        mocks: { $showModal: jest.fn(), $hideModal: hideModal, $aw: { req: { post: jest.fn() } } },
        config: {
          globalProperties: { $filters: { friendlytime: v => String(v) } },
          errorHandler: () => {},
        },
        stubs,
      },
    });
    await flush();
    await openConfirmation();
  });
  afterEach(() => wrapper.unmount());

  test('deletes each confirmed id once and closes the modal on full success', async () => {
    await submit();
    expect(calls()).toEqual(['A', 'B', 'C']);
    expect(hideModal).toHaveBeenCalledWith('delete-host-modal');
    expect(wrapper.vm.delete_host_error).toBeFalsy();
    expect(wrapper.vm.deleting_host).toBe(false);
  });

  test('a failed delete keeps acknowledged progress; retry skips confirmed ids', async () => {
    let failOnce = true;
    mockDeleteBucket.mockImplementation(async id => {
      if (id === 'B' && failOnce) {
        failOnce = false;
        throw new Error('B failed');
      }
      await deleteOnServer(id);
    });
    await submit();
    expect(calls()).toEqual(['A', 'B']);
    expect(pendingIds()).toEqual(['B', 'C']);
    expect(wrapper.vm.delete_host_error).toBe('B failed');
    expect(hideModal).not.toHaveBeenCalled();

    catalogue.set('D', bucket('D')); // new arrival must not be deleted
    await submit();
    expect(calls()).toEqual(['A', 'B', 'B', 'C']);
    expect([...catalogue.keys()]).toEqual(['D']);
    expect(hideModal).toHaveBeenCalledWith('delete-host-modal');
    expect(wrapper.vm.delete_host_error).toBeFalsy();
  });

  test('duplicate confirmation while pending does not issue duplicate deletes', async () => {
    const gate = deferred();
    mockDeleteBucket.mockImplementationOnce(async id => {
      await gate.promise;
      await deleteOnServer(id);
    });
    const first = submit();
    expect(wrapper.vm.deleting_host).toBe(true);
    const duplicate = submit();
    expect(calls()).toEqual(['A']);
    gate.resolve();
    await Promise.all([first, duplicate]);
    expect(calls()).toEqual(['A', 'B', 'C']);
  });

  test('an acknowledgement survives dismiss/reopen and is not retried unless recreated', async () => {
    let failOnce = true;
    mockDeleteBucket.mockImplementation(async id => {
      if (id === 'B' && failOnce) {
        failOnce = false;
        throw new Error('B failed');
      }
      await deleteOnServer(id);
    });
    await submit(); // A acknowledged, B failed, C untouched
    expect(pendingIds()).toEqual(['B', 'C']);

    // Reopen with a recreated A (different creation timestamp): A must be retried.
    catalogue.set('A', { ...bucket('A'), created: new Date('2026-10-29T10:00:00Z') });
    await openConfirmation();
    expect(pendingIds().slice().sort()).toEqual(['A', 'B', 'C']);

    await submit();
    // Reconciliation drops the stale A acknowledgement only when A was recreated;
    // here A is recreated so it is retried, while the confirmed A is not double-counted.
    const deletes = calls();
    expect(deletes.filter(id => id === 'A')).toHaveLength(2); // original + recreated retry
    expect(deletes.filter(id => id === 'B')).toHaveLength(2); // failed once, then retried
    expect(deletes.filter(id => id === 'C')).toHaveLength(1);
    expect(catalogue.size).toBe(0);
  });

  test('a catalogue reload failure does not turn acknowledged success into failure', async () => {
    mockGetBuckets.mockRejectedValueOnce(new Error('Catalogue unavailable'));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await submit();
    expect(calls()).toEqual(['A', 'B', 'C']);
    expect(catalogue.size).toBe(0);
    expect(wrapper.vm.delete_host_error).toBeFalsy();
    expect(hideModal).toHaveBeenCalledWith('delete-host-modal');
  });
});
