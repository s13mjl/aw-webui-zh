import { createApp, defineAsyncComponent } from 'vue';

// Installs the FullCalendarVDom global required by @fullcalendar plugins.
// Must run before any plugin chunk is evaluated (see Calendar.vue).
import '@fullcalendar/core/vdom';

// Load the Bootstrap CSS
import 'bootstrap/dist/css/bootstrap.css';
import './style/bootstrap-vue.css';
import './compat/bootstrap-vue/compat.css';
import './style/vue-datetime.css';
import './style/vue-d3-sunburst.css';

// Load the Varela Round font
import 'typeface-varela-round';

// Load the main style
import './style/style.scss';

// Internationalization
import i18n from './i18n';

// Sets up the routing and the base app (using vue-router)
import router from './route.js';

// Sets up the pinia store
import pinia from './stores';

// BootstrapVue-compatible component layer for Vue 3
import { installBootstrapVue, showModal, hideModal, toggleModal } from './compat/bootstrap-vue';

// Font Awesome style icon component (vue-awesome compatible)
import Icon from './compat/icons/Icon';
import './compat/icons/icon.css';

// Datetime picker (vue-datetime compatible)
import Datetime from './compat/datetime/Datetime.vue';

// Loads all the filters as plain helpers
import { filters } from './util/filters';

// A mixin to make async method errors propagate
import asyncErrorCapturedMixin from './mixins/asyncErrorCaptured.js';

// Create an instance of AWClient as this.$aw
// NOTE: needs to be created before the Vue app is created,
//       since stores rely on it having been run.
import { createClient, getClient, configureClient } from './util/awclient';
createClient();

// Setup Vue app
import App from './App.vue';

const app = createApp(App);

app.use(router);
app.use(i18n);
app.use(pinia);

installBootstrapVue(app);

// Register Font Awesome icon component
app.component('icon', Icon);
app.component('datetime', Datetime);

function asyncComponent(loader) {
  return defineAsyncComponent(loader);
}

// General components
app.component('error-boundary', asyncComponent(() => import('./components/ErrorBoundary.vue')));
app.component('input-timeinterval', asyncComponent(() => import('./components/InputTimeInterval.vue')));
app.component('aw-header', asyncComponent(() => import('./components/Header.vue')));
app.component('aw-footer', asyncComponent(() => import('./components/Footer.vue')));
app.component('aw-devonly', asyncComponent(() => import('./components/DevOnly.vue')));
app.component('aw-selectable-vis', asyncComponent(() => import('./components/SelectableVisualization.vue')));
app.component('aw-selectable-eventview', asyncComponent(() => import('./components/SelectableEventView.vue')));
app.component('new-release-notification', asyncComponent(() => import('./components/NewReleaseNotification.vue')));
app.component('user-satisfaction-poll', asyncComponent(() => import('./components/UserSatisfactionPoll.vue')));
app.component('aw-query-options', asyncComponent(() => import('./components/QueryOptions.vue')));
app.component('aw-select-categories', asyncComponent(() => import('./components/SelectCategories.vue')));
app.component(
  'aw-select-categories-or-pattern',
  asyncComponent(() => import('./components/SelectCategoriesOrPattern.vue'))
);

// Visualization components
app.component('aw-summary', asyncComponent(() => import('./visualizations/Summary.vue')));
app.component('aw-periodusage', asyncComponent(() => import('./visualizations/PeriodUsage.vue')));
app.component('aw-eventlist', asyncComponent(() => import('./visualizations/EventList.vue')));
app.component('aw-sunburst-categories', asyncComponent(() => import('./visualizations/SunburstCategories.vue')));
app.component('aw-top-bucket-data', asyncComponent(() => import('./visualizations/TopBucketData.vue')));
app.component('aw-sunburst-clock', asyncComponent(() => import('./visualizations/SunburstClock.vue')));
app.component('aw-timeline-inspect', asyncComponent(() => import('./visualizations/TimelineInspect.vue')));
app.component('aw-timeline', asyncComponent(() => import('./visualizations/TimelineSimple.vue')));
app.component('vis-timeline', asyncComponent(() => import('./visualizations/VisTimeline.vue')));
app.component('aw-categorytree', asyncComponent(() => import('./visualizations/CategoryTree.vue')));
app.component('aw-timeline-barchart', asyncComponent(() => import('./visualizations/TimelineBarChart.vue')));
app.component('aw-calendar', asyncComponent(() => import('./visualizations/Calendar.vue')));
app.component('aw-custom-vis', asyncComponent(() => import('./visualizations/CustomVisualization.vue')));
app.component('aw-score', asyncComponent(() => import('./visualizations/Score.vue')));

app.mixin(asyncErrorCapturedMixin);

// Set the PRODUCTION constant
const globalProperties = app.config.globalProperties;
globalProperties.PRODUCTION = PRODUCTION;
globalProperties.COMMIT_HASH = COMMIT_HASH;
globalProperties.$isAndroid = process.env.VUE_APP_ON_ANDROID;
globalProperties.$filters = filters;
globalProperties.$aw = getClient();
globalProperties.$showModal = showModal;
globalProperties.$hideModal = hideModal;
globalProperties.$bvModal = { show: showModal, hide: hideModal, toggle: toggleModal };

app.mount('#app');

// Must be run after vue init since it relies on the settings store
configureClient();
