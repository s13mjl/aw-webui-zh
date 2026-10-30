import { defineComponent, h } from 'vue';

export const BInputGroupText = defineComponent({
  name: 'BInputGroupText',
  props: {
    tag: { type: String, default: 'div' },
  },
  setup(props, { slots }) {
    return () => h(props.tag, { class: 'input-group-text' }, slots.default ? slots.default() : undefined);
  },
});

export const BInputGroupPrepend = defineComponent({
  name: 'BInputGroupPrepend',
  setup(_props, { slots }) {
    return () => h('div', { class: 'input-group-prepend' }, slots.default ? slots.default() : undefined);
  },
});

export const BInputGroupAppend = defineComponent({
  name: 'BInputGroupAppend',
  setup(_props, { slots }) {
    return () => h('div', { class: 'input-group-append' }, slots.default ? slots.default() : undefined);
  },
});

export const BInputGroup = defineComponent({
  name: 'BInputGroup',
  props: {
    id: { type: String, default: undefined },
    size: { type: String, default: undefined },
    prepend: { type: String, default: undefined },
    append: { type: String, default: undefined },
    tag: { type: String, default: 'div' },
  },
  setup(props, { slots }) {
    return () => {
      const children = [];
      if (props.prepend || slots.prepend) {
        children.push(
          h('div', { class: 'input-group-prepend' }, [
            slots.prepend
              ? slots.prepend()
              : h(BInputGroupText, null, { default: () => props.prepend }),
          ])
        );
      }
      if (slots.default) children.push(slots.default());
      if (props.append || slots.append) {
        children.push(
          h('div', { class: 'input-group-append' }, [
            slots.append
              ? slots.append()
              : h(BInputGroupText, null, { default: () => props.append }),
          ])
        );
      }
      return h(
        props.tag,
        {
          class: ['input-group', props.size ? `input-group-${props.size}` : null],
          id: props.id,
          role: 'group',
        },
        children
      );
    };
  },
});
