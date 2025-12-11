import * as FileSystem from 'expo-file-system/legacy';
import Constants, { ExecutionEnvironment } from 'expo-constants';

export const CompressionService = {
    compressVideo: async (inputUri: string): Promise<string> => {
        const fileName = `compressed_${Date.now()}.mp4`;
        const outputUri = `${FileSystem.cacheDirectory}${fileName}`;

        console.log(`[Compression] Starting for ${inputUri}`);

        // Block FFmpeg in Expo Go to prevent crash
        if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
            console.warn("[Compression] Running in Expo Go. Skipping Optimization (Native Layer Unavailable).");
            return inputUri;
        }

        try {
            // Dynamic import to prevent crash in Expo Go
            const { FFmpegKit, ReturnCode } = require('ffmpeg-kit-react-native');

            const command = `-i "${inputUri}" -c:v libx264 -crf 28 -preset veryfast -c:a aac -b:a 128k -movflags +faststart "${outputUri}"`;

            const session = await FFmpegKit.execute(command);
            const returnCode = await session.getReturnCode();

            if (ReturnCode.isSuccess(returnCode)) {
                console.log(`[Compression] Success: ${outputUri}`);
                return outputUri;
            } else {
                const logs = await session.getAllLogs();
                const logText = logs.map((l: any) => l.getMessage()).join('\n');
                console.error(`[Compression] Failed. Logs:\n${logText}`);
                return inputUri; // Fallback
            }
        } catch (e) {
            console.warn("[Compression] Native module not found (Expo Go?). Skipping compression.");
            return inputUri; // Fallback
        }
    },

    stitchVideos: async (videoUris: string[]): Promise<string> => {
        if (videoUris.length === 0) return '';
        if (videoUris.length === 1) return videoUris[0];

        // Expo Go Guard
        if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
            console.warn("[Stitch] Expo Go detected. Returning first segment only.");
            return videoUris[0];
        }

        const fileName = `stitched_${Date.now()}.mp4`;
        const outputUri = `${FileSystem.cacheDirectory}${fileName}`;

        try {
            const { FFmpegKit, ReturnCode } = require('ffmpeg-kit-react-native');

            // Create list file
            const listFileUri = `${FileSystem.cacheDirectory}concat_list.txt`;
            const fileContent = videoUris.map(uri => {
                const path = uri.replace('file://', '');
                return `file '${path}'`;
            }).join('\n');

            await FileSystem.writeAsStringAsync(listFileUri, fileContent);
            console.log(`[Stitch] List created: ${fileContent}`);

            const command = `-f concat -safe 0 -i "${listFileUri.replace('file://', '')}" -c copy "${outputUri}"`;

            const session = await FFmpegKit.execute(command);
            const returnCode = await session.getReturnCode();

            if (ReturnCode.isSuccess(returnCode)) {
                console.log(`[Stitch] Success: ${outputUri}`);
                return outputUri;
            } else {
                const logs = await session.getAllLogs();
                const logText = logs.map((l: any) => l.getMessage()).join('\n');
                console.error(`[Stitch] Failed. Logs:\n${logText}`);
                return videoUris[0]; // Fallback to first
            }
        } catch (e) {
            console.warn("[Stitch] Error", e);
            return videoUris[0];
        }
    }
};
