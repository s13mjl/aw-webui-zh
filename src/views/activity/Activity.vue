<template lang="pug">
div
  h3.mb-0 {{ $t('activity.title') }} #[span.d-sm-inline.d-none {{ $t('activity.for') }} ]
    span.text-muted.d-sm-inline-block.d-block
      span(v-if="periodIsBrowseable") {{ timeperiod | friendlyperiod }}
      span(v-else) {{ periodLengthTitle }}

  div.mb-3.text-muted(style="font-size: 0.9em;")
    ul.list-group.list-group-horizontal-md
      li.list-group-item.pl-0.pr-3.py-0.border-0
        b.mr-1 {{ $t('activity.host') }}
        span {{ host }}
      li.list-group-item.pl-0.pr-3.py-0.border-0
        b.mr-1 {{ $t('activity.timeActive') }}
        span {{ activityStore.active.duration | friendlyduration }}
    ul.list-group.list-group-horizontal-md(v-if="periodLength != 'day'")
      li.list-group-item.pl-0.pr-3.py-0.border-0
        b.mr-1 {{ $t('activity.queryRange') }}
        span {{ periodReadableRange }}

  div.activity-toolbar.d-flex.flex-wrap.align-items-center
    div.d-flex.mr-2
      b-button-group
        b-button.px-3(
          v-for="opt in primaryPeriods"
          :key="opt.value"
          :pressed="periodLength === opt.value"
          @click="setDate(_date, opt.value)"
          variant="outline-dark"
          size="sm"
        ) {{ opt.text }}
        // If an extended period is active (week/month/year), surface it as
        // an extra pressed pill so the user sees what's selected — the kebab
        // alone wouldn't communicate that. Click toggles it back off (back
        // to "day") so it's not stuck.
        b-button.px-3(
          v-if="!isPrimaryPeriod"
          pressed
          variant="outline-dark"
          size="sm"
          @click="exitExtendedPeriod"
        ) {{ extendedPeriodLabel }}
      // Kebab sits outside the b-button-group so the last pressed pill
      // (whichever it is) keeps its rounded right corner.
      b-dropdown.kebab-dropdown.ml-1(
        size="sm"
        variant="outline-secondary"
        toggle-class="border-0"
        no-caret
        right
        :title="$t('activity.moreRanges')"
        :aria-label="$t('activity.moreRangesAria')"
      )
        template(v-slot:button-content)
          icon(name="ellipsis-v")
        b-dropdown-item-button(
          v-for="opt in extendedPeriods"
          :key="opt.value"
          :active="periodLength === opt.value"
          @click="opt.value === 'custom' ? startCustomRange() : setDate(_date, opt.value)"
        ) {{ opt.text }}

    //- "All time" has no browsable date, so the date navigator is hidden.
    b-input-group.mr-2(v-if="periodLength !== 'all'", size="sm", style="width: auto")
      b-input-group-prepend
        b-button.px-2(:to="previousLink",
                 variant="outline-dark",
                 :title="$t('activity.previous', { period: periodLength })",
                 :aria-label="$t('activity.previousAria', { period: periodLength })")
          icon(name="arrow-left")
      //- Custom ranges need two dates (start and end), shown inline so the
      //- user can adjust them without opening another dialog.
      template(v-if="periodLength === 'custom'")
        input.form-control.form-control-sm.activity-dateinput(
          type="date"
          :value="customStart"
          :max="today"
          :title="$t('activity.customRangeStart')"
          :aria-label="$t('activity.customRangeStart')"
          @change="setCustomStart($event.target.value)"
        )
        span.activity-range-separator —
        input.form-control.form-control-sm.activity-dateinput(
          type="date"
          :value="customEnd"
          :max="today"
          :title="$t('activity.customRangeEnd')"
          :aria-label="$t('activity.customRangeEnd')"
          @change="setCustomEnd($event.target.value)"
        )
      input.form-control.form-control-sm.activity-dateinput(
        v-else
        type="date"
        :value="_date"
        :max="today"
        :title="periodIsBrowseable ? periodReadableRange : ''"
        @change="setDate($event.target.value, periodLength)"
      )
      b-input-group-append
        b-button.px-2(:to="nextLink",
                      :disabled="nextDisabled", variant="outline-dark",
                      :title="$t('activity.next', { period: periodLength })",
                      :aria-label="$t('activity.nextAria', { period: periodLength })")
          icon(name="arrow-right")

    div.ml-auto
      b-button-group(size="sm")
        b-button.px-2(:pressed.sync="showOptions", variant="outline-dark", :title="$t('activity.filtersTitle')", :aria-label="$t('activity.filtersAria')")
          icon(name="filter")
          span.d-none.d-md-inline
            |  {{ $t('activity.filters') }}
            b-badge(pill, variant="secondary" v-if="filters_set > 0").ml-2 {{ filters_set }}
        b-button.px-2(@click="refresh(true)", variant="outline-dark", :title="$t('activity.refresh')", :aria-label="$t('activity.refreshAria')")
          icon(name="sync")
          span.d-none.d-md-inline
            |  {{ $t('activity.refresh') }}

  div.row(v-if="showOptions" style="background-color: #EEE;").my-3.py-3
    div.col-md-12
      h5 {{ $t('activity.filtersTitle') }}
    div.col-md-6
      b-form-checkbox(v-model="filter_afk" size="sm")
        | {{ $t('activity.excludeAfk') }}
        icon#filterAFKHelp(name="question-circle" style="opacity: 0.4")
        b-tooltip(target="filterAFKHelp" v-b-tooltip.hover :title="$t('activity.filterAfkTooltip')")
      b-form-checkbox(v-model="include_audible" :disabled="!filter_afk" size="sm")
        | {{ $t('activity.audibleActive') }}
        icon#includeAudibleHelp(name="question-circle" style="opacity: 0.4")
        b-tooltip(target="includeAudibleHelp" v-b-tooltip.hover :title="$t('activity.filterAudibleTooltip')")

      b-form-checkbox(v-if="devmode" v-model="include_stopwatch" size="sm")
        // WIP: https://github.com/ActivityWatch/aw-webui/pull/368
        | {{ $t('activity.includeStopwatch') }}
        br
        | {{ $t('activity.stopwatchWipNote') }}

    div.col-md-6.mt-2.mt-md-0
      b-form-group(:label="$t('activity.showCategory')" label-cols="5" label-cols-lg="4" style="font-size: 0.88em")
        b-form-select(v-model="filter_category", :options="categoryStore.category_select(true)" size="sm")


  aw-periodusage(v-if="showPeriodUsage", :periodusage_arr="periodusage", @update="setDate")

  aw-uncategorized-notification(:periodLength="periodLength")

  ul.row.nav.nav-tabs.mt-4
    li.nav-item(v-for="view in views")
      router-link.nav-link(:to="{ name: 'activity-view', params: {...$route.params, view_id: view.id}, query: $route.query}" :class="{'router-link-exact-active': currentView.id == view.id}")
        h6 {{view.name}}

    li.nav-item(style="margin-left: auto")
      a.nav-link(@click="$refs.new_view.show()")
        h6
          icon(name="plus")
          span.d-none.d-md-inline
            | {{ $t('activity.newView') }}

  b-modal(id="new_view" ref="new_view" :title="$t('activity.newViewTitle')" @show="resetModal" @hidden="resetModal" @ok="handleOk" :ok-title="$t('common.confirm')" :cancel-title="$t('common.cancel')")
    div.my-1
      b-input-group.my-1(:prepend="$t('activity.viewId')")
        b-form-input(v-model="new_view.id")
      b-input-group.my-1(:prepend="$t('activity.viewName')")
        b-form-input(v-model="new_view.name")

  div
    router-view

    aw-devonly
      b-btn(id="load-demo", @click="load_demo")
        | {{ $t('activity.loadDemo') }}
