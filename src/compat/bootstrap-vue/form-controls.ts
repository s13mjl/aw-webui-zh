import { defineComponent, h, PropType, computed } from 'vue';
import { coerceModel, looseEqual, looseIndexOf, uid } from './utils';

const stateClass = (state: any): string | null =>
  state === true || state === 'valid' ? 'is-valid' : state === false || state === 'invalid' ? 'is-invalid' : null;

export const BForm = defineComponent({
  name: 'BForm',
  props: {
    id: { type: String, default: undefined },
  },
  setup(_props, { slots }) {
    return () => h('form', null, slots.default ? slots.default() : undefined);
  },
});

function colFromProps(props: any, base: 'label' | 'content'): string[] {
  const classes: string[] = [];
  const map: [string, string][] = [
    ['Cols', ''],
    ['ColsSm', 'sm'],
    ['ColsMd', 'md'],
    ['ColsLg', 'lg'],
    ['ColsXl', 'xl'],
  ];
  let any = false;
  for (const [suffix, bp] of map) {
    const value = props[`${base}${suffix}`];
    if (value === undefined || value === null || value === false) continue;
    any = true;
    let n: any = value;
    if (n === '') n = true;
    const prefix = bp ? `col-${bp}` : 'col';
    if (n === true) classes.push(base === 'content' ? 'col' : 'col');
    else if (n === 'auto') classes.push(`${prefix}-auto`);
    else classes.push(`${prefix}-${n}`);
  }
  if (!any && base === 'content') classes.push('col');
  return classes;
}

export const BFormGroup = defineComponent({
  name: 'BFormGroup',
  props: {
    id: { type: String, default: undefined },
    label: { type: String, default: undefined },
    labelFor: { type: String, default: undefined },
    labelClass: { type: [String, Array, Object] as PropType<any>, default: undefined },
    labelSize: { type: String, default: undefined },
    labelSrOnly: { type: Boolean, default: false },
    description: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    invalidFeedback: { type: String, default: undefined },
    validFeedback: { type: String, default: undefined },
    state: { type: [Boolean, String] as PropType<boolean | string | null>, default: null },
    validated: { type: Boolean, default: false },
    tooltip: { type: Boolean, default: false },
    labelCols: { type: [Boolean, Number, String] as PropType<any>, default: undefined },
    labelColsSm: { type: [Boolean, Number, String] as PropType<any>, default: undefined },
    labelColsMd: { type: [Boolean, Number, String] as PropType<any>, default: undefined },
    labelColsLg: { type: [Boolean, Number, String] as PropType<any>, default: undefined },
    labelColsXl: { type: [Boolean, Number, String] as PropType<any>, default: undefined },
    labelAlign: { type: String, default: undefined },
    labelAlignSm: { type: String, default: undefined },
    labelAlignMd: { type: String, default: undefined },
    labelAlignLg: { type: String, default: undefined },
    labelAlignXl: { type: String, default: undefined },
    contentCols: { type: [Boolean, Number, String] as PropType<any>, default: undefined },
    contentColsSm: { type: [Boolean, Number, String] as PropType<any>, default: undefined },
    contentColsMd: { type: [Boolean, Number, String] as PropType<any>, default: undefined },
    contentColsLg: { type: [Boolean, Number, String] as PropType<any>, default: undefined },
    contentColsXl: { type: [Boolean, Number, String] as PropType<any>, default: undefined },
    ariaInvalid: { type: [Boolean, String] as PropType<any>, default: undefined },
  },
  setup(props, { slots }) {
    const autoId = uid('group');
    return () => {
      const horizontal =
        props.labelCols !== undefined ||
        props.labelColsSm !== undefined ||
        props.labelColsMd !== undefined ||
        props.labelColsLg !== undefined ||
        props.labelColsXl !== undefined ||
        props.contentCols !== undefined ||
        props.contentColsSm !== undefined ||
        props.contentColsMd !== undefined ||
        props.contentColsLg !== undefined ||
        props.contentColsXl !== undefined;

      const labelContent = slots.label ? slots.label() : props.label;
      const labelTag = props.labelFor ? 'label' : 'legend';
      const labelColClasses = colFromProps(props, 'label');
      const labelClasses = [
        !props.labelFor ? 'bv-no-focus-ring' : null,
        horizontal || !props.labelFor ? 'col-form-label' : null,
        !horizontal && !props.labelFor ? 'pt-0' : null,
        !horizontal && props.labelFor ? 'd-block' : null,
        props.labelSize ? `col-form-label-${props.labelSize}` : null,
        props.labelAlign ? `text-${props.labelAlign}` : null,
        props.labelClass,
      ];

      let label: any = null;
      if (labelContent || horizontal) {
        const labelEl = labelContent
          ? h(
              labelTag,
              {
                id: `${autoId}-label`,
                for: props.labelFor || undefined,
                tabindex: !props.labelFor ? '-1' : undefined,
                class: labelClasses,
              },
              labelContent
            )
          : null;
        label = horizontal
          ? h('div', { class: labelColClasses }, labelEl ? [labelEl] : [])
          : labelEl;
      }

      const invalidFeedback = props.invalidFeedback
        ? h('div', { class: 'invalid-feedback' }, props.invalidFeedback)
        : null;
      const validFeedback = props.validFeedback
        ? h('div', { class: 'valid-feedback' }, props.validFeedback)
        : null;
      const description = props.description
        ? h('small', { class: 'form-text text-muted', tabindex: '-1' }, props.description)
        : null;

      const content = h(
        horizontal ? 'div' : 'div',
        { class: horizontal ? colFromProps(props, 'content') : undefined },
        [
          slots.default ? slots.default() : null,
          invalidFeedback,
          validFeedback,
          description,
        ]
      );

      const groupAttrs = {
        id: autoId,
        disabled: !props.labelFor && props.disabled ? true : undefined,
        role: props.labelFor ? 'group' : undefined,
      };
      const groupClass = ['form-group', stateClass(props.state), { 'was-validated': props.validated }];

      if (!props.labelFor) {
        return h('fieldset', { class: groupClass, ...groupAttrs }, [
          horizontal ? h('div', { class: 'form-row' }, [label, content]) : label,
          ...(horizontal ? [] : [content]),
        ]);
      }
      return h('div', { class: groupClass, ...groupAttrs }, horizontal
        ? [h('div', { class: 'form-row' }, [label, content])]
        : [label, content]);
    };
  },
});

