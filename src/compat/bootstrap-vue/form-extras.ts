import { defineComponent, h, ref, computed, PropType } from 'vue';
import { BBadge } from './layout';
import { BButtonClose } from './button';
import { uid } from './utils';

export const BFormFile = defineComponent({
  name: 'BFormFile',
  props: {
    modelValue: { type: [Object, Array] as PropType<any>, default: null },
    placeholder: { type: String, default: 'No file chosen' },
    dropPlaceholder: { type: String, default: 'Drop files here' },
    browseText: { type: String, default: 'Browse' },
    multiple: { type: Boolean, default: false },
    accept: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    size: { type: String, default: undefined },
    state: { type: [Boolean, String] as PropType<any>, default: null },
    plain: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    name: { type: String, default: undefined },
    form: { type: String, default: undefined },
    id: { type: String, default: undefined },
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { emit }) {
    const inputId = props.id || uid('file');
    const dragging = ref(false);

    const labelContent = computed(() => {
      const value = props.modelValue;
      if (dragging.value) return props.dropPlaceholder;
      if (!value) return props.placeholder;
      if (Array.isArray(value)) return value.map((f: File) => f.name).join(', ');
      return (value as File).name || props.placeholder;
    });

    const onChange = (event: Event) => {
      const input = event.target as HTMLInputElement;
      const files = input.files ? Array.from(input.files) : [];
      const value = props.multiple ? files : files[0] || null;
      emit('update:modelValue', value);
      emit('change', value);
    };
    const onDrop = (event: DragEvent) => {
      dragging.value = false;
      if (props.disabled) return;
      const files = event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : [];
      if (files.length === 0) return;
      event.preventDefault();
      const value = props.multiple ? files : files[0];
      emit('update:modelValue', value);
      emit('change', value);
    };

    return () => {
      const input = h('input', {
        id: inputId,
        type: 'file',
        name: props.name,
        form: props.form,
        class: [
          props.plain ? 'form-control-file' : 'custom-file-input',
          props.state === true ? 'is-valid' : props.state === false ? 'is-invalid' : null,
        ],
        style: props.plain ? undefined : { zIndex: -5 },
        accept: props.accept,
        multiple: props.multiple || undefined,
        disabled: props.disabled || undefined,
        required: props.required || undefined,
        onChange,
      });
      if (props.plain) return input;
      return h(
        'div',
        {
          id: `${inputId}_BV_file_outer_`,
          class: [
            'custom-file',
            'b-form-file',
            props.size ? `b-custom-control-${props.size}` : null,
            props.state === true ? 'is-valid' : props.state === false ? 'is-invalid' : null,
          ],
          onDragenter: (event: DragEvent) => {
            event.preventDefault();
            dragging.value = true;
          },
          onDragover: (event: DragEvent) => {
            event.preventDefault();
            dragging.value = true;
          },
          onDragleave: () => {
            dragging.value = false;
          },
          onDrop,
        },
        [
          input,
          h(
            'label',
            {
              class: ['custom-file-label', { dragging: dragging.value }],
              for: inputId,
              'data-browse': props.browseText || undefined,
            },
            [h('span', { class: 'd-block form-file-text', style: { pointerEvents: 'none' } }, labelContent.value)]
          ),
        ]
      );
    };
  },
});

export const BFormTag = defineComponent({
  name: 'BFormTag',
  props: {
    title: { type: String, default: undefined },
    variant: { type: String, default: 'secondary' },
    disabled: { type: Boolean, default: false },
    noRemove: { type: Boolean, default: false },
    pill: { type: Boolean, default: false },
    removeLabel: { type: String, default: 'Remove tag' },
    tag: { type: String, default: 'span' },
    id: { type: String, default: undefined },
  },
  emits: ['remove'],
  setup(props, { slots, emit }) {
    return () => {
      const content = slots.default ? slots.default() : props.title;
      return h(
        BBadge,
        {
          variant: props.variant,
          pill: props.pill,
          class: ['b-form-tag', 'd-inline-flex', 'align-items-baseline', 'mw-100', { disabled: props.disabled }],
        },
        [
          h('span', { class: 'b-form-tag-content flex-grow-1 text-truncate' }, content),
          !props.noRemove && !props.disabled
            ? h(BButtonClose, {
                class: 'b-form-tag-remove',
                ariaLabel: props.removeLabel,
                onClick: () => emit('remove'),
              })
            : null,
        ]
      );
    };
  },
});

