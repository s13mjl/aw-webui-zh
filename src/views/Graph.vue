<template lang="pug">
div
  h3 {{ $t('graph.title') }}

  b-alert(show variant="warning")
    | {{ $t('graph.earlyDev') }} #[a(href="https://github.com/ActivityWatch/aw-webui/pull/365") aw-webui#365] {{ $t('graph.earlyDevSuffix') }}

  p {{ $t('graph.description') }}

  b-alert(v-if="error" show variant="danger")
    | {{error}}

  // Specify max category depth
  b-form-group(:label="$t('graph.maxDepth')")
    b-form-input(v-model="maxDepth" type="number" min="1")

  // Toggle to exclude uncategorized
  b-form-group(:label="$t('graph.excludeUncategorized')")
    b-form-checkbox(v-model="excludeUncategorized")

  div.d-flex
    span.mr-auto
    b-button(type="button", @click="generate()" variant="success")
      icon(name="search")
      | {{ $t('graph.generate') }}

  div.d-flex.mt-1
    span.mr-auto.small.text-muted {{ $t('common.hostname') }} {{queryOptions.hostname}}
    b-button.border-0(size="sm", variant="outline-dark" @click="show_options = !show_options")
      span(v-if="!show_options")
        | #[icon(name="angle-double-down")] {{ $t('graph.showOptions') }}
      span(v-else)
        | #[icon(name="angle-double-up")] {{ $t('graph.hideOptions') }}

  div(v-show="show_options")
    h4 {{ $t('graph.options') }}
    aw-query-options(v-model="queryOptions")

  div(v-if="status == 'searching'")
    div #[icon(name="spinner" pulse)] {{ $t('graph.searching') }}


  div(v-if="events != null")
    hr

    div
        | {{ $t('graph.foundEvents', { count: events.length, seconds: queryTime / 1000 }) }}

    aw-force-graph(:data="graphdata")

    hr

    div
      | {{ $t('graph.notFound') }}
      br
      | {{ $t('graph.addWeek') }} #[b-button(size="sm" variant="outline-dark" @click="extendByWeek()") {{ $t('search.addWeekBtn') }}]
</template>

<style scoped lang="scss"></style>

<script lang="ts">
import { defineAsyncComponent } from 'vue';
import _ from 'lodash';
import moment from 'moment';


import { canonicalEvents, querystr_to_array } from '~/queries';

import { useCategoryStore } from '~/stores/categories';

import { getClient } from '~/util/awclient';

