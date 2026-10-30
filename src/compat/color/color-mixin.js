import tinycolor from 'tinycolor2';

function colorChange(data, oldHue) {
  const alpha = data && data.a;
  let color;

  if (data && data.hsl) color = tinycolor(data.hsl);
  else if (data && data.hex && data.hex.length > 0) color = tinycolor(data.hex);
  else if (data && data.hsv) color = tinycolor(data.hsv);
  else if (data && data.rgba) color = tinycolor(data.rgba);
  else if (data && data.rgb) color = tinycolor(data.rgb);
  else color = tinycolor(data);

  if (color && (color._a === undefined || color._a === null)) {
    color.setAlpha(alpha || 1);
  }

  const hsl = color.toHsl();
  const hsv = color.toHsv();

  if (hsl.s === 0) {
    hsv.h = hsl.h = data.h || (data.hsl && data.hsl.h) || oldHue || 0;
  }

  return {
    hsl,
    hex: color.toHexString().toUpperCase(),
    hex8: color.toHex8String().toUpperCase(),
    rgba: color.toRgb(),
    hsv,
    oldHue: data.h || oldHue || hsl.h,
    source: data.source,
    a: data.a || color.getAlpha(),
  };
}

export default {
  props: ['value'],
  data() {
    return {
      val: colorChange(this.value),
    };
  },
  computed: {
    colors: {
      get() {
        return this.val;
      },
      set(newVal) {
        this.val = newVal;
        this.$emit('input', newVal);
      },
    },
  },
  watch: {
    value(newVal) {
      this.val = colorChange(newVal);
    },
  },
  methods: {
    colorChange(data, oldHue) {
      this.oldHue = this.colors.hsl.h;
      this.colors = colorChange(data, oldHue || this.oldHue);
    },
    isValidHex(hex) {
      return tinycolor(hex).isValid();
    },
    simpleCheckForValidColor(data) {
      const keysToCheck = ['r', 'g', 'b', 'a', 'h', 's', 'l', 'v'];
      let checked = 0;
      let passed = 0;
      for (let i = 0; i < keysToCheck.length; i++) {
        const letter = keysToCheck[i];
        if (data[letter]) {
          checked++;
          if (!isNaN(data[letter])) passed++;
        }
      }
      if (checked === passed) return data;
    },
    paletteUpperCase(palette) {
      return palette.map((c) => c.toUpperCase());
    },
    isTransparent(color) {
      return tinycolor(color).getAlpha() === 0;
    },
  },
};
