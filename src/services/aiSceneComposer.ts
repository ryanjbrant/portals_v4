/**
 * AI Scene Composer Service
 * Advanced voice-controlled AR scene composition via Gemini AI
 */

import * as FileSystem from 'expo-file-system/legacy';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { VoiceService } from './voice';

const GEMINI_API_KEY = 'AIzaSyCrI1tru2J5mapuoDkF8B9eCqSfwGYNFdU';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// =====================================================
// COMPLETE ASSET CATALOG - Matches ModelItems.js exactly
// =====================================================
const ASSET_CATALOG = [
    { index: 0, name: 'cube_glb', keywords: ['cube', 'box', 'block', 'square'] },
    { index: 1, name: 'sphere_glb', keywords: ['sphere', 'ball', 'orb', 'round'] },
    { index: 2, name: 'cylinder_glb', keywords: ['cylinder', 'tube', 'pipe', 'column', 'pillar'] },
    { index: 3, name: 'torus_glb', keywords: ['torus', 'donut', 'ring shape', 'doughnut'] },
    { index: 4, name: 'cone_glb', keywords: ['cone', 'point', 'spike'] },
    { index: 5, name: 'plane_glb', keywords: ['plane', 'flat', 'floor', 'wall', 'panel'] },
    { index: 6, name: 'capsule_glb', keywords: ['capsule', 'pill', 'lozenge', 'oval'] },
    { index: 7, name: 'rounded_cube_glb', keywords: ['rounded cube', 'soft cube', 'smooth box', 'rounded box'] },
    { index: 8, name: 'torus_twisted_glb', keywords: ['twisted torus', 'spiral ring', 'twisted ring'] },
    { index: 9, name: 'oil_tank_glb', keywords: ['oil tank', 'barrel', 'tank', 'container'] },
    { index: 10, name: 'hex_cylinder_glb', keywords: ['hexagon', 'hex cylinder', 'hex', 'honeycomb'] },
    { index: 11, name: 'platonic_glb', keywords: ['platonic', 'icosahedron', 'd20', 'polyhedron'] },
    { index: 12, name: 'cube_doodad_glb', keywords: ['doodad', 'piece', 'fragment', 'chunk'] },
    { index: 13, name: 'tetra_small_glb', keywords: ['tetrahedron', 'pyramid small', 'small pyramid', 'triangle'] },
    { index: 14, name: 'tetra_large_glb', keywords: ['large pyramid', 'big pyramid', 'pyramid', 'tetra large'] },
    { index: 15, name: 'tetra_tri_glb', keywords: ['tetra tri', 'triangle pyramid', 'tri'] },
    { index: 16, name: 'tetra_diamond_glb', keywords: ['diamond', 'gem', 'jewel', 'crystal'] },
    { index: 17, name: 'dragon_anim', keywords: ['dragon', 'monster', 'creature', 'beast', 'flying dragon'] },
    { index: 18, name: 'icecream_man', keywords: ['ice cream man', 'ice cream', 'character', 'person', 'icecream'] },
    { index: 19, name: 'pumpkin_man', keywords: ['pumpkin man', 'pumpkin', 'halloween', 'spooky', 'jack o lantern'] },
    { index: 20, name: 'turkeyman_anim', keywords: ['turkey', 'thanksgiving', 'bird character', 'gobble'] },
    { index: 21, name: 'pug_animated', keywords: ['pug', 'dog', 'puppy', 'pet', 'cute dog'] },
    { index: 22, name: 'emoji_smile', keywords: ['happy emoji', 'smile', 'smiley', 'happy face', 'happy', 'smiling'] },
    { index: 23, name: 'emoji_sad', keywords: ['sad emoji', 'sad', 'crying', 'unhappy', 'frown'] },
    { index: 24, name: 'emoji_wow', keywords: ['wow emoji', 'wow', 'surprised', 'shocked', 'amazed', 'omg'] },
    { index: 25, name: 'emoji_angry', keywords: ['angry emoji', 'angry', 'mad', 'furious', 'rage'] },
    { index: 26, name: 'emoji_kiss', keywords: ['kiss emoji', 'kiss', 'kissing', 'love kiss', 'smooch'] },
    { index: 27, name: 'emoji_heart', keywords: ['heart', 'love heart', 'heart emoji', 'love', 'valentine'] },
    { index: 28, name: 'emoji_thumbsup', keywords: ['thumbs up', 'like', 'approve', 'ok', 'thumbsup', 'good'] },
    { index: 29, name: 'emoji_poop', keywords: ['poop emoji', 'poop', 'poo', 'funny', 'turd'] },
    { index: 30, name: 'object_star', keywords: ['star', 'twinkle', 'sparkle', 'shining star'] },
    { index: 31, name: 'object_rainbow', keywords: ['rainbow', 'colors', 'arc', 'colorful arc'] },
    { index: 32, name: 'object_cloud', keywords: ['cloud', 'fluffy', 'sky', 'puffy cloud'] },
    { index: 33, name: 'object_bday_cake', keywords: ['cake', 'birthday cake', 'birthday', 'celebration', 'party'] },
    { index: 34, name: 'object_flowers', keywords: ['flowers', 'bouquet', 'plants', 'floral', 'flower'] },
];

