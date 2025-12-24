/**
 * MediaCache Tests
 */

// Mock expo modules before importing MediaCache
jest.mock('expo-file-system', () => ({
    cacheDirectory: '/mock/cache/',
    documentDirectory: '/mock/documents/',
    getInfoAsync: jest.fn(),
    makeDirectoryAsync: jest.fn(() => Promise.resolve()),
    readDirectoryAsync: jest.fn(() => Promise.resolve([])),
    downloadAsync: jest.fn(),
    deleteAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-crypto', () => ({
    digestStringAsync: jest.fn((algo, str) => Promise.resolve(`hash_${str.length}`)),
    CryptoDigestAlgorithm: { SHA256: 'SHA256' },
}));

import * as FileSystem from 'expo-file-system';
import { MediaCache } from '../../services/cache/MediaCache';

describe('MediaCache', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset getInfoAsync mock
        (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });
        (FileSystem.downloadAsync as jest.Mock).mockResolvedValue({ status: 200 });
    });

    describe('getOrFetch', () => {
        it('should return local file paths unchanged', async () => {
            const localPath = 'file:///local/image.png';
            const result = await MediaCache.getOrFetch(localPath);
            expect(result).toBe(localPath);
        });

        it('should return absolute paths unchanged', async () => {
            const localPath = '/local/image.png';
            const result = await MediaCache.getOrFetch(localPath);
            expect(result).toBe(localPath);
        });

        it('should return empty string for empty input', async () => {
            const result = await MediaCache.getOrFetch('');
            expect(result).toBe('');
        });

        it('should download and cache remote URLs', async () => {
            (FileSystem.getInfoAsync as jest.Mock)
                .mockResolvedValueOnce({ exists: true }) // dir exists
                .mockResolvedValueOnce({ exists: false }) // file not cached
                .mockResolvedValueOnce({ exists: true, size: 1000 }); // after download

            const remoteUrl = 'https://example.com/image.png';
            const result = await MediaCache.getOrFetch(remoteUrl);

            expect(result).toContain('/mock/cache/');
            expect(FileSystem.downloadAsync).toHaveBeenCalled();
        });

        it('should return cached file if it exists', async () => {
            (FileSystem.getInfoAsync as jest.Mock)
                .mockResolvedValueOnce({ exists: true }) // dir exists
                .mockResolvedValueOnce({ exists: true }); // file is cached

            const remoteUrl = 'https://example.com/cached.png';
            const result = await MediaCache.getOrFetch(remoteUrl);

            expect(result).toContain('/mock/cache/');
            expect(FileSystem.downloadAsync).not.toHaveBeenCalled();
        });

        it('should fall back to original URL on download failure', async () => {
            (FileSystem.getInfoAsync as jest.Mock)
                .mockResolvedValueOnce({ exists: true }) // dir exists
                .mockResolvedValueOnce({ exists: false }); // file not cached
            (FileSystem.downloadAsync as jest.Mock).mockResolvedValue({ status: 404 });

            const remoteUrl = 'https://example.com/missing.png';
            const result = await MediaCache.getOrFetch(remoteUrl);

            expect(result).toBe(remoteUrl);
        });
    });

    describe('getStats', () => {
        it('should return stats object', () => {
            const stats = MediaCache.getStats();
            expect(stats).toHaveProperty('entries');
            expect(stats).toHaveProperty('sizeBytes');
            expect(stats).toHaveProperty('sizeMB');
        });
    });

    describe('prefetch', () => {
        it('should handle empty array', async () => {
            await expect(MediaCache.prefetch([])).resolves.not.toThrow();
        });

        it('should process multiple URIs', async () => {
            (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({ exists: false });
            (FileSystem.downloadAsync as jest.Mock).mockResolvedValue({ status: 200 });

            const uris = [
                'https://example.com/1.png',
                'https://example.com/2.png',
            ];

            await MediaCache.prefetch(uris);
            // Should not throw
        });
    });
});
