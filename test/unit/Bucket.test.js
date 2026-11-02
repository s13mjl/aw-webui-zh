import { reactive } from 'vue';
import { shallowMount } from '@vue/test-utils';
import Bucket from '~/views/Bucket.vue';
import i18nInstance from '~/i18n';
import { installBootstrapVue } from '~/compat/bootstrap-vue';
import { filters } from '~/util/filters';

const mockCountEvents = jest.fn();
const mockGetBucketWithEvents = jest.fn();
const mockLoadBuckets = jest.fn();
const mockEnsureLoaded = jest.fn().mockResolvedValue(undefined);
const knownBucket = {
  id: 'aw-watcher-window_host',
  type: 'currentwindow',
  hostname: 'host',
  client: 'test',
};
// Reactive like the real Pinia store, so the view's `bucket` computed sees a refresh.
const mockState = reactive({ buckets: [] });

jest.mock('~/util/awclient', () => ({
  getClient: () => ({ countEvents: mockCountEvents }),
}));

jest.mock('~/stores/buckets', () => ({
  useBucketsStore: () => ({
    ensureLoaded: mockEnsureLoaded,
    loadBuckets: mockLoadBuckets,
    getBucket: id => mockState.buckets.find(b => b.id === id),
    getBucketWithEvents: mockGetBucketWithEvents,
  }),
}));

// Like the real input-timeinterval, emit an initial date range on mount
// (Vue 3 v-model uses update:modelValue instead of input).
const InputTimeIntervalStub = {
  template: '<div class="timeinterval" />',
  mounted() {
    const t = iso => ({ format: () => iso });
    this.$emit('update:modelValue', [t('2026-10-01T00:00:00Z'), t('2026-10-02T00:00:00Z')]);
  },
};

function mountBucket(id) {
  return shallowMount(Bucket, {
    props: { id },
    global: {
      plugins: [i18nInstance, { install: installBootstrapVue }],
      config: {
        globalProperties: { $filters: filters },
      },
      stubs: {
        'b-alert': { template: '<div class="alert"><slot /></div>' },
        'router-link': { template: '<a><slot /></a>' },
        'input-timeinterval': InputTimeIntervalStub,
        'vis-timeline': true,
        'aw-eventlist': true,
      },
    },
  });
}

async function flush() {
  for (let i = 0; i < 3; i++) await new Promise(resolve => setTimeout(resolve, 0));
}

describe('Bucket view', () => {
  beforeEach(() => {
    mockState.buckets = [knownBucket];
    mockCountEvents.mockReset();
    mockLoadBuckets.mockReset().mockResolvedValue(undefined);
    mockEnsureLoaded.mockReset().mockResolvedValue(undefined);
    mockGetBucketWithEvents.mockReset().mockResolvedValue({ ...knownBucket, events: [] });
  });

  test('shows the event count returned by countEvents', async () => {
    mockCountEvents.mockResolvedValue(49828);
    const wrapper = mountBucket('aw-watcher-window_host');
    await flush();

    expect(mockCountEvents).toHaveBeenCalledWith('aw-watcher-window_host');
    expect(wrapper.vm.eventcount).toBe(49828);
    expect(wrapper.text()).toContain('49828');
    expect(wrapper.find('.alert').exists()).toBe(false);
    expect(mockGetBucketWithEvents).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'aw-watcher-window_host' })
    );
  });

  test('shows a count of 0 when aw-client returns the raw response', async () => {
    mockCountEvents.mockResolvedValue({ data: 0, status: 200 });
    const wrapper = mountBucket('aw-watcher-window_host');
    await flush();

    expect(wrapper.vm.eventcount).toBe(0);
  });

  test('refreshes a stale bucket list before calling a bucket missing', async () => {
    const newBucket = { ...knownBucket, id: 'aw-watcher-new_host' };
    mockLoadBuckets.mockImplementation(async () => {
      mockState.buckets = [knownBucket, newBucket];
    });
    mockCountEvents.mockResolvedValue(3);
    const wrapper = mountBucket('aw-watcher-new_host');
    await flush();

    expect(mockLoadBuckets).toHaveBeenCalled();
    expect(wrapper.find('.alert').exists()).toBe(false);
    expect(mockCountEvents).toHaveBeenCalledWith('aw-watcher-new_host');
    expect(wrapper.vm.eventcount).toBe(3);
  });

  test('renders a not-found state for an unknown bucket', async () => {
    const wrapper = mountBucket('does-not-exist');
    await flush();

    expect(mockLoadBuckets).toHaveBeenCalled();
    expect(mockCountEvents).not.toHaveBeenCalled();
    expect(mockGetBucketWithEvents).not.toHaveBeenCalled();
    expect(wrapper.find('.alert').text()).toContain('No bucket named "does-not-exist".');
    expect(wrapper.find('table').exists()).toBe(false);
  });

  test('hides the Data row when the bucket has no data', async () => {
    mockCountEvents.mockResolvedValue(1);

    // knownBucket has no `data` field at all (undefined must not throw in Object.keys)
    const withoutData = mountBucket('aw-watcher-window_host');
    await flush();
    expect(withoutData.find('table').exists()).toBe(true);
    expect(withoutData.text()).not.toContain('Data:');

    const emptyData = { ...knownBucket, id: 'aw-watcher-empty_host', data: {} };
    mockState.buckets = [...mockState.buckets, emptyData];
    const withEmptyData = mountBucket('aw-watcher-empty_host');
    await flush();
    expect(withEmptyData.text()).not.toContain('Data:');

    const withData = { ...knownBucket, id: 'aw-watcher-full_host', data: { client: 'c' } };
    mockState.buckets = [...mockState.buckets, withData];
    const withRealData = mountBucket('aw-watcher-full_host');
    await flush();
    expect(withRealData.text()).toContain('Data:');
  });
});