export const BFormInput = defineComponent({
  name: 'BFormInput',
  props: {
    modelValue: { type: [String, Number] as PropType<any>, default: undefined },
    modelModifiers: { type: Object as PropType<Record<string, boolean>>, default: () => ({}) },
    type: { type: String, default: 'text' },
    size: { type: String, default: undefined },
    state: { type: [Boolean, String] as PropType<any>, default: null },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    plain: { type: Boolean, default: false },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const onInput = (event: Event) => {
      emit('update:modelValue', coerceModel((event.target as HTMLInputElement).value, props.modelModifiers));
    };
    return () =>
      h('input', {
        type: props.type,
        class: [
          // Range inputs use Bootstrap's custom-range styling, matching BootstrapVue.
          props.type === 'range'
            ? 'custom-range'
            : props.plain
              ? 'form-control-plaintext'
              : 'form-control',
          props.size && props.type !== 'range' ? `form-control-${props.size}` : null,
          stateClass(props.state),
        ],
        value: props.modelValue,
        disabled: props.disabled || undefined,
        readonly: props.readonly || undefined,
        onInput,
      });
  },
});

export const BFormTextarea = defineComponent({
  name: 'BFormTextarea',
  props: {
    modelValue: { type: String, default: undefined },
    modelModifiers: { type: Object as PropType<Record<string, boolean>>, default: () => ({}) },
    size: { type: String, default: undefined },
    state: { type: [Boolean, String] as PropType<any>, default: null },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    rows: { type: [String, Number] as PropType<any>, default: undefined },
    plain: { type: Boolean, default: false },
  },
  emits: ['update:modelValue'],
  setup(props, { emit, attrs }) {
    const onInput = (event: Event) => {
      emit('update:modelValue', coerceModel((event.target as HTMLTextAreaElement).value, props.modelModifiers));
    };
    return () =>
      h('textarea', {
        class: [
          props.plain ? 'form-control-plaintext' : 'form-control',
          props.size ? `form-control-${props.size}` : null,
          stateClass(props.state),
        ],
        value: props.modelValue,
        rows: props.rows,
        disabled: props.disabled || undefined,
        readonly: props.readonly || undefined,
        onInput,
      });
  },
});

