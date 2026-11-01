import { shallowMount } from '@vue/test-utils';
import i18nInstance from '~/i18n';
import { installBootstrapVue } from '~/compat/bootstrap-vue';
import ActivityView from '~/views/activity/ActivityView.vue';

const mockViews = [
  { id: 'default', name: 'Default', elements: [{ type: 'top_apps', props: {} }] },
  { id: 'second', name: 'Second', elements: [{ type: 'top_apps', props: {} }] },
];

jest.mock('~/stores/views', () => ({
  useViewsStore: () => ({
    viewsForHost: () => mockViews,
  }),
}));

describe('ActivityView isVisLarge', () => {
  test('treats wide visualizations as full-width cards', () => {
    expect(ActivityView.methods.isVisLarge({ type: 'sunburst_clock' })).toBe(true);
    expect(ActivityView.methods.isVisLarge({ type: 'vis_timeline' })).toBe(true);
    expect(ActivityView.methods.isVisLarge({ type: 'timeline_barchart' })).toBe(false);
    expect(ActivityView.methods.isVisLarge({ type: 'top_apps' })).toBe(false);
  });
});

// Visualizations keep local state — the Top Bucket Data picker holds its
// selected bucket, field and fetched events in `data` and fills them in
// `mounted`. Every view renders the same list at the same positions, so if a
// card is keyed by its position alone Vue reuses the instance from the
// previous view and the stale state comes along with it.
// See https://github.com/ActivityWatch/aw-webui/issues/935
describe('ActivityView view switching', () => {
  // Records a line per aw-selectable-vis instance created, so we can tell a
  // reused instance (no new record) from a fresh one.
  let created;

  // vuedraggable v4 does not render its items itself: it exposes a scoped
  // `item` slot and identifies each entry through the `item-key` prop. The
  // stub has to reproduce both, otherwise the keying behaviour under test is
  // invisible (a plain `<slot />` stub never calls the scoped slot).
  const draggableStub = {
    name: 'draggable',
    props: ['modelValue', 'itemKey'],
    template: `
      <div>
        <div v-for="(element, index) in modelValue" :key="itemKey(element)">
          <slot name="item" :element="element" :index="index" />
        </div>
        <slot name="footer" />
      </div>
    `,
  };

  const visStub = {
    name: 'aw-selectable-vis',
    props: ['id', 'type', 'props', 'viewId', 'editable'],
    created() {
      created.push(`${this.viewId}:${this.id}:${this.type}`);
    },
    template: '<div />',
  };

  function mountView() {
    return shallowMount(ActivityView, {
      props: { view_id: 'default' },
      global: {
        // b-* components and $t are registered globally in main.js, so a bare
        // mount needs the compat layer and the real i18n instance.
        plugins: [i18nInstance, { install: installBootstrapVue }],
        mocks: { $route: { params: {}, path: '/activity/view/default' } },
        stubs: {
          draggable: draggableStub,
          'aw-selectable-vis': visStub,
        },
      },
    });
  }

  beforeEach(() => {
    created = [];
  });

  test('creates a fresh visualization instance when switching views', async () => {
    const wrapper = mountView();
    expect(created).toEqual(['default:0:top_apps']);

    await wrapper.setProps({ view_id: 'second' });

    // Without the view id in the key this stays at one entry: Vue patches the
    // props of the instance already sitting at index 0 rather than rebuilding.
    expect(created).toEqual(['default:0:top_apps', 'second:0:top_apps']);
    wrapper.unmount();
  });

  test('does not rebuild visualizations while staying on the same view', async () => {
    const wrapper = mountView();
    await wrapper.setProps({ view_id: 'default' });

    expect(created).toEqual(['default:0:top_apps']);
    wrapper.unmount();
  });
});
