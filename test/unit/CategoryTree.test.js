import { shallowMount } from '@vue/test-utils';
import CategoryTree from '~/visualizations/CategoryTree.vue';
import i18nInstance from '~/i18n';
import { installBootstrapVue } from '~/compat/bootstrap-vue';

// 同步上游 #1220：结构化路径的展开状态按数组识别，显示名相撞互不影响。
const event = (name, duration) => ({
  timestamp: '2026-01-01T00:00:00Z',
  duration,
  data: { $category: name },
});

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
};

describe('CategoryTree 结构化层级', () => {
  let wrapper;

  const render = async events => {
    wrapper = shallowMount(CategoryTree, {
      props: { events },
      global: {
        plugins: [i18nInstance, { install: installBootstrapVue }],
        mocks: { $t: key => key, $filters: { friendlyduration: value => `${value}s` } },
        stubs: { icon: true, 'b-checkbox': true },
      },
    });
    await flush();
    return wrapper;
  };

  const rows = () => wrapper.findAll('.category-row');
  const row = title => rows().find(r => r.find('.category-title').text() === title);
  const titles = () => rows().map(r => r.find('.category-title').text());
  const icon = title => row(title).find('icon-stub').attributes('name');

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
  });

  test('包含隐式父级、汇总时长且保留可读标签与原始输入', async () => {
    const events = [event(['Work>Code'], 60), event(['Work', 'Code', 'Review'], 120)];
    const before = JSON.parse(JSON.stringify(events));
    await render(events);

    expect(wrapper.vm.total_duration).toBe(180);
    expect(titles()).toEqual(['Work', 'Work>Code']);
    expect(row('Work').find('.category-value').text()).toBe('120s');
    await row('Work').trigger('click');
    await flush();
    await row('Code').trigger('click');
    await flush();
    expect(titles()).toEqual(['Work', 'Code', 'Review', 'Work>Code']);
    expect(events).toEqual(before);
  });

  test('平铺与嵌套同显示名路径各自独立展开', async () => {
    await render([
      event(['Work'], 1),
      event(['Work', 'Code'], 2),
      event(['Work', 'Code', 'Child'], 3),
      event(['Work>Code'], 4),
      event(['Work>Code', 'Flat child'], 5),
    ]);
    await row('Work').trigger('click');
    await flush();
    expect(icon('Code')).toBe('regular/plus-square');
    await row('Work>Code').trigger('click');
    await flush();
    expect(titles()).toContain('Flat child');
    expect(titles()).not.toContain('Child');
    expect(icon('Work>Code')).toBe('regular/minus-square');
    expect(icon('Code')).toBe('regular/plus-square');

    await row('Code').trigger('click');
    await flush();
    expect(titles()).toContain('Child');
    expect(icon('Code')).toBe('regular/minus-square');
    await row('Work>Code').trigger('click');
    await flush();
    expect(titles()).not.toContain('Flat child');
    expect(titles()).toContain('Child');
    expect(icon('Code')).toBe('regular/minus-square');

    await row('Work').trigger('click');
    await flush();
    expect(titles()).not.toContain('Code');
    expect(titles()).not.toContain('Child');
    await row('Work').trigger('click');
    await flush();
    expect(titles()).toContain('Child');
    expect(titles()).not.toContain('Flat child');
  });

  test('重复分类事件只计一次而不产生重复行', async () => {
    await render([
      event(['Work'], 10),
      event(['Work'], 20),
      event(['Work', 'Code'], 30),
      event(['Work', 'Code'], 40),
      event(['Leisure'], 50),
    ]);
    expect(wrapper.vm.total_duration).toBe(150);
    expect(titles()).toEqual(['Work', 'Leisure']);
    expect(wrapper.vm.category_hierarchy.map(c => c.name)).toEqual([
      ['Work'],
      ['Work', 'Code'],
      ['Leisure'],
    ]);
  });

  test('事件更新后结构上相同的展开状态保持不变', async () => {
    await render([event(['Work', 'Code'], 10), event(['Leisure'], 20)]);
    await row('Work').trigger('click');
    await flush();
    await wrapper.setProps({
      events: [event(['Work', 'Code'], 30), event(['Leisure'], 5)],
    });
    await flush();
    expect(wrapper.vm.total_duration).toBe(35);
    expect(titles()).toEqual(['Work', 'Code', 'Leisure']);
    expect(icon('Work')).toBe('regular/minus-square');
  });
});