export const BFormSelectOption = defineComponent({
  name: 'BFormSelectOption',
  props: {
    value: { type: [String, Number, Boolean, Object] as PropType<any>, default: undefined },
    disabled: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    return () =>
      h('option', { value: props.value, disabled: props.disabled || undefined }, slots.default ? slots.default() : undefined);
  },
});

interface SelectOption {
  value?: any;
  text?: string;
  html?: string;
  disabled?: boolean;
  options?: SelectOption[];
}

function renderOptions(options: SelectOption[], modelValue: any, multiple: boolean): any[] {
  return options.map((option) => {
    if (!option) return null;
    if (Array.isArray(option.options)) {
      return h(
        'optgroup',
        { label: option.text, disabled: option.disabled || undefined },
        renderOptions(option.options, modelValue, multiple)
      );
    }
    if (typeof option === 'string' || typeof option === 'number' || typeof option === 'boolean') {
      const selected = multiple
        ? Array.isArray(modelValue) && modelValue.some((v) => looseEqual(v, option))
        : looseEqual(modelValue, option);
      return h(
        'option',
        {
          value: String(option),
          selected,
          ref: (el: any) => {
            if (el) el._value = option;
          },
        },
        String(option)
      );
    }
    const selected = multiple
      ? Array.isArray(modelValue) && modelValue.some((v) => looseEqual(v, option.value))
      : looseEqual(modelValue, option.value);
    return h(
      'option',
      {
        value: option.value == null ? '' : String(option.value),
        selected,
        disabled: option.disabled || undefined,
        ref: (el: any) => {
          if (el) el._value = option.value;
        },
      },
      option.text != null ? String(option.text) : option.html ? undefined : String(option.value)
    );
  });
}

export const BFormSelect = defineComponent({
  name: 'BFormSelect',
  props: {
    modelValue: { type: [String, Number, Boolean, Array, Object] as PropType<any>, default: undefined },
    // BootstrapVue's original v-model prop name; callers migrated from
    // `:value="x" @change="..."` keep working without template rewrites.
    value: { type: [String, Number, Boolean, Array, Object] as PropType<any>, default: undefined },
    options: { type: Array as PropType<any[]>, default: undefined },
    size: { type: String, default: undefined },
    state: { type: [Boolean, String] as PropType<any>, default: null },
    disabled: { type: Boolean, default: false },
    plain: { type: Boolean, default: false },
    multiple: { type: Boolean, default: false },
    selectSize: { type: Number, default: 0 },
    id: { type: String, default: undefined },
    ariaInvalid: { type: [Boolean, String] as PropType<any>, default: undefined },
  },
  emits: ['update:modelValue', 'change', 'input'],
  setup(props, { emit, slots, attrs }) {
    // v-model (modelValue) wins; an explicit `:value` binding is the fallback.
    const effectiveValue = () => (props.modelValue !== undefined ? props.modelValue : props.value);
    const onChange = (event: Event) => {
      const target = event.target as HTMLSelectElement;
      const values = Array.from(target.selectedOptions).map((o) => (o as any)._value ?? o.value);
      const value = props.multiple ? values : (target.options[target.selectedIndex] as any)?._value ?? target.value;
      emit('update:modelValue', value);
      emit('change', value);
      emit('input', value);
    };
    // Freshly inserted <option> elements ignore a `selected` DOM property set
    // before insertion, so sync the selection imperatively after mount/update.
    const syncSelected = (el: any) => {
      if (!el || !el.options) return;
      const value = effectiveValue();
      for (const option of Array.from(el.options)) {
        const raw = option._value !== undefined ? option._value : option.value;
        option.selected = props.multiple
          ? Array.isArray(value) && value.some((v) => looseEqual(v, raw))
          : looseEqual(value, raw);
      }
    };
    const vnodeHooks = {
      onVnodeMounted: (vnode: any) => syncSelected(vnode.el),
      onVnodeUpdated: (vnode: any) => syncSelected(vnode.el),
    };
    return () => {
      const children: any[] = [];
      if (slots.first) children.push(slots.first());
      if (props.options) children.push(...renderOptions(props.options as SelectOption[], effectiveValue(), props.multiple));
      if (slots.default) children.push(slots.default());
      const scalarValue =
        typeof effectiveValue() === 'string' ||
        typeof effectiveValue() === 'number' ||
        typeof effectiveValue() === 'boolean'
          ? effectiveValue()
          : undefined;
      return h(
        'select',
        {
          ...vnodeHooks,
          id: props.id,
          class: [
            props.plain ? 'form-control' : 'custom-select',
            props.size && props.plain ? `form-control-${props.size}` : null,
            props.size && !props.plain ? `custom-select-${props.size}` : null,
            stateClass(props.state),
          ],
          value: scalarValue,
          multiple: props.multiple || undefined,
          size: props.plain || props.selectSize ? props.selectSize || undefined : undefined,
          disabled: props.disabled || undefined,
          'aria-invalid': props.state === false ? 'true' : undefined,
          onChange,
        },
        children
      );
    };
  },
});

