import type { App } from 'vue';
import { BAlert } from './alert';
import { BButton, BButtonClose, BButtonGroup } from './button';
import {
  BInputGroup,
  BInputGroupAppend,
  BInputGroupPrepend,
  BInputGroupText,
} from './input-group';
import {
  BForm,
  BFormCheckbox,
  BFormGroup,
  BFormInput,
  BFormRadioGroup,
  BFormSelect,
  BFormSelectOption,
  BFormTextarea,
} from './form-controls';
import {
  BFormDatepicker,
  BFormFile,
  BFormTag,
  BFormTags,
} from './form-extras';
import {
  BDropdown,
  BDropdownDivider,
  BDropdownHeader,
  BDropdownItem,
  BDropdownItemButton,
} from './dropdown';
import { BNav, BNavItem, BNavItemDropdown } from './nav';
import {
  BCollapse,
  BNavbar,
  BNavbarBrand,
  BNavbarNav,
  BNavbarToggle,
} from './navbar';
import { BModal, registerBModalDirective } from './modal';
import { BTable } from './table';
import { BPopover, BTooltip } from './tooltip';
import { BBadge, BCard, BCardGroup, BCol, BRow, BSpinner } from './layout';

export * from './modal';

const components: Record<string, any> = {
  BAlert,
  BButton,
  BButtonClose,
  BButtonGroup,
  BBadge,
  BCard,
  BCardGroup,
  BCol,
  BRow,
  BSpinner,
  BInputGroup,
  BInputGroupAppend,
  BInputGroupPrepend,
  BInputGroupText,
  BForm,
  BFormGroup,
  BFormInput,
  BFormTextarea,
  BFormSelect,
  BFormSelectOption,
  BFormCheckbox,
  BFormRadioGroup,
  BFormFile,
  BFormTags,
  BFormTag,
  BFormDatepicker,
  BDropdown,
  BDropdownItem,
  BDropdownItemButton,
  BDropdownHeader,
  BDropdownDivider,
  BNav,
  BNavItem,
  BNavItemDropdown,
  BNavbar,
  BNavbarNav,
  BNavbarBrand,
  BNavbarToggle,
  BCollapse,
  BModal,
  BTable,
  BTooltip,
  BPopover,
};

const aliases: Record<string, string> = {
  'b-alert': 'BAlert',
  'b-button': 'BButton',
  'b-btn': 'BButton',
  'b-button-close': 'BButtonClose',
  'b-button-group': 'BButtonGroup',
  'b-badge': 'BBadge',
  'b-card': 'BCard',
  'b-card-group': 'BCardGroup',
  'b-col': 'BCol',
  'b-row': 'BRow',
  'b-spinner': 'BSpinner',
  'b-input-group': 'BInputGroup',
  'b-input-group-append': 'BInputGroupAppend',
  'b-input-group-prepend': 'BInputGroupPrepend',
  'b-input-group-text': 'BInputGroupText',
  'b-form': 'BForm',
  'b-form-group': 'BFormGroup',
  'b-form-input': 'BFormInput',
  'b-input': 'BFormInput',
  'b-form-textarea': 'BFormTextarea',
  'b-form-select': 'BFormSelect',
  'b-select': 'BFormSelect',
  'b-form-select-option': 'BFormSelectOption',
  'b-select-option': 'BFormSelectOption',
  'b-form-checkbox': 'BFormCheckbox',
  'b-checkbox': 'BFormCheckbox',
  'b-form-radio-group': 'BFormRadioGroup',
  'b-form-file': 'BFormFile',
  'b-form-tags': 'BFormTags',
  'b-form-tag': 'BFormTag',
  'b-form-datepicker': 'BFormDatepicker',
  'b-dropdown': 'BDropdown',
  'b-dropdown-item': 'BDropdownItem',
  'b-dropdown-item-button': 'BDropdownItemButton',
  'b-dropdown-header': 'BDropdownHeader',
  'b-dropdown-divider': 'BDropdownDivider',
  'b-nav': 'BNav',
  'b-nav-item': 'BNavItem',
  'b-nav-item-dropdown': 'BNavItemDropdown',
  'b-navbar': 'BNavbar',
  'b-navbar-nav': 'BNavbarNav',
  'b-navbar-brand': 'BNavbarBrand',
  'b-navbar-toggle': 'BNavbarToggle',
  'b-collapse': 'BCollapse',
  'b-modal': 'BModal',
  'b-table': 'BTable',
  'b-tooltip': 'BTooltip',
  'b-popover': 'BPopover',
};

export function installBootstrapVue(app: App): void {
  for (const [name, component] of Object.entries(components)) {
    app.component(name, component);
  }
  for (const [name, componentName] of Object.entries(aliases)) {
    app.component(name, components[componentName]);
  }
  registerBModalDirective(app);
}
