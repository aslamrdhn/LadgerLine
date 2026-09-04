export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/?(*.)+(spec|test).[tj]s?(x)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^(\\.{1,2}/.*)\\.ts$': '$1',
  },
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'server/**/*.ts',
    '!src/**/*.d.ts',
  ],
  setupFiles: ['<rootDir>/tests/setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts']
};
