import { defineComponent, h, PropType } from 'vue';
import { RouterLink } from 'vue-router';

export const BButton = defineComponent({
  name: 'BButton',
  props: {
    variant: { type: String, default: 'secondary' },
    size: { type: String as PropType<string>, default: undefined },
    type: { type: String, default: 'button' },
    disabled: { type: Boolean, default: false },
    block: { type: Boolean, default: false },
    pill: { type: Boolean, default: false },
    squared: { type: Boolean, default: false },
    pressed: { type: Boolean, default: null },
    active: { type: Boolean, default: false },
    to: { type: [String, Object] as PropType<any>, default: undefined },
    href: { type: String, default: undefined },
    rel: { type: String, default: undefined },
    target: { type: String, default: undefined },
    tag: { type: String, default: 'button' },
  },
  emits: ['update:pressed'],
  setup(props, { slots, attrs, emit }) {
    const isToggle = () => props.pressed !== null;
    const isRealButton = () => !props.to && !props.href && props.tag === 'button';

    const onClick = (event: MouseEvent) => {
      if (props.disabled) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (isToggle()) emit('update:pressed', !props.pressed);
    };

    return () => {
      const classes = [
        'btn',
        `btn-${props.variant || 'secondary'}`,
        props.size ? `btn-${props.size}` : null,
        {
          'btn-block': props.block,
          'rounded-pill': props.pill,
          'rounded-0': props.squared && !props.pill,
          disabled: props.disabled && !isRealButton(),
          active: props.active || (isToggle() && props.pressed),
        },
      ];
      const common = {
        class: classes,
        onClick,
      };
      const linkAttrs = {
        'aria-disabled': props.disabled ? 'true' : undefined,
        'aria-pressed': isToggle() ? String(!!props.pressed) : undefined,
        autocomplete: isToggle() ? 'off' : undefined,
        tabindex: props.disabled ? '-1' : undefined,
        rel: props.rel,
        target: props.target,
      };

      if (props.to && props.disabled) {
        return h(
          'a',
          {
            ...common,
            ...linkAttrs,
            'aria-disabled': 'true',
            tabindex: '-1',
          },
          slots.default ? slots.default() : undefined
        );
      }
      if (props.to) {
        return h(
          RouterLink,
          { ...common, ...linkAttrs, to: props.to, role: attrs.role },
          slots.default ? { default: () => slots.default!() } : undefined
        );
      }
      if (props.href || props.tag === 'a') {
        return h(
          'a',
          {
            ...common,
            ...linkAttrs,
            href: props.disabled ? undefined : props.href,
          },
          slots.default ? slots.default() : undefined
        );
      }
      return h(
        props.tag,
        {
          ...common,
          type: props.tag === 'button' ? props.type : undefined,
          disabled: props.disabled || undefined,
          'aria-pressed': isToggle() ? String(!!props.pressed) : undefined,
          autocomplete: isToggle() ? 'off' : undefined,
        },
        slots.default ? slots.default() : undefined
      );
    };
  },
});

export const BButtonGroup = defineComponent({
  name: 'BButtonGroup',
  props: {
    size: { type: String, default: undefined },
    vertical: { type: Boolean, default: false },
    ariaRole: { type: String, default: 'group' },
  },
  setup(props, { slots, attrs }) {
    return () =>
      h(
        'div',
        {
          class: [
            props.vertical ? 'btn-group-vertical' : 'btn-group',
            props.size ? `btn-group-${props.size}` : null,
          ],
          role: attrs.role || props.ariaRole,
        },
        slots.default ? slots.default() : undefined
      );
  },
});

export const BButtonClose = defineComponent({
  name: 'BButtonClose',
  props: {
    ariaLabel: { type: String, default: 'Close' },
    textVariant: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    return () =>
      h(
        'button',
        {
          type: 'button',
          class: ['close', props.textVariant ? `text-${props.textVariant}` : null],
          'aria-label': props.ariaLabel,
          disabled: props.disabled || undefined,
        },
        slots.default
          ? slots.default()
          : [h('span', { 'aria-hidden': 'true' }, '\u00d7')]
      );
  },
});
