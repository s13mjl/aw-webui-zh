import { mount } from '@vue/test-utils';
import { BModal } from '~/compat/bootstrap-vue/modal';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

async function openModal() {
  const wrapper = mount(BModal, {
    attachTo: document.body,
    props: { id: 'test-modal', title: '编辑分类' },
    slots: { default: '<input id="inside-field" type="text" />' },
  });
  wrapper.vm.show();
  await flush();
  await wrapper.vm.$nextTick();
  await flush();

  const modal = document.querySelector('.modal');
  const dialog = document.querySelector('.modal-dialog');
  const inside = document.querySelector('#inside-field');
  expect(modal).not.toBeNull();
  expect(dialog).not.toBeNull();
  expect(inside).not.toBeNull();
  return { wrapper, modal, dialog, inside };
}

const fire = (el, type) => el.dispatchEvent(new MouseEvent(type, { bubbles: true }));

afterEach(() => {
  document.body.innerHTML = '';
});

describe('b-modal backdrop dismissal', () => {
  test('pressing inside the dialog and releasing on the overlay keeps it open', async () => {
    const { wrapper, modal, inside } = await openModal();

    // The browser dispatches the click on the nearest common ancestor of the
    // mousedown and mouseup targets, which for this gesture is the `.modal`
    // overlay itself — the guard must swallow that click.
    fire(inside, 'mousedown');
    fire(modal, 'mouseup');
    fire(modal, 'click');
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('update:visible') || []).toEqual([[true]]);
  });

  test('pressing and releasing on the overlay still closes the dialog', async () => {
    const { wrapper, modal } = await openModal();

    fire(modal, 'mousedown');
    fire(modal, 'mouseup');
    fire(modal, 'click');
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('update:visible')).toContainEqual([false]);
  });
});
