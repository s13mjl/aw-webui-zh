<template lang="pug">
// The category edit modal
b-modal(id="edit" ref="edit" :title="$t('categoryEdit.editTitle')" @show="resetModal" @hidden="hidden" @ok="handleOk" :ok-title="$t('common.confirm')" :cancel-title="$t('common.cancel')")
  div.my-1
    b-input-group.my-1(:prepend="$t('categoryEdit.name')")
      b-form-input(v-model="editing.name")
    b-input-group(:prepend="$t('categoryEdit.parent')")
      b-select(v-model="editing.parent", :options="allCategories")
    b-input-group.my-1(:prepend="$t('categoryEdit.priority')")
      b-form-input(v-model.number="editing.priority" type="number" :placeholder="$t('categoryEdit.priorityPlaceholder')")
    small.text-muted {{ $t('categoryEdit.priorityHint') }}
    //| ID: {{editing.id}}

  hr
  div.my-1
    b {{ $t('categoryEdit.rule') }}
    b-input-group.my-1(:prepend="$t('categoryEdit.type')")
      b-select(v-model="editing.rule.type", :options="allRuleTypes")
    div(v-if="editing.rule.type === 'regex'")
      // Multiple pattern fields with a "+" button to add more.
      // Each field is a literal string; '|' inside a field matches literally.
      // On save the fields are escaped and joined with '|' into rule.regex.
      div(v-for="(p, idx) in editing.patterns" :key="idx").d-flex.align-items-center.my-1
        b-input-group.flex-grow-1(:prepend="idx === 0 ? $t('categoryEdit.pattern') : ''")
          b-form-input(v-model="editing.patterns[idx]" :placeholder="$t('categoryEdit.patternPlaceholder')")
        b-btn.ml-1(variant="outline-danger" size="sm" @click="removePattern(idx)" :disabled="editing.patterns.length <= 1")
          icon(name="times")
      b-btn.my-1(variant="outline-primary" size="sm" @click="addPattern")
        icon(name="plus")
        | &nbsp;{{ $t('categoryEdit.addPattern') }}
      div.d-flex
        div.flex-grow-1
          b-form-checkbox(v-model="editing.rule.ignore_case" switch)
            | {{ $t('categoryEdit.caseInsensitive') }}
        div.flex-grow-1
          small.text-right
            div.text-danger(v-if="!validPattern") {{ $t('categoryEdit.invalidPattern') }}
            div.text-warning(v-if="validPattern && broad_pattern") {{ $t('categoryEdit.patternTooBroad') }}
      small.text-muted {{ $t('categoryEdit.patternHelp') }}

  hr
  div.my-1
    b {{ $t('categoryEdit.color') }}

    b-form-checkbox(v-model="editing.inherit_color" switch)
      | {{ $t('categoryEdit.inheritColor') }}
    div.mt-1(v-show="!editing.inherit_color")
      color-picker(v-model="editing.color")

  hr
  div.my-1
    b {{ $t('categoryEdit.productivityScore') }}
    b-form-checkbox(v-model="editing.inherit_score" switch)
      | {{ $t('categoryEdit.inheritScore') }}
    b-input-group.my-1(:prepend="$t('categoryEdit.score')" v-if="!editing.inherit_score")
      b-form-input(v-model="editing.score")

  hr
  div.my-1
    b-btn(variant="danger", @click="removeClass(categoryId); $refs.edit.hide()")
      icon(name="trash")
      | {{ $t('categoryEdit.remove') }}

  // Visible error banner shown when the user clicks OK but validation fails.
  // Previously the modal just silently refused to close, leaving the user
  // wondering why nothing happened — see issue #585.
  b-alert.mt-2(v-if="submitError" show variant="danger")
    | {{ submitError }}
</template>

<script lang="ts">
import _ from 'lodash';
import ColorPicker from '~/components/ColorPicker.vue';
import { useCategoryStore } from '~/stores/categories';
import { validateRegex, isRegexBroad } from '~/util/validate';
import { patternsToRegex, regexToPatterns } from '~/util/classes';

import 'vue-awesome/icons/trash';
import 'vue-awesome/icons/times';
import 'vue-awesome/icons/plus';

