// Tests can be added in the aw-webui/test folder
// File names that end with .test.js will be run in the jsdom testEnvironment
// File names that end with .test.node.js will be run in the node testEnvironment

module.exports = {
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.{js,ts}'],
  projects: [
    {
      displayName: 'jsdom',
      testEnvironment: 'jsdom',
      transform: {
        '^.+\\.js$': 'babel-jest',
        '^.+\\.ts$': 'ts-jest',
        '^.+\\.vue$': '<rootDir>/scripts/jest-vue-pug-transform.cjs',
      },
      transformIgnorePatterns: ['/node_modules/(?!(vue-i18n|@intlify|@vue|vue|pinia|@pinia|@fullcalendar|vue-demi)/)'],
      testMatch: ['**/test/**/*.test.js?(x)'],
      setupFiles: ['<rootDir>/test/setupI18n.ts'],
      moduleNameMapper: {
        '^~/(.+)$': '<rootDir>/src/$1',
        '^d3$': '<rootDir>/node_modules/d3/dist/d3.min.js',
        '^d3-scale$': '<rootDir>/node_modules/d3/dist/d3.min.js',
        '^d3-scale-chromatic$': '<rootDir>/node_modules/d3/dist/d3.min.js',
        '^d3-hierarchy$': '<rootDir>/node_modules/d3/dist/d3.min.js',
        '^d3-shape$': '<rootDir>/node_modules/d3/dist/d3.min.js',
        '^d3-interpolate$': '<rootDir>/node_modules/d3/dist/d3.min.js',
        '^d3-selection$': '<rootDir>/node_modules/d3/dist/d3.min.js',
        '^d3-transition$': '<rootDir>/node_modules/d3/dist/d3.min.js',
      },
      moduleFileExtensions: ['js', 'ts', 'vue', 'json'],
      modulePathIgnorePatterns: ['test/e2e/screenshot.test.js'], // Don't run this file in npm test
    },
    {
      displayName: 'node',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['**/test/**/*.test.node.{js,ts}?(x)'],
      transform: {
        '^.+\\.js$': 'babel-jest',
        '^.+\\.ts$': 'ts-jest',
        '^.+\\.vue$': '<rootDir>/scripts/jest-vue-pug-transform.cjs',
      },
      transformIgnorePatterns: ['/node_modules/(?!(vue-i18n|@intlify|@vue|vue|pinia|@pinia|@fullcalendar|vue-demi)/)'],
      setupFiles: ['<rootDir>/test/setupI18n.ts'],
      moduleNameMapper: {
        '^~/(.+)$': '<rootDir>/src/$1',
        '^d3$': '<rootDir>/node_modules/d3/dist/d3.min',
        '^d3-scale$': '<rootDir>/node_modules/d3/dist/d3.min',
        '^d3-scale-chromatic$': '<rootDir>/node_modules/d3/dist/d3.min',
        '^d3-hierarchy$': '<rootDir>/node_modules/d3/dist/d3.min',
        '^d3-shape$': '<rootDir>/node_modules/d3/dist/d3.min',
        '^d3-interpolate$': '<rootDir>/node_modules/d3/dist/d3.min',
        '^d3-selection$': '<rootDir>/node_modules/d3/dist/d3.min',
        '^d3-transition$': '<rootDir>/node_modules/d3/dist/d3.min',
      },
    },
  ],
};
