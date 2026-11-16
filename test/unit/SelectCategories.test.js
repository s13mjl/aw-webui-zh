import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import i18nInstance from '~/i18n';
import { installBootstrapVue } from '~/compat/bootstrap-vue';
import SelectCategories from '~/components/SelectCategories.vue';
import SelectCategoriesOrPattern from '~/components/SelectCategoriesOrPattern.vue';
import { useCategoryStore } from '~/stores/categories';

const fixtures = [
  { name: ['Work'], rule: { type: 'regex', regex: 'work' } },
  { name: ['Work', 'Code'], rule: { type: 'regex', regex: 'code' } },
  { name: ['Work', 'Code', 'Editor'], rule: { type: 'regex', regex: 'editor' } },
  { name: ['Work > Code'], rule: { type: 'regex', regex: 'literal' } },
  { name: ['Leisure', 'Work'], rule: { type: 'regex', regex: 'leisure' } },
  { name: ['work'], rule: { type: 'regex', regex: 'lowercase' } },
  { name: ['Work', 'No rule'], rule: { type: 'none' } },
];

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

function setup() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const store = useCategoryStore(pinia);
  store.classes = JSON.parse(JSON.stringify(fixtures));
  jest.spyOn(store, 'load').mockResolvedValue(undefined);
  return pinia;
}

function mountWith(component, pinia, props = {}, stubs = {}) {
  return mount(component, {
    props,
    global: {
      plugins: [pinia, i18nInstance, { install: installBootstrapVue }],
      stubs,
    },
  });
}

describe('结构化类别选择器', () => {
  afterEach(() => jest.restoreAllMocks());

  test('显示标签相同的类别使用不同的结构化值，删除只影响一条路径', async () => {
    const pinia = setup();
    const wrapper = mountWith(SelectCategories, pinia);
    const select = wrapper.find('select');
    const options = select.findAll('option');
    const valueOf = i => options.at(i).element._value;
    expect(valueOf(2)).toBe(JSON.stringify(['Work', 'Code']));
    expect(valueOf(4)).toBe(JSON.stringify(['Work > Code']));

    select.element.selectedIndex = 2;
    await select.trigger('change');
    await wrapper.setProps({ modelValue: wrapper.emitted('update:modelValue').at(-1)[0] });
    select.element.selectedIndex = 4;
    await select.trigger('change');

    const emitted = wrapper.emitted('update:modelValue').at(-1)[0];
    expect(emitted).toEqual([
      ['Work', 'Code'],
      ['Work > Code'],
    ]);
    wrapper.unmount();
  });

  test('含分隔符的单个分段无损往返', () => {
    const pinia = setup();
    const wrapper = mountWith(SelectCategories, pinia);
    const literal = ['Work > Code'];
    expect(wrapper.vm.tagLabel(JSON.stringify(literal))).toBe('Work > Code');
    wrapper.vm.selectedTags = [JSON.stringify(literal), JSON.stringify(['Work', 'Code'])];
    expect(wrapper.emitted('update:modelValue').at(-1)[0]).toEqual([literal, ['Work', 'Code']]);
    wrapper.unmount();
  });

  test('初始 modelValue 驱动可见标签且不产生输入回环', () => {
    const pinia = setup();
    const wrapper = mountWith(SelectCategories, pinia, { modelValue: [['Work > Code']] });
    expect(wrapper.findAll('.b-form-tag')).toHaveLength(1);
    expect(wrapper.text()).toContain('Work > Code');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    wrapper.unmount();
  });

  test.each([
    { selected: [['Work']], expected: [0, 1, 2] },
    { selected: [['Work', 'Code']], expected: [1, 2] },
    { selected: [['Work > Code']], expected: [3] },
    { selected: [['work']], expected: [5] },
    { selected: [], expected: [] },
    { selected: [[]], expected: [] },
  ])('按结构路径前缀筛选 $selected', async ({ selected, expected }) => {
    const pinia = setup();
    const wrapper = mountWith(SelectCategoriesOrPattern, pinia, { filterCategories: selected }, {
      'aw-select-categories': true,
    });
    await flush();
    await flush();
    expect(wrapper.emitted('update:modelValue').at(-1)[0]).toEqual(
      expected.map(i => [fixtures[i].name, fixtures[i].rule])
    );
    wrapper.unmount();
  });
});