export default {
  name: 'CategoryEditModal',
  components: {
    'color-picker': ColorPicker,
  },
  props: {
    categoryId: { type: Number, required: true },
  },
  data: function () {
    return {
      categoryStore: useCategoryStore(),

      editing: {
        id: 0, // FIXME: Use ID assigned to category in store, in order for saves to be uniquely targeted
        name: null,
        rule: {},
        parent: [],
        inherit_color: true,
        color: null,
        inherit_score: true,
        score: null,
        priority: 0,
        patterns: [] as string[],
      },
      // Error message shown in the modal when validation fails on submit.
      // Cleared every time the modal is reopened and every time a new submit
      // attempt starts — see issue #585.
      submitError: null,
    };
  },
  computed: {
    allCategories: function () {
      return [{ value: [], text: this.$t('categoryEdit.none') }].concat(
        this.categoryStore.allCategoriesSelect
      );
    },
    allRuleTypes: function () {
      return [
        { value: 'none', text: this.$t('categoryEdit.none') },
        { value: 'regex', text: this.$t('categoryEdit.regex') },
        //{ value: 'glob', text: 'Glob pattern' },
      ];
    },
    // The regex string that will be saved, derived from the patterns list.
    // Used for validation (validPattern / broad_pattern) and on submit.
    computedRegex(): string {
      if (this.editing.rule.type !== 'regex') return '';
      const patterns = (this.editing.patterns || []).filter(
        p => p !== null && p !== undefined && String(p) !== ''
      );
      return patternsToRegex(patterns) || '';
    },
    valid: function () {
      return this.editing.rule.type !== 'none' && this.validPattern;
    },
    validPattern: function () {
      return this.editing.rule.type === 'regex' && validateRegex(this.computedRegex);
    },
    broad_pattern: function () {
      return this.editing.rule.type === 'regex' && isRegexBroad(this.computedRegex);
    },
  },
  watch: {
    categoryId: function (new_value) {
      if (new_value !== null) {
        this.showModal();
      }
    },
  },
  mounted: function () {
    if (this.categoryId !== null) {
      this.showModal();
    }
  },
  methods: {
    showModal() {
      this.$refs.edit.show();
    },
    hidden() {
      this.$emit('hidden');
    },
    removeClass() {
      // TODO: Show a confirmation dialog
      // TODO: Remove children as well?
      this.categoryStore.removeClass(this.categoryId);
    },
    addPattern() {
      // Add a new empty pattern field
      this.editing.patterns.push('');
    },
    removePattern(idx: number) {
      // Keep at least one field so the UI always has an entry to edit
      if (this.editing.patterns.length > 1) {
        this.editing.patterns.splice(idx, 1);
      }
    },
    checkFormValidity() {
      // Validate that the category name is non-empty (prevents null/undefined
      // from being written into the name array, which would break queries —
      // see https://github.com/ActivityWatch/activitywatch/issues/1355).
      const name = this.editing.name;
      if (name === null || name === undefined || String(name).trim() === '') {
        this.submitError = this.$t('categoryEdit.errorNameRequired');
        return false;
      }
      // Validate regex pattern when rule type is 'regex' (prevents invalid
      // patterns like "Notepad++" from being saved and causing 500 errors
      // from the query engine — see https://github.com/ActivityWatch/activitywatch/issues/1340).
      if (this.editing.rule.type === 'regex') {
        // Require at least one non-empty pattern
        const nonEmpty = (this.editing.patterns || []).filter(
          p => p !== null && p !== undefined && String(p).trim() !== ''
        );
        if (nonEmpty.length === 0) {
          this.submitError = this.$t('categoryEdit.errorNameRequired');
          return false;
        }
        if (!this.validPattern) {
          this.submitError = this.$t('categoryEdit.errorInvalidPattern');
          return false;
        }
      }
      return true;
    },
    handleOk(event) {
      // Prevent modal from closing
      event.preventDefault();
      // Clear previous error before attempting a new submit
      this.submitError = null;
      // Trigger submit handler
      this.handleSubmit();
      this.$emit('ok');
    },
    handleSubmit() {
      // Exit when the form isn't valid
      if (!this.checkFormValidity()) {
        // Error message is already set in checkFormValidity and shown in the
        // modal via the submitError banner — see issue #585.
        return;
      }

      // Save the category.
      // Filter out any null/undefined entries from the name array as a defensive
      // measure — even with the checkFormValidity guard above, a stale parent
      // value or future code change could otherwise sneak a null into the array
      // and break the query engine.
      const raw_name = this.editing.parent.concat(this.editing.name);
      const clean_name = raw_name.filter(
        part => part !== null && part !== undefined && String(part).trim() !== ''
      );

      // Build the rule. For regex rules, derive rule.regex from the patterns
      // list (each pattern escaped, joined with '|') so '|' inside a pattern
      // is treated as a literal character. Keep patterns[] on the saved
      // category so the modal can re-edit the list.
      let rule;
      let patterns;
      if (this.editing.rule.type === 'regex') {
        patterns = (this.editing.patterns || []).filter(
          p => p !== null && p !== undefined && String(p).trim() !== ''
        );
        rule = {
          type: 'regex' as const,
          regex: patternsToRegex(patterns),
          ignore_case: this.editing.rule.ignore_case === true,
        };
      } else {
        rule = { type: 'none' as const };
        patterns = [];
      }

      const new_class = {
        id: this.editing.id,
        name: clean_name,
        rule,
        patterns,
        priority: Number(this.editing.priority) || 0,
        data: {
          color: this.editing.inherit_color === true ? undefined : this.editing.color,
          score: this.editing.inherit_score === true ? undefined : this.editing.score,
        },
      };
      this.categoryStore.updateClass(new_class);

      // Hide the modal manually.
      // Guard against $refs.edit being undefined — the modal may have already
      // been torn down (e.g. parent set editingId=null during batch edits),
      // which previously threw "TypeError: e.$refs.edit is undefined"
      // (see https://github.com/ActivityWatch/activitywatch/issues/1144).
      this.$nextTick(() => {
        if (this.$refs.edit) {
          this.$refs.edit.hide();
        }
      });
    },
    resetModal() {
      const cat = this.categoryStore.get_category_by_id(this.categoryId);
      const color = cat.data ? cat.data.color : undefined;
      const inherit_color = !color;
      const score = cat.data ? cat.data.score : undefined;
      const inherit_score = !score;
      // Load patterns from the category if present; otherwise split the
      // existing regex heuristically into a patterns list.
      let patterns: string[];
      if (cat.patterns && cat.patterns.length > 0) {
        patterns = _.cloneDeep(cat.patterns);
      } else if (cat.rule && cat.rule.type === 'regex' && cat.rule.regex) {
        patterns = regexToPatterns(cat.rule.regex);
      } else {
        patterns = [''];
      }
      // Ensure there's always at least one editable field
      if (patterns.length === 0) patterns = [''];
      this.editing = {
        id: cat.id,
        name: cat.subname,
        rule: _.cloneDeep(cat.rule),
        parent: cat.parent ? cat.parent : [],
        color,
        inherit_color,
        score,
        inherit_score,
        priority: cat.priority ?? 0,
        patterns,
      };
      // Clear any error from a previous submit attempt when the modal reopens
      this.submitError = null;
    },
  },
};
</script>
