import { createLocalVue, mount } from '@vue/test-utils';
import BootstrapVue, { BModal } from 'bootstrap-vue';
import { createPinia, PiniaVuePlugin, setActivePinia } from 'pinia';
import CategoryEditModal from '~/components/CategoryEditModal.vue';
import { useCategoryStore } from '~/stores/categories';

// Enter inside the category edit modal should submit it, same as pressing OK.
// See https://github.com/ActivityWatch/aw-webui/issues/232
describe('CategoryEditModal handleEnter', () => {
  function ctx({ tagName = 'INPUT', ruleType = 'regex', validPattern = true } = {}) {
    const event = { target: { tagName }, preventDefault: jest.fn() };
    const vm = {
      editing: { rule: { type: ruleType } },
      validPattern,
      canSubmit: ruleType !== 'regex' || validPattern,
      handleSubmit: jest.fn(),
      $emit: jest.fn(),
    };
    return { vm, event };
  }

  const handleEnter = (vm, event) => CategoryEditModal.methods.handleEnter.call(vm, event);

  test('submits when Enter is pressed in a text input', () => {
    const { vm, event } = ctx();
    handleEnter(vm, event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(vm.handleSubmit).toHaveBeenCalled();
    expect(vm.$emit).toHaveBeenCalledWith('ok');
  });

  test.each(['TEXTAREA', 'BUTTON', 'A', 'SELECT'])(
    'leaves Enter alone on <%s>, which handles it itself',
    tagName => {
      const { vm, event } = ctx({ tagName });
      handleEnter(vm, event);
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(vm.handleSubmit).not.toHaveBeenCalled();
    }
  );

  test('does not submit an invalid regex, mirroring the disabled OK button', () => {
    const { vm, event } = ctx({ validPattern: false });
    handleEnter(vm, event);
    expect(vm.handleSubmit).not.toHaveBeenCalled();
    expect(vm.$emit).not.toHaveBeenCalled();
  });

  test('submits a rule with no pattern to validate', () => {
    const { vm, event } = ctx({ ruleType: 'none', validPattern: false });
    handleEnter(vm, event);
    expect(vm.handleSubmit).toHaveBeenCalled();
  });
});

describe('CategoryEditModal rule priority', () => {
  const handleSubmit = vm => CategoryEditModal.methods.handleSubmit.call(vm);

  function ctx({ rule = { type: 'regex', regex: 'Firefox', weight: 7 }, priority = null } = {}) {
    const updateClass = jest.fn();
    const vm = {
      editing: {
        id: 1,
        name: 'Browser',
        parent: ['Work'],
        rule,
        patterns: [],
        match_fields: [],
        inherit_color: true,
        color: null,
        inherit_score: true,
        score: null,
        priority,
      },
      checkFormValidity: () => true,
      categoryStore: { updateClass },
      $nextTick: callback => callback(),
      $refs: { edit: { hide: jest.fn() } },
      priorityFromInput: CategoryEditModal.methods.priorityFromInput,
      priorityFromRule: CategoryEditModal.methods.priorityFromRule,
    };
    return { vm, updateClass };
  }

  test('saves an integer priority on regex rules', () => {
    const { vm, updateClass } = ctx({ priority: '25' });
    handleSubmit(vm);
    expect(updateClass.mock.calls[0][0].rule.priority).toBe(25);
    expect(updateClass.mock.calls[0][0].rule.weight).toBeUndefined();
    expect(updateClass.mock.calls[0][0].priority).toBe(25);
  });

  test('blank priority removes existing priority aliases', () => {
    const { vm, updateClass } = ctx({
      rule: { type: 'regex', regex: 'Firefox', priority: 3, weight: 7 },
      priority: '',
    });
    handleSubmit(vm);
    expect(updateClass.mock.calls[0][0].rule.priority).toBeUndefined();
    expect(updateClass.mock.calls[0][0].rule.weight).toBeUndefined();
    expect(updateClass.mock.calls[0][0].priority).toBeNull();
  });

  test('resetModal shows the weight alias as priority', () => {
    const { vm } = ctx();
    vm.categoryId = 1;
    vm.categoryStore.get_category_by_id = () => ({
      id: 1,
      subname: 'Browser',
      parent: ['Work'],
      rule: { type: 'regex', regex: 'Firefox', weight: 7 },
      data: {},
    });

    CategoryEditModal.methods.resetModal.call(vm);

    expect(vm.editing.priority).toBe(7);
  });

  test('resetModal shows the rule priority when present', () => {
    const { vm } = ctx();
    vm.categoryId = 1;
    vm.categoryStore.get_category_by_id = () => ({
      id: 1,
      subname: 'Browser',
      parent: ['Work'],
      rule: { type: 'regex', regex: 'Firefox', priority: 3 },
      data: {},
    });

    CategoryEditModal.methods.resetModal.call(vm);

    expect(vm.editing.priority).toBe(3);
  });

  test('resetModal falls back to legacy top-level priority', () => {
    const { vm } = ctx();
    vm.categoryId = 1;
    vm.categoryStore.get_category_by_id = () => ({
      id: 1,
      subname: 'Browser',
      parent: ['Work'],
      rule: { type: 'regex', regex: 'Firefox' },
      priority: 9,
      data: {},
    });

    CategoryEditModal.methods.resetModal.call(vm);

    expect(vm.editing.priority).toBe(9);
  });

  test('decimal priorities are invalid and block submit', () => {
    const vm = {
      editing: { rule: { type: 'regex' }, priority: '1.5' },
      validPattern: false,
      priorityFromInput: CategoryEditModal.methods.priorityFromInput,
    };

    expect(CategoryEditModal.computed.validPriority.call(vm)).toBe(false);
    expect(CategoryEditModal.computed.canSubmit.call(vm)).toBe(false);
  });

  test('none rules do not require a priority', () => {
    const vm = {
      editing: { rule: { type: 'none' }, priority: '1.5' },
      priorityFromInput: CategoryEditModal.methods.priorityFromInput,
    };

    expect(CategoryEditModal.computed.validPriority.call(vm)).toBe(true);
    expect(CategoryEditModal.computed.canSubmit.call(vm)).toBe(true);
  });
});

describe('CategoryEditModal field-scoped rules', () => {
  const handleSubmit = vm => CategoryEditModal.methods.handleSubmit.call(vm);

  function ctx(match_fields, extra = {}) {
    const updateClass = jest.fn();
    return {
      vm: {
        editing: {
          id: 1,
          name: 'Browser',
          parent: ['Work'],
          rule: { type: 'regex', regex: 'Firefox', select_keys: ['stale'] },
          patterns: ['Firefox'],
          match_fields,
          priority: 0,
          inherit_color: true,
          color: null,
          inherit_score: true,
          score: null,
        },
        validPattern: true,
        validPriority: true,
        checkFormValidity: () => true,
        categoryStore: { updateClass },
        $nextTick: callback => callback(),
        $refs: { edit: { hide: jest.fn() } },
        priorityFromInput: CategoryEditModal.methods.priorityFromInput,
        priorityFromRule: CategoryEditModal.methods.priorityFromRule,
        ...extra,
      },
      updateClass,
    };
  }

  test('blank field selection keeps the legacy unrestricted rule', () => {
    const { vm, updateClass } = ctx([]);
    handleSubmit(vm);
    expect(updateClass.mock.calls[0][0].rule.select_keys).toBeUndefined();
  });

  test('explicit field selection is preserved even when all offered fields are selected', () => {
    const { vm, updateClass } = ctx(['app', 'title']);
    handleSubmit(vm);
    expect(updateClass.mock.calls[0][0].rule.select_keys).toEqual(['app', 'title']);
  });

  test('only canonical fields are offered by default', () => {
    const fieldOptions = CategoryEditModal.computed.fieldOptions.call({
      editing: { match_fields: [] },
    });
    expect(fieldOptions).toEqual(['app', 'title']);
  });

  test('stale unknown fields are still listed but rejected on submit', () => {
    const fieldOptions = CategoryEditModal.computed.fieldOptions.call({
      editing: { match_fields: ['stale'] },
    });
    expect(fieldOptions).toEqual(['app', 'title', 'stale']);

    const { vm, updateClass } = ctx(['stale']);
    vm.$t = k => k;
    vm.checkFormValidity = CategoryEditModal.methods.checkFormValidity;
    expect(vm.checkFormValidity()).toBe(false);
    expect(vm.submitError).toBe('categoryEdit.errorInvalidField');
    handleSubmit(vm);
    expect(updateClass).not.toHaveBeenCalled();
  });
});

describe('CategoryEditModal score round trip', () => {
  test.each([0, 0.5, -0.5, null, undefined])('reopens and saves score %s', score => {
    const updateClass = jest.fn();
    const category = {
      id: 2,
      subname: 'Child',
      parent: ['Parent'],
      rule: { type: 'none' },
      data: { score, color: '#123456' },
    };
    const vm = {
      categoryId: 2,
      categoryStore: { get_category_by_id: () => category, updateClass },
      priorityFromRule: CategoryEditModal.methods.priorityFromRule,
      checkFormValidity: () => true,
      $nextTick: callback => callback(),
      $refs: { edit: { hide: jest.fn() } },
    };

    CategoryEditModal.methods.resetModal.call(vm);
    expect(vm.editing.inherit_score).toBe(score === null || score === undefined);
    CategoryEditModal.methods.handleSubmit.call(vm);

    expect(updateClass).toHaveBeenCalledWith({
      id: 2,
      name: ['Parent', 'Child'],
      rule: { type: 'none' },
      data: { score: score ?? undefined, color: '#123456' },
    });
  });
});

describe('CategoryEditModal mounted score round trip', () => {
  test('keeps numeric zero after showing, saving, and reopening the modal', async () => {
    const localVue = createLocalVue();
    localVue.use(BootstrapVue);
    localVue.use(PiniaVuePlugin);
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useCategoryStore();
    store.load([
      { name: ['Parent'], rule: { type: 'none' }, data: { score: 1 } },
      { name: ['Parent', 'Child'], rule: { type: 'none' }, data: { score: 0 } },
    ]);
    const categoryId = store.get_category(['Parent', 'Child']).id;
    const openModal = async () => {
      const wrapper = mount(CategoryEditModal, {
        localVue,
        pinia,
        propsData: { categoryId },
        mocks: { $t: key => key },
        stubs: {
          'color-picker': true,
          icon: true,
          'b-modal': { extends: BModal, props: { static: { default: true } } },
        },
      });
      await localVue.nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));
      return wrapper;
    };

    let wrapper = await openModal();
    try {
      const scoreCheckbox = wrapper
        .findAllComponents({ name: 'BFormCheckbox' })
        .wrappers.find(checkbox => checkbox.text().includes('Inherit parent score'));
      expect(scoreCheckbox.find('input').element.checked).toBe(false);
      const scoreInput = wrapper
        .findAllComponents({ name: 'BInputGroup' })
        .wrappers.find(group => group.text().includes('Score'))
        .find('input');
      expect(scoreInput.element.value).toBe('0');
      wrapper.vm.$refs.edit.$emit('ok', { preventDefault: jest.fn() });
      await localVue.nextTick();
      expect(store.get_category(['Parent', 'Child']).data.score).toBe(0);
      expect(store.get_category_score(['Parent', 'Child'])).toBe(0);

      wrapper.destroy();
      wrapper = await openModal();
      expect(wrapper.vm.editing.inherit_score).toBe(false);
      expect(wrapper.vm.editing.score).toBe(0);
    } finally {
      wrapper.destroy();
    }
  });
});
