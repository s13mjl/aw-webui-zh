import { mount } from '@vue/test-utils';
import TimelineEventList from '~/visualizations/TimelineEventList.vue';
import i18nInstance from '~/i18n';

function windowBucket(id, count, offset = 0) {
  return {
    id,
    hostname: 'host-a',
    type: 'currentwindow',
    events: Array.from({ length: count }, (_, i) => ({
      timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, i + offset)).toISOString(),
      duration: 90,
      data: { app: `app${i}`, title: `title${i}` },
    })),
  };
}

function mountList(buckets, range = null) {
  return mount(TimelineEventList, {
    props: { buckets, range },
    global: {
      plugins: [i18nInstance],
      stubs: {
        'b-button': {
          inheritAttrs: false,
          template: '<button :class="$attrs.class" @click="$emit(\'click\')"><slot /></button>',
        },
      },
    },
  });
}

describe('TimelineEventList', () => {
  test('展示开始、结束、时长、存储桶/主机和标题', () => {
    const wrapper = mountList([windowBucket('aw-watcher-window_host-a', 1)]);
    const cells = wrapper.findAll('tbody tr').at(0).findAll('td');
    expect(cells.at(0).text()).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(cells.at(1).text()).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(cells.at(2).text()).toBe('1m 30s');
    expect(cells.at(3).text()).toContain('aw-watcher-window_host-a');
    expect(cells.at(3).text()).toContain('(host-a)');
    expect(cells.at(4).text()).toBe('app0 — title0');
    wrapper.unmount();
  });

  test('标记触及查询范围边界的行', () => {
    const wrapper = mountList(
      [windowBucket('w', 1)],
      ['2026-01-01T00:00:00Z', '2026-01-01T00:01:00Z']
    );
    const cells = wrapper.findAll('tbody tr').at(0).findAll('td');
    expect(cells.at(0).text().startsWith('≤ ')).toBe(true);
    expect(cells.at(1).text().startsWith('≥ ')).toBe(true);
    expect(cells.at(2).text()).toBe('≥ 1m 30s');
    wrapper.unmount();
  });

  test('超过 100 行时逐页展开，全部显示后按钮消失', async () => {
    const wrapper = mountList([windowBucket('w', 250)]);
    expect(wrapper.findAll('tbody tr')).toHaveLength(100);
    await wrapper.find('button').trigger('click');
    expect(wrapper.findAll('tbody tr')).toHaveLength(200);
    await wrapper.find('button').trigger('click');
    expect(wrapper.findAll('tbody tr')).toHaveLength(250);
    expect(wrapper.find('button').exists()).toBe(false);
    wrapper.unmount();
  });

  test('筛选后的桶变化时回到第一页', async () => {
    const wrapper = mountList([windowBucket('w', 250)]);
    await wrapper.find('button').trigger('click');
    expect(wrapper.findAll('tbody tr')).toHaveLength(200);
    await wrapper.setProps({ buckets: [windowBucket('w', 150)] });
    expect(wrapper.findAll('tbody tr')).toHaveLength(100);
    wrapper.unmount();
  });
});
