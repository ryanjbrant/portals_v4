import { SerializedScene } from '../types/scene';

export type NeedleEditorOutboundMessage =
    | { type: "add-glb"; id: string; uri: string }
    | { type: "add-image"; id: string; uri: string; originalUri?: string }
    | { type: "add-video"; id: string; uri: string; originalUri?: string }
    | { type: "add-audio"; id: string; uri: string }
    | { type: "add-primitive"; id: string; primitive: "cube" | "sphere" | "plane" | "cylinder" }
    | { type: "reset-scene" }
    | { type: "start-recording-segment" }
    | { type: "stop-recording-segment" }
    | { type: "request-export" }
    | { type: "set-environment"; uri: string }
    | { type: "load-scene"; scene: SerializedScene }
    | { type: "update-object-material"; id: string; material: any }
    | { type: "add-object-animation"; id: string; animation: any }
    | { type: "update-object-animation"; id: string; animationId: string; params: any }
    | { type: "select-object"; id: string | null }
    // Stream Messages
    | { type: "stream-start"; id: string; mediaType: 'video' | 'image'; totalChunks: number; mimeType: string; originalUri?: string }
    | { type: "stream-chunk"; id: string; chunkIndex: number; data: string }
    | { type: "stream-end"; id: string };

export type NeedleEditorInboundMessage =
    | { type: 'log'; message: string; level?: 'info' | 'warn' | 'error' }
    | { type: 'viewer-ready' }
    | { type: 'export-complete'; scene: any; finalVideoUri: string; coverImageURI?: string }
    | { type: 'recording-complete'; data: string; durationMs: number }
    | { type: 'recording-paused'; durationMs: number }
    | { type: 'object-selected'; id: string | null };

export const sendMessageToWebView = (webviewRef: any, message: NeedleEditorOutboundMessage) => {
    if (webviewRef.current) {
        webviewRef.current.postMessage(JSON.stringify(message));
    }
};

export const parseInboundMessage = (event: any): NeedleEditorInboundMessage | null => {
    try {
        const data = JSON.parse(event.nativeEvent.data);
        return data as NeedleEditorInboundMessage;
    } catch (e) {
        console.warn("Failed to parse WebView message", e);
        return null;
    }
};
