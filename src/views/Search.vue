<template lang="pug">
div
  h3 {{ $t('search.title') }}

  b-alert(v-if="error" show variant="danger")
    | {{error}}

  b-input-group(size="lg")
    b-input(v-model="pattern" v-on:keyup.enter="search()" :placeholder="$t('search.placeholder')")
    b-input-group-append
      b-button(type="button", @click="search()" variant="success")
        icon.mr-1(name="search")
        | {{ $t('search.searchBtn') }}

  div.d-flex.mt-1
    span.mr-auto.small.text-muted {{ $t('common.hostname') }} {{queryOptions.hostname}}
    b-button.border-0(size="sm", variant="outline-dark" @click="show_options = !show_options")
      span(v-if="!show_options")
        | #[icon(name="angle-double-down")] {{ $t('search.showOptions') }}
      span(v-else)
        | #[icon(name="angle-double-up")] {{ $t('search.hideOptions') }}

  div(v-show="show_options")
    h4 {{ $t('search.options') }}
    aw-query-options(v-model="queryOptions")

  div(v-if="status == 'searching'")
    div #[icon(name="spinner" pulse)] {{ $t('search.searching') }}

  div(v-if="events != null || browserEvents != null")
    hr

    div(v-if="events && events.length > 0")
      h5 {{ $t('search.windowEvents', { count: events.length }) }}
      aw-selectable-eventview(:events="events")

    div(v-if="browserEvents && browserEvents.length > 0")
      h5 {{ $t('search.browserEvents', { count: browserEvents.length }) }}
      table.table.table-sm.table-hover
        thead
          tr
            th {{ $t('search.timestamp') }}
            th {{ $t('search.duration') }}
            th {{ $t('search.url') }}
            th {{ $t('search.title') }}
        tbody
          tr(v-for="e in browserEvents" :key="e.id || e.timestamp")
            td
              | {{ $filters.shortdate(e.timestamp) }}
              | {{ $filters.shorttime(e.timestamp) }}
            td {{ $filters.friendlyduration(e.duration) }}
            td
              a(:href="e.data.url" target="_blank" rel="noopener") {{ e.data.url }}
            td {{ e.data.title }}

    div(v-if="status !== 'searching' && events && events.length === 0 && (!browserEvents || browserEvents.length === 0)")
      p.text-muted {{ $t('search.noResults') }}

    div
      | {{ $t('search.notFound') }}
      br
      | {{ $t('search.addWeek') }} #[b-button(size="sm" variant="outline-dark" @click="extendByWeek()") {{ $t('search.addWeekBtn') }}]
</template>

<script lang="ts">
import _ from 'lodash';
import moment from 'moment';
import { browserSearchQuery, canonicalEvents, querystr_to_array } from '~/queries';
import { useBucketsStore } from '~/stores/buckets';

export default {
  name: 'Search',
  data() {
    return {
      pattern: '',
      events: null,
      browserEvents: null,

      status: null,
      error: '',
      // Every submission owns a sequence; stale completions must not overwrite
      // results (or loading/error state) produced by a newer submission.
      searchSequence: 0,

      // Options
      show_options: false,
      queryOptions: {
        start: moment().subtract(1, 'day').format('YYYY-MM-DD'),
        stop: moment().add(1, 'day').format('YYYY-MM-DD'),
      },
    };
  },
  beforeUnmount() {
    // Invalidate any pending search when this view goes away.
    this.searchSequence++;
  },
  methods: {
    search: async function () {
      const sequence = ++this.searchSequence;
      // Capture the submission's inputs up front so a form edit during the
      // request cannot leak into an older submission's result ownership.
      const pattern = this.pattern;
      const { hostname, start, stop, filter_afk } = this.queryOptions;
      this.status = 'searching';
      this.error = '';

      try {
        let windowQuery = canonicalEvents({
          bid_window: 'aw-watcher-window_' + hostname,
          bid_afk: 'aw-watcher-afk_' + hostname,
          filter_afk,
          categories: [[['searched'], { type: 'regex', regex: pattern, ignore_case: true }]],
          filter_categories: [['searched']],
        });
        windowQuery += '; RETURN = events;';

        const windowQueryArray = querystr_to_array(windowQuery);
        const timeperiods = [moment(start).format() + '/' + moment(stop).format()];

        // Look up browser buckets for this host. A failure here (e.g. the
        // bucket list cannot be loaded) must not block the window-only search.
        let browserQueryArray: string[] = [];
        try {
          const bucketsStore = useBucketsStore();
          await bucketsStore.ensureLoaded();
          browserQueryArray = browserSearchQuery(bucketsStore.bucketsBrowser(hostname), pattern);
        } catch (e) {
          console.error('Failed to load browser buckets for search', e);
        }

        // Each source can fail independently (e.g. a browser-only host has no
        // window/AFK buckets). Keep successful matches and report partial failures.
        const errors: string[] = [];
        const results = await Promise.all([
          this.$aw.query(timeperiods, windowQueryArray).catch(e => {
            console.error('Window search failed', e);
            errors.push(
              this.$t('search.windowQueryFailed', {
                error: e.response?.data?.message ?? String(e),
              })
            );
            return null;
          }),
          browserQueryArray.length > 0
            ? this.$aw.query(timeperiods, browserQueryArray).catch(e => {
                console.error('Browser search failed', e);
                errors.push(
                  this.$t('search.browserQueryFailed', {
                    error: e.response?.data?.message ?? String(e),
                  })
                );
                return null;
              })
            : Promise.resolve(null),
        ]);
        // A newer submission (or unmount) superseded this one: discard it.
        if (sequence !== this.searchSequence) return;
        this.error = errors.join('; ');

        // Every window hit carries the synthetic `searched` category the query
        // uses for filtering; it is not a real category, so drop it from results.
        const windowResults = results[0] ? results[0][0] : [];
        const windowEvents = (windowResults || []).map(e => ({
          ...e,
          data: _.omit(e.data, '$category'),
        }));
        this.events = _.orderBy(windowEvents, ['timestamp'], ['desc']);
        const browserResults = results[1] ? results[1][0] : [];
        // An event can match the pattern in both its url and title, which the
        // query concatenates into two entries; dedup by event ID so each
        // database record appears at most once.
        this.browserEvents = _.orderBy(
          _.uniqBy(browserResults || [], (e: any) => e.id),
          ['timestamp'],
          ['desc']
        );
      } catch (e) {
        console.error(e);
        if (sequence === this.searchSequence) {
          this.error = e.response?.data?.message ?? String(e);
        }
      } finally {
        if (sequence === this.searchSequence) this.status = null;
      }
    },
    extendByWeek() {
      this.queryOptions.start = moment(this.queryOptions.start)
        .subtract(1, 'week')
        .format('YYYY-MM-DD');
      this.search();
    },
  },
};
</script>
