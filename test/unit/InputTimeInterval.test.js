import moment from 'moment';
import { mount } from '@vue/test-utils';
import i18nInstance from '~/i18n';
import { installBootstrapVue } from '~/compat/bootstrap-vue';
import InputTimeInterval from '~/components/InputTimeInterval.vue';

const bootstrapVue = { install: installBootstrapVue };

function create(props = {}) {
  return mount(InputTimeInterval, {
    props: { defaultDuration: 3600, maxDuration: null, ...props },
    global: {
      plugins: [i18nInstance, bootstrapVue],
      config: { globalProperties: { $filters: { friendlytime: () => 'now' } } },
      stubs: { icon: true },
    },
  });
}

function lastRange(wrapper) {
  return wrapper.emitted('update:modelValue').slice(-1)[0][0];
}

afterEach(() => jest.useRealTimers());

describe('范围边界校验', () => {
  test.each([
    ['2026-01-01', '2026-01-31', 31 * 86400, false],
    ['2026-01-01', '2026-02-01', 31 * 86400, true],
    ['2026-01-01', '2026-01-01', 86400, false],
    ['2026-01-01', '', 86400, false],
    ['2026-01-01', '', 3600, true],
    ['2026-01-01', '2026-02-01', null, false],
    ['', '', 3600, false],
  ])('按包含的结束日计算经过秒数：%s ~ %s（上限 %s）', (start, end, maxDuration, tooLong) => {
    const wrapper = create({ maxDuration });
    wrapper.vm.start = start;
    wrapper.vm.end = end;
    expect(wrapper.vm.daterangeTooLong).toBe(tooLong);
    if (start) {
      expect(wrapper.vm.dateRange[1].diff(wrapper.vm.dateRange[0], 'seconds', true)).toBe(
        end ? moment(end).add(1, 'day').diff(moment(start), 'seconds', true) : 86400
      );
    }
    wrapper.unmount();
  });
});

describe('相对时长保留', () => {
  test('切换到日期范围并应用后仍保留已选相对时长', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 29, 12));
    const wrapper = create({ defaultDuration: 7200 });
    // 重新选择相对时长（而非仅依赖默认值）
    await wrapper.find('input#dur3').setChecked();
    const [relativeStart, relativeEnd] = lastRange(wrapper);
    expect(relativeEnd.diff(relativeStart, 'seconds', true)).toBe(7200);

    wrapper.vm.start = '2026-10-27';
    wrapper.vm.end = '2026-10-28';
    wrapper.vm.mode = 'range';
    wrapper.vm.applyRange();
    const [rangeStart, rangeEnd] = lastRange(wrapper);
    expect(rangeStart.format('YYYY-MM-DD')).toBe('2026-10-27');
    expect(rangeEnd.format('YYYY-MM-DD')).toBe('2026-10-29');

    wrapper.vm.mode = 'last_duration';
    wrapper.vm.refresh();
    const [againStart, againEnd] = lastRange(wrapper);
    expect(againEnd.diff(againStart, 'seconds', true)).toBe(7200);
    expect(againEnd.valueOf()).toBe(Date.now());
    wrapper.unmount();
  });
});
