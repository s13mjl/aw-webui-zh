import { defineComponent, h, onBeforeUnmount, onMounted, ref, useAttrs, watch } from 'vue';
import { BButtonClose } from './button';
import { uid } from './utils';

interface SidebarHandle {
  toggle: () => void;
  open: () => void;
  close: () => void;
}

const sidebars = new Map<string, SidebarHandle>();

export function toggleSidebar(id: string): void {
  sidebars.get(id)?.toggle();
}

export function showSidebar(id: string): void {
  sidebars.get(id)?.open();
}

export function hideSidebar(id: string): void {
  sidebars.get(id)?.close();
}

/**
 * BootstrapVue-compatible `b-sidebar` for the Vue 3 compat layer.
 *
 * A fixed left/right drawer with an optional backdrop. Closes on backdrop
 * click, the header close button and Escape. `lazy` keeps the body slot from
 * rendering until the drawer has been opened at least once. State is kept in
 * `v-model` (modelValue), mirroring BootstrapVue's `b-sidebar`.
 */
export const BSidebar = defineComponent({
  name: 'BSidebar',
  inheritAttrs: false,
  props: {
    id: { type: String, default: undefined },
    title: { type: String, default: undefined },
    modelValue: { type: Boolean, default: null },
    backdrop: { type: Boolean, default: false },
    lazy: { type: Boolean, default: false },
    shadow: { type: Boolean, default: false },
    right: { type: Boolean, default: false },
    bgVariant: { type: String, default: undefined },
    width: { type: String, default: undefined },
    closeLabel: { type: String, default: 'Close' },
    noCloseOnEsc: { type: Boolean, default: false },
  },
  emits: ['update:modelValue', 'show', 'shown', 'hide', 'hidden'],
  setup(props, { slots, emit }) {
    const attrs = useAttrs();
    const sidebarId = props.id || uid('sidebar');
    const titleId = `${sidebarId}__BV_title__`;
    const open = ref(false);
    const everOpened = ref(false);

    const openSidebar = () => {
      if (open.value) return;
      everOpened.value = true;
      open.value = true;
      emit('update:modelValue', true);
      emit('show');
      emit('shown');
    };

    const closeSidebar = () => {
      if (!open.value) return;
      open.value = false;
      emit('update:modelValue', false);
      emit('hide');
      emit('hidden');
    };

    watch(
      () => props.modelValue,
      value => {
        if (value === null) return;
        if (value) openSidebar();
        else closeSidebar();
      }
    );

    const handle: SidebarHandle = {
      toggle: () => (open.value ? closeSidebar() : openSidebar()),
      open: openSidebar,
      close: closeSidebar,
    };

    const onKeydown = (event: KeyboardEvent) => {
      if (open.value && !props.noCloseOnEsc && (event.key === 'Escape' || event.key === 'Esc')) {
        closeSidebar();
      }
    };

    onMounted(() => {
      sidebars.set(sidebarId, handle);
      if (props.modelValue === true) openSidebar();
      document.addEventListener('keydown', onKeydown);
    });

    onBeforeUnmount(() => {
      sidebars.delete(sidebarId);
      document.removeEventListener('keydown', onKeydown);
    });

    return () => {
      if (props.lazy && !everOpened.value) return null;

      const header = h('div', { class: 'b-sidebar-header' }, [
        props.title
          ? h('div', { class: 'b-sidebar-title', id: titleId }, props.title)
          : slots.title
          ? h('div', { id: titleId }, slots.title())
          : null,
        h(BButtonClose, { ariaLabel: props.closeLabel, onClick: closeSidebar }),
      ]);
      const body = h(
        'div',
        { class: 'b-sidebar-body' },
        slots.default ? slots.default() : undefined
      );

      const backdrop = props.backdrop
        ? h('div', { class: 'b-sidebar-backdrop', onClick: closeSidebar })
        : null;

      const panel = h(
        'aside',
        {
          ...attrs,
          id: sidebarId,
          class: [
            'b-sidebar',
            'slide',
            {
              show: open.value,
              'b-sidebar-right': props.right,
              shadow: props.shadow,
              [`bg-${props.bgVariant}`]: props.bgVariant,
            },
          ],
          style: props.width ? { width: props.width } : undefined,
          role: 'dialog',
          'aria-modal': 'true',
          'aria-labelledby': props.title ? titleId : undefined,
          tabindex: '-1',
        },
        [header, body]
      );

      return h('div', { class: 'b-sidebar-outer' }, [backdrop, panel]);
    };
  },
});
