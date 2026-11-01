import { deviceHostnames, preferKnownHostnames } from '~/util/hostnames';

describe('preferKnownHostnames', () => {
  test('moves unknown to the end when a known host exists', () => {
    expect(preferKnownHostnames(['unknown', 'laptop_ori'])).toEqual(['laptop_ori', 'unknown']);
  });

  test('preserves the original order for known hosts', () => {
    expect(preferKnownHostnames(['desktop', 'laptop', 'unknown'])).toEqual([
      'desktop',
      'laptop',
      'unknown',
    ]);
  });

  test('keeps unknown when it is the only host', () => {
    expect(preferKnownHostnames(['unknown'])).toEqual(['unknown']);
  });
});

describe('deviceHostnames', () => {
  test('drops the unknown pseudo-host when a real host exists', () => {
    expect(deviceHostnames(['laptop', 'unknown'])).toEqual(['laptop']);
    expect(deviceHostnames(['unknown', 'desktop', 'laptop'])).toEqual(['desktop', 'laptop']);
  });

  test('keeps unknown when it is the only host', () => {
    expect(deviceHostnames(['unknown'])).toEqual(['unknown']);
  });

  test('returns an empty list when there are no hosts', () => {
    expect(deviceHostnames([])).toEqual([]);
  });
});
