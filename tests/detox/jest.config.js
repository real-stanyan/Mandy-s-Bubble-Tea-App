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
  // Transform .ts test files via babel — same chain the app uses for
  // its existing jest tests (jest-expo preset wraps babel-jest).
  transform: {
    '^.+\\.tsx?$': ['babel-jest', { presets: ['babel-preset-expo'] }],
  },
  verbose: true,
}
