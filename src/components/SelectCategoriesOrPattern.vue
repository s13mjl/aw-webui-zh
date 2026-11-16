<template lang="pug">
div
  // Let the user either choose a mode to use for filtering events.
  // Either let the user choose which of the existing categories to include, or use a custom regex.
  b-form-group
    b-form-select(v-model="mode")
      option(value="custom") {{ $t('selectCategories.customRegex') }}
      option(value="categories") {{ $t('selectCategories.useExisting') }}

  // select which categories, by having a form select and a "plus" button to include them
  b-input-group
    aw-select-categories(v-if="mode == 'categories'", v-model="filterCategoriesData")
    b-input(v-if="mode == 'custom'" v-model="pattern" v-on:keyup.enter="generate()" :placeholder="$t('selectCategories.regexPlaceholder')")
    b-input-group-append
      slot(name="input-group-append")
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue';
import { useCategoryStore } from '~/stores/categories';

export default defineComponent({
  name: 'SelectCategoriesOrPattern',
  emits: ['update:modelValue'],
  props: {
    filterCategories: {
      type: Array as PropType<string[][]>,
      default: () => [],
    },
  },
  data() {
    return {
      mode: 'categories',
      pattern: '',
      filterCategoriesData: this.filterCategories.map(path => [...path]),
    };
  },
  computed: {
    categories: function () {
      return useCategoryStore().classes;
    },

    categoriesWithRules() {
      if (this.mode === 'categories') {
        // Get the category and all subcategories. Match by structural path
        // prefix so a literal ">" inside a segment, or a coincidental
        // substring, cannot select the wrong category.
        return this.categories
          .filter(cat =>
            this.filterCategoriesData.some(
              path =>
                path.length > 0 &&
                path.length <= cat.name.length &&
                path.every((segment, index) => segment === cat.name[index])
            )
          )
          .filter(cat => cat.rule.type === 'regex')
          .map(cat => [cat.name, cat.rule]);
      } else if (this.mode === 'custom') {
        return [[['searched'], { type: 'regex', regex: this.pattern }]];
      } else {
        console.error('Unknown mode:', this.mode);
        return [];
      }
    },
  },
  watch: {
    filterCategories(paths: string[][]) {
      this.filterCategoriesData = paths.map(path => [...path]);
    },
    categoriesWithRules: {
      immediate: true,
      handler(rules) {
        this.$emit('update:modelValue', rules);
      },
    },
  },
  async mounted() {
    await useCategoryStore().load();
  },
});
</script>
