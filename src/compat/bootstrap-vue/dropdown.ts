import { defineComponent, h, onBeforeUnmount, ref, watch, PropType } from 'vue';
import { RouterLink } from 'vue-router';
import { BButton } from './button';

export const BDropdownItem = defineComponent({
  name: 'BDropdownItem',
  props: {
    to: { type: [String, Object] as PropType<any>, default: undefined },
    href: { type: String, default: undefined },
    active: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    variant: { type: String, default: undefined },
    linkClass: { type: [String, Array, Object] as PropType<any>, default: undefined },
  },
  setup(props, { slots }) {
    return () => {
      const inner = slots.default ? slots.default() : undefined;
      if (props.to) {
        return h('li', { role: 'presentation' }, [
          h(
            RouterLink,
            {
              class: ['dropdown-item', props.linkClass, { active: props.active, disabled: props.disabled, [`text-${props.variant}`]: props.variant && !(props.active || props.disabled) }],
              to: props.to,
              'aria-disabled': props.disabled ? 'true' : undefined,
              tabindex: props.disabled ? '-1' : undefined,
            },
            inner
          ),
        ]);
      }
      return h('li', { role: 'presentation' }, [
        h(
          'a',
          {
            class: ['dropdown-item', props.linkClass, { active: props.active, disabled: props.disabled, [`text-${props.variant}`]: props.variant && !(props.active || props.disabled) }],
            href: props.disabled ? undefined : props.href || '#',
            'aria-disabled': props.disabled ? 'true' : undefined,
            tabindex: props.disabled ? '-1' : undefined,
          },
          inner
        ),
      ]);
    };
  },
});

export const BDropdownItemButton = defineComponent({
  name: 'BDropdownItemButton',
  props: {
    active: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    variant: { type: String, default: undefined },
    buttonClass: { type: [String, Array, Object] as PropType<any>, default: undefined },
  },
  setup(props, { slots }) {
    return () =>
      h('li', { role: 'presentation' }, [
        h(
          'button',
          {
            type: 'button',
            class: [
              'dropdown-item',
              props.buttonClass,
              {
                active: props.active,
                disabled: props.disabled,
                [`text-${props.variant}`]: props.variant && !(props.active || props.disabled),
              },
            ],
            disabled: props.disabled || undefined,
          },
          slots.default ? slots.default() : undefined
        ),
      ]);
  },
});

export const BDropdownHeader = defineComponent({
  name: 'BDropdownHeader',
  props: {
    tag: { type: String, default: 'header' },
  },
  setup(props, { slots }) {
    return () => h(props.tag, { class: 'dropdown-header' }, slots.default ? slots.default() : undefined);
  },
});

export const BDropdownDivider = defineComponent({
  name: 'BDropdownDivider',
  props: {
    tag: { type: String, default: 'hr' },
  },
  setup(props) {
    return () => h(props.tag, { class: 'dropdown-divider' });
  },
});

export const BDropdown = defineComponent({
  name: 'BDropdown',
  inheritAttrs: false,
  props: {
    id: { type: String, default: undefined },
    text: { type: String, default: undefined },
    variant: { type: String, default: 'secondary' },
    size: { type: String, default: undefined },
    block: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    right: { type: Boolean, default: false },
    noCaret: { type: Boolean, default: false },
    toggleClass: { type: [String, Array, Object] as PropType<any>, default: undefined },
    menuClass: { type: [String, Array, Object] as PropType<any>, default: undefined },
    role: { type: String, default: 'menu' },
    lazy: { type: Boolean, default: true },
    boundary: { type: String, default: 'scrollParent' },
  },
  setup(props, { slots, attrs }) {
    const visible = ref(false);
    let rootEl: HTMLElement | null = null;

    const setRoot = (el: any) => {
      rootEl = el instanceof HTMLElement ? el : null;
    };

    const onDocumentClick = (event: MouseEvent) => {
      if (rootEl && event.target instanceof Node && rootEl.contains(event.target)) return;
      visible.value = false;
    };
    const onDocumentKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Esc') visible.value = false;
    };
    let listening = false;
    const setListening = (on: boolean) => {
      if (on === listening) return;
      listening = on;
      if (on) {
        document.addEventListener('click', onDocumentClick, true);
        document.addEventListener('keydown', onDocumentKeydown);
      } else {
        document.removeEventListener('click', onDocumentClick, true);
        document.removeEventListener('keydown', onDocumentKeydown);
      }
    };
    watch(visible, (v) => setListening(v));
    onBeforeUnmount(() => setListening(false));

    const toggle = () => {
      if (props.disabled) return;
      visible.value = !visible.value;
    };

    return () => {
      const toggleChildren = slots['button-content']
        ? slots['button-content']()
        : props.text != null
          ? props.text
          : undefined;
      return h(
        'div',
        {
          ...attrs,
          ref: setRoot,
          id: props.id,
          class: [attrs.class, 'dropdown', 'b-dropdown', 'btn-group', { show: visible.value, 'd-flex': props.block }],
        },
        [
          h(
            BButton,
            {
              class: ['dropdown-toggle', props.toggleClass, { 'dropdown-toggle-no-caret': props.noCaret }],
              variant: props.variant,
              size: props.size,
              block: props.block,
              disabled: props.disabled,
              'aria-haspopup': props.role,
              'aria-expanded': visible.value ? 'true' : 'false',
              onClick: toggle,
            },
            toggleChildren ? { default: () => toggleChildren } : undefined
          ),
          h(
            'ul',
            {
              class: ['dropdown-menu', props.menuClass, { 'dropdown-menu-right': props.right, show: visible.value }],
              role: props.role,
              tabindex: '-1',
              onClick: (event: Event) => {
                const target = event.target as HTMLElement;
                const link = target.closest('a');
                if (link && link.getAttribute('href') === '#') event.preventDefault();
                visible.value = false;
              },
            },
            props.lazy && !visible.value ? [] : slots.default ? slots.default({ hide: () => (visible.value = false) }) : []
          ),
        ]
      );
    };
  },
});
