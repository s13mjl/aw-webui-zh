import { defineComponent, h, PropType } from 'vue';
import { iconDefs, IconDef } from './icon-data';

let idCounter = 0;
function getId(): string {
  return `icon-${++idCounter}`;
}

function escapeHTML(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default defineComponent({
  name: 'fa-icon',
  props: {
    name: { type: String as PropType<string | null | undefined>, default: undefined },
    title: { type: String, default: undefined },
    scale: { type: [Number, String] as PropType<number | string>, default: undefined },
    spin: { type: Boolean, default: false },
    inverse: { type: Boolean, default: false },
    pulse: { type: Boolean, default: false },
    flip: {
      type: String as PropType<'horizontal' | 'vertical' | undefined>,
      default: undefined,
    },
    label: { type: String, default: undefined },
    tabindex: { type: [Number, String] as PropType<number | string>, default: undefined },
  },
  setup(props) {
    return () => {
      if (props.name === null) return null;
      const icon: IconDef | undefined = props.name ? iconDefs[props.name] : undefined;
      if (props.name && !icon) {
        console.warn(`Invalid prop: prop "name" is referring to an unregistered icon "${props.name}".`);
      }

      let normalizedScale = 1;
      if (props.scale !== undefined) {
        normalizedScale = Number(props.scale);
        if (isNaN(normalizedScale) || normalizedScale <= 0) normalizedScale = 1;
      }
      const ratio = icon ? Math.max(icon.width, icon.height) / 16 : 1;
      const width = icon ? (icon.width / ratio) * normalizedScale : 0;
      const height = icon ? (icon.height / ratio) * normalizedScale : 0;

      const klass = {
        'fa-icon': true,
        'fa-spin': props.spin,
        'fa-flip-horizontal': props.flip === 'horizontal',
        'fa-flip-vertical': props.flip === 'vertical',
        'fa-inverse': props.inverse,
        'fa-pulse': props.pulse,
      } as Record<string, boolean>;

      let focusable: string | null = 'false';
      if (props.tabindex != null) {
        const index = typeof props.tabindex === 'string' ? parseInt(props.tabindex, 10) : props.tabindex;
        focusable = index >= 0 ? null : 'false';
      }

      const titleId = `vat-${getId()}`;
      const children: any[] = [];
      if (props.title) {
        children.push(h('title', { id: titleId }, props.title));
      }
      if (icon) {
        for (const [i, path] of (icon.paths || []).entries()) {
          children.push(h('path', { ...path, key: `path-${i}` }));
        }
        for (const [i, polygon] of (icon.polygons || []).entries()) {
          children.push(h('polygon', { ...polygon, key: `polygon-${i}` }));
        }
      }

      return h(
        'svg',
        {
          class: klass,
          style: normalizedScale === 1 ? undefined : { fontSize: `${normalizedScale}em` },
          role: props.label || props.title ? 'img' : undefined,
          'aria-label': props.label || undefined,
          'aria-labelledby': props.title ? titleId : undefined,
          'aria-hidden': String(!(props.label || props.title)),
          tabindex: props.tabindex,
          width,
          height,
          viewBox: icon ? `0 0 ${icon.width} ${icon.height}` : undefined,
          focusable,
        },
        children
      );
    };
  },
});
