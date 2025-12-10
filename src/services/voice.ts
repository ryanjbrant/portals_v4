import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { getGenerativeModel } from 'firebase/ai';
import { vertexAI } from '../config/firebase';

export const VoiceService = {
    audioRecording: null as Audio.Recording | null,

    async requestPermissions() {
        const { status } = await Audio.requestPermissionsAsync();
        return status === 'granted';
    },

    async startRecording(onMeteringUpdate: (metering: number) => void): Promise<boolean> {
        try {
            const hasPermission = await this.requestPermissions();
            if (!hasPermission) return false;

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const recording = new Audio.Recording();
            this.audioRecording = recording;

            await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);

            recording.setOnRecordingStatusUpdate((status) => {
                if (status.metering !== undefined) {
                    onMeteringUpdate(status.metering);
                }
            });

            await recording.startAsync();
            console.log('Recording started');
            return true;
        } catch (error) {
            console.error('Failed to start recording', error);
            return false;
        }
    },

    async stopRecording(): Promise<string | null> {
        try {
            if (!this.audioRecording) return null;

            await this.audioRecording.stopAndUnloadAsync();
            const uri = this.audioRecording.getURI();

            this.audioRecording = null;
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

            // 2. Initialize Model
            const model = getGenerativeModel(vertexAI, { model: 'gemini-2.0-flash-exp' });

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
            const result = await model.generateContent([
                prompt,
                {
                    inlineData: {
                        mimeType: 'audio/m4a', // Expo High Quality preset uses m4a/aac
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

        } catch (error) {
            console.error("Gemini Error:", error);
            return { action: 'none', text: "Sorry, I couldn't understand that." };
        }
    }
};
