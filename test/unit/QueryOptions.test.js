import moment from 'moment';
import { createPinia, setActivePinia } from 'pinia';
import { shallowMount } from '@vue/test-utils';
import i18nInstance from '~/i18n';
import { installBootstrapVue } from '~/compat/bootstrap-vue';
import QueryOptions from '~/components/QueryOptions.vue';
import Search from '~/views/Search.vue';

const mockEnsureLoaded = jest.fn().mockResolvedValue(undefined);

jest.mock('~/stores/buckets', () => ({
  useBucketsStore: () => ({
    ensureLoaded: mockEnsureLoaded,
    hosts: ['laptop'],
  }),
}));

describe('QueryOptions', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockEnsureLoaded.mockClear();
  });

  test('renders date range values in native date inputs', async () => {
    const wrapper = shallowMount(QueryOptions, {
      props: {
        queryOptions: {
          start: '2026-08-15',
          stop: '2026-08-16',
        },
      },
      global: {
        // b-* components and $t are registered globally in main.js, so a bare
        // mount needs the compat layer and the real i18n instance.
        plugins: [i18nInstance, { install: installBootstrapVue }],
        stubs: {
          // shallowMount stubs every child component, slots and all; b-form-group
          // has to stay a passthrough or the date inputs inside it never render.
          'b-form-group': { template: '<div><slot /></div>' },
          'b-form-select': true,
          'b-form-checkbox': true,
        },
      },
    });

    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    const dateInputs = wrapper.findAll('input[type="date"]');
    expect(dateInputs).toHaveLength(2);
    expect(dateInputs.at(0).element.value).toBe('2026-08-15');
    expect(dateInputs.at(1).element.value).toBe('2026-08-16');
  });

  test.each([Search])('initializes date ranges as YYYY-MM-DD strings', view => {
    const data = view.data();

    expect(data.queryOptions.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(data.queryOptions.stop).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test.each([Search])('keeps extended ranges compatible with date inputs', view => {
    const vm = {
      queryOptions: { start: moment('2026-08-15') },
      search: jest.fn(),
      generate: jest.fn(),
    };

    view.methods.extendByWeek.call(vm);

    expect(vm.queryOptions.start).toBe('2026-08-08');
  });
});
