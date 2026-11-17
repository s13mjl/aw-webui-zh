<template lang="pug">
//- Navigation entries are defined once and rendered twice: inline in the
//- desktop navbar, and in the phone side drawer below the lg breakpoint.
mixin navMain
  // If only a single view (the default) is available
  template(v-if="activityViews && activityViews.length === 1")
    b-nav-item(v-for="view in activityViews", :key="view.name", :to="view.pathUrl")
      div.px-2.px-lg-1
        icon(name="calendar-day")
        | {{ $t('nav.activity') }}

  // If multiple (or no) activity views are available
  b-nav-item-dropdown(v-if="!activityViews || activityViews.length !== 1")
    template(v-slot:button-content)
      div.d-inline.px-2.px-lg-1
        icon(name="calendar-day")
        | {{ $t('nav.activity') }}
    b-dropdown-item(v-if="activityViews === null", disabled)
      span.text-muted {{ $t('nav.loading') }}
      br
    b-dropdown-item(v-else-if="activityViews && activityViews.length <= 0", disabled)
      | {{ $t('nav.noActivityReports') }}
    b-dropdown-item(v-for="view in activityViews", :key="view.name", :to="view.pathUrl")
      icon(:name="view.icon")
      | {{ view.name }}

  b-nav-item(to="/timeline" style="font-color: #000;")
    div.px-2.px-lg-1
      icon(name="stream")
      | {{ $t('nav.timeline') }}

  b-nav-item(to="/stopwatch")
    div.px-2.px-lg-1
      icon(name="stopwatch")
      | {{ $t('nav.stopwatch') }}

mixin navTools
  b-nav-item-dropdown
    template(v-slot:button-content)
      div.d-inline.px-2.px-lg-1
        icon(name="tools")
        | {{ $t('nav.tools') }}
    b-dropdown-item(to="/search")
      icon(name="search")
      | {{ $t('nav.search') }}
    b-dropdown-item(to="/work-report")
      icon(name="briefcase")
      | {{ $t('nav.workReport') }}
    b-dropdown-item(to="/trends" v-if="devmode")
      icon(name="chart-line")
      | {{ $t('nav.trends') }}
    b-dropdown-item(to="/report" v-if="devmode")
      icon(name="chart-pie")
      | {{ $t('nav.report') }}
    b-dropdown-item(to="/alerts" v-if="devmode")
      icon(name="flag-checkered")
      | {{ $t('nav.alerts') }}
    b-dropdown-item(to="/timespiral" v-if="devmode")
      icon(name="history")
      | {{ $t('nav.timespiral') }}
    b-dropdown-item(to="/query")
      icon(name="code")
      | {{ $t('nav.query') }}
    b-dropdown-item(to="/graph" v-if="devmode")
      icon(name="project-diagram")
      | {{ $t('nav.graph') }}

  b-nav-item(to="/buckets")
    div.px-2.px-lg-1
      icon(name="database")
      | {{ $t('nav.rawData') }}
  b-nav-item(to="/settings")
    div.px-2.px-lg-1
      icon(name="cog")
      | {{ $t('nav.settings') }}

div(:class="{'fixed-top-padding': fixedTopMenu}")
  b-navbar.aw-navbar(toggleable="lg" :fixed="fixedTopMenu ? 'top' : null")
    // Brand on mobile
    b-navbar-nav.d-block.d-lg-none
      b-navbar-brand(to="/" style="background-color: transparent;")
        img.aligh-middle(src="/logo.png" style="height: 1.5em;")
        span.ml-2.align-middle(style="font-size: 1em; color: #000;") {{ $t('app.name') }}

    // Opens the phone drawer; the inline collapse below is the desktop navbar.
    b-navbar-toggle(target="nav-drawer" :label="$t('nav.menu')" data-testid="nav-drawer-toggle")

    b-collapse#nav-collapse(is-nav)
      b-navbar-nav
        +navMain

      // Brand on large screens (centered)
      b-navbar-nav.abs-center.d-none.d-lg-block
        b-navbar-brand(to="/" style="background-color: transparent;")
          img.ml-0.aligh-middle(src="/logo.png" style="height: 1.5em;")
          span.ml-2.align-middle(style="font-size: 1.0em; color: #000;") {{ $t('app.name') }}

      b-navbar-nav.ml-auto
        +navTools

    // Phone/tablet: modal side drawer. Closes on route change, Escape and
    // backdrop tap; the header close button dismisses it as well.
    b-sidebar#nav-drawer.aw-nav-drawer(
      v-model="drawerOpen"
      :title="$t('app.name')"
      :close-label="$t('nav.close')"
      backdrop
      lazy
      shadow
      width="min(85vw, 320px)"
      bg-variant="white"
      data-testid="nav-drawer"
    )
      b-navbar-nav.px-2
        +navMain
        +navTools
