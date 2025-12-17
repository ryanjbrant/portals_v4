/**
 * SceneService - Handles scene persistence operations
 * 
 * Responsibilities:
 * - Save/load scenes to/from Firebase + R2
 * - Version management
 * - Scene publishing
 */

import { db, auth } from '../../config/firebase';
import {
    collection,
    doc,
    setDoc,
    getDoc,
    addDoc,
    updateDoc,
    serverTimestamp,
    query,
    orderBy,
    limit,
    getDocs,
    deleteDoc
} from 'firebase/firestore';
import { uploadToR2, R2_PUBLIC_BASE } from '../storage/r2';
import { serializeScene, deserializeScene, SceneManifest } from './SceneSerializer';

// Configuration
const MAX_VERSIONS = 10;
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

/**
 * Save a scene (draft or update)
 */
export async function saveScene(
    sceneId: string | null,
    reduxState: any,
    metadata: SceneMetadata
): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    console.log('[SceneService] Saving scene...');

    // Serialize Redux state to manifest
    const manifest = serializeScene(reduxState, {
        version: metadata.currentVersion ? metadata.currentVersion + 1 : 1,
        hdriBackground: metadata.hdriBackground,
        ambientLight: metadata.ambientLight,
    });

    // Generate scene ID if new
    const isNewScene = !sceneId;
    const resolvedSceneId = sceneId || generateSceneId();

    try {
        // 1. Upload any new assets to R2
        await uploadSceneAssets(resolvedSceneId, manifest);

        // 2. Save version history (if updating existing scene)
        if (!isNewScene && metadata.currentVersion) {
            await saveVersionSnapshot(resolvedSceneId, metadata.currentVersion);
        }

        // 3. Save/update scene metadata
        const metadataRef = doc(db, 'scenes', resolvedSceneId, 'metadata', 'info');
        await setDoc(metadataRef, {
            ownerId: user.uid,
            title: metadata.title || 'Untitled Scene',
            status: metadata.status || 'draft',
            thumbnailUrl: metadata.thumbnailUrl || null,
            createdAt: isNewScene ? serverTimestamp() : metadata.createdAt,
            updatedAt: serverTimestamp(),
            version: manifest.version,
        }, { merge: true });

        // 4. Save manifest
        const manifestRef = doc(db, 'scenes', resolvedSceneId, 'manifest', 'current');
        await setDoc(manifestRef, {
            ...manifest,
            savedAt: serverTimestamp(),
        });

        console.log('[SceneService] Scene saved successfully:', resolvedSceneId);
        return resolvedSceneId;

    } catch (error) {
        console.error('[SceneService] Save failed:', error);
        throw error;
    }
}

/**
 * Load a scene by ID
 */
export async function loadScene(sceneId: string): Promise<LoadedScene | null> {
    console.log('[SceneService] Loading scene:', sceneId);

    try {
        // 1. Fetch metadata
        const metadataRef = doc(db, 'scenes', sceneId, 'metadata', 'info');
        const metadataSnap = await getDoc(metadataRef);

        if (!metadataSnap.exists()) {
            console.log('[SceneService] Scene not found:', sceneId);
            return null;
        }

        const metadata = metadataSnap.data() as SceneMetadata;

        // 2. Fetch manifest
        const manifestRef = doc(db, 'scenes', sceneId, 'manifest', 'current');
        const manifestSnap = await getDoc(manifestRef);

        if (!manifestSnap.exists()) {
            console.log('[SceneService] Manifest not found for scene:', sceneId);
            return null;
        }

        const manifest = manifestSnap.data() as SceneManifest;

        // 3. Deserialize for Redux
        const sceneData = deserializeScene(manifest);

        console.log('[SceneService] Scene loaded:', sceneId, 'Objects:', sceneData.objects.length);

        return {
            sceneId,
            metadata,
            manifest,
            sceneData,
        };

    } catch (error) {
        console.error('[SceneService] Load failed:', error);
        throw error;
    }
}

/**
 * Publish a scene to the feed
 */
export async function publishScene(
    sceneId: string,
    publishData: PublishData
): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    console.log('[SceneService] Publishing scene:', sceneId);

    try {
        // 1. Update scene status
        const metadataRef = doc(db, 'scenes', sceneId, 'metadata', 'info');
        await updateDoc(metadataRef, {
            status: 'published',
            publishedAt: serverTimestamp(),
            thumbnailUrl: publishData.thumbnailUrl,
            previewVideoUrl: publishData.previewVideoUrl,
        });

        // 2. Add to public feed index
        await addDoc(collection(db, 'feed'), {
            sceneId,
            ownerId: user.uid,
            ownerName: user.displayName || 'Anonymous',
            title: publishData.title,
            description: publishData.description,
            thumbnailUrl: publishData.thumbnailUrl,
            previewVideoUrl: publishData.previewVideoUrl,
            publishedAt: serverTimestamp(),
            likes: 0,
            views: 0,
        });

        console.log('[SceneService] Scene published successfully');

    } catch (error) {
        console.error('[SceneService] Publish failed:', error);
        throw error;
    }
}