export const BFormCheckbox = defineComponent({
  name: 'BFormCheckbox',
  props: {
    modelValue: { type: [Boolean, Array, String, Number, Object] as PropType<any>, default: null },
    value: { type: [Boolean, String, Number, Object] as PropType<any>, default: true },
    uncheckedValue: { type: [Boolean, String, Number, Object] as PropType<any>, default: false },
    switch: { type: Boolean, default: false },
    inline: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    size: { type: String, default: undefined },
    state: { type: [Boolean, String] as PropType<any>, default: null },
    id: { type: String, default: undefined },
    label: { type: String, default: undefined },
    description: { type: String, default: undefined },
    ariaLabel: { type: String, default: undefined },
    ariaLabelledby: { type: String, default: undefined },
    name: { type: String, default: undefined },
    type: { type: String, default: 'checkbox' },
    required: { type: Boolean, default: false },
    plain: { type: Boolean, default: false },
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { slots, emit }) {
    const inputId = props.id || uid('checkbox');
    const isChecked = computed(() => {
      if (Array.isArray(props.modelValue)) return looseIndexOf(props.modelValue, props.value) > -1;
      return looseEqual(props.modelValue, props.value);
    });
    const onChange = (event: Event) => {
      const checked = (event.target as HTMLInputElement).checked;
      let next: any;
      if (Array.isArray(props.modelValue)) {
        const arr = props.modelValue.slice();
        const index = looseIndexOf(arr, props.value);
        if (checked && index < 0) arr.push(props.value);
        else if (!checked && index > -1) arr.splice(index, 1);
        next = arr;
      } else {
        next = checked ? props.value : props.uncheckedValue;
      }
      emit('update:modelValue', next);
      emit('change', next);
    };
    return () => {
      const content = slots.default ? slots.default() : props.label != null ? String(props.label) : undefined;
      return h(
        'div',
        {
          class: {
            'form-check': props.plain,
            'form-check-inline': props.plain && props.inline,
            'custom-control': !props.plain,
            'custom-control-inline': !props.plain && props.inline,
            'custom-checkbox': !props.plain && !props.switch,
            'custom-switch': !props.plain && props.switch,
            [`b-custom-control-${props.size}`]: props.size,
          },
        },
        [
          h('input', {
            id: inputId,
            type: 'checkbox',
            name: props.name,
            class: props.plain ? 'form-check-input' : 'custom-control-input',
            checked: isChecked.value,
            disabled: props.disabled || undefined,
            required: props.required || undefined,
            'aria-label': props.ariaLabel || undefined,
            'aria-labelledby': props.ariaLabelledby || undefined,
            onChange,
          }),
          h(
            'label',
            {
              class: props.plain ? 'form-check-label' : 'custom-control-label',
              for: inputId,
            },
            content
          ),
          props.description
            ? h('small', { class: 'form-text text-muted' }, props.description)
            : null,
        ]
      );
    };
  },
});

