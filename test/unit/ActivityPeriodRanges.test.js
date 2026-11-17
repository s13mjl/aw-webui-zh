import { setActivePinia, createPinia } from 'pinia';
import { i18n } from '~/i18n';
import Activity from '~/views/activity/Activity.vue';
import { useSettingsStore } from '~/stores/settings';

// 上游 #1003：年度时间范围不再受 showYearly 设置控制，默认设置下即渲染。
describe('Activity 时间范围选项', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test('默认设置下 periodLengths 始终包含 year 选项', () => {
    const settingsStore = useSettingsStore();
    expect('showYearly' in settingsStore.$state).toBe(false);

    const vm = {
      $t: key => i18n.t(key),
    };
    const periods = Activity.computed.periodLengths.call(vm);

    expect(Object.keys(periods)).toEqual(
      expect.arrayContaining(['day', 'week', 'month', 'year', 'last7d', 'last30d'])
    );
    expect(periods.year).toBe(i18n.t('activity.periodYear'));
  });
});
