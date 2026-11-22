<template lang="pug">
div
  b-row
    b-col(cols="12", md="6").mb-2
      b-form-group(:label="$t('topBucketData.bucket')")
        b-form-select(
          v-model="selectedBucketId",
          :options="bucketOptions",
          :disabled="disabled || bucketOptions.length === 0 || loading"
        )
    b-col(cols="12", md="6").mb-2
      b-form-group
        template(#label)
          span {{ $t('topBucketData.fieldLabel') }}
          span.info-icon(
            :title="$t('topBucketData.fieldHint')"
          ) i
        b-form-select(
          v-model="selectedField",
          :options="fieldSelectOptions",
          :disabled="disabled || !selectedBucketId || loading"
        )
        b-form-input.mt-2(
          v-if="selectedField === '__custom' || fieldOptions.length === 0",
          v-model="customField",
          :placeholder="$t('topBucketData.fieldPlaceholder')",
          :disabled="disabled || loading"
        )
  b-alert.mt-2(v-if="error", show, variant="danger") {{ error }}
  b-alert.mt-2(v-else-if="!selectedBucketId" show variant="info")
    | {{ $t('topBucketData.selectWatcher') }}
  b-alert.mt-2(v-else-if="!loading && aggregated.length === 0" show variant="warning")
    | {{ $t('topBucketData.noEvents') }}

  div.mt-2
    div.text-center.py-4(v-if="loading")
      b-spinner(small type="grow" :label="$t('topBucketData.loading')")
      span.ml-2 {{ $t('topBucketData.loadingEvents') }}
    aw-summary(
      v-else-if="aggregated.length",
      :fields="aggregated",
      :namefunc="namefunc",
      :hoverfunc="hoverfunc",
      :colorfunc="colorfunc",
      with_limit
    )
    div.text-muted.text-center.py-4(v-else)
      | {{ $t('topBucketData.pickField') }}
</template>

<script lang="ts">
import _ from 'lodash';
import moment from 'moment';
import { earliestEventInBucket, rangeCoveringEarliest } from '~/util/earliestEvent';
import { useActivityStore } from '~/stores/activity';
import { useBucketsStore } from '~/stores/buckets';
import { getClient } from '~/util/awclient';
interface AggregatedEvent {
  duration: number;
  data: Record<string, any>;
}
// watcher 值是 JSON 风格数据：保持类型与结构独立于展示文本；
// 对象属性插入顺序不属于值身份，数组顺序属于。
function valueIdentity(value: unknown): unknown {
  if (value === null || value === undefined) return ['unknown'];
  if (Array.isArray(value)) return ['array', value.map(valueIdentity)];
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return [
      'object',
      Object.keys(obj)
        .sort()
        .map(key => [key, valueIdentity(obj[key])]),
    ];
  }
  return [typeof value, value];
}
export default {
  name: 'aw-top-bucket-data',
  props: {
    initialBucketId: { type: String, default: '' },
    initialField: { type: String, default: '' },
    initialCustomField: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
  },
  data() {
    return {
      bucketsStore: useBucketsStore(),
      activityStore: useActivityStore(),
      selectedBucketId: this.initialBucketId || '',
      selectedField: this.initialField || '',
      customField: this.initialCustomField || '',
      fieldOptions: [] as string[],
      events: [] as any[],
      aggregated: [] as AggregatedEvent[],
      // bucket id -> earliest event, for All time (see queryRange)
      earliestByBucket: {} as Record<string, Date | null>,
      loading: false,
      error: '',
      loadGeneration: 0,
    };
  },
  computed: {
    bucketOptions(): { value: string; text: string }[] {
      return this.bucketsStore.buckets.map(b => ({
        value: b.id,
        text: `${b.id} (${b.type || this.$t('common.unknown')})`,
      }));
    },
    fieldSelectOptions(): { value: string; text: string }[] {
      const options = this.fieldOptions.map(f => ({ value: f, text: f }));
      options.push({ value: '__custom', text: this.$t('topBucketData.customField') });
      return options;
    },
    selectedFieldValue(): string {
      if (this.selectedField === '__custom') return this.customField;
      return this.selectedField;
    },
    timeRange(): { start: string; end: string } | null {
      const opts = this.activityStore.query_options;
      if (!opts || !opts.timeperiod) return null;
      const start = opts.timeperiod.start;
      const end = moment(start)
        .add(...opts.timeperiod.length)
        .toISOString();
      return { start, end };
    },
    namefunc(): (e: AggregatedEvent) => string {
      return e => e.data.display;
    },
    hoverfunc(): (e: AggregatedEvent) => string {
      return e => e.data.display;
    },
    colorfunc(): (e: AggregatedEvent) => string {
      return e => e.data.colorKey;
    },
  },
  watch: {
    disabled(value) {
      // 字段发现在保存期间可能完成；父级重新接受草稿更新时再转发结果选择。
      if (!value) this.emitSelection();
    },
    selectedBucketId: function () {
      this.emitSelection();
      // 新选中的桶可能在上次查看后导入了更早的数据，丢弃它的最早事件缓存，
      // 让普通切换也能看到完整历史（不必先点一次刷新）。
      const rest = { ...this.earliestByBucket };
      delete rest[this.selectedBucketId];
      this.earliestByBucket = rest;
      this.loadEvents();
    },
    selectedField: function () {
      this.emitSelection();
      this.aggregate();
    },
    customField: function () {
      if (this.selectedField === '__custom') {
        this.emitSelection();
        this.aggregate();
      }
    },
    timeRange() {
      this.loadEvents();
    },
  },
  async mounted() {
    await this.bucketsStore.ensureLoaded();
    this.setDefaultBucket();
    this.emitSelection();
    if (this.selectedBucketId) {
      await this.loadEvents();
    }
  },
  methods: {
    setDefaultBucket() {
      if (this.selectedBucketId) return;
      const host = this.activityStore.query_options && this.activityStore.query_options.host;
      const byHost = host ? this.bucketsStore.buckets.filter(b => b.hostname === host) : [];
      if (byHost.length > 0) {
        this.selectedBucketId = byHost[0].id;
      } else if (this.bucketsStore.buckets.length > 0) {
        this.selectedBucketId = this.bucketsStore.buckets[0].id;
      }
    },
    // All time 的共享范围只覆盖主机标准桶；选中的桶可能更早（例如导入的旧通话记录），
    // 需要把起点扩展到该桶自己的最早事件。
    async queryRange(
      bucketId: string,
      generation: number
    ): Promise<{ start: string; end: string } | null> {
      const range = this.timeRange;
      const opts = this.activityStore.query_options;
      if (!range || !opts || !opts.all_time) return range;
      if (opts.force || !(bucketId in this.earliestByBucket)) {
        const bucket = this.bucketsStore.getBucket(bucketId);
        // 桶存储尚未加载或恢复的 initialBucketId 还不在列表里：不要缓存 null，
        // 否则只能靠刷新重试。
        if (!bucket) return range;
        const earliest = await earliestEventInBucket(bucket, (id, params) =>
          getClient().getEvents(id, params)
        );
        if (generation !== this.loadGeneration) return null;
        this.earliestByBucket = { ...this.earliestByBucket, [bucketId]: earliest };
      }
      return rangeCoveringEarliest(range, this.earliestByBucket[bucketId]);
    },
    async loadEvents() {
      // 同一个 bucket 可能有重叠的日期/刷新请求，也可能 A -> B -> A 再次被选中，
      // 仅比较 bucket 无法判断异步结果属于哪一次加载，用递增代数标记归属。
      const generation = ++this.loadGeneration;
      const bucketId = this.selectedBucketId;
      const timeRange = this.timeRange;
      this.error = '';
      this.aggregated = [];
      this.events = [];
      this.fieldOptions = [];
      if (!bucketId || !timeRange) {
        this.loading = false;
        return;
      }
      this.loading = true;
      try {
        const range = await this.queryRange(bucketId, generation);
        if (!range || generation !== this.loadGeneration) return;
        const events = await getClient().getEvents(bucketId, {
          start: range.start,
          end: range.end,
          limit: -1,
        });
        // 已被更新的加载取代，丢弃本次结果。
        if (generation !== this.loadGeneration) return;
        this.events = events;
        this.fieldOptions = this.extractFields(this.events);
        if (!this.selectedField && this.fieldOptions.length > 0) {
          this.selectedField = this.fieldOptions[0];
        } else if (!this.selectedField && this.fieldOptions.length === 0) {
          this.selectedField = '__custom';
        }
        this.aggregate();
      } catch (err) {
        // 被取代的加载不得覆盖较新加载的结果或发布错误。
        if (generation !== this.loadGeneration) return;
        console.error(err);
        this.events = [];
        this.fieldOptions = [];
        this.error = err?.message || this.$t('topBucketData.loadFailed');
      } finally {
        // 被取代的加载不得关闭较新加载仍在进行的加载状态。
        if (generation === this.loadGeneration) this.loading = false;
      }
    },
    extractFields(events: any[]): string[] {
      // Sample first 100 events for field discovery (performance vs coverage tradeoff)
      const keys = new Set<string>();
      events.slice(0, 100).forEach(e => {
        Object.keys(e.data || {}).forEach(k => keys.add(k));
      });
      return Array.from(keys).sort();
    },
    aggregate() {
      const fieldValue = (this.selectedFieldValue || '').trim();
      if (!fieldValue) {
        this.aggregated = [];
        return;
      }
      // Even though the user should start the manual data fields with "data", we want
      // to gracefully let it pass. Chances are there are no nested data.data.title.
      const path = fieldValue.startsWith('data.') ? fieldValue : `data.${fieldValue}`;
      const grouped = new Map<string, AggregatedEvent>();
      this.events.forEach(e => {
        const value = _.get(e, path);
        const display = this.formatValue(value);
        // 按类型与结构分组，而不是按展示文本，避免数值 1 与字符串 "1" 等被合并。
        const key = JSON.stringify(valueIdentity(value));
        if (!grouped.has(key)) {
          grouped.set(key, {
            duration: 0,
            data: { display, raw: value, colorKey: display },
          });
        }
        const entry = grouped.get(key);
        entry.duration += e.duration || 0;
      });
      const rows = Array.from(grouped.values());
      const labelCounts = new Map<string, number>();
      rows.forEach(e =>
        labelCounts.set(e.data.display, (labelCounts.get(e.data.display) || 0) + 1)
      );
      // 保留原始标签，避免生成的注解掩盖同名字符串；普通字符串名称保持不变。
      const usedLabels = new Set(rows.map(e => e.data.display));
      rows.forEach(e => {
        if ((labelCounts.get(e.data.display) || 0) < 2 || typeof e.data.raw === 'string') return;
        const raw = e.data.raw;
        const type = raw == null ? 'unknown' : Array.isArray(raw) ? 'array' : typeof raw;
        const text = Array.isArray(raw) ? JSON.stringify(raw) : e.data.display;
        const base = `${text} (${type})`;
        let label = base;
        let suffix = 2;
        while (usedLabels.has(label)) label = `${base} #${suffix++}`;
        usedLabels.add(label);
        e.data.display = label;
      });
      this.aggregated = rows.sort((a, b) => b.duration - a.duration);
    },
    emitSelection() {
      this.$emit('update-props', {
        bucketId: this.selectedBucketId,
        field: this.selectedField === '__custom' ? '__custom' : this.selectedField,
        customField: this.selectedField === '__custom' ? this.customField : '',
      });
    },
    formatValue(value: unknown): string {
      if (Array.isArray(value)) return value.join(' > ');
      if (value === null || value === undefined) return this.$t('topBucketData.unknown');
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    },
  },
};
</script>

<style scoped>
.info-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 0.25rem;
  width: 1.15em;
  height: 1.15em;
  border: 1px solid #888;
  border-radius: 50%;
  font-size: 0.75em;
  color: #555;
  cursor: help;
}
</style>