export const BFormRadioGroup = defineComponent({
  name: 'BFormRadioGroup',
  props: {
    modelValue: { type: [String, Number, Boolean, Object] as PropType<any>, default: null },
    options: { type: Array as PropType<any[]>, default: () => [] },
    buttons: { type: Boolean, default: false },
    buttonVariant: { type: String, default: undefined },
    size: { type: String, default: undefined },
    name: { type: String, default: undefined },
    id: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    stacked: { type: Boolean, default: false },
    state: { type: [Boolean, String] as PropType<any>, default: null },
    ariaLabel: { type: String, default: undefined },
    plain: { type: Boolean, default: false },
    switches: { type: Boolean, default: false },
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { emit, slots }) {
    const groupId = props.id || uid('radio-group');
    const name = props.name || groupId;
    const select = (value: any) => {
      if (props.disabled) return;
      emit('update:modelValue', value);
      emit('change', value);
    };
    return () => {
      if (props.buttons) {
        return h(
          'div',
          {
            id: groupId,
            class: [
              'btn-group-toggle',
              'bv-no-focus-ring',
              props.stacked ? 'btn-group-vertical' : 'btn-group',
              props.size ? `btn-group-${props.size}` : null,
            ],
            role: 'radiogroup',
            tabindex: '-1',
            'aria-label': props.ariaLabel,
          },
          [
            slots.first ? slots.first() : null,
            ...props.options.map((option: any) => {
              const value = option.value;
              const checked = looseEqual(value, props.modelValue);
              return h(
                'label',
                {
                  class: [
                    'btn',
                    `btn-${props.buttonVariant || 'secondary'}`,
                    props.size ? `btn-${props.size}` : null,
                    {
                      disabled: props.disabled || option.disabled,
                      active: checked,
                    },
                  ],
                },
                [
                  h('input', {
                    type: 'radio',
                    name,
                    value,
                    checked,
                    disabled: props.disabled || option.disabled || undefined,
                    onChange: () => select(value),
                  }),
                  h('span', null, option.text != null ? String(option.text) : String(value)),
                ]
              );
            }),
            slots.default ? slots.default() : null,
          ]
        );
      }
      const any = props.options && props.options.length > 0;
      if (!any && slots.default) {
        return h('div', { class: 'bv-no-focus-ring', role: 'radiogroup', id: groupId }, [slots.default()]);
      }
      return h(
        'div',
        {
          id: groupId,
          class: ['bv-no-focus-ring', stateClass(props.state)],
          role: 'radiogroup',
          tabindex: '-1',
          'aria-label': props.ariaLabel,
        },
        [
          slots.first ? slots.first() : null,
          ...props.options.map((option: any) => {
            const value = option.value;
            const checked = looseEqual(value, props.modelValue);
            const id = `${groupId}-${String(value)}`;
            return h(
              'div',
              {
                class: [
                  props.plain ? 'form-check' : 'custom-control',
                  props.stacked ? null : props.plain ? 'form-check-inline' : 'custom-control-inline',
                  props.plain ? null : 'custom-radio',
                ],
              },
              [
                h('input', {
                  id,
                  type: 'radio',
                  name,
                  class: props.plain ? 'form-check-input' : 'custom-control-input',
                  value,
                  checked,
                  disabled: props.disabled || option.disabled || undefined,
                  onChange: () => select(value),
                }),
                h('label', { class: props.plain ? 'form-check-label' : 'custom-control-label', for: id }, [
                  h('span', null, option.text != null ? String(option.text) : String(value)),
                ]),
              ]
            );
          }),
          slots.default ? slots.default() : null,
        ]
      );
    };
  },
});