const ANIMATIONS = ['bounce', 'pulse', 'rotate', 'float', 'spin', 'breathe', 'wiggle'];
const PARTICLES = ['snow', 'fire', 'sparkles', 'confetti', 'bubbles', 'rain', 'smoke', 'stars'];

// Build prompt-friendly asset list
const ASSET_LIST_FOR_PROMPT = ASSET_CATALOG.map(a =>
    `${a.index}: ${a.name} (${a.keywords.slice(0, 3).join(', ')})`
).join('\n');

export interface SceneAction {
    type: 'ADD_OBJECT' | 'SET_ANIMATION' | 'ADD_EMITTER' | 'REMOVE_OBJECT' | 'CLEAR_SCENE' |
    'BATCH_TRANSFORM' | 'ARRANGE_FORMATION' | 'TRANSFORM_OBJECT' | 'GENERATE_STRUCTURE';
    objectType?: string;
    objectIndex?: number;
    objectName?: string;
    position?: [number, number, number];
    scale?: [number, number, number];
    rotation?: [number, number, number];
    animationType?: string;
    animationActive?: boolean;
    speed?: number;
    emitterPreset?: string;
    uuid?: string;
    transformType?: string;
    formationType?: string;
    structureType?: string;
    params?: Record<string, any>;
    transforms?: { position?: [number, number, number]; scale?: [number, number, number]; rotation?: [number, number, number] };
}

export interface SceneComposerResult {
    success: boolean;
    actions: SceneAction[];
    message: string;
}

