import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Credentials (In a real app, strict NO-NO. Prototype only.)
const R2_ACCOUNT_ID = "79a6ed38798d77eccd49aeba5b49cd1e";
const R2_ACCESS_KEY_ID = "5489d4f31b46f984df98234c0d04a6d6";
const R2_SECRET_ACCESS_KEY = "25b8ad2d2f30905ba1f34ce1936b8cedfe6cda02e0381b9544d85dad33a53b16";
const R2_BUCKET_NAME = "portals";

// Initialize S3 Client targeting Cloudflare R2
export const r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
});

export const getBucketName = () => R2_BUCKET_NAME;

/**
 * Generates a presigned URL for uploading a file to R2.
 * @param key Storage key (path)
 * @param contentType MIME type of the file
 */
export async function getUploadUrl(key: string, contentType: string) {
    const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        ContentType: contentType,
    });
    return await getSignedUrl(r2Client, command, { expiresIn: 3600 }); // 1 hour
}

/**
 * Generates a presigned URL for downloading/viewing a file from R2.
 * @param key Storage key (path)
 */
export async function getDownloadUrl(key: string) {
    const command = new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
    });
    return await getSignedUrl(r2Client, command, { expiresIn: 3600 });
}

/**
 * Uploads a file directly to R2 using a presigned URL.
 * NOTE: For React Native, 'uri' usually points to a local file system path.
 * We fetch the blob from the URI and PUT it to the signed URL.
 */
export async function uploadToR2(uri: string, key: string, contentType: string) {
    console.log(`[R2] Preparing upload for ${key}`);
    try {
        // 1. Get Presigned URL
        const uploadUrl = await getUploadUrl(key, contentType);

        // 2. Fetch the file data
        const response = await fetch(uri);
        const blob = await response.blob();

        // 3. Upload to R2
        const uploadResponse = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
                "Content-Type": contentType,
            },
            body: blob,
        });

        if (!uploadResponse.ok) {
            throw new Error(`Upload failed with status ${uploadResponse.status}`);
        }

        console.log(`[R2] Successfully uploaded ${key}`);
        // Return the public URL or the key? Returning key is better for storage abstracton.
        // But for immediate usage we might want a simple public URL if the bucket is public.
        // Assuming R2 bucket is NOT public by default, we'd need a worker or signed URL to view.
        // For now, return the Key.
        return key;
    } catch (error) {
        console.error("[R2] Upload Error:", error);
        throw error;
    }
}

/**
 * Direct Upload for string content (like JSON), bypassing file fetch.
 */
export async function uploadStringContent(content: string, key: string, contentType: string = 'application/json') {
    console.log(`[R2] Uploading string content to ${key}`);
    try {
        const uploadUrl = await getUploadUrl(key, contentType);

        const uploadResponse = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
                "Content-Type": contentType,
            },
            body: content,
        });

        if (!uploadResponse.ok) throw new Error(`Upload failed: ${uploadResponse.status}`);
        return key;
    } catch (e) {
        console.error("[R2] String Upload Error:", e);
        throw e;
    }
}
