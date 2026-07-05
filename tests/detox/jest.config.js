/** @type {import('jest').Config} */
module.exports = {
  rootDir: '../..',
  testMatch: ['<rootDir>/tests/detox/e2e/**/*.test.{js,ts}'],
  testTimeout: 120_000,
  maxWorkers: 1,
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: ['detox/runners/jest/reporter'],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  setupFiles: ['<rootDir>/tests/detox/setup-env.js'],
  // Transform .ts test files via babel — same chain the app uses for
  // its existing jest tests (jest-expo preset wraps babel-jest).
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }],
  },
  // expo/virtual/env.js is shipped as ESM and supabase-js pulls it in.
  // Default node_modules ignore breaks the import; allow Babel to
  // transform expo virtual modules.
  transformIgnorePatterns: [
    'node_modules/(?!(expo|@expo|@supabase)/)',
  ],
  verbose: true,
}
