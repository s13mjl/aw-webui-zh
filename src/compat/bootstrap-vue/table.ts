import { defineComponent, h, ref, computed, PropType } from 'vue';

interface TableField {
  key: string;
  label?: string;
  sortable?: boolean;
  thClass?: any;
  tdClass?: any;
  class?: any;
  thStyle?: any;
  tdStyle?: any;
  sortKey?: string;
  formatter?: (value: any, key: string, item: any) => any;
}

function normalizeFields(fields: any[] | undefined, items: any[]): TableField[] {
  if (fields && fields.length > 0) {
    return fields.map((field) =>
      typeof field === 'string'
        ? { key: field, label: field.replace(/([_-])/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }
        : { ...field, key: field.key }
    );
  }
  const keys = new Set<string>();
  items.forEach((item) => {
    if (item && typeof item === 'object') Object.keys(item).forEach((k) => keys.add(k));
  });
  return Array.from(keys).map((key) => ({ key, label: key }));
}

function compare(a: any, b: any): number {
  if (a === b) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (Array.isArray(a) || Array.isArray(b)) return String(a).localeCompare(String(b));
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

export const BTable = defineComponent({
  name: 'BTable',
  props: {
    items: { type: Array as PropType<any[]>, default: () => [] },
    fields: { type: Array as PropType<any[]>, default: undefined },
    small: { type: Boolean, default: false },
    hover: { type: Boolean, default: false },
    striped: { type: Boolean, default: false },
    bordered: { type: Boolean, default: false },
    borderless: { type: Boolean, default: false },
    outlined: { type: Boolean, default: false },
    dark: { type: Boolean, default: false },
    responsive: { type: [Boolean, String] as PropType<any>, default: false },
    fixed: { type: Boolean, default: false },
    emptyText: { type: String, default: 'There are no records to show' },
    showEmpty: { type: Boolean, default: false },
    sortBy: { type: String, default: undefined },
    sortDesc: { type: Boolean, default: false },
    sortDirection: { type: String, default: 'asc' },
    noSortReset: { type: Boolean, default: false },
    id: { type: String, default: undefined },
    theadClass: { type: [String, Array, Object] as PropType<any>, default: undefined },
    tbodyClass: { type: [String, Array, Object] as PropType<any>, default: undefined },
  },
  emits: ['head-clicked', 'row-clicked', 'sort-changed'],
  setup(props, { slots, emit }) {
    const localSortBy = ref(props.sortBy || '');
    const localSortDesc = ref(!!props.sortDesc);

    const computedFields = computed(() => normalizeFields(props.fields, props.items));

    const computedItems = computed(() => {
      const items = props.items ? props.items.slice() : [];
      if (!localSortBy.value) return items;
      const field = computedFields.value.find(
        (f) => (f.sortKey || f.key) === localSortBy.value
      );
      if (!field) return items;
      const key = field.sortKey || field.key;
      const sorted = items.slice().sort((a, b) => compare(a?.[key], b?.[key]));
      return localSortDesc.value ? sorted.reverse() : sorted;
    });

    const headClicked = (field: TableField) => {
      if (!field.sortable) return;
      const key = field.sortKey || field.key;
      if (localSortBy.value !== key) {
        localSortBy.value = key;
        localSortDesc.value = false;
      } else if (!localSortDesc.value) {
        localSortDesc.value = true;
      } else if (props.noSortReset) {
        localSortDesc.value = false;
      } else {
        localSortBy.value = '';
        localSortDesc.value = false;
      }
      emit('sort-changed', { sortBy: localSortBy.value, sortDesc: localSortDesc.value });
    };

    const getValue = (item: any, field: TableField) => {
      const key = field.sortKey || field.key;
      const value = item ? item[key] : undefined;
      return field.formatter ? field.formatter(value, key, item) : value;
    };

    const tableClass = computed(() => [
      {
        'table-striped': props.striped,
        'table-hover': props.hover && computedItems.value.length > 0,
        'table-dark': props.dark,
        'table-bordered': props.bordered,
        'table-borderless': props.borderless,
        'table-sm': props.small,
        border: props.outlined,
        'b-table-fixed': props.fixed,
      },
    ]);

    return () => {
      const fields = computedFields.value;
      const items = computedItems.value;
      const headCells = fields.map((field) => {
        const key = field.sortKey || field.key;
        const ariaSort = field.sortable
          ? localSortBy.value === key
            ? localSortDesc.value
              ? 'descending'
              : 'ascending'
            : 'none'
          : undefined;
        return h(
          'th',
          {
            scope: 'col',
            'aria-sort': ariaSort,
            style: field.thStyle,
            class: [field.class, field.thClass],
            onClick: () => {
              if (field.sortable) headClicked(field);
              emit('head-clicked', key, field);
            },
          },
          field.label != null ? String(field.label) : null
        );
      });

      const rows = items.map((item, index) => {
        const cells = fields.map((field) => {
          const key = field.key;
          const slot = slots[`cell(${key})`];
          const value = getValue(item, field);
          return h(
            'td',
            { class: [field.class, field.tdClass], style: field.tdStyle },
            slot ? slot({ item, value, index, field }) : value != null ? String(value) : ''
          );
        });
        return h(
          'tr',
          {
            onClick: () => emit('row-clicked', item, index),
          },
          cells
        );
      });

      if (items.length === 0 && props.showEmpty) {
        rows.push(
          h('tr', { class: 'b-table-empty-row' }, [
            h('td', { colspan: fields.length || null }, [
              h(
                'div',
                { class: ['text-center', 'my-2'], role: 'alert', 'aria-live': 'polite' },
                slots.empty ? slots.empty() : props.emptyText
              ),
            ]),
          ])
        );
      }

      const table = h(
        'table',
        { id: props.id, class: ['table', 'b-table', tableClass.value] },
        [
          h('thead', { class: props.theadClass }, [h('tr', null, headCells)]),
          h('tbody', { class: props.tbodyClass }, rows),
        ]
      );

      if (props.responsive) {
        return h(
          'div',
          { class: props.responsive === true ? 'table-responsive' : `table-responsive-${props.responsive}` },
          [table]
        );
      }
      return table;
    };
  },
});
