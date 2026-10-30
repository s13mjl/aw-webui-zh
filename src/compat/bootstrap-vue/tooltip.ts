import { defineComponent, h, onBeforeUnmount, onMounted, ref, nextTick, Teleport, PropType } from 'vue';

function parseTriggers(triggers: string): { show: string[]; hide: string[] } {
  const list = triggers.split(/\s+/).filter(Boolean);
  const show: string[] = [];
  const hide: string[] = [];
  for (const trigger of list) {
    if (trigger === 'hover') {
      show.push('mouseenter');
      hide.push('mouseleave');
    } else if (trigger === 'focus') {
      show.push('focusin');
      hide.push('focusout');
    } else if (trigger === 'click') {
      show.push('click');
    } else if (trigger === 'blur') {
      hide.push('blur');
    } else if (trigger === 'manual') {
      // no-op
    }
  }
  return { show, hide };
}

function useTooltip(props: any, kind: 'tooltip' | 'popover') {
  const visible = ref(false);
  const style = ref<Record<string, string>>({});
  let targetEl: HTMLElement | null = null;
  let containerEl: HTMLElement | null = null;
  let timeout: any = null;
  const triggers = parseTriggers(props.triggers || 'hover focus');

  const position = () => {
    if (!targetEl || !containerEl) return;
    const r = targetEl.getBoundingClientRect();
    const c = containerEl.getBoundingClientRect();
    const placement = props.placement || 'top';
    let left = r.left + window.scrollX + r.width / 2 - c.width / 2;
    let top = r.top + window.scrollY - c.height - 6;
    if (placement.startsWith('bottom')) {
      top = r.top + window.scrollY + r.height + 6;
    } else if (placement.startsWith('left')) {
      left = r.left + window.scrollX - c.width - 6;
      top = r.top + window.scrollY + r.height / 2 - c.height / 2;
    } else if (placement.startsWith('right')) {
      left = r.left + window.scrollX + r.width + 6;
      top = r.top + window.scrollY + r.height / 2 - c.height / 2;
    }
    style.value = {
      position: 'absolute',
      left: `${Math.max(0, left)}px`,
      top: `${Math.max(0, top)}px`,
    };
  };

  const show = () => {
    if (props.disabled) return;
    clearTimeout(timeout);
    visible.value = true;
    nextTick(position);
  };
  const hide = () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      visible.value = false;
    }, 50);
  };
  const onShowEvent = () => show();
  const onHideEvent = () => hide();
  const onClick = (event: MouseEvent) => {
    event.preventDefault();
    if (visible.value) hide();
    else show();
  };

  const bind = () => {
    targetEl = document.getElementById(props.target);
    if (!targetEl) return;
    triggers.show.forEach((type) => {
      if (type === 'click') targetEl!.addEventListener('click', onClick);
      else targetEl!.addEventListener(type, onShowEvent);
    });
    triggers.hide.forEach((type) => targetEl!.addEventListener(type, onHideEvent));
  };
  const unbind = () => {
    if (!targetEl) return;
    triggers.show.forEach((type) => {
      if (type === 'click') targetEl!.removeEventListener('click', onClick);
      else targetEl!.removeEventListener(type, onShowEvent);
    });
    triggers.hide.forEach((type) => targetEl!.removeEventListener(type, onHideEvent));
  };
  onMounted(bind);
  onBeforeUnmount(() => {
    clearTimeout(timeout);
    unbind();
  });

  const setContainer = (el: any) => {
    containerEl = el instanceof HTMLElement ? el : null;
    if (containerEl && visible.value) position();
  };

  return { visible, style, setContainer, kind };
}

export const BTooltip = defineComponent({
  name: 'BTooltip',
  props: {
    target: { type: String, required: true },
    title: { type: String, default: undefined },
    triggers: { type: String, default: 'hover focus' },
    placement: { type: String, default: 'top' },
    disabled: { type: Boolean, default: false },
    delay: { type: [Number, Object] as PropType<any>, default: 50 },
    boundary: { type: String, default: 'scrollParent' },
    container: { type: String, default: 'body' },
    customClass: { type: String, default: undefined },
    variant: { type: String, default: undefined },
    noninteractive: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    const { visible, style, setContainer } = useTooltip(props, 'tooltip');
    return () => {
      if (!visible.value) return null;
      return h(Teleport, { to: 'body' }, [
        h(
          'div',
          {
            ref: setContainer,
            class: ['tooltip', 'show', `bs-tooltip-${props.placement}`, props.customClass],
            role: 'tooltip',
            style: style.value,
          },
          [
            h('div', { class: 'arrow' }),
            h(
              'div',
              { class: ['tooltip-inner', props.variant ? `bg-${props.variant}` : null] },
              slots.default ? slots.default() : props.title
            ),
          ]
        ),
      ]);
    };
  },
});

export const BPopover = defineComponent({
  name: 'BPopover',
  props: {
    target: { type: String, required: true },
    title: { type: String, default: undefined },
    content: { type: String, default: undefined },
    triggers: { type: String, default: 'click' },
    placement: { type: String, default: 'right' },
    disabled: { type: Boolean, default: false },
    delay: { type: [Number, Object] as PropType<any>, default: 50 },
    boundary: { type: String, default: 'scrollParent' },
    container: { type: String, default: 'body' },
    customClass: { type: String, default: undefined },
    variant: { type: String, default: undefined },
  },
  setup(props, { slots }) {
    const { visible, style, setContainer } = useTooltip(props, 'popover');
    return () => {
      if (!visible.value) return null;
      const placement = props.placement || 'right';
      return h(Teleport, { to: 'body' }, [
        h(
          'div',
          {
            ref: setContainer,
            class: ['popover', 'show', `bs-popover-${placement}`, props.customClass],
            role: 'tooltip',
            style: style.value,
          },
          [
            h('div', { class: 'arrow' }),
            props.title
              ? h('h3', { class: 'popover-header' }, props.title)
              : null,
            h(
              'div',
              { class: 'popover-body' },
              slots.default ? slots.default() : props.content
            ),
          ]
        ),
      ]);
    };
  },
});