export const BFormTags = defineComponent({
  name: 'BFormTags',
  props: {
    modelValue: { type: Array as PropType<any[]>, default: () => [] },
    addOnChange: { type: Boolean, default: false },
    noOuterFocus: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    size: { type: String, default: undefined },
    state: { type: [Boolean, String] as PropType<any>, default: null },
    id: { type: String, default: undefined },
    placeholder: { type: String, default: 'Add tag...' },
    separator: { type: [String, Array] as PropType<any>, default: undefined },
    tagVariant: { type: String, default: 'secondary' },
    tagPills: { type: Boolean, default: false },
    noTagRemove: { type: Boolean, default: false },
    tagRemoveLabel: { type: String, default: 'Remove tag' },
    duplicateTagText: { type: String, default: 'Duplicate tag(s)' },
    invalidTagText: { type: String, default: 'Invalid tag(s)' },
    limit: { type: Number, default: undefined },
    addButtonText: { type: String, default: 'Add' },
    addButtonVariant: { type: String, default: 'outline-secondary' },
    inputClass: { type: [String, Array, Object] as PropType<any>, default: undefined },
    name: { type: String, default: undefined },
    form: { type: String, default: undefined },
    required: { type: Boolean, default: false },
  },
  emits: ['update:modelValue', 'tag-state'],
  setup(props, { slots, emit }) {
    const inputId = props.id ? `${props.id}__input__` : uid('form-tags');
    const hasFocus = ref(false);

    const addTag = (tag: any) => {
      let value = tag;
      if (typeof value === 'string') value = value.trim();
      if (value === '' || value == null) return;
      const tags = props.modelValue.slice();
      if (tags.includes(value)) return;
      tags.push(value);
      emit('update:modelValue', tags);
    };
    const removeTag = (tag: any) => {
      const tags = props.modelValue.filter((t) => t !== tag);
      emit('update:modelValue', tags);
    };
    const reset = () => emit('update:modelValue', []);

    const inputAttrs = computed(() => ({
      id: inputId,
      value: '',
      disabled: props.disabled,
      form: props.form,
    }));
    const inputHandlers = {
      change: (value: any) => {
        if (props.addOnChange) {
          const val = value && value.target ? value.target.value : value;
          addTag(val);
        }
      },
      input: (value: any) => {
        if (!props.addOnChange) {
          const val = value && value.target ? value.target.value : value;
          addTag(val);
        }
      },
      keydown: () => undefined,
      focus: () => {
        hasFocus.value = true;
      },
      blur: () => {
        hasFocus.value = false;
      },
    };

    return () => {
      const scope = {
        tags: props.modelValue.slice(),
        inputAttrs: inputAttrs.value,
        inputType: 'text',
        inputHandlers,
        removeTag,
        addTag,
        reset,
        inputId,
        disabled: props.disabled,
        noTagRemove: props.noTagRemove,
        tagVariant: props.tagVariant,
        tagPills: props.tagPills,
        tagRemoveLabel: props.tagRemoveLabel,
        placeholder: props.placeholder,
        state: props.state,
      };
      const content = slots.default ? slots.default(scope) : null;
      return h(
        'div',
        {
          id: props.id,
          class: [
            'b-form-tags',
            'form-control',
            'h-auto',
            {
              focus: hasFocus.value && !props.noOuterFocus && !props.disabled,
              disabled: props.disabled,
            },
            props.size ? `form-control-${props.size}` : null,
            props.state === true ? 'is-valid' : props.state === false ? 'is-invalid' : null,
          ].filter(Boolean),
          role: 'group',
          tabindex: props.disabled || props.noOuterFocus ? undefined : '-1',
          onClick: () => (hasFocus.value = true),
        },
        [
          h('output', {
            class: 'sr-only',
            id: `${props.id || inputId}__selected_tags__`,
            role: 'status',
            for: inputId,
            'aria-live': hasFocus.value ? 'polite' : 'off',
            'aria-atomic': 'true',
            'aria-relevant': 'additions text',
          }, props.modelValue.join(', ')),
          content,
        ]
      );
    };
  },
});

export const BFormDatepicker = defineComponent({
  name: 'BFormDatepicker',
  props: {
    modelValue: { type: String, default: '' },
    id: { type: String, default: undefined },
    locale: { type: String, default: 'en-US' },
    placeholder: { type: String, default: 'YYYY-MM-DD' },
    min: { type: String, default: undefined },
    max: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    size: { type: String, default: undefined },
    state: { type: [Boolean, String] as PropType<any>, default: null },
  },
  emits: ['update:modelValue', 'input', 'change'],
  setup(props, { emit }) {
    return () =>
      h('input', {
        id: props.id,
        type: 'date',
        class: [
          'form-control',
          'b-form-datepicker',
          props.size ? `form-control-${props.size}` : null,
          props.state === true ? 'is-valid' : props.state === false ? 'is-invalid' : null,
        ],
        value: props.modelValue || '',
        min: props.min,
        max: props.max,
        disabled: props.disabled || undefined,
        readonly: props.readonly || undefined,
        lang: props.locale,
        onInput: (event: Event) => {
          const value = (event.target as HTMLInputElement).value;
          emit('update:modelValue', value);
          emit('input', value);
        },
        onChange: (event: Event) => {
          emit('change', (event.target as HTMLInputElement).value);
        },
      });
  },
});
