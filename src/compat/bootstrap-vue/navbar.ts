import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch, PropType } from 'vue';
import { RouterLink } from 'vue-router';

interface CollapseHandle {
  toggle: () => void;
  open: () => void;
  close: () => void;
}

const collapses = new Map<string, CollapseHandle>();

export function toggleCollapse(id: string): void {
  collapses.get(id)?.toggle();
}

export function showCollapse(id: string): void {
  collapses.get(id)?.open();
}

export function hideCollapse(id: string): void {
  collapses.get(id)?.close();
}

export const BCollapse = defineComponent({
  name: 'BCollapse',
  props: {
    modelValue: { type: Boolean, default: null },
    id: { type: String, default: undefined },
    isNav: { type: Boolean, default: false },
    tag: { type: String, default: 'div' },
  },
  emits: ['update:modelValue', 'show', 'shown', 'hide', 'hidden'],
  setup(props, { slots, emit, attrs }) {
    const open = ref(!!props.modelValue);
    let collapseId: string | null = null;
    watch(
      () => props.modelValue,
      (value) => {
        if (value !== null) open.value = !!value;
      }
    );
    const setOpen = (value: boolean) => {
      if (open.value === value) return;
      open.value = value;
      emit('update:modelValue', value);
      emit(value ? 'show' : 'hide');
      emit(value ? 'shown' : 'hidden');
    };
    const handle: CollapseHandle = {
      toggle: () => setOpen(!open.value),
      open: () => setOpen(true),
      close: () => setOpen(false),
    };
    const register = () => {
      if (props.id) {
        collapseId = props.id;
        collapses.set(collapseId, handle);
      }
    };
    onMounted(register);
    onBeforeUnmount(() => {
      if (collapseId) collapses.delete(collapseId);
    });
    return () => {
      const onClick = (event: Event) => {
        if (!open.value) return;
        const target = event.target as HTMLElement;
        if (target.closest('a') || target.closest('button')) setOpen(false);
      };
      return h(
        props.tag,
        {
          id: props.id,
          class: ['collapse', { 'navbar-collapse': props.isNav, show: open.value }],
          onClick,
        },
        slots.default ? slots.default() : undefined
      );
    };
  },
});

export const BNavbar = defineComponent({
  name: 'BNavbar',
  props: {
    tag: { type: String, default: 'nav' },
    type: { type: String, default: 'light' },
    variant: { type: String, default: undefined },
    toggleable: { type: [Boolean, String] as PropType<boolean | string>, default: false },
    fixed: { type: String, default: undefined },
    sticky: { type: Boolean, default: false },
    print: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    return () =>
      h(
        props.tag,
        {
          class: [
            'navbar',
            props.type ? `navbar-${props.type}` : null,
            props.variant ? `bg-${props.variant}` : null,
            props.fixed ? `fixed-${props.fixed}` : null,
            { 'sticky-top': props.sticky, 'd-print': props.print },
            typeof props.toggleable === 'string' ? `navbar-expand-${props.toggleable}` : props.toggleable ? 'navbar-expand' : null,
          ],
          role: props.tag === 'nav' ? undefined : 'navigation',
        },
        slots.default ? slots.default() : undefined
      );
  },
});

export const BNavbarNav = defineComponent({
  name: 'BNavbarNav',
  props: {
    tag: { type: String, default: 'ul' },
    fill: { type: Boolean, default: false },
    justified: { type: Boolean, default: false },
    small: { type: Boolean, default: false },
    align: { type: String, default: undefined },
  },
  setup(props, { slots }) {
    return () =>
      h(
        props.tag,
        {
          class: [
            'navbar-nav',
            {
              'nav-fill': props.fill,
              'nav-justified': props.justified,
              small: props.small,
              [`justify-content-${props.align === 'left' ? 'start' : props.align === 'right' ? 'end' : props.align}`]: props.align,
            },
          ],
        },
        slots.default ? slots.default() : undefined
      );
  },
});

export const BNavbarBrand = defineComponent({
  name: 'BNavbarBrand',
  props: {
    tag: { type: String, default: 'div' },
    to: { type: [String, Object] as PropType<any>, default: undefined },
    href: { type: String, default: undefined },
    target: { type: String, default: '_self' },
  },
  setup(props, { slots }) {
    return () => {
      const children = slots.default ? slots.default() : undefined;
      if (props.to) {
        return h(RouterLink, { to: props.to, class: 'navbar-brand' }, { default: () => children });
      }
      if (props.href) {
        return h('a', { class: 'navbar-brand', href: props.href, target: props.target }, children);
      }
      return h(props.tag, { class: 'navbar-brand' }, children);
    };
  },
});

export const BNavbarToggle = defineComponent({
  name: 'BNavbarToggle',
  props: {
    target: { type: [String, Array] as PropType<string | string[]>, required: true },
    label: { type: String, default: 'Toggle navigation' },
    disabled: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    return () => {
      const targets = Array.isArray(props.target) ? props.target : [props.target];
      return h(
        'button',
        {
          class: ['navbar-toggler', { disabled: props.disabled }],
          type: 'button',
          disabled: props.disabled || undefined,
          'aria-label': props.label,
          onClick: () => {
            if (props.disabled) return;
            targets.forEach((id) => toggleCollapse(id));
          },
        },
        slots.default ? slots.default() : [h('span', { class: 'navbar-toggler-icon' })]
      );
    };
  },
});
