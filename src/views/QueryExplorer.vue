<template lang="pug">

div
  h3 {{ $t('query.title') }}

  | {{ $t('queryExplorer.docsPrefix') }} #[a(href="https://docs.activitywatch.net/en/latest/examples/querying-data.html") {{ $t('queryExplorer.docsLink') }}] {{ $t('queryExplorer.docsSuffix') }}

  hr

  div.alert.alert-danger(v-if="error")
    | {{error}}

  div.alert.alert-danger(v-if="saved_query_error")
    | {{saved_query_error}}

  form
    div.form-row.align-items-end
      div.form-group.col-lg-6
        label.mb-1(for="saved-query-select") {{ $t('queryExplorer.savedQueries') }}
        select#saved-query-select.form-control(v-model="selected_saved_query_id", @change="loadSelectedQuery()")
          option(value="") {{ $t('queryExplorer.selectSaved') }}
          option(v-for="savedQuery in savedQueries", :key="savedQuery.id", :value="savedQuery.id")
            | {{savedQuery.name}}
      div.form-group.col-lg-6
        div.saved-query-actions
          button.btn.btn-success.mr-2(type="button", @click="saveCurrentQuery()", :disabled="saved_query_pending") {{ $t('queryExplorer.saveCurrent') }}
          button.btn.btn-secondary.mr-2(type="button", @click="renameSelectedQuery()", :disabled="!selected_saved_query_id || saved_query_pending") {{ $t('queryExplorer.rename') }}
          button.btn.btn-danger(type="button", @click="deleteSelectedQuery()", :disabled="!selected_saved_query_id || saved_query_pending")
            icon(name="trash")
            |  {{ $t('queryExplorer.delete') }}

    div.form-row
      div.form-group.col-md-6
        | {{ $t('query.start') }}
        input.form-control(type="date", :max="today", v-model="startdate")
      div.form-group.col-md-6
        | {{ $t('query.end') }}
        input.form-control(type="date", :max="tomorrow", v-model="enddate")

    div.form-group
      textarea.form-control(v-model="query_code", @keypress.ctrl.enter="query()" style="font-family: monospace", rows=10)
    div.form-inline
      div.form-group
        button.btn.btn-success(type="button", @click="query()") {{ $t('queryExplorer.query') }}
      span(style="padding-left: 1em;")
      | {{eventcount_str}}

  hr

  aw-selectable-eventview(:events="events", :event_type="event_type")

  b-modal(
    v-model:visible="showSaveQueryModal"
    :title="$t('queryExplorer.saveModalTitle')"
    :ok-title="$t('common.save')"
    :cancel-title="$t('common.cancel')"
    :ok-disabled="saved_query_pending"
    :cancel-disabled="saved_query_pending"
    :no-close-on-backdrop="saved_query_pending"
    :no-close-on-esc="saved_query_pending"
    :hide-header-close="saved_query_pending"
    @ok="onSaveQueryConfirm"
    @shown="$refs.saveQueryNameInput && $refs.saveQueryNameInput.focus()"
  )
    b-form-group(:label="$t('queryExplorer.namePrompt')")
      b-form-input(
        ref="saveQueryNameInput"
        v-model="saveQueryName"
        :placeholder="$t('queryExplorer.queryNamePlaceholder')"
      )

  b-modal(
    v-model:visible="showRenameQueryModal"
    :title="$t('queryExplorer.renameModalTitle')"
    :ok-title="$t('queryExplorer.rename')"
    :cancel-title="$t('common.cancel')"
    :ok-disabled="saved_query_pending"
    :cancel-disabled="saved_query_pending"
    :no-close-on-backdrop="saved_query_pending"
    :no-close-on-esc="saved_query_pending"
    :hide-header-close="saved_query_pending"
    @ok="onRenameQueryConfirm"
    @shown="$refs.renameQueryNameInput && $refs.renameQueryNameInput.focus()"
  )
    b-form-group(:label="$t('queryExplorer.renamePrompt')")
      b-form-input(
        ref="renameQueryNameInput"
        v-model="renameQueryName"
        :placeholder="$t('queryExplorer.queryNamePlaceholder')"
      )