</template>

<style lang="scss" scoped>
@import '../../style/globals';

.activity-toolbar {
  // row-gap kicks in only when items wrap to a second line, so the
  // single-row case stays compact without piling mb-2 on every child.
  row-gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.activity-dateinput {
  // Keep the date picker compact and aligned with the period button-group
  // regardless of mode (day / week / month / year / N days). The full
  // human-readable range remains available via the input's tooltip and the
  // page heading.
  width: 9.5rem;
  min-width: 9.5rem;
}

.activity-range-separator {
  display: flex;
  align-items: center;
  padding: 0 0.25rem;
  color: #6c757d;
}

.nav {
  border-bottom: 1px solid $lightBorderColor;

  .nav-item {
    margin-bottom: 0px;

    &:first-child {
      margin-left: 0;
    }

    .nav-link {
      // default bootstrap vertical padding was too high
      padding: 0.25rem 1rem;

      color: lighten(black, 40%);
      cursor: pointer;
      border: none;

      &:hover {
        color: black !important;
        border-bottom: 3px solid lighten(black, 70%);
        border-radius: 0;
      }

      &.router-link-exact-active {
        color: $activeHighlightColor !important;
        border-bottom: 3px solid lighten($activeHighlightColor, 15%);
        border-radius: 0;

        // Does nothing for Verala Round
        font-weight: bold;

        &:hover {
          background-color: #fff;
        }
      }
    }
  }
}
</style>

<script lang="ts">
import { mapState } from 'pinia';
import moment from 'moment';
import { get_day_start_with_offset, get_today_with_offset } from '~/util/time';
import { periodLengthConvertMoment } from '~/util/timeperiod';
import _ from 'lodash';

import 'vue-awesome/icons/arrow-left';
import 'vue-awesome/icons/arrow-right';
import 'vue-awesome/icons/sync';
import 'vue-awesome/icons/plus';
import 'vue-awesome/icons/edit';
import 'vue-awesome/icons/times';
import 'vue-awesome/icons/save';
import 'vue-awesome/icons/question-circle';
import 'vue-awesome/icons/filter';
import 'vue-awesome/icons/ellipsis-v';

import { useSettingsStore } from '~/stores/settings';
import { useCategoryStore } from '~/stores/categories';
import { useActivityStore, QueryOptions } from '~/stores/activity';
import { useBucketsStore } from '~/stores/buckets';
import { useViewsStore } from '~/stores/views';

export default {
  name: 'Activity',
  components: {
    'aw-uncategorized-notification': () => import('~/components/UncategorizedNotification.vue'),
  },
  props: {
    host: String,
    date: {
      type: String,
      // NOTE: This does not work as you'd might expect since the default is set on
      // initialization, which would lead to the same date always being returned,
      // even if the day has changed.
      // Instead, use the computed _date.
      //default: get_today(),
    },
    periodLength: {
      type: String,
      default: 'day',
    },
  },
  data: function () {
    return {
      activityStore: useActivityStore(),
      categoryStore: useCategoryStore(),
      bucketsStore: useBucketsStore(),
      viewsStore: useViewsStore(),
      settingsStore: useSettingsStore(),

      showOptions: false,

      include_audible: true,
      // Include stopwatch events when a stopwatch bucket exists. The
      // store query falls back to noop if no bucket is present, so this
      // is safe for users without stopwatch data. Enabling by default
      // means the "Top Stopwatch Events" visualization shows real
      // numbers as soon as a user records a session; previously a
      // stopwatch run produced "No data" unless they also flipped the
      // dev-only "Include manually logged events" checkbox.
      include_stopwatch: true,
      filter_afk: true,
      new_view: {},
    };
  },
  computed: {
    views(): import('~/stores/views').View[] {
      return this.viewsStore.viewsForHost(this.host);
    },
    ...mapState(useSettingsStore, ['devmode']),
    ...mapState(useSettingsStore, ['always_active_pattern']),

    // number of filters currently set (different from defaults)
    filters_set() {
      return (this.filter_category ? 1 : 0) + (!this.filter_afk ? 1 : 0);
    },

    // getter and setter for filter_category, getting and setting $route.query
    filter_category: {
      get() {
        if (!this.$route.query.category) return null;
        return this.$route.query.category.split('>');
      },
      set(value) {
        if (value == null) {
          this.$router.push({ query: _.omit(this.$route.query, 'category') });
        } else {
          this.$router.push({ query: { ...this.$route.query, category: value.join('>') } });
        }
      },
    },

    periodLengths: function () {
      // Year is always available; "all time" and "custom" round out the
      // range picker.
      return {
        day: this.$t('activity.periodDay').toString(),
        week: this.$t('activity.periodWeek').toString(),
        month: this.$t('activity.periodMonth').toString(),
        year: this.$t('activity.periodYear').toString(),
        last7d: this.$t('activity.periodLast7d').toString(),
        last30d: this.$t('activity.periodLast30d').toString(),
        all: this.$t('activity.periodAll').toString(),
        custom: this.$t('activity.periodCustom').toString(),
      };
    },
    periodLengthTitle: function () {
      if (this.periodLength === 'last7d') {
        return this.$t('activity.periodLast7dTitle');
      }
      if (this.periodLength === 'last30d') {
        return this.$t('activity.periodLast30dTitle');
      }
      if (this.periodLength === 'all') {
        return this.$t('activity.periodAll');
      }
      if (this.periodLength === 'custom') {
        return this.$t('activity.periodCustom');
      }
      return '';
    },
    periodLengthsButtons: function () {
      return Object.entries(this.periodLengths).map(([value, text]) => ({ value, text }));
    },
    primaryPeriods: function () {
      return this.periodLengthsButtons.filter(p => ['day', 'last7d', 'last30d'].includes(p.value));
    },
    extendedPeriods: function () {
      return this.periodLengthsButtons.filter(p => !['day', 'last7d', 'last30d'].includes(p.value));
    },
    isPrimaryPeriod: function () {
      return ['day', 'last7d', 'last30d'].includes(this.periodLength);
    },
    extendedPeriodLabel: function () {
      const opt = this.extendedPeriods.find(p => p.value === this.periodLength);
      return opt ? opt.text : '';
    },
    periodIsBrowseable: function () {
      return ['day', 'week', 'month', 'year'].includes(this.periodLength);
    },
    today: function () {
      return get_today_with_offset(this.settingsStore.startOfDay);
    },
    // Earliest date we have data for, used as the start of the "all time"
    // range. Bucket metadata is the only source available before querying,
    // so use the oldest of created/first_seen/metadata.start. Falls back to
    // one year back when the server reports no usable timestamps.
    earliestDate: function () {
      const hostBuckets = this.bucketsStore.buckets.filter(
        b => b.hostname === this.host || (b.data && b.data.hostname === this.host)
      );
      // In multidevice mode the activity view aggregates several hosts, so the
      // earliest date should consider all of them. Otherwise stick to buckets
      // belonging to the selected host.
      const buckets = this.settingsStore.useMultidevice ? this.bucketsStore.buckets : hostBuckets;
      const dates: moment.Moment[] = [];
      buckets.forEach(b => {
        [b.created, b.first_seen, b.metadata && b.metadata.start].forEach(d => {
          if (!d) return;
          const m = moment(d);
          if (m.isValid()) dates.push(m);
        });
      });
      if (dates.length === 0) {
        return moment(this.today).subtract(1, 'year').format('YYYY-MM-DD');
      }
      const earliest = moment.min(dates).format('YYYY-MM-DD');
      return earliest > this.today ? this.today : earliest;
    },
    customStart: function () {
      const start = this.date || this.today;
      if (!moment(start).isValid()) return this.today;
      const formatted = moment(start).format('YYYY-MM-DD');
      return formatted > this.today ? this.today : formatted;
    },
    customEnd: function () {
      const end = this.$route.query.end;
      if (typeof end === 'string' && moment(end).isValid()) {
        const formatted = moment(end).format('YYYY-MM-DD');
        const clamped = formatted > this.today ? this.today : formatted;
        return clamped < this.customStart ? this.customStart : clamped;
      }
      return this.customStart;
    },
    showPeriodUsage: function () {
      // The period-usage chart queries ±15 periods of the current length,
      // which is far too expensive for year/custom/all-time ranges.
      return !['year', 'all', 'custom'].includes(this.periodLength);
    },
    previousLink: function () {
      const path = `${this.link_prefix}/${this.previousPeriod()}/${this.subview}/${
        this.currentViewId
      }`;
      if (this.periodLength === 'custom') {
        return { path, query: { ...this.$route.query, end: this.shiftCustomEnd(-1) } };
      }
      return path;
    },
    nextLink: function () {
      // A disabled b-button still renders a router-link, so make the target a
      // no-op when there is nowhere to go.
      if (this.nextDisabled) {
        return this.$route.fullPath;
      }
      const path = `${this.link_prefix}/${this.nextPeriod()}/${this.subview}/${this.currentViewId}`;
      if (this.periodLength === 'custom') {
        return { path, query: { ...this.$route.query, end: this.shiftCustomEnd(1) } };
      }
      return path;
    },
    nextDisabled: function () {
      if (this.periodLength === 'custom') {
        return moment(this.customEnd).isSameOrAfter(this.today, 'day');
      }
      return this.nextPeriod() > this.today;
    },
    currentView: function () {
      return this.views.find(v => v.id == this.$route.params.view_id) || this.views[0];
    },
    currentViewId: function () {
      // If localStore is not yet initialized, then currentView can be undefined. In that case, we return an empty string (which should route to the default view)
      return this.currentView !== undefined ? this.currentView.id : '';
    },
    _date: function () {
      const offset = this.settingsStore.startOfDay;
      return this.date || get_today_with_offset(offset);
    },
    subview: function () {
      return this.$route.meta.subview;
    },
    filter_categories: function () {
      if (this.filter_category) {
        const cats = this.categoryStore.all_categories;
        const isChild = p => c => c.length > p.length && _.isEqual(p, c.slice(0, p.length));
        const children = _.filter(cats, isChild(this.filter_category));
        return [this.filter_category].concat(children);
      } else {
        return null;
      }
    },
    link_prefix: function () {
      return `/activity/${this.host}/${this.periodLength}`;
    },
    periodusage: function () {
      return this.activityStore.getActiveHistoryAroundTimeperiod(this.timeperiod);
    },
    timeperiod: function () {
      const settingsStore = useSettingsStore();

      if (this.periodIsBrowseable) {
        return {
          start: get_day_start_with_offset(this._date, settingsStore.startOfDay),
          length: [1, this.periodLength],
        };
      }
      if (this.periodLength === 'all') {
        return this.dateRangeTimeperiod(this.earliestDate, this.today);
      }
      if (this.periodLength === 'custom') {
        return this.dateRangeTimeperiod(this.customStart, this.customEnd);
      }
      const len = { last7d: [7, 'days'], last30d: [30, 'days'] }[this.periodLength];
      return {
        start: get_day_start_with_offset(
          moment(this._date).subtract(len[0] - 1, len[1]),
          settingsStore.startOfDay
        ),
        length: len,
      };
    },
    periodReadableRange: function () {
      const periodStart = moment(this.timeperiod.start);
      const dateFormatString = 'YYYY-MM-DD';

      // "All time" and custom ranges display their inclusive end date, which
      // is more intuitive than the exclusive end used by week/month/year.
      if (this.periodLength === 'all') {
        return `${periodStart.format(dateFormatString)}—${this.today}`;
      }
      if (this.periodLength === 'custom') {
        return `${periodStart.format(dateFormatString)}—${this.customEnd}`;
      }

      // it's helpful to render a range for the week as opposed to just the start of the week
      // or the number of the week so users can easily determine (a) if we are using monday/sunday as the week
      // start and exactly when the week ends. The formatting code ends up being a bit more wonky, but it's
      // worth the tradeoff. https://github.com/ActivityWatch/aw-webui/pull/284

      let periodLength;
      if (this.periodIsBrowseable) {
        periodLength = [1, this.periodLength];
      } else {
        if (this.periodLength === 'last7d') {
          periodLength = [7, 'day'];
        } else if (this.periodLength === 'last30d') {
          periodLength = [30, 'day'];
        } else {
          throw 'unknown periodLength';
        }
      }

      const startOfPeriod = periodStart.format(dateFormatString);
      const endOfPeriod = periodStart.add(...periodLength).format(dateFormatString);
      return `${startOfPeriod}—${endOfPeriod}`;
    },
  },
  watch: {
    host: function () {
      this.refresh();
    },
    timeperiod: function () {
      this.refresh();
    },
    filter_category: function () {
      this.refresh();
    },
    filter_afk: function () {
      this.refresh();
    },
    include_audible: function () {
      this.refresh();
    },
    // Refresh when the always-active pattern changes in settings so the
    // activity view picks up the new pattern without a manual refresh. See #1117.
    always_active_pattern: function () {
      this.refresh();
    },
  },

  mounted: async function () {
    this.viewsStore.load();
    this.categoryStore.load();
    try {
      // Needed to resolve the earliest data date for the "all time" range.
      await this.bucketsStore.ensureLoaded();
      await this.refresh();
    } catch (e) {
      if (e.message !== 'canceled') {
        console.error(e);
        throw e;
      }
    }
  },

  beforeDestroy: async function () {
    // Cancels pending requests and resets store
    await this.activityStore.reset();
  },

  methods: {
    // Clicking the pressed extended-period pill goes back to "day". Custom
    // ranges keep their pill (and inline date inputs) until the user picks
    // another period.
    exitExtendedPeriod: function () {
      if (this.periodLength !== 'custom') {
        this.setDate(this._date, 'day');
      }
    },

    // Build a [start, N days] timeperiod from two inclusive YYYY-MM-DD dates.
    dateRangeTimeperiod: function (startDate, endDate) {
      const offset = this.settingsStore.startOfDay;
      const start = moment(get_day_start_with_offset(startDate, offset));
      const end = moment(
        get_day_start_with_offset(moment(endDate).add(1, 'day').format('YYYY-MM-DD'), offset)
      );
      const days = Math.max(end.diff(start, 'days'), 1);
      return { start: start.format(), length: [days, 'day'] as [number, string] };
    },

    // Seed the custom range with the range currently on screen, so switching
    // to "custom" doesn't jump the user somewhere unexpected.
    startCustomRange: function () {
      let start: string;
      let end: string;
      if (this.periodLength === 'all') {
        end = this.today;
        start = moment(end).subtract(29, 'days').format('YYYY-MM-DD');
      } else {
        start = moment(this.timeperiod.start).format('YYYY-MM-DD');
        end = moment(this.timeperiod.start)
          .add(
            this.timeperiod.length[0],
            this.timeperiod.length[1] as moment.unitOfTime.DurationConstructor
          )
          .subtract(1, 'day')
          .format('YYYY-MM-DD');
      }
      this.setCustomRange(start, end);
    },

    setCustomStart: function (value) {
      if (!value || !moment(value).isValid()) return;
      let start = moment(value).format('YYYY-MM-DD');
      let end = this.customEnd;
      if (start > this.today) start = this.today;
      if (end < start) end = start;
      this.setCustomRange(start, end);
    },

    setCustomEnd: function (value) {
      if (!value || !moment(value).isValid()) return;
      let end = moment(value).format('YYYY-MM-DD');
      const start = this.customStart;
      if (end > this.today) end = this.today;
      if (end < start) end = start;
      this.setCustomRange(start, end);
    },

    setCustomRange: function (start, end) {
      const startDate = moment(start);
      const endDate = moment(end);
      if (!startDate.isValid() || !endDate.isValid()) return;

      let startStr = startDate.format('YYYY-MM-DD');
      let endStr = endDate.format('YYYY-MM-DD');
      if (startStr > this.today) startStr = this.today;
      if (endStr > this.today) endStr = this.today;
      if (endStr < startStr) endStr = startStr;

      const path = `/activity/${this.host}/custom/${startStr}/${this.subview}/${this.currentViewId}`;
      if (this.$route.path === path && this.$route.query.end === endStr) {
        return;
      }
      this.$router
        .push({ path, query: { ...this.$route.query, end: endStr } })
        .catch(() => undefined);
    },

    shiftCustomEnd: function (direction) {
      const days = this.timeperiod.length[0];
      const end = moment(this.customEnd)
        .add(direction * days, 'day')
        .format('YYYY-MM-DD');
      return end > this.today ? this.today : end;
    },

    previousPeriod: function () {
      return moment(this._date)
        .subtract(
          this.timeperiod.length[0],
          this.timeperiod.length[1] as moment.unitOfTime.DurationConstructor
        )
        .format('YYYY-MM-DD');
    },
    nextPeriod: function () {
      return moment(this._date)
        .add(
          this.timeperiod.length[0],
          this.timeperiod.length[1] as moment.unitOfTime.DurationConstructor
        )
        .format('YYYY-MM-DD');
    },

    setDate: function (date, periodLength) {
      // periodLength is an optional argument, default to this.periodLength
      if (!periodLength) {
        periodLength = this.periodLength;
      }

      const momentJsDate = moment(date);
      if (!momentJsDate.isValid()) {
        return;
      }

      // When switching between period buttons (day/week/month/year), prefer
      // today's date if today falls inside the source period. Otherwise the
      // user gets thrown across the calendar — e.g. year(2026) → month →
      // week lands on 2025-12-29 because startOf("week") of Jan 1 walks
      // back into the previous year.
      let anchorDate = momentJsDate;
      const today = moment(get_today_with_offset(this.settingsStore.startOfDay));
      if (this.periodIsBrowseable) {
        const sourceUnit = periodLengthConvertMoment(this.periodLength);
        const sourceStart = momentJsDate.clone().startOf(sourceUnit);
        // moment.add() rejects "isoWeek" as a DurationConstructor (even
        // though startOf() accepts it). Cast — runtime handles both spellings.
        const sourceEnd = sourceStart
          .clone()
          .add(1, sourceUnit as moment.unitOfTime.DurationConstructor);
        if (today.isSameOrAfter(sourceStart) && today.isBefore(sourceEnd)) {
          anchorDate = today;
        }
      }

      let new_date;
      if (periodLength === 'custom') {
        this.startCustomRange();
        return;
      } else if (periodLength === 'all') {
        // The date is irrelevant for all-time, but keep it in the URL so the
        // route stays valid when switching back to a dated period.
        new_date = anchorDate.format('YYYY-MM-DD');
      } else if (periodLength === 'last7d' || periodLength === 'last30d') {
        new_date = anchorDate.format('YYYY-MM-DD');
      } else {
        const new_period_length_moment = periodLengthConvertMoment(periodLength);
        new_date = anchorDate.clone().startOf(new_period_length_moment).format('YYYY-MM-DD');
      }
      const path = `/activity/${this.host}/${periodLength}/${new_date}/${this.subview}/${this.currentViewId}`;
      // Leaving a custom range behind also means dropping its end date.
      const query = { ...this.$route.query };
      delete query.end;
      if (this.$route.path !== path || this.$route.query.end) {
        this.$router.push({ path, query });
      }
    },

    refresh: async function (force) {
      // Ensure settings are loaded before reading always_active_pattern,
      // otherwise the default empty string is used and the pattern is
      // silently ignored on the initial page load. See #1117.
      await this.settingsStore.ensureLoaded();
      const queryOptions: QueryOptions = {
        timeperiod: this.timeperiod,
        host: this.host,
        force: force,
        filter_afk: this.filter_afk,
        include_audible: this.include_audible,
        include_stopwatch: this.include_stopwatch,
        filter_categories: this.filter_categories,
        always_active_pattern: this.always_active_pattern,
        skip_active_history: !this.showPeriodUsage,
      };
      await this.activityStore.ensure_loaded(queryOptions);
    },

    load_demo: async function () {
      await this.activityStore.load_demo();
    },

    checkFormValidity() {
      // All checks must be false for check to pass
      const checks: [string, boolean][] = [
        [
          this.$t('activity.errIdNotUnique').toString(),
          this.viewsStore.views.map(v => v.id).includes(this.new_view.id),
        ],
        [this.$t('activity.errMissingId').toString(), this.new_view.id === ''],
        [this.$t('activity.errMissingName').toString(), this.new_view.name === ''],
      ];
      const errors = checks.filter(([, v]) => v).map(([k]) => k);
      const valid = errors.length == 0;
      if (!valid) {
        alert(this.$t('activity.invalidForm', { errors: errors.join(', ') }));
      }
      return valid;
    },

    handleOk(event) {
      // Prevent modal from closing
      event.preventDefault();
      // Trigger submit handler
      this.handleSubmit();
    },

    handleSubmit() {
      // Exit when the form isn't valid
      const valid = this.checkFormValidity();
      if (!valid) {
        return;
      }

      const viewsStore = useViewsStore();
      viewsStore.addView({ id: this.new_view.id, name: this.new_view.name, elements: [] });
      viewsStore.save();

      // Hide the modal manually
      this.$nextTick(() => {
        this.$refs.new_view.hide();
      });
    },

    resetModal() {
      this.new_view = {
        id: '',
        name: '',
      };
    },
  },
};
</script>
