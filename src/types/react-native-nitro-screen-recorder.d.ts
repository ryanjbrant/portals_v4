declare module 'react-native-nitro-screen-recorder' {
    export interface RecordingOptions {
        enableMic?: boolean;
        enableCamera?: boolean;
        cameraDevice?: 'front' | 'back';
        cameraPreviewStyle?: {
            width?: number;
            height?: number;
            top?: number;
            left?: number;
        };
    }

    export interface ScreenRecordingFile {
        path: string;
        duration?: number;
        size?: number;
        width?: number;
        height?: number;
    }

    export interface InAppRecordingInput {
        options: RecordingOptions;
        onRecordingFinished: (file: ScreenRecordingFile) => void;
        onRecordingError?: (error: Error) => void;
    }

    export function startInAppRecording(input: InAppRecordingInput): Promise<void>;
    export function stopInAppRecording(): Promise<ScreenRecordingFile | undefined>;
    export function cancelInAppRecording(): Promise<void>;
}
