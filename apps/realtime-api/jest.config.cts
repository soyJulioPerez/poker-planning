module.exports = {
  displayName: 'realtime-api',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/realtime-api',
  // El testMatch por default de @nx/jest/preset matchea cualquier *.spec.ts, incluidos
  // los de integracion — sin esto, este target rapido intentaria correrlos tambien y
  // fallaria sin DynamoDB Local. Ver jest.integration.config.cts.
  testPathIgnorePatterns: ['/node_modules/', '\\.integration\\.spec\\.ts$'],
  coverageReporters: ['html', 'text-summary'],
  coverageThreshold: {
    global: {
      statements: 86,
      branches: 76,
      functions: 95,
      lines: 86,
    },
  },
};