export default {
  name: 'Graph',
  components: {
    'aw-force-graph': defineAsyncComponent(() => import('~/visualizations/ForceGraph.vue')),
  },
  data() {
    return {
      categoryStore: useCategoryStore(),

      events: null,
      graphdata: {},

      status: null,
      queryTime: null,
      error: '',
      generateRequest: null,

      // Parameters
      maxDepth: 3,
      excludeUncategorized: false,

      // Options
      show_options: false,
      queryOptions: {},
    };
  },
  mounted: async function () {
    await this.categoryStore.load();
  },
  methods: {
    generate: async function () {
      // 快照查询/渲染选项：后续 Generate 不能窃取本次请求的 hostname/过滤条件/深度，
      // 也只有本次调用可以发布结果、错误或清除搜索状态。
      const request = {
        hostname: this.queryOptions.hostname,
        filter_afk: this.queryOptions.filter_afk,
        start: this.queryOptions.start,
        stop: this.queryOptions.stop,
        excludeUncategorized: this.excludeUncategorized,
        maxDepth: this.maxDepth,
      };
      this.generateRequest = request;
      this.status = 'searching';
      this.error = '';
      try {
        const events = await this.fetchEvents(request);
        if (this.generateRequest !== request) return;
        this.events = events;
        this.graphdata = this.generateGraphData(events, request.maxDepth);
      } catch (e) {
        if (this.generateRequest !== request) return;
        console.error(e);
        this.error =
          e?.response?.data?.message ||
          e?.message ||
          (typeof e === 'string' ? e : '') ||
          this.$t('common.requestFailed');
        this.events = null;
        this.graphdata = {};
      } finally {
        if (this.generateRequest === request) this.status = null;
      }
    },
    fetchEvents: async function (request) {
      // TODO: use full query (one per day/timeperiod) instead of canonicalEvents
      let query = canonicalEvents({
        bid_window: 'aw-watcher-window_' + request.hostname,
        bid_afk: 'aw-watcher-afk_' + request.hostname,
        filter_afk: request.filter_afk,
        categories: this.categoryStore.classes_for_query,
        filter_categories: request.excludeUncategorized
          ? this.categoryStore.classes_for_query.map(t => t[0])
          : null,
      });
      query += '; RETURN = events;';

      const query_array = querystr_to_array(query);
      const start = moment(request.start).format();
      const end = moment(request.stop).format();
      const timeperiods = [start + '/' + end];
      const time = moment();
      const data = await getClient().query(timeperiods, query_array);
      if (this.generateRequest === request) {
        this.queryTime = moment().diff(time);
        console.log('done fetching events!');
      }
      return _.orderBy(data[0], ['timestamp'], ['desc']);
    },
    generateGraphData: function (events, maxDepth = this.maxDepth) {
      // generate graph data from events
      // iterate through events, and count the number of category transitions
      // for each category, add a node to the graphdata with the group of its parent category
      // for each transition-pair, add a link to the graphdata with the number of transitions as weight
      // 分类路径中可能含有字面量分隔符，显示字符串不能当作身份标识。
      const categoryKey = (category: string[]) => JSON.stringify(category);

      // copy all events, slice off category depth deeper than maxDepth
      events = events.map(e => {
        const $category = e.data.$category.slice(0, maxDepth);
        return { ...e, data: { ...e.data, $category } };
      });

      const allCategories = new Map<string, string[]>(
        events.map(e => [categoryKey(e.data.$category), e.data.$category])
      );
      const groups = new Map<string, number>([['Uncategorized', 0]]);

      // Generate groups
      // 注意：本地 jest 的 Vue SFC 转译会把 for...of 降级为按 length 遍历，
      // 而 Map 迭代器没有 length；用 forEach 兼顾测试环境与浏览器构建。
      allCategories.forEach(category => {
        const rootcat = category[0];
        if (!groups.has(rootcat)) {
          groups.set(rootcat, groups.size);
        }
      });

      // Generate nodes
      const nodes = [];
      allCategories.forEach((category, id) => {
        const rootcat = category[0];
        // Size nodes depending on time spent
        const catTime = events
          .filter(e => categoryKey(e.data.$category) == id)
          .map(e => moment(e.timestamp).add(e.duration).diff(e.timestamp))
          .reduce((a, b) => a + b, 0);
        nodes.push({
          id,
          label: category[category.length - 1] || '',
          title: category.join(' > '),
          group: groups.get(rootcat),
          color: this.categoryStore.get_category_color(category),
          value: catTime,
        });
      });

      // Generate links
      const links = [];
      for (let i = 0; i < events.length - 1; i++) {
        const e1 = events[i];
        const e2 = events[i + 1];
        const e1cat = e1.data.$category;
        const e2cat = e2.data.$category;
        if (_.isEqual(e1cat, e2cat)) continue;

        const source = categoryKey(e1cat);
        const target = categoryKey(e2cat);
        const link = links.find(l => l.source == source && l.target == target);
        if (link) {
          link.value++;
        } else {
          links.push({
            source,
            target,
            value: 1,
          });
        }
      }

      console.log('generated nodes & links');
      return { nodes, links };
    },
    extendByWeek() {
      this.queryOptions.start = moment(this.queryOptions.start)
        .subtract(1, 'week')
        .format('YYYY-MM-DD');
      this.generate();
    },
  },
};
</script>
