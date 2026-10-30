import { defineComponent, h, PropType } from 'vue';

export const BRow = defineComponent({
  name: 'BRow',
  props: {
    tag: { type: String, default: 'div' },
    noGutters: { type: Boolean, default: false },
    alignV: { type: String, default: undefined },
    alignH: { type: String, default: undefined },
    alignContent: { type: String, default: undefined },
  },
  setup(props, { slots }) {
    return () =>
      h(
        props.tag,
        {
          class: [
            'row',
            {
              'no-gutters': props.noGutters,
              [`align-items-${props.alignV}`]: props.alignV,
              [`justify-content-${props.alignH}`]: props.alignH,
              [`align-content-${props.alignContent}`]: props.alignContent,
            },
          ],
        },
        slots.default ? slots.default() : undefined
      );
  },
});

function colClass(base: string, value: any): string | null {
  if (value === undefined || value === null || value === false) return null;
  if (value === true || value === '') return base;
  if (value === 'auto') return `${base}-auto`;
  return `${base}-${value}`;
}

export const BCol = defineComponent({
  name: 'BCol',
  props: {
    cols: { type: [String, Number] as PropType<string | number>, default: undefined },
    sm: { type: [String, Number] as PropType<string | number>, default: undefined },
    md: { type: [String, Number] as PropType<string | number>, default: undefined },
    lg: { type: [String, Number] as PropType<string | number>, default: undefined },
    xl: { type: [String, Number] as PropType<string | number>, default: undefined },
    offset: { type: [String, Number] as PropType<string | number>, default: undefined },
    offsetSm: { type: [String, Number] as PropType<string | number>, default: undefined },
    offsetMd: { type: [String, Number] as PropType<string | number>, default: undefined },
    offsetLg: { type: [String, Number] as PropType<string | number>, default: undefined },
    offsetXl: { type: [String, Number] as PropType<string | number>, default: undefined },
    tag: { type: String, default: 'div' },
  },
  setup(props, { slots }) {
    return () => {
      const hasBreakpoint =
        props.sm !== undefined ||
        props.md !== undefined ||
        props.lg !== undefined ||
        props.xl !== undefined;
      const classes: (string | null)[] = [];
      if (props.cols !== undefined) classes.push(colClass('col', props.cols));
      else if (!hasBreakpoint) classes.push('col');
      classes.push(
        colClass('col-sm', props.sm),
        colClass('col-md', props.md),
        colClass('col-lg', props.lg),
        colClass('col-xl', props.xl),
        colClass('offset', props.offset),
        colClass('offset-sm', props.offsetSm),
        colClass('offset-md', props.offsetMd),
        colClass('offset-lg', props.offsetLg),
        colClass('offset-xl', props.offsetXl)
      );
      return h(props.tag, { class: classes }, slots.default ? slots.default() : undefined);
    };
  },
});

export const BCard = defineComponent({
  name: 'BCard',
  props: {
    header: { type: String, default: undefined },
    footer: { type: String, default: undefined },
    title: { type: String, default: undefined },
    borderVariant: { type: String, default: undefined },
    bgVariant: { type: String, default: undefined },
    textVariant: { type: String, default: undefined },
    bodyClass: { type: [String, Array, Object] as PropType<any>, default: undefined },
    noBlock: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    return () =>
      h(
        'div',
        {
          class: [
            'card',
            props.borderVariant ? `border-${props.borderVariant}` : null,
            props.bgVariant ? `bg-${props.bgVariant}` : null,
            props.textVariant ? `text-${props.textVariant}` : null,
          ],
        },
        [
          props.header || slots.header
            ? h('div', { class: 'card-header' }, slots.header ? slots.header() : props.header)
            : null,
          props.noBlock
            ? slots.default
              ? slots.default()
              : undefined
            : h('div', { class: ['card-body', props.bodyClass] }, [
                props.title || slots.title
                  ? h('h4', { class: 'card-title' }, slots.title ? slots.title() : props.title)
                  : null,
                slots.default ? slots.default() : undefined,
              ]),
          props.footer || slots.footer
            ? h('div', { class: 'card-footer' }, slots.footer ? slots.footer() : props.footer)
            : null,
        ]
      );
  },
});

export const BCardGroup = defineComponent({
  name: 'BCardGroup',
  props: {
    deck: { type: Boolean, default: false },
    columns: { type: Boolean, default: false },
    tag: { type: String, default: 'div' },
  },
  setup(props, { slots }) {
    return () =>
      h(
        props.tag,
        {
          class: props.deck ? 'card-deck' : props.columns ? 'card-columns' : 'card-group',
        },
        slots.default ? slots.default() : undefined
      );
  },
});

export const BBadge = defineComponent({
  name: 'BBadge',
  props: {
    variant: { type: String, default: 'secondary' },
    pill: { type: Boolean, default: false },
    tag: { type: String, default: 'span' },
  },
  setup(props, { slots }) {
    return () =>
      h(
        props.tag,
        {
          class: [
            'badge',
            `badge-${props.variant}`,
            { 'rounded-pill': props.pill },
          ],
        },
        slots.default ? slots.default() : undefined
      );
  },
});

export const BSpinner = defineComponent({
  name: 'BSpinner',
  props: {
    type: { type: String, default: 'border' },
    small: { type: Boolean, default: false },
    label: { type: String, default: 'Loading...' },
    tag: { type: String, default: 'span' },
  },
  setup(props, { slots }) {
    return () =>
      h(
        props.tag,
        {
          class: [`spinner-${props.type}`, props.small ? `spinner-${props.type}-sm` : null],
          role: 'status',
        },
        [
          slots.default ? slots.default() : h('span', { class: 'sr-only' }, props.label),
        ]
      );
  },
});
