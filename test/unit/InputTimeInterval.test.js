import moment from 'moment';
import { mount } from '@vue/test-utils';
import i18nInstance from '~/i18n';
import { installBootstrapVue } from '~/compat/bootstrap-vue';
import InputTimeInterval from '~/components/InputTimeInterval.vue';
import { wallTimeInstants } from '~/util/timeperiod';

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

describe('可选精确时间（allowTime）', () => {
  test('默认真实日期输入仍按包含结束日处理', () => {
    const wrapper = create();
    wrapper.vm.start = '2026-06-10';
    wrapper.vm.end = '2026-06-11';
    expect(wrapper.vm.hasTime).toBe(false);
    expect(wrapper.findAll('input[type="time"]')).toHaveLength(0);
    expect(wrapper.vm.dateRange[1].format('YYYY-MM-DD HH:mm')).toBe('2026-06-12 00:00');
    wrapper.unmount();
  });

  test('allowTime 时提供开始/结束时间输入，并按墙钟时间计算精确区间', async () => {
    const wrapper = create({ allowTime: true });
    wrapper.vm.mode = 'range';
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll('input[type="time"]')).toHaveLength(2);
    wrapper.vm.start = '2026-06-10';
    wrapper.vm.end = '2026-06-11';
    wrapper.vm.startTime = '09:30';
    wrapper.vm.endTime = '11:45';
    expect(wrapper.vm.hasTime).toBe(true);
    expect(wrapper.vm.dateRange[0].format('YYYY-MM-DD HH:mm')).toBe('2026-06-10 09:30');
    expect(wrapper.vm.dateRange[1].format('YYYY-MM-DD HH:mm')).toBe('2026-06-11 11:45');
    wrapper.unmount();
  });

  test('只填开始时间时结束日仍包含整天', () => {
    const wrapper = create({ allowTime: true });
    wrapper.vm.start = '2026-06-10';
    wrapper.vm.end = '2026-06-11';
    wrapper.vm.startTime = '09:30';
    expect(wrapper.vm.hasTime).toBe(true);
    expect(wrapper.vm.dateRange[0].format('YYYY-MM-DD HH:mm')).toBe('2026-06-10 09:30');
    expect(wrapper.vm.dateRange[1].format('YYYY-MM-DD HH:mm')).toBe('2026-06-12 00:00');
    wrapper.unmount();
  });

  test('结束时间早于开始时间时判为无效范围', () => {
    const wrapper = create({ allowTime: true });
    wrapper.vm.start = '2026-06-10';
    wrapper.vm.end = '2026-06-10';
    wrapper.vm.startTime = '18:00';
    wrapper.vm.endTime = '09:00';
    expect(wrapper.vm.invalidDaterange).toBe(true);
    wrapper.unmount();
  });

  test('开始与结束时间相同时判为无效范围', () => {
    const wrapper = create({ allowTime: true });
    wrapper.vm.start = '2026-06-10';
    wrapper.vm.end = '2026-06-10';
    wrapper.vm.startTime = '09:30';
    wrapper.vm.endTime = '09:30';
    expect(wrapper.vm.invalidDaterange).toBe(true);
    wrapper.unmount();
  });
});

describe('wallTimeInstants', () => {
  test('普通本地墙钟时间映射到一个 instant', () => {
    const instants = wallTimeInstants('2026-01-01T12:00');
    expect(instants).toHaveLength(1);
    expect(instants[0].getFullYear()).toBe(2026);
    expect(instants[0].getMonth()).toBe(0);
    expect(instants[0].getDate()).toBe(1);
    expect(instants[0].getHours()).toBe(12);
    expect(instants[0].getMinutes()).toBe(0);
  });

  test('不存在的日期或时间返回空数组', () => {
    expect(wallTimeInstants('2026-02-30T12:00')).toEqual([]);
    expect(wallTimeInstants('2026-01-01T24:00')).toEqual([]);
    expect(wallTimeInstants('2026-01-01T12:60')).toEqual([]);
    expect(wallTimeInstants('not-a-time')).toEqual([]);
  });
});

