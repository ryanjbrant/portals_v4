
// Mocking the behavior for the React Native WebView since we can't run the actual Needle Engine build process here.

const canvas = document.getElementById('needle-canvas');
const ctx = canvas.getContext('2d');
const debug = document.getElementById('debug');

// Registry
let objects = [];
let mediaRecorder = null;
let chunks = [];
let recordingStartTime = 0;

// Resize
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Render Loop (Mock 3D)
function render() {
    if (!ctx) return;
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.beginPath();
    for (let i = 0; i < canvas.width; i += 50) { ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); }
    for (let i = 0; i < canvas.height; i += 50) { ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); }
    ctx.stroke();

    // Draw Objects
    objects.forEach((obj, index) => {
        const x = (obj.transform.position[0] * 100) + (canvas.width / 2);
        const y = (obj.transform.position[1] * -100) + (canvas.height / 2); // Invert Y

        ctx.fillStyle = getObjectColor(obj.type);
        ctx.beginPath();
        if (obj.primitiveType === 'sphere') {
            ctx.arc(x, y, 30, 0, Math.PI * 2);
        } else {
            ctx.fillRect(x - 25, y - 25, 50, 50);
        }
        ctx.fill();

        // Label
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.fillText(obj.type, x - 20, y + 40);
    });

    requestAnimationFrame(render);
}

function getObjectColor(type) {
    switch (type) {
        case 'primitive': return '#3498db';
        case 'glb': return '#e74c3c';
        case 'image-plane': return '#f1c40f';
        case 'video-plane': return '#9b59b6';
        default: return '#bdc3c7';
    }
}

render();

// Message Handler
// Listen for messages from React Native
document.addEventListener("message", handleMessage); // For RN Android
window.addEventListener("message", handleMessage); // For RN iOS

function handleMessage(event) {
    try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!data || !data.type) return;

        log(`Received: ${data.type}`);

        switch (data.type) {
            case 'add-primitive':
            case 'add-glb':
            case 'add-image':
            case 'add-video':
                const newObj = {
                    id: data.id,
                    type: data.type === 'add-primitive' ? 'primitive' : data.type.replace('add-', ''),
                    assetUri: data.uri || null,
                    primitiveType: data.primitive,
                    transform: { position: [Math.random() * 2 - 1, Math.random() * 2 - 1, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }
                };
                objects.push(newObj);
                log(`Added Object: ${newObj.id}`);
                break;

            case 'reset-scene':
                objects = [];
                log("Scene Reset");
                break;

            case 'start-recording-segment':
                startRecording();
                break;

            case 'stop-recording-segment':
                stopRecording();
                break;

            case 'request-export':
                exportScene();
                break;

            case 'load-scene':
                if (data.scene && data.scene.objects) {
                    objects = data.scene.objects;
                    log(`Loaded ${objects.length} objects`);
                }
                break;
        }
    } catch (e) {
        log(`Error: ${e}`);
    }
}

function log(msg) {
    if (debug) debug.innerText = msg;
    const bridge = window.ReactNativeWebView;
    if (bridge) bridge.postMessage(JSON.stringify({ type: 'log', message: msg, level: 'info' }));
}

// Recording Logic
function startRecording() {
    try {
        const stream = canvas.captureStream(30);
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' }); // WebM is standard for Chrome/Android WebView
        chunks = [];
        recordingStartTime = Date.now();

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            // const blob = new Blob(chunks, { type: 'video/webm' });

            const duration = Date.now() - recordingStartTime;
            const fakeUri = `file:///simulated/video_${Date.now()}.mp4`; // Mock

            const bridge = window.ReactNativeWebView;
            if (bridge) {
                bridge.postMessage(JSON.stringify({
                    type: 'recording-segment-complete',
                    segmentId: `seg_${Date.now()}`,
                    uri: fakeUri,
                    durationMs: duration
                }));
            }
        };

        mediaRecorder.start();
        log("Recording...");
    } catch (e) {
        log("Recording failed: " + e);
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        log("Stopped");
    }
}

function exportScene() {
    const bridge = window.ReactNativeWebView;
    if (bridge) {
        bridge.postMessage(JSON.stringify({
            type: 'export-complete',
            scene: { objects: objects },
            finalVideoUri: 'file:///simulated/final_export.mp4' // Mock
        }));
    }
}
