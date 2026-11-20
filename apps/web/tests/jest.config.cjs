module.exports = {
  rootDir: '..',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.tsx'],
  transform: {
    '^.+\\.tsx?$': ['<rootDir>/tests/ts-jest-transformer.cjs', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js'],
}
