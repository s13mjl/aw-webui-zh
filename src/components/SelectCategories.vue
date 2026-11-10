<template lang="pug">
// Based on https://bootstrap-vue.org/docs/components/form-tags#using-custom-form-components
b-form-tags#tags-component-select(
  v-model="selectedTags"
  add-on-change
  no-outer-focus
)
  template(v-slot="{ tags, inputAttrs, inputHandlers, disabled, removeTag }")
    b-form-select(
      v-bind="inputAttrs"
      v-on="inputHandlers"
      :disabled="disabled || options.length === 0"
      :options="options"
    )
      template(#first)
        // This is required to prevent bugs with Safari
        option(disabled value="") {{ $t('selectCategories.chooseTag') }}
    ul.list-inline.d-inline-block.my-2(v-if="tags.length > 0")
      li.list-inline-item(v-for="tag in tags" :key="tag")
        b-form-tag(
          @remove="removeTag(tag)"
          :title="tagLabel(tag)"
          :disabled="disabled"
          variant="info"
        )
          | {{ tagLabel(tag) }}
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue';
import { useCategoryStore } from '~/stores/categories';
import { categoryPathLabel } from '~/util/categoryLabels';

const SEP = ' > ';

export default defineComponent({
  emits: ['update:modelValue'],
  props: {
    // 类别以结构化路径（字符串数组）表示，而不是拼接后的显示文本。
    modelValue: {
      type: Array as PropType<string[][]>,
      default: () => [],
    },
  },

  computed: {
    // Bootstrap tags 只接受字符串：序列化完整路径，绝不使用显示标签，
    // 这样即使某个分段本身含有分隔符也能无损往返。
    selectedTags: {
      get(): string[] {
        return this.modelValue.map(path => JSON.stringify(path));
      },
      set(tags: string[]) {
        this.$emit(
          'update:modelValue',
          tags.map(tag => JSON.parse(tag))
        );
      },
    },
    options() {
      return useCategoryStore().classes.map(category => ({
        value: JSON.stringify(category.name),
        text: categoryPathLabel(category.name, SEP),
      }));
    },
  },

  methods: {
    tagLabel(tag: string): string {
      return categoryPathLabel(JSON.parse(tag), SEP);
    },
  },
});
</script>