/**
 * Get version history for a scene
 */
export async function getVersionHistory(sceneId: string): Promise<VersionInfo[]> {
    const versionsRef = collection(db, 'scenes', sceneId, 'versions');
    const q = query(versionsRef, orderBy('timestamp', 'desc'), limit(MAX_VERSIONS));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
        versionId: doc.id,
        ...doc.data(),
    })) as VersionInfo[];
}

/**
 * Rollback to a previous version
 */
export async function rollbackToVersion(
    sceneId: string,
    versionId: string
): Promise<void> {
    console.log('[SceneService] Rolling back to version:', versionId);

    const versionRef = doc(db, 'scenes', sceneId, 'versions', versionId);
    const versionSnap = await getDoc(versionRef);

    if (!versionSnap.exists()) {
        throw new Error('Version not found');
    }

    const oldManifest = versionSnap.data().manifest as SceneManifest;

    // Save current as a new version first
    const metadataRef = doc(db, 'scenes', sceneId, 'metadata', 'info');
    const metadataSnap = await getDoc(metadataRef);
    const currentVersion = metadataSnap.data()?.version || 1;
    await saveVersionSnapshot(sceneId, currentVersion);

    // Restore old manifest as current
    const manifestRef = doc(db, 'scenes', sceneId, 'manifest', 'current');
    await setDoc(manifestRef, {
        ...oldManifest,
        version: currentVersion + 1,
        savedAt: serverTimestamp(),
    });

    // Update metadata version
    await updateDoc(metadataRef, {
        version: currentVersion + 1,
        updatedAt: serverTimestamp(),
    });

    console.log('[SceneService] Rollback complete');
}

// ============ Helper Functions ============

function generateSceneId(): string {
    return `scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function saveVersionSnapshot(sceneId: string, version: number): Promise<void> {
    // Get current manifest
    const manifestRef = doc(db, 'scenes', sceneId, 'manifest', 'current');
    const manifestSnap = await getDoc(manifestRef);

    if (!manifestSnap.exists()) return;

    const manifest = manifestSnap.data();

    // Save to versions
    const versionRef = doc(db, 'scenes', sceneId, 'versions', `v${version}`);
    await setDoc(versionRef, {
        manifest,
        timestamp: serverTimestamp(),
        version,
    });

    // Cleanup old versions (keep only MAX_VERSIONS)
    const versionsRef = collection(db, 'scenes', sceneId, 'versions');
    const q = query(versionsRef, orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);

    if (snapshot.size > MAX_VERSIONS) {
        const toDelete = snapshot.docs.slice(MAX_VERSIONS);
        for (const doc of toDelete) {
            await deleteDoc(doc.ref);
        }
    }
}

async function uploadSceneAssets(sceneId: string, manifest: SceneManifest): Promise<void> {
    // For each non-starter asset, check if it needs uploading to scene folder
    for (const obj of manifest.objects) {
        if (obj.isStarterAsset) continue;

        const currentUrl = obj.assetRef;
        if (!currentUrl) continue;

        // Check if already in scene folder
        const sceneAssetsPath = `portals/scenes/${sceneId}/`;
        if (currentUrl.includes(sceneAssetsPath)) continue;

        // Determine asset type folder
        let folder = 'assets';
        if (obj.type === 'model') folder = 'models';
        else if (obj.type === 'video') folder = 'video';
        else if (obj.type === 'image') folder = 'images';
        else if (obj.type === 'audio') folder = 'audio';
        else if (obj.type === 'splat') folder = 'splats';

        // Extract filename from URL
        const filename = currentUrl.split('/').pop() || `asset_${obj.id}`;
        const newKey = `portals/scenes/${sceneId}/${folder}/${filename}`;

        // Note: In production, you'd copy the file to the new location
        // For now, we update the assetRef to point to expected location
        // The actual copy would happen server-side or during initial upload
        console.log(`[SceneService] Asset will be at: ${newKey}`);

        // Update the assetRef to new location (actual copy TBD)
        obj.assetRef = `${R2_PUBLIC_BASE}/${newKey}`;
    }
}

// ============ Types ============

export interface SceneMetadata {
    ownerId: string;
    title: string;
    status: 'draft' | 'published';
    thumbnailUrl?: string;
    createdAt: any;
    updatedAt: any;
    currentVersion?: number;
    hdriBackground?: string;
    ambientLight?: number;
}

export interface LoadedScene {
    sceneId: string;
    metadata: SceneMetadata;
    manifest: SceneManifest;
    sceneData: any;
}

export interface PublishData {
    title: string;
    description?: string;
    thumbnailUrl: string;
    previewVideoUrl?: string;
}

export interface VersionInfo {
    versionId: string;
    version: number;
    timestamp: any;
}
