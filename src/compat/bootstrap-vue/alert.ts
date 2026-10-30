import { defineComponent, h, ref, watch, PropType } from 'vue';
import { BButtonClose } from './button';

export const BAlert = defineComponent({
  name: 'BAlert',
  props: {
    show: { type: [Boolean, Number, String] as PropType<boolean | number | string>, default: false },
    variant: { type: String, default: 'info' },
    dismissible: { type: Boolean, default: false },
    dismissLabel: { type: String, default: 'Close' },
    fade: { type: Boolean, default: false },
  },
  emits: ['update:show', 'dismissed'],
  setup(props, { slots, emit }) {
    const localShow = ref(!!props.show);

    watch(
      () => props.show,
      (value) => {
        localShow.value = !!value;
      }
    );

    const dismiss = () => {
      localShow.value = false;
      emit('update:show', false);
      emit('dismissed');
    };

    return () => {
      if (!localShow.value) return null;
      return h(
        'div',
        {
          class: ['alert', `alert-${props.variant}`, { 'alert-dismissible': props.dismissible }],
          role: 'alert',
        },
        [
          props.dismissible
            ? h(BButtonClose, { ariaLabel: props.dismissLabel, onClick: dismiss })
            : null,
          slots.default ? slots.default() : undefined,
        ]
      );
    };
  },
});
