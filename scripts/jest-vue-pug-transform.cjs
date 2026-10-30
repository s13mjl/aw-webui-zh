// Jest transformer: @vue/vue3-jest does not preprocess `lang="pug"` templates
// (the Vue 2 jest runner did). Render pug to plain HTML first, then delegate.
const pug = require('pug');
const vue3Jest = require('@vue/vue3-jest');

module.exports = {
  process(src, filename, options) {
    let source = src;
    try {
      const { parse, compileScript } = require('@vue/compiler-sfc');
      const { descriptor } = parse(source, { filename });
      const template = descriptor.template;
      if (template && (template.lang === 'pug' || template.lang === 'jade')) {
        const html = pug.render(template.content, {
          filename,
          doctype: 'html',
          basedir: require('path').dirname(filename),
        });
        const start = source.indexOf(template.content);
        if (start !== -1) {
          source =
            source.slice(0, start) +
            html +
            source.slice(start + template.content.length);
          source = source.replace(
            /<template lang=["'](?:pug|jade)["']>/,
            '<template>'
          );
        }
      }
    } catch (e) {
      // Let vue3-jest surface compilation errors for non-pug problems.
    }
    return vue3Jest.process(source, filename, options);
  },
};