</template>

<style scoped lang="scss">
.saved-query-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
}
</style>

<script lang="ts">
import moment from 'moment';
import _ from 'lodash';
import { querystr_to_array } from '~/queries';
import { useCategoryStore } from '~/stores/categories';
import { useSettingsStore } from '~/stores/settings';
import {
  buildSavedQuery,
  buildSavedQueryId,
  getDefaultSavedQueryName,
  resolveSavedQueryDates,
  SavedQuery,
  sortSavedQueries,
} from '~/util/savedQueries';

const today = moment().startOf('day');
const tomorrow = moment(today).add(24, 'hours');

export default {
  name: 'QueryExplorer',
  data() {
    const settingsStore = useSettingsStore();

    // allow queries to be saved in a URL parameter
    let queryCode = this.$route.query.q;

    if (_.isEmpty(this.$route.query.q)) {
      queryCode = `
afk_events = query_bucket(find_bucket("aw-watcher-afk_"));
window_events = query_bucket(find_bucket("aw-watcher-window_"));
window_events = filter_period_intersect(window_events, filter_keyvals(afk_events, "status", ["not-afk"]));
merged_events = merge_events_by_keys(window_events, ["app", "title"]);
merged_events = categorize(merged_events, __CATEGORIES__);
RETURN = sort_by_duration(merged_events);
`.trim();
    }

    return {
      settingsStore,
      query_code: queryCode,
      event_type: 'currentwindow',
      events: [],
      today: today.format(),
      tomorrow: tomorrow.format(),
      error: '',
      saved_query_error: '',
      selected_saved_query_id: '',
      startdate: today.format('YYYY-MM-DD'),
      enddate: tomorrow.format('YYYY-MM-DD'),
      showSaveQueryModal: false,
      saveQueryName: '',
      // 弹窗确认期间固定当时打开的快照，避免选择/表单变化串到本次操作。
      saveQueryDraft: null,
      showRenameQueryModal: false,
      renameQueryName: '',
      renameQueryTarget: null,
      saved_query_pending: false,
    };
  },
  computed: {
    savedQueries: function (): SavedQuery[] {
      return sortSavedQueries(this.settingsStore.saved_queries || []);
    },
    selectedSavedQuery: function (): SavedQuery | null {
      return this.savedQueries.find(query => query.id === this.selected_saved_query_id) || null;
    },
    eventcount_str: function () {
      if (Array.isArray(this.events))
        return this.$t('queryExplorer.numberOfEvents') + this.events.length;
      else return '';
    },
  },
  mounted: async function () {
    await this.settingsStore.ensureLoaded();
    useCategoryStore().load();
  },
  methods: {
    persistSavedQueries: async function (savedQueries: SavedQuery[]) {
      try {
        this.saved_query_error = '';
        await this.settingsStore.update({ saved_queries: sortSavedQueries(savedQueries) });
        return true;
      } catch (e) {
        console.error('Failed to save query presets', e);
        this.saved_query_error = this.$t('queryExplorer.saveFailed');
        return false;
      }
    },
    loadSelectedQuery: function () {
      if (!this.selectedSavedQuery) {
        return;
      }

      const { startdate, enddate } = resolveSavedQueryDates(this.selectedSavedQuery);
      this.query_code = this.selectedSavedQuery.query_code;
      this.event_type = this.selectedSavedQuery.event_type || 'currentwindow';
      this.startdate = startdate;
      this.enddate = enddate;
      this.saved_query_error = '';
    },
    saveCurrentQuery: async function () {
      if (this.saved_query_pending) return;
      const current = this.selectedSavedQuery;
      // 在确认/等待前固定本次操作的目标与内容快照。
      const draft = buildSavedQuery({
        id: current?.id || '',
        name: current?.name || '',
        query_code: this.query_code,
        startdate: this.startdate,
        enddate: this.enddate,
        event_type: this.event_type,
      });

      if (current) {
        this.saved_query_pending = true;
        try {
          if (!confirm(this.$t('queryExplorer.updatePrompt', { name: draft.name }))) return;
          await this.persistSavedQueries(
            this.savedQueries.map(savedQuery => (savedQuery.id === draft.id ? draft : savedQuery))
          );
        } finally {
          this.saved_query_pending = false;
        }
        return;
      }

      // 没有已选查询：用本次快照命名并打开弹窗。
      this.saveQueryDraft = draft;
      this.saveQueryName = getDefaultSavedQueryName(draft.query_code);
      this.showSaveQueryModal = true;
    },
    onSaveQueryConfirm: async function (event) {
      event.preventDefault();

      if (this.saved_query_pending) return;
      const draft = this.saveQueryDraft;
      const trimmedName = this.saveQueryName.trim();
      if (_.isEmpty(trimmedName)) {
        this.saved_query_error = this.$t('queryExplorer.emptyNameAlert');
        return;
      }
      if (!draft) return;

      const newId = buildSavedQueryId(
        trimmedName,
        this.savedQueries.map(savedQuery => savedQuery.id)
      );
      const newQuery = { ...draft, id: newId, name: trimmedName };
      this.saved_query_pending = true;
      try {
        const didPersist = await this.persistSavedQueries([...this.savedQueries, newQuery]);
        if (didPersist && this.saveQueryDraft === draft) {
          if (!this.selected_saved_query_id) this.selected_saved_query_id = newId;
          this.showSaveQueryModal = false;
        }
      } finally {
        this.saved_query_pending = false;
      }
    },
    renameSelectedQuery: async function () {
      if (this.saved_query_pending || !this.selectedSavedQuery) return;

      this.renameQueryTarget = { ...this.selectedSavedQuery };
      this.renameQueryName = this.renameQueryTarget.name;
      this.showRenameQueryModal = true;
    },
    onRenameQueryConfirm: async function (event) {
      event.preventDefault();

      if (this.saved_query_pending) return;
      const target = this.renameQueryTarget;
      const trimmedName = this.renameQueryName.trim();
      if (_.isEmpty(trimmedName)) {
        this.saved_query_error = this.$t('queryExplorer.emptyNameAlert');
        return;
      }
      if (!target) return;

      this.saved_query_pending = true;
      try {
        const didPersist = await this.persistSavedQueries(
          this.savedQueries.map(savedQuery =>
            savedQuery.id === target.id ? { ...savedQuery, name: trimmedName } : savedQuery
          )
        );
        if (didPersist && this.renameQueryTarget === target) {
          this.showRenameQueryModal = false;
        }
      } finally {
        this.saved_query_pending = false;
      }
    },
    deleteSelectedQuery: async function () {
      if (this.saved_query_pending || !this.selectedSavedQuery) return;
      const targetId = this.selectedSavedQuery.id;
      const targetName = this.selectedSavedQuery.name;
      this.saved_query_pending = true;
      try {
        if (!confirm(this.$t('queryExplorer.deletePrompt', { name: targetName }))) return;
        const didPersist = await this.persistSavedQueries(
          this.savedQueries.filter(savedQuery => savedQuery.id !== targetId)
        );
        if (didPersist && this.selected_saved_query_id === targetId) {
          this.selected_saved_query_id = '';
        }
      } finally {
        this.saved_query_pending = false;
      }
    },
    query: async function () {
      let query = this.query_code;

      // replace magic string `__CATEGORIES__` in query text with latest category rule
      if (_.includes(query, '__CATEGORIES__')) {
        const categoryRules = useCategoryStore().classes_for_query;

        if (useCategoryStore().classes_for_query.length === 0) {
          this.error = this.$t('queryExplorer.categoriesMissing');
          return;
        }

        query = query.replace('__CATEGORIES__', JSON.stringify(categoryRules));
      }

      // the aw-client expects an array of commands with whitespace cleaned up
      query = querystr_to_array(query as string);
      const timeperiods = [moment(this.startdate).format() + '/' + moment(this.enddate).format()];

      try {
        const data = await this.$aw.query(timeperiods, query);
        this.events = data[0];
        this.error = '';
      } catch (e) {
        this.error = e.response.data.message;
      }
    },
  },
};
</script>