</template>

<style lang="scss" scoped>
.fixed-top-padding {
  padding-bottom: var(--aw-navbar-height);
}
</style>

<script lang="ts">
// only import the icons you use to reduce bundle size

import _ from 'lodash';

import { mapState } from 'pinia';
import { useSettingsStore } from '~/stores/settings';
import { useBucketsStore } from '~/stores/buckets';
import { IBucket } from '~/util/interfaces';

export default {
  name: 'Header',
  data() {
    return {
      activityViews: null,
      // Sticky on every platform: tall pages (the timeline, a long activity
      // view) otherwise scroll the navigation out of reach.
      // See https://github.com/ActivityWatch/aw-webui/issues/299
      fixedTopMenu: true,
      drawerOpen: false,
      desktopQuery: null as MediaQueryList | null,
    };
  },
  computed: {
    ...mapState(useSettingsStore, ['devmode']),
  },
  watch: {
    // A navigation click routes to another page; the drawer must follow.
    $route() {
      this.drawerOpen = false;
    },
  },
  mounted: async function () {
    // The drawer only exists below the lg breakpoint: close it (and its
    // backdrop) when the viewport grows to desktop width.
    if (typeof window !== 'undefined' && window.matchMedia) {
      this.desktopQuery = window.matchMedia('(min-width: 992px)');
      // Safari < 14 and old WebViews only have the legacy addListener API.
      if (typeof this.desktopQuery.addEventListener === 'function') {
        this.desktopQuery.addEventListener('change', this.onDesktopQueryChange);
      } else if (typeof this.desktopQuery.addListener === 'function') {
        this.desktopQuery.addListener(this.onDesktopQueryChange);
      }
    }

    const bucketStore = useBucketsStore();
    await bucketStore.ensureLoaded();
    const buckets: IBucket[] = bucketStore.buckets;
    const types_by_host = {};

    const activityViews = [];

    _.each(buckets, v => {
      types_by_host[v.hostname] = types_by_host[v.hostname] || {};
      types_by_host[v.hostname].afk ||= v.type == 'afkstatus';
      types_by_host[v.hostname].window ||= v.type == 'currentwindow';
      types_by_host[v.hostname].android ||= v.type == 'currentwindow' && v.id.includes('android');
    });

    _.each(types_by_host, (types, hostname) => {
      if (types['android']) {
        activityViews.push({
          name: `${hostname} (Android)`,
          hostname: hostname,
          type: 'android',
          pathUrl: `/activity/${hostname}`,
          icon: 'mobile',
        });
      } else if (hostname != 'unknown') {
        activityViews.push({
          name: hostname,
          hostname: hostname,
          type: 'default',
          pathUrl: `/activity/${hostname}`,
          icon: 'desktop',
        });
      }
    });

    this.activityViews = activityViews;
  },
  beforeUnmount() {
    if (this.desktopQuery) {
      if (typeof this.desktopQuery.removeEventListener === 'function') {
        this.desktopQuery.removeEventListener('change', this.onDesktopQueryChange);
      } else if (typeof this.desktopQuery.removeListener === 'function') {
        this.desktopQuery.removeListener(this.onDesktopQueryChange);
      }
    }
  },
  methods: {
    onDesktopQueryChange(e: MediaQueryListEvent) {
      if (e.matches) {
        this.drawerOpen = false;
      }
    },
  },
};
</script>

<style lang="scss" scoped>
@import '../style/globals';

.aw-navbar {
  background-color: white;
  border: solid $lightBorderColor;
  border-width: 0 0 1px 0;
}

.nav-item {
  align-items: center;

  margin-left: 0.2em;
  margin-right: 0.2em;
  border-radius: 0.5em;

  &:hover {
    background-color: #ddd;
  }
}

.abs-center {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.aw-nav-drawer ::v-deep {
  .nav-link,
  .dropdown-item {
    display: flex;
    align-items: center;
    min-height: 48px;
  }

  .nav-item {
    margin-left: 0;
    margin-right: 0;
  }
}
</style>

<style lang="scss">
.nav-item {
  .nav-link {
    color: #555 !important;
  }
}
</style>
