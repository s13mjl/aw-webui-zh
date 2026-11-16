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

  div(v-if="events != null")
    hr

    aw-selectable-eventview(:events="events")

    div
      | {{ $t('search.notFound') }}
      br
      | {{ $t('search.addWeek') }} #[b-button(size="sm" variant="outline-dark" @click="extendByWeek()") {{ $t('search.addWeekBtn') }}]
</template>

<script lang="ts">
import _ from 'lodash';
import moment from 'moment';
import { canonicalEvents, querystr_to_array } from '~/queries';


export default {
  name: 'Search',
  data() {
    return {
      pattern: '',
      events: null,

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
        let query = canonicalEvents({
          bid_window: 'aw-watcher-window_' + hostname,
          bid_afk: 'aw-watcher-afk_' + hostname,
          filter_afk,
          categories: [[['searched'], { type: 'regex', regex: pattern, ignore_case: true }]],
          filter_categories: [['searched']],
        });
        query += '; RETURN = events;';

        const query_array = querystr_to_array(query);
        const timeperiods = [moment(start).format() + '/' + moment(stop).format()];
        const data = await this.$aw.query(timeperiods, query_array);
        // A newer submission (or unmount) superseded this one: discard it.
        if (sequence !== this.searchSequence) return;
        // Every hit carries the synthetic `searched` category the query uses
        // for filtering; it is not a real category, so drop it from results.
        const events = (data[0] || []).map(e => ({ ...e, data: _.omit(e.data, '$category') }));
        this.events = _.orderBy(events, ['timestamp'], ['desc']);
        this.error = '';
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
