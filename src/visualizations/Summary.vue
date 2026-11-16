<template lang="pug">
div
  div.aw-summary-container
  // Use visibility to make sure elements don't skip when data finishes loading
  div(:style='{"visibility": visible_more ? "visible" : "hidden"}')
    b-button.mt-1.mr-2(v-if="fields && (limit_ < fields.length)", size="sm", variant="outline-secondary", @click="limit_ += 5")
      icon(name="angle-double-down")
      | {{ $t('summary.showMore') }}
    b-button.mt-1(v-if="limit_ != limit" size="sm", variant="outline-secondary", @click="limit_ = limit")
      icon(name="angle-double-up")
</template>

<style scoped lang="scss">
.aw-summary-container > svg {
  border: 1px solid #999;
  border-radius: 0.5em;
}
</style>

<script lang="ts">
// NOTE: This is just a Vue.js component wrapper for summary.ts
//       Code should generally go in the framework-independent file.

import summary from './summary';

export default {
  name: 'aw-summary',
  props: {
    fields: Array,
    namefunc: Function,
    hoverfunc: {
      type: Function,
      default: null, // If not set we will default to namefunc
    },
    colorfunc: Function,
    linkfunc: {
      type: Function,
      default: () => null,
    },
    limit: {
      type: Number,
      default: 5,
    },
    with_limit: {
      type: Boolean,
      default: false,
    },
    // 父组件保留稳定的 name/color 回调时，改变此值仍可触发重绘。
    dataKey: {
      type: String,
      default: null,
    },
  },
  data: function () {
    return { limit_: this.limit, updateQueued: false };
  },
  computed: {
    visible_more() {
      return this.fields && this.fields.length > 0 && this.with_limit;
    },
  },
  watch: {
    fields: function () {
      this.scheduleUpdate();
    },
    limit_: function () {
      this.scheduleUpdate();
    },
    dataKey: function () {
      this.scheduleUpdate();
    },
    namefunc: function () {
      this.scheduleUpdate();
    },
    colorfunc: function () {
      this.scheduleUpdate();
    },
    hoverfunc: function () {
      this.scheduleUpdate();
    },
    linkfunc: function () {
      this.scheduleUpdate();
    },
  },
  mounted: function () {
    const el = this.$el.children[0];
    summary.create(el);
    this.update();
  },
  methods: {
    // 同一 tick 内多个字段变化合并为一次重绘。
    scheduleUpdate: function () {
      if (this.updateQueued) return;
      this.updateQueued = true;
      this.$nextTick(() => {
        this.updateQueued = false;
        this.update();
      });
    },
    update: function () {
      const el = this.$el.children[0];
      if (this.fields) {
        summary.updateSummedEvents(
          el,
          this.fields.slice(0, this.limit_),
          this.namefunc,
          this.hoverfunc,
          this.colorfunc,
          this.linkfunc
        );
      } else {
        summary.set_status(el, this.$t('common.loading'));
      }
    },
  },
};
</script>
