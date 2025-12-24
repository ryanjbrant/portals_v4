module.exports = {
    preset: 'react-native',
    setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    transformIgnorePatterns: [
        'node_modules/(?!(react-native|@react-native|@expo|expo-|@reactvision|react-redux|zustand)/)',
    ],
    testPathIgnorePatterns: ['/node_modules/', '/_ref/'],
    testMatch: ['**/__tests__/**/*.(spec|test).(ts|tsx|js)'],
    collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.d.ts',
        '!src/**/types.ts',
        '!src/**/__tests__/**',
    ],
    coverageThreshold: {
        global: {
            branches: 50,
            functions: 50,
            lines: 50,
            statements: 50,
        },
    },
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    testEnvironment: 'node',
    globals: {
        __DEV__: true,
    },
};
