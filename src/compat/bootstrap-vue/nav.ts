import { defineComponent, h, onBeforeUnmount, ref, watch, PropType } from 'vue';
import { RouterLink } from 'vue-router';
import { uid } from './utils';

export const BNav = defineComponent({
  name: 'BNav',
  props: {
    tag: { type: String, default: 'ul' },
    pills: { type: Boolean, default: false },
    tabs: { type: Boolean, default: false },
    vertical: { type: Boolean, default: false },
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
            'nav',
            {
              'nav-tabs': props.tabs,
              'nav-pills': props.pills && !props.tabs,
              'flex-column': props.vertical,
              'nav-fill': !props.vertical && props.fill,
              'nav-justified': !props.vertical && props.justified,
              [`justify-content-${props.align === 'left' ? 'start' : props.align === 'right' ? 'end' : props.align}`]: !props.vertical && props.align,
              small: props.small,
            },
          ],
        },
        slots.default ? slots.default() : undefined
      );
  },
});

export const BNavItem = defineComponent({
  name: 'BNavItem',
  props: {
    to: { type: [String, Object] as PropType<any>, default: undefined },
    href: { type: String, default: undefined },
    active: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    linkClasses: { type: [String, Array, Object] as PropType<any>, default: undefined },
    linkAttrs: { type: Object as PropType<Record<string, any>>, default: () => ({}) },
    replace: { type: Boolean, default: false },
    exact: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    return () => {
      const children = slots.default ? slots.default() : undefined;
      const linkClass = ['nav-link', props.linkClasses, { active: props.active, disabled: props.disabled }];
      let link: any;
      if (props.to) {
        link = h(
          RouterLink,
          {
            class: linkClass,
            ...props.linkAttrs,
            to: props.to,
            replace: props.replace,
            exact: props.exact || undefined,
            'aria-disabled': props.disabled ? 'true' : undefined,
            tabindex: props.disabled ? '-1' : undefined,
          },
          { default: () => children }
        );
      } else if (props.href) {
        link = h('a', { class: linkClass, ...props.linkAttrs, href: props.href }, children);
      } else {
        link = h('a', { class: linkClass, ...props.linkAttrs, href: '#' }, children);
      }
      return h('li', { class: 'nav-item' }, [link]);
    };
  },
});

export const BNavItemDropdown = defineComponent({
  name: 'BNavItemDropdown',
  inheritAttrs: false,
  props: {
    id: { type: String, default: undefined },
    text: { type: String, default: undefined },
    right: { type: Boolean, default: false },
    noCaret: { type: Boolean, default: false },
    toggleClass: { type: [String, Array, Object] as PropType<any>, default: undefined },
    menuClass: { type: [String, Array, Object] as PropType<any>, default: undefined },
    role: { type: String, default: 'menu' },
    disabled: { type: Boolean, default: false },
    lazy: { type: Boolean, default: true },
  },
  setup(props, { slots, attrs }) {
    const visible = ref(false);
    const baseId = props.id || uid('nav-dropdown');
    const toggleId = `${baseId}_BV_toggle_`;
    const menuId = `${baseId}_BV_toggle_menu_`;
    let rootEl: HTMLElement | null = null;
    let listening = false;
    const onDocumentClick = (event: MouseEvent) => {
      if (rootEl && event.target instanceof Node && rootEl.contains(event.target)) return;
      visible.value = false;
    };
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Esc') visible.value = false;
    };
    const setListening = (on: boolean) => {
      if (on === listening) return;
      listening = on;
      if (on) {
        document.addEventListener('click', onDocumentClick, true);
        document.addEventListener('keydown', onKeydown);
      } else {
        document.removeEventListener('click', onDocumentClick, true);
        document.removeEventListener('keydown', onKeydown);
      }
    };
    watch(visible, setListening);
    onBeforeUnmount(() => setListening(false));
    return () => {
      const children = slots['button-content']
        ? slots['button-content']()
        : props.text != null
          ? props.text
          : undefined;
      return h(
        'li',
        {
          ...attrs,
          ref: (el: any) => {
            rootEl = el instanceof HTMLElement ? el : null;
          },
          id: baseId,
          class: [attrs.class, 'nav-item', 'b-nav-dropdown', 'dropdown', { show: visible.value }],
        },
        [
          h(
            'a',
            {
              class: ['nav-link', 'dropdown-toggle', props.toggleClass, { 'dropdown-toggle-no-caret': props.noCaret, disabled: props.disabled }],
              href: `#${baseId || ''}`,
              id: toggleId,
              role: 'button',
              'aria-haspopup': 'true',
              'aria-expanded': visible.value ? 'true' : 'false',
              'aria-controls': menuId,
              onClick: (event: Event) => {
                event.preventDefault();
                if (!props.disabled) visible.value = !visible.value;
              },
            },
            children
          ),
          h(
            'ul',
            {
              class: ['dropdown-menu', props.menuClass, { 'dropdown-menu-right': props.right, show: visible.value }],
              id: menuId,
              tabindex: '-1',
              'aria-labelledby': toggleId,
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
