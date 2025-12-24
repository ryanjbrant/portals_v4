/**
 * Jest Setup
 * Configure testing environment for React Native
 */

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
    setItem: jest.fn(() => Promise.resolve()),
    getItem: jest.fn(() => Promise.resolve(null)),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
    getAllKeys: jest.fn(() => Promise.resolve([])),
    multiGet: jest.fn(() => Promise.resolve([])),
    multiSet: jest.fn(() => Promise.resolve()),
    multiRemove: jest.fn(() => Promise.resolve()),
}));

// Mock Firebase
jest.mock('./src/config/firebase', () => ({
    app: {},
    auth: {},
    db: {},
    storage: {},
    analytics: null,
    vertexAI: {},
}));

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
    cacheDirectory: '/mock/cache/',
    documentDirectory: '/mock/documents/',
    getInfoAsync: jest.fn(() => Promise.resolve({ exists: false })),
    makeDirectoryAsync: jest.fn(() => Promise.resolve()),
    readDirectoryAsync: jest.fn(() => Promise.resolve([])),
    downloadAsync: jest.fn(() => Promise.resolve({ status: 200 })),
    deleteAsync: jest.fn(() => Promise.resolve()),
}));

// Mock expo-crypto
jest.mock('expo-crypto', () => ({
    digestStringAsync: jest.fn((algo, str) => Promise.resolve('mocked-hash')),
    CryptoDigestAlgorithm: { SHA256: 'SHA256' },
}));

// Silence console warnings in tests
global.console = {
    ...console,
    warn: jest.fn(),
    log: jest.fn(),
};
