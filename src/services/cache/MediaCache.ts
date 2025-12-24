/**
 * MediaCache Service
 * 
 * Provides tiered caching for images and videos with:
 * - Memory cache (LRU) for hot assets
 * - Disk cache for persistence across sessions
 * - Automatic cache eviction when size limits exceeded
 */
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';

// Configuration
const CACHE_DIR = FileSystem.cacheDirectory + 'media/';
const MAX_CACHE_SIZE_MB = 500;
const MAX_CACHE_SIZE = MAX_CACHE_SIZE_MB * 1024 * 1024;
const MAX_MEMORY_CACHE_ITEMS = 50;

// Memory cache (LRU)
class LRUCache<T> {
    private cache = new Map<string, T>();
    private maxSize: number;

    constructor(maxSize: number) {
        this.maxSize = maxSize;
    }

    get(key: string): T | undefined {
        const value = this.cache.get(key);
        if (value !== undefined) {
            // Move to end (most recently used)
            this.cache.delete(key);
            this.cache.set(key, value);
        }
        return value;
    }

    set(key: string, value: T): void {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            // Remove least recently used (first item)
            const firstKey = this.cache.keys().next().value;
            if (firstKey) this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    }

    has(key: string): boolean {
        return this.cache.has(key);
    }

    clear(): void {
        this.cache.clear();
    }
}

// Memory cache for URIs
const memoryCache = new LRUCache<string>(MAX_MEMORY_CACHE_ITEMS);

// Cache metadata tracking
interface CacheEntry {
    localPath: string;
    size: number;
    accessedAt: number;
}

let cacheEntries: CacheEntry[] = [];
let totalCacheSize = 0;
let isInitialized = false;

/**
 * Initialize the cache directory and load existing entries
 */
async function initializeCache(): Promise<void> {
    if (isInitialized) return;

    try {
        const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
        if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
        }

        // Scan existing cache files
        const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
        cacheEntries = [];
        totalCacheSize = 0;

        for (const file of files) {
            try {
                const filePath = CACHE_DIR + file;
                const info = await FileSystem.getInfoAsync(filePath, { size: true });
                if (info.exists && !info.isDirectory) {
                    const size = (info as any).size || 0;
                    cacheEntries.push({
                        localPath: filePath,
                        size,
                        accessedAt: Date.now(), // Assume recent for existing files
                    });
                    totalCacheSize += size;
                }
            } catch {
                // Skip inaccessible files
            }
        }

        console.log(`[MediaCache] Initialized with ${cacheEntries.length} entries, ${(totalCacheSize / 1024 / 1024).toFixed(1)}MB`);
        isInitialized = true;
    } catch (error) {
        console.error('[MediaCache] Failed to initialize:', error);
        isInitialized = true; // Mark as initialized to prevent retry loops
    }
}

/**
 * Generate a cache key from a URI
 */
async function hashUri(uri: string): Promise<string> {
    const digest = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        uri
    );
    // Get extension from URI if possible
    const ext = getExtension(uri);
    return digest.substring(0, 16) + ext;
}

/**
 * Extract file extension from URI
 */
function getExtension(uri: string): string {
    const match = uri.match(/\.([a-zA-Z0-9]+)(\?|$)/);
    return match ? '.' + match[1].toLowerCase() : '';
}

/**
 * Evict old entries to stay under size limit
 */
async function pruneIfNeeded(): Promise<void> {
    if (totalCacheSize <= MAX_CACHE_SIZE) return;

    // Sort by accessedAt (oldest first)
    cacheEntries.sort((a, b) => a.accessedAt - b.accessedAt);

    while (totalCacheSize > MAX_CACHE_SIZE * 0.8 && cacheEntries.length > 0) {
        const oldest = cacheEntries.shift();
        if (oldest) {
            try {
                await FileSystem.deleteAsync(oldest.localPath, { idempotent: true });
                totalCacheSize -= oldest.size;
                console.log(`[MediaCache] Evicted ${oldest.localPath}`);
            } catch {
                // Ignore deletion errors
            }
        }
    }
}

/**
 * Get cached or download a media file
 * Returns local file path
 */
async function getOrFetch(uri: string): Promise<string> {
    if (!uri) return uri;

    // Skip caching for local files
    if (uri.startsWith('file://') || uri.startsWith('/')) {
        return uri;
    }

    await initializeCache();

    // Check memory cache first
    const memCached = memoryCache.get(uri);
    if (memCached) {
        // Verify file still exists
        const info = await FileSystem.getInfoAsync(memCached);
        if (info.exists) {
            return memCached;
        }
        // File was deleted, continue to download
    }

    // Generate cache key
    const cacheKey = await hashUri(uri);
    const localPath = CACHE_DIR + cacheKey;

    // Check disk cache
    const existingInfo = await FileSystem.getInfoAsync(localPath);
    if (existingInfo.exists) {
        memoryCache.set(uri, localPath);
        // Update access time
        const entry = cacheEntries.find(e => e.localPath === localPath);
        if (entry) entry.accessedAt = Date.now();
        return localPath;
    }

    // Download to cache
    try {
        console.log(`[MediaCache] Downloading: ${uri.substring(0, 50)}...`);
        const downloadResult = await FileSystem.downloadAsync(uri, localPath);

        if (downloadResult.status === 200) {
            const info = await FileSystem.getInfoAsync(localPath, { size: true });
            const size = (info as any).size || 0;

            // Add to tracking
            cacheEntries.push({
                localPath,
                size,
                accessedAt: Date.now(),
            });
            totalCacheSize += size;

            // Add to memory cache
            memoryCache.set(uri, localPath);

            // Prune if needed
            await pruneIfNeeded();

            return localPath;
        } else {
            console.warn(`[MediaCache] Download failed with status ${downloadResult.status}`);
            return uri; // Fall back to original URI
        }
    } catch (error) {
        console.error('[MediaCache] Download error:', error);
        return uri; // Fall back to original URI
    }
}

/**
 * Prefetch multiple URIs in background
 */
async function prefetch(uris: string[]): Promise<void> {
    const promises = uris.map(uri => getOrFetch(uri).catch(() => null));
    await Promise.all(promises);
}

/**
 * Clear all cached media
 */
async function clearCache(): Promise<void> {
    try {
        await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
        await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
        memoryCache.clear();
        cacheEntries = [];
        totalCacheSize = 0;
        console.log('[MediaCache] Cache cleared');
    } catch (error) {
        console.error('[MediaCache] Failed to clear cache:', error);
    }
}

/**
 * Get cache statistics
 */
function getStats(): { entries: number; sizeBytes: number; sizeMB: number } {
    return {
        entries: cacheEntries.length,
        sizeBytes: totalCacheSize,
        sizeMB: Math.round(totalCacheSize / 1024 / 1024 * 10) / 10,
    };
}

export const MediaCache = {
    getOrFetch,
    prefetch,
    clearCache,
    getStats,
    initializeCache,
};
