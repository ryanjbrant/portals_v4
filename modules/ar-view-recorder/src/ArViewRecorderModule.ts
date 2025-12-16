import { NativeModule, requireNativeModule } from 'expo';

interface RecordingResult {
  success: boolean;
  message?: string;
  url?: string;
  path?: string;
}

interface FrameExtractionResult {
  success: boolean;
  frames: string[]; // Array of base64 data URIs
}

declare class ArViewRecorderModule extends NativeModule {
  startRecording(viewTag: number, fileName: string): Promise<RecordingResult>;
  pauseRecording(): Promise<RecordingResult>;
  resumeRecording(): Promise<RecordingResult>;
  stopRecording(): Promise<RecordingResult>;
  isRecording(): boolean;
  isPaused(): boolean;
  extractFrames(videoPath: string, count: number): Promise<FrameExtractionResult>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<ArViewRecorderModule>('ArViewRecorder');
