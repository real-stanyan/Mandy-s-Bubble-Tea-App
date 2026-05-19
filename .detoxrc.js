/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'tests/detox/jest.config.js',
    },
    jest: { setupTimeout: 120000 },
  },
  apps: {
    'ios.sim.debug': {
      type: 'ios.app',
      binaryPath:
        'ios/build/Build/Products/Debug-iphonesimulator/mandysbubbleteaapp.app',
      build:
        'xcodebuild -workspace ios/mandysbubbleteaapp.xcworkspace -scheme mandysbubbleteaapp -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build -quiet',
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: { type: 'iPhone 17 Pro' },
    },
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.sim.debug',
    },
  },
}
