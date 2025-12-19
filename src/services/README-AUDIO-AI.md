# Audio & AI Voice Commands

## Overview

The voice command system enables hands-free interaction with the Portals app using Gemini AI for natural language understanding.

## Architecture

```
┌──────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   VoiceOverlay   │ ──▶ │  VoiceService   │ ──▶ │   Gemini API    │
│   (UI/UX)        │     │  (Recording)    │     │   (Processing)  │
└──────────────────┘     └─────────────────┘     └─────────────────┘
```

## Dependencies

| Package | Purpose |
|---------|---------|
| `expo-audio` | Audio recording |
| `expo-file-system` | File I/O for base64 encoding |
| `@google/generative-ai` | Gemini AI SDK |

## Audio Recording

### ⚠️ Critical Format Requirements

**Use WAV format, NOT M4A.** The Gemini API rejects M4A files with 400 errors.

```typescript
const WAV_RECORDING_OPTIONS = {
    isMeteringEnabled: true,
    sampleRate: 16000,      // 16kHz optimal for speech
    numberOfChannels: 1,     // Mono
    bitRate: 256000,
    extension: '.wav',
    ios: {
        outputFormat: IOSOutputFormat.LINEARPCM,  // WAV format
    },
};
```

### Why WAV over M4A?
- **M4A (AAC)**: Compressed format, often rejected by speech APIs
- **WAV (LINEARPCM)**: Uncompressed, universally supported for speech recognition

## Gemini Integration

### SDK Choice

**Use `@google/generative-ai` directly**, not `firebase/ai`:

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
```

### Why Not Firebase Vertex AI?
- Firebase SDK had consistent 400 errors with audio inline data
- Direct Google AI SDK has better multimodal support

### Request Format

```typescript
const result = await model.generateContent([
    prompt,  // Text prompt with context
    {
        inlineData: {
            mimeType: 'audio/wav',  // MUST match recording format
            data: base64Audio       // Base64-encoded audio
        }
    }
]);
```

## Voice Commands

### Supported Actions

| Command | Action | Example |
|---------|--------|---------|
| Navigation | `navigate` | "Go to my profile" |
| Like | `like_post` | "Like this post" |
| Comment | `add_comment` | "Comment 'awesome!'" |
| Follow | `follow_user` | "Follow this person" |

### Context-Aware Commands

The system passes current screen context to Gemini:
- `currentScreen`: Active screen name
- `currentId`: Visible item ID  
- `currentType`: Item type (post, profile, etc.)

## Troubleshooting

### 400 "Invalid Argument" Error
1. ✅ Check MIME type matches recording format
2. ✅ Use WAV, not M4A
3. ✅ Verify audio base64 size is reasonable (>10KB)

### Recording Fails
1. ✅ Check microphone permissions
2. ✅ Ensure `setAudioModeAsync({ allowsRecording: true })`

### Empty Audio (small base64)
1. ✅ Recording was too short
2. ✅ Microphone hardware issue

## Files

| File | Description |
|------|-------------|
| `src/services/voice.ts` | Main voice service |
| `src/components/VoiceOverlay.tsx` | Recording UI overlay |