export const AISceneComposer = {
    async startRecording(onMeteringUpdate?: (metering: number) => void): Promise<boolean> {
        return VoiceService.startRecording(onMeteringUpdate || (() => { }));
    },

    async stopAndProcess(sceneContext?: {
        objectCount: number;
        selectedUuid?: string;
        objectNames?: string[];
    }): Promise<SceneComposerResult> {
        try {
            const uri = await VoiceService.stopRecording();
            if (!uri) {
                return { success: false, actions: [], message: "No audio recorded." };
            }
            return this.processSceneCommand(uri, sceneContext);
        } catch (error) {
            console.error('[AISceneComposer] Error:', error);
            return { success: false, actions: [], message: "Error processing command." };
        }
    },

    async processSceneCommand(audioUri: string, context?: any): Promise<SceneComposerResult> {
        try {
            console.log('[AISceneComposer] Processing scene command...');

            const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
                encoding: 'base64',
            });

            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

            const prompt = `
You are an advanced AR Scene Composer AI for "Figment AR". Interpret voice commands and return precise JSON actions.

═══════════════════════════════════════════════════════════════
COMPLETE ASSET CATALOG (use objectIndex for ADD_OBJECT):
═══════════════════════════════════════════════════════════════
${ASSET_LIST_FOR_PROMPT}

═══════════════════════════════════════════════════════════════
CURRENT SCENE STATE:
═══════════════════════════════════════════════════════════════
Objects in scene: ${context?.objectCount || 0}
Object names: ${context?.objectNames?.join(', ') || 'none'}

═══════════════════════════════════════════════════════════════
ACTION TYPES (use the exact type names):
═══════════════════════════════════════════════════════════════

1. ADD_OBJECT - Add a single object
   { type: "ADD_OBJECT", objectIndex: <number>, position: [x,y,z], scale: [s,s,s] }
   Examples:
   - "Add a cube" → objectIndex: 0
   - "Add a dragon" → objectIndex: 17
   - "Add a turkey" → objectIndex: 20
   - "Add a happy emoji" / "Add smiley" → objectIndex: 22
   - "Add a rainbow" → objectIndex: 31
   - "Add a heart" → objectIndex: 27
   - "Add a pug" → objectIndex: 21
   - "Add flowers" → objectIndex: 34

2. BATCH_TRANSFORM - Transform ALL objects at once
   { type: "BATCH_TRANSFORM", transformType: "<type>", params: {...} }
   
   transformType options:
   - "moveUp" → { distance: 1 } - Move all up by distance meters
   - "moveDown" → { distance: 1 } - Move all down
   - "moveToFloor" → {} - Put all at y=0
   - "liftInAir" → { height: 1.5 } - Lift to specific height
   - "cluster" → { center: [0,0,-2] } - Bring all to same point
   - "spread" → { factor: 2 } - Push apart from center
   - "uniformScale" → { scale: 0.5 } - Make all same size
   - "randomScale" → { min: 0.2, max: 0.8 } - Random sizes
   - "randomPosition" → { range: 2 } - Scatter randomly
   - "randomRotation" → {} - Random rotations
   - "stack" → { spacing: 0.3 } - Stack vertically
   - "alignX" / "alignY" / "alignZ" → {} - Align on axis

3. ARRANGE_FORMATION - Arrange in geometric pattern
   { type: "ARRANGE_FORMATION", formationType: "<type>", params: {...} }
   
   formationType options:
   - "ring" / "circle" → { radius: 1.5 }
   - "grid" → { spacing: 0.5, cols: 3 }
   - "line" → { spacing: 0.5 }
   - "scatter" → { range: 3 }
   - "dome" → { radius: 2 } - Half sphere arrangement

4. SET_ANIMATION - Apply animation (to specific object or ALL)
   { type: "SET_ANIMATION", objectName?: "<name>", animationType: "<anim>", speed?: 1 }
   
   If objectName omitted → applies to ALL objects
   animationType: ${ANIMATIONS.join(', ')}

5. REMOVE_OBJECT - Delete by name
   { type: "REMOVE_OBJECT", objectName: "<name>" }

6. ADD_EMITTER - Add particle effect
   { type: "ADD_EMITTER", emitterPreset: "<preset>" }
   presets: ${PARTICLES.join(', ')}

7. CLEAR_SCENE - Remove everything
   { type: "CLEAR_SCENE" }

8. GENERATE_STRUCTURE - Create complex structures
   { type: "GENERATE_STRUCTURE", structureType: "<type>", params: {...} }
   
   structureType options:
   - "igloo" → { blockIndex: 0, radius: 1.5 } - Dome of blocks
   - "wall" → { blockIndex: 0, width: 5, height: 3 }
   - "tower" → { blockIndex: 0, height: 5 }
   - "pyramid" → { blockIndex: 0, layers: 4 }
   - "stairs" → { blockIndex: 0, steps: 5 }

═══════════════════════════════════════════════════════════════
VOICE COMMAND EXAMPLES → JSON OUTPUT:
═══════════════════════════════════════════════════════════════

"Add a turkey" →
{ "actions": [{ "type": "ADD_OBJECT", "objectIndex": 20, "position": [0, 0, -2] }] }

"Add 5 cubes" →
{ "actions": [
  { "type": "ADD_OBJECT", "objectIndex": 0, "position": [-1, 0, -2] },
  { "type": "ADD_OBJECT", "objectIndex": 0, "position": [-0.5, 0, -2] },
  { "type": "ADD_OBJECT", "objectIndex": 0, "position": [0, 0, -2] },
  { "type": "ADD_OBJECT", "objectIndex": 0, "position": [0.5, 0, -2] },
  { "type": "ADD_OBJECT", "objectIndex": 0, "position": [1, 0, -2] }
] }

"Move them up" / "Lift the cubes" →
{ "actions": [{ "type": "BATCH_TRANSFORM", "transformType": "moveUp", "params": { "distance": 1 } }] }

"Put them on the floor" →
{ "actions": [{ "type": "BATCH_TRANSFORM", "transformType": "moveToFloor", "params": {} }] }

"Make them the same size" →
{ "actions": [{ "type": "BATCH_TRANSFORM", "transformType": "uniformScale", "params": { "scale": 0.4 } }] }

"Cluster them together" / "Bring them together" →
{ "actions": [{ "type": "BATCH_TRANSFORM", "transformType": "cluster", "params": {} }] }

"Make a ring" →
{ "actions": [{ "type": "ARRANGE_FORMATION", "formationType": "ring", "params": { "radius": 1.5 } }] }

"Make them all spin" / "Rotate everything" →
{ "actions": [{ "type": "SET_ANIMATION", "animationType": "spin" }] }

"Make an igloo" →
{ "actions": [{ "type": "GENERATE_STRUCTURE", "structureType": "igloo", "params": { "blockIndex": 0, "radius": 1.5 } }] }

═══════════════════════════════════════════════════════════════
RESPONSE FORMAT (RAW JSON ONLY - NO MARKDOWN):
═══════════════════════════════════════════════════════════════
{
  "success": true,
  "actions": [...],
  "message": "Brief description"
}
`;

            const result = await model.generateContent([
                prompt,
                {
                    inlineData: {
                        mimeType: 'audio/wav',
                        data: base64Audio
                    }
                }
            ]);

            const responseText = result.response.text();
            console.log('[AISceneComposer] Gemini response:', responseText);

            const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);

            return {
                success: parsed.success ?? true,
                actions: parsed.actions || [],
                message: parsed.message || 'Command processed'
            };

        } catch (error) {
            console.error('[AISceneComposer] Gemini error:', error);
            return {
                success: false,
                actions: [],
                message: "Sorry, I couldn't understand that command."
            };
        }
    }
};

export default AISceneComposer;

