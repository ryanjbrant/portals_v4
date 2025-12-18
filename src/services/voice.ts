import {
    AudioModule,
    RecordingPresets,
    requestRecordingPermissionsAsync,
    setAudioModeAsync,
    type AudioRecorder as AudioRecorderType
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { getGenerativeModel } from 'firebase/ai';
import { vertexAI } from '../config/firebase';

export const VoiceService = {
    audioRecorder: null as AudioRecorderType | null,
    meteringInterval: null as NodeJS.Timeout | null,

    async requestPermissions() {
        const { status } = await requestRecordingPermissionsAsync();
        return status === 'granted';
    },

    async startRecording(onMeteringUpdate: (metering: number) => void): Promise<boolean> {
        try {
            const hasPermission = await this.requestPermissions();
            if (!hasPermission) return false;

            await setAudioModeAsync({
                allowsRecording: true,
                playsInSilentMode: true,
            });

            const recorder = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
            this.audioRecorder = recorder;

            await recorder.prepareToRecordAsync();

            // Poll for metering updates since expo-audio doesn't have callback-based metering
            this.meteringInterval = setInterval(async () => {
                if (this.audioRecorder?.isRecording) {
                    const status = await this.audioRecorder.getStatus();
                    if (status.metering !== undefined) {
                        onMeteringUpdate(status.metering);
                    }
                }
            }, 100);

            await recorder.record();
            console.log('Recording started');
            return true;
        } catch (error) {
            console.error('Failed to start recording', error);
            return false;
        }
    },

    async stopRecording(): Promise<string | null> {
        try {
            if (!this.audioRecorder) return null;

            // Clear metering interval
            if (this.meteringInterval) {
                clearInterval(this.meteringInterval);
                this.meteringInterval = null;
            }

            await this.audioRecorder.stop();
            const uri = this.audioRecorder.uri;

            this.audioRecorder = null;
            console.log('Recording stopped, URI:', uri);
            return uri;
        } catch (error) {
            console.error('Failed to stop recording', error);
            return null;
        }
    },

    async processCommand(audioUri: string | null, context?: any): Promise<{ action: string, params?: any, text: string }> {
        if (!audioUri) return { action: 'none', text: "No audio recorded." };

        try {
            console.log("Processing audio with Gemini 2.0 Flash...");
            console.log("Context:", context);

            // 1. Read Audio File as Base64
            const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
                encoding: 'base64',
            });

            // Debug: Log audio data size
            console.log("Audio base64 length:", base64Audio.length);

            // 2. Initialize Model (using stable GA model)
            const model = getGenerativeModel(vertexAI, { model: 'gemini-2.0-flash' });

            // 3. Define Prompt
            const prompt = `
            You are a navigation and action assistant for "Portals".
            
            CURRENT CONTEXT:
            - Screen: ${context?.currentScreen || 'Unknown'}
            - Visible Item ID: ${context?.currentId || 'None'}
            - Item Type: ${context?.currentType || 'None'}

            Listen to the user command and return JSON.

            ACTIONS:
            1. NAVIGATION:
               - "search for [X]" -> { "action": "navigate", "params": { "screen": "Search", "params": { "query": "[X]" } } }
               - "go to my profile" -> { "action": "navigate", "params": { "screen": "Tabs", "params": { "screen": "Me" } } }
               - "take me to the feed" / "home" -> { "action": "navigate", "params": { "screen": "Tabs", "params": { "screen": "Home" } } }
               - "go to map" -> { "action": "navigate", "params": { "screen": "Tabs", "params": { "screen": "Map" } } }
               
            2. INTERACTION (Use Context if "this" or "current" is implied):
               - "like this post" (if Type=post) -> { "action": "like_post", "params": { "id": "${context?.currentId}" } }
               - "comment [TEXT]" (if Type=post) -> { "action": "add_comment", "params": { "id": "${context?.currentId}", "text": "[TEXT]" } }
               - "follow this person" (if Type=profile) -> { "action": "follow_user", "params": { "id": "${context?.currentId}" } }

            FORMAT:
            {
              "action": "navigate" | "like_post" | "add_comment" | "follow_user" | "none",
              "params": { ... },
              "text": "Confirmation message or response."
            }

            Return ONLY raw JSON.
            `;

            // 4. Generate Content (Multimodal: Text + Audio)
            // Supported MIME types: audio/m4a, audio/mp4, audio/mp3, audio/wav, audio/ogg, audio/aac
            console.log("Sending request with audio/m4a MIME type...");
            const result = await model.generateContent([
                prompt,
                {
                    inlineData: {
                        mimeType: 'audio/m4a', // M4A is supported
                        data: base64Audio
                    }
                }
            ]);

            const responseText = result.response.text();
            console.log("Gemini Response:", responseText);

            // 5. Parse JSON
            const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const command = JSON.parse(cleanJson);

            return command;

        } catch (error: any) {
            console.error("Gemini Error:", error);
            console.error("Error details:", error?.message, error?.status, error?.statusText);
            return { action: 'none', text: "Sorry, I couldn't understand that." };
        }
    }
};
