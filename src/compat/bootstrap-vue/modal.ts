import { defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref, watch, Teleport, PropType } from 'vue';
import { BButton, BButtonClose } from './button';

interface ModalHandle {
  show: () => void;
  hide: () => void;
  toggle: () => void;
}

function makeModalEvent(type: string): any {
  const event: any = {
    type,
    defaultPrevented: false,
    preventDefault() {
      event.defaultPrevented = true;
    },
  };
  return event;
}

const modals = new Map<string, ModalHandle>();
const pendingShow = new Set<string>();
let uidCounter = 0;
let openCount = 0;

function lockBody() {
  openCount++;
  if (openCount === 1) document.body.classList.add('modal-open');
}
function unlockBody() {
  openCount = Math.max(0, openCount - 1);
  if (openCount === 0) document.body.classList.remove('modal-open');
}

export function showModal(id: string): void {
  const modal = modals.get(id);
  if (modal) modal.show();
  else pendingShow.add(id);
}

export function hideModal(id: string): void {
  modals.get(id)?.hide();
}

export function toggleModal(id: string): void {
  modals.get(id)?.toggle();
}

export const BModal = defineComponent({
  name: 'BModal',
  props: {
    id: { type: String, default: undefined },
    title: { type: String, default: undefined },
    centered: { type: Boolean, default: false },
    scrollable: { type: Boolean, default: false },
    hideFooter: { type: Boolean, default: false },
    hideHeader: { type: Boolean, default: false },
    hideHeaderClose: { type: Boolean, default: false },
    noCloseOnBackdrop: { type: Boolean, default: false },
    noCloseOnEsc: { type: Boolean, default: false },
    okTitle: { type: String, default: 'OK' },
    cancelTitle: { type: String, default: 'Cancel' },
    okVariant: { type: String, default: 'primary' },
    cancelVariant: { type: String, default: 'secondary' },
    okOnly: { type: Boolean, default: false },
    okDisabled: { type: Boolean, default: false },
    cancelDisabled: { type: Boolean, default: false },
    size: { type: String, default: 'md' },
    staticBackdrop: { type: Boolean, default: false },
    visible: { type: Boolean, default: null },
    lazy: { type: Boolean, default: false },
  },
  emits: ['show', 'shown', 'hide', 'hidden', 'ok', 'cancel', 'update:visible'],
  setup(props, { slots, emit, expose }) {
    const modalId = props.id || `modal-${++uidCounter}`;
    const titleId = `${modalId}__BV_title__`;
    const mounted = ref(false);
    const showClass = ref(false);
    let locked = false;
    let timer: any = null;

    const clearTimer = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const open = () => {
      if (mounted.value && showClass.value) return;
      clearTimer();
      const showEvent = makeModalEvent('show');
      emit('show', showEvent);
      if (showEvent.defaultPrevented) return;
      mounted.value = true;
      if (!locked) {
        lockBody();
        locked = true;
      }
      nextTick(() => {
        requestAnimationFrame(() => {
          showClass.value = true;
          timer = setTimeout(() => emit('shown', makeModalEvent('shown')), 300);
        });
      });
      emit('update:visible', true);
    };

    const hide = () => {
      if (!mounted.value) return;
      clearTimer();
      const hideEvent = makeModalEvent('hide');
      emit('hide', hideEvent);
      if (hideEvent.defaultPrevented) return;
      showClass.value = false;
      emit('update:visible', false);
      timer = setTimeout(() => {
        mounted.value = false;
        if (locked) {
          unlockBody();
          locked = false;
        }
        emit('hidden', makeModalEvent('hidden'));
        timer = null;
        const doc = document.activeElement as HTMLElement | null;
        if (doc && doc.blur) doc.blur();
      }, 300);
    };

    const toggle = () => (mounted.value && showClass.value ? hide() : open());
    const onOk = () => {
      const event = makeModalEvent('ok');
      emit('ok', event);
      if (!event.defaultPrevented) hide();
    };
    const onCancel = () => {
      const event = makeModalEvent('cancel');
      emit('cancel', event);
      if (!event.defaultPrevented) hide();
    };

    const handle: ModalHandle = { show: open, hide, toggle };
    onMounted(() => {
      modals.set(modalId, handle);
      if (pendingShow.has(modalId)) {
        pendingShow.delete(modalId);
        open();
      }
      if (props.visible === true) open();
    });
    onBeforeUnmount(() => {
      clearTimer();
      modals.delete(modalId);
      if (locked) {
        unlockBody();
        locked = false;
      }
      document.removeEventListener('keydown', onKeydown);
    });

    const onKeydown = (event: KeyboardEvent) => {
      if ((event.key === 'Escape' || event.key === 'Esc') && showClass.value && !props.noCloseOnEsc) {
        hide();
      }
    };
    watch(showClass, (value) => {
      if (value) document.addEventListener('keydown', onKeydown);
      else document.removeEventListener('keydown', onKeydown);
    });
    watch(
      () => props.visible,
      (value) => {
        if (value === true) open();
        else if (value === false) hide();
      }
    );

    expose({ show: open, hide, toggle });

    return () => {
      if (!mounted.value) return null;
      const header = !props.hideHeader
        ? h('div', { class: 'modal-header' }, [
            h('h5', { class: 'modal-title', id: titleId }, slots.title ? slots.title() : props.title),
            props.hideHeaderClose
              ? null
              : h(BButtonClose, { ariaLabel: 'Close', onClick: hide }),
          ])
        : null;
      const body = h('div', { class: 'modal-body' }, slots.default ? slots.default() : undefined);
      const footer = !props.hideFooter
        ? h('div', { class: 'modal-footer' }, [
            props.okOnly
              ? null
              : h(BButton, { variant: props.cancelVariant, disabled: props.cancelDisabled, onClick: onCancel }, { default: () => props.cancelTitle }),
            h(BButton, { variant: props.okVariant, disabled: props.okDisabled, onClick: onOk }, { default: () => props.okTitle }),
          ])
        : null;
      const content = h('div', { class: 'modal-content' }, [header, body, footer]);
      const dialog = h(
        'div',
        {
          class: ['modal-dialog', { 'modal-dialog-centered': props.centered, 'modal-dialog-scrollable': props.scrollable }],
          role: 'document',
        },
        [content]
      );
      const modal = h(
        'div',
        {
          id: modalId,
          class: ['modal', { fade: true, show: showClass.value }],
          tabindex: '-1',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-labelledby': titleId,
          style: { display: 'block' },
          onClick: (event: MouseEvent) => {
            if (event.target === event.currentTarget && !props.noCloseOnBackdrop && !props.staticBackdrop) hide();
          },
        },
        [dialog]
      );
      const backdrop = h('div', {
        class: ['modal-backdrop', { fade: true, show: showClass.value }],
        onClick: () => {
          if (!props.noCloseOnBackdrop && !props.staticBackdrop) hide();
        },
      });
      return h(Teleport, { to: 'body' }, [backdrop, modal]);
    };
  },
});

export function registerBModalDirective(app: any): void {
  app.directive('b-modal', {
    mounted(el: HTMLElement, binding: any) {
      const handler = (event: Event) => {
        event.preventDefault();
        const value = binding.value;
        if (Array.isArray(value)) value.forEach((id) => showModal(id));
        else if (value) showModal(String(value));
      };
      (el as any).__bvModalHandler = handler;
      el.addEventListener('click', handler);
    },
    updated(el: HTMLElement, binding: any) {
      if (binding.value === binding.oldValue) return;
      const old = (el as any).__bvModalHandler;
      if (old) el.removeEventListener('click', old);
      const handler = (event: Event) => {
        event.preventDefault();
        const value = binding.value;
        if (Array.isArray(value)) value.forEach((id) => showModal(id));
        else if (value) showModal(String(value));
      };
      (el as any).__bvModalHandler = handler;
      el.addEventListener('click', handler);
    },
    unmounted(el: HTMLElement) {
      const handler = (el as any).__bvModalHandler;
      if (handler) el.removeEventListener('click', handler);
    },
  });
}
