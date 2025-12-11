export const EditorContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>Needle Composer 3D</title>
    <style>
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: transparent; }
        canvas { display: block; width: 100%; height: 100%; outline: none; }
        #debug { position: absolute; top: 40px; left: 10px; color: lime; font-family: monospace; pointer-events: none; z-index: 999; font-size: 14px; text-shadow: 1px 1px 1px black; display: none; }
    </style>
    <!-- Load Three.js from CDN -->
    <script type="importmap">
      {
        "imports": {
          "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
          "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
        }
      }
    </script>
</head>
<body>
    <div id="debug">Initializing 3D...</div>
    
    <script type="module">
        import * as THREE from 'three';
        import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
        import { TransformControls } from 'three/addons/controls/TransformControls.js';
        // RoundedBoxGeometry import disabled for debugging - may not be available in WebView
        // import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

        const debug = document.getElementById('debug');
        function log(msg) {
            if (debug) debug.innerText = msg;
            sendMessage({ type: 'log', message: msg, level: 'info' });
        }
        
        function sendMessage(msg) {
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify(msg));
            }
        }

        // --- 3D Scene Setup ---
        const scene = new THREE.Scene();
        // Transparent background for AR (CameraView visible behind WebView)
        scene.background = null; 
        // scene.background = new THREE.Color(0x333333);

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 1.5, 3);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(renderer.domElement);
        
        // Ensure canvas is visible with explicit styling
        renderer.domElement.style.position = 'absolute';
        renderer.domElement.style.top = '0';
        renderer.domElement.style.left = '0';
        renderer.domElement.style.zIndex = '1';
        renderer.domElement.style.pointerEvents = 'auto';

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); 
        scene.add(ambientLight);

        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.3);
        hemiLight.position.set(0, 20, 0);
        scene.add(hemiLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        dirLight.position.set(5, 10, 7.5);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 50;
        dirLight.shadow.bias = -0.0005; // Standard PCF bias
        dirLight.shadow.radius = 3; // Soften edges moderately
        scene.add(dirLight);

        // Ground Plane for AR Shadows (DISABLED FOR DEBUGGING)
        // const groundGeo = new THREE.PlaneGeometry(20, 20);
        // const groundMat = new THREE.ShadowMaterial({ opacity: 0.4, color: 0x000000, transparent: true }); 
        // const ground = new THREE.Mesh(groundGeo, groundMat);
        // ground.rotation.x = -Math.PI / 2;
        // ground.position.y = 0; 
        // ground.receiveShadow = true;
        // scene.add(ground);

        // Controls
        const orbit = new OrbitControls(camera, renderer.domElement);
        orbit.enableDamping = true;
        orbit.dampingFactor = 0.05;

        // Gizmo for manipulation
        const transformControl = new TransformControls(camera, renderer.domElement);
        transformControl.addEventListener('dragging-changed', function (event) {
            orbit.enabled = !event.value;
        });
        scene.add(transformControl);

        // Object Registry for Export
        const objectsRegistry = []; // { id, mesh, type... }
        
        // Animation State
        const activeAnimations = {}; // { [objectId]: { [animType]: { intensity: 1, active: true, offset: random } } }

        // Interaction (Raycaster)
        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();

        function onPointerDown(event) {
            pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
            pointer.y = - (event.clientY / window.innerHeight) * 2 + 1;

            raycaster.setFromCamera(pointer, camera);
            
            // Collect interactable meshes
            const meshes = objectsRegistry.map(o => o.mesh);
            const intersects = raycaster.intersectObjects(meshes, false);

            if (intersects.length > 0) {
                const selected = intersects[0].object;
                transformControl.attach(selected);
                log("Selected: " + selected.userData.id);
                sendMessage({ 
                    type: 'object-selected', 
                    id: selected.userData.id,
                    animations: activeAnimations[selected.userData.id] || {} 
                });
            } else {
                // If clicked empty space, detach (unless dragging gizmo handles, which logic handles)
                // transformControl.detach(); 
                // Don't detach immediately logic needed to distinguish gizmo click vs empty click, TransfromControls handles its own raycast usually.
                // Simplified:
               // transformControl.detach();
            }
        }
        window.addEventListener('pointerdown', onPointerDown);

        // Resize
        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // Animation Loop
        const clock = new THREE.Clock();

        function animate() {
            requestAnimationFrame(animate);
            const delta = clock.getDelta();
            const time = clock.getElapsedTime();

            // Apply Animations
            Object.keys(activeAnimations).forEach(objId => {
                const entry = objectsRegistry.find(o => o.id === objId);
                if (!entry || !entry.mesh) return;

                const anims = activeAnimations[objId];
                const mesh = entry.mesh;

                Object.keys(anims).forEach(type => {
                    const params = anims[type];
                    if (!params.active) return;
                    
                    const intensity = params.intensity || 1.0;
                    const t = time + params.offset;

                    switch (type) {
                        case 'rotate':
                            const axis = params.axis || { x: false, y: true, z: false };
                            if (axis.x) mesh.rotation.x += delta * intensity;
                            if (axis.y) mesh.rotation.y += delta * intensity;
                            if (axis.z) mesh.rotation.z += delta * intensity;
                            break;
                        case 'bounce':
                            mesh.position.y = 0.5 + Math.abs(Math.sin(t * 3)) * 0.5 * intensity;
                            break;
                        case 'scale':
                            const s = 1 + Math.sin(t * 5) * 0.2 * intensity;
                            mesh.scale.setScalar(s);
                            break;
                        case 'pulse':
                             // Gentle opacity or scale pulse
                             const p = 1 + Math.sin(t * 2) * 0.1 * intensity;
                             mesh.scale.setScalar(p);
                             break;
                        case 'wiggle':
                            mesh.rotation.z = Math.sin(t * 10) * 0.1 * intensity;
                            break;
                        case 'random':
                             // Smooth Noise (sum of sines)
                             const noiseX = Math.sin(t * 1.5) + Math.sin(t * 3.7) * 0.5;
                             const noiseY = Math.sin(t * 2.1) + Math.sin(t * 4.3) * 0.5;
                             const noiseZ = Math.sin(t * 1.8) + Math.sin(t * 2.9) * 0.5;
                             
                             if (params.initialX !== undefined) {
                                 mesh.position.x = params.initialX + noiseX * 0.1 * intensity;
                                 mesh.position.y = params.initialY + noiseY * 0.1 * intensity;
                                 mesh.position.z = params.initialZ + noiseZ * 0.1 * intensity;
                             }
                             break;
                    }
                });
            });

            orbit.update();
            renderer.render(scene, camera);
            
            // Heartbeat & Memory Monitor
            if (renderer.info.render.frame % 60 === 0) {
                 const cp = camera.position;
                 log("[Heartbeat] Cam: " + cp.x.toFixed(2) + "," + cp.y.toFixed(2) + "," + cp.z.toFixed(2) + 
                     " | Calls: " + renderer.info.render.calls + 
                     " | Geometries: " + renderer.info.memory.geometries + 
                     " | Textures: " + renderer.info.memory.textures);
            }
        }
        animate();
        log("3D Engine Ready");

        // addPrimitive function
        function addPrimitive(id, type, shouldSelect = true) {
            let geometry;
            let material = new THREE.MeshStandardMaterial({ 
                color: Math.random() * 0xffffff,
                roughness: 0.2,
                metalness: 0.1,
            });
            
            if (type === 'cube') geometry = new THREE.BoxGeometry(1, 1, 1);
            else if (type === 'sphere') geometry = new THREE.SphereGeometry(0.6, 64, 64);
            else if (type === 'cylinder') geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
            else if (type === 'cone') geometry = new THREE.ConeGeometry(0.5, 1, 32);
            else if (type === 'torus') geometry = new THREE.TorusGeometry(0.5, 0.2, 16, 100);
            else if (type === 'plane') geometry = new THREE.PlaneGeometry(1, 1);
            else if (type === 'capsule') geometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
            
            // New Shapes
            else if (type === 'torus-knot') geometry = new THREE.TorusKnotGeometry(0.4, 0.15, 100, 16);
            else if (type === 'icosphere') geometry = new THREE.IcosahedronGeometry(0.6, 2); 
            else if (type === 'rounded-cube') geometry = new THREE.BoxGeometry(1, 1, 1); // Fallback - RoundedBoxGeometry unavailable
            else if (type === 'ring') geometry = new THREE.RingGeometry(0.3, 0.7, 32);
            else if (type === 'octahedron') geometry = new THREE.OctahedronGeometry(0.6);
            else if (type === 'dodecahedron') geometry = new THREE.DodecahedronGeometry(0.6);
            else if (type === 'tetrahedron') geometry = new THREE.TetrahedronGeometry(0.6);
            
            else geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(0, 0.5, 0); // Spawn at center of view
            mesh.userData = { id: id, type: type };
            
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            const edges = new THREE.EdgesGeometry(geometry);
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 }));
            mesh.add(line);
            
            scene.add(mesh);
            objectsRegistry.push({ id, mesh, type });
            
            // Debug: Log mesh position and scene children count
            log("Added " + type + " at (" + mesh.position.x.toFixed(2) + "," + mesh.position.y.toFixed(2) + "," + mesh.position.z.toFixed(2) + ") Scene children: " + scene.children.length);
            
            if (shouldSelect) {
                transformControl.attach(mesh);
                sendMessage({ 
                    type: 'object-selected', 
                    id: id,
                    animations: activeAnimations[id] || {} 
                });
            }
        }

        // --- Helper Functions Moved Up for Scope ---
        
        // Helper to store texture URIs for export
        function setMaterialTexture(mesh, mapKey, uri) {
            if (!mesh.userData.textures) mesh.userData.textures = {};
            mesh.userData.textures[mapKey] = uri;
            
            new THREE.TextureLoader().load(uri, (tex) => {
                if(mapKey === 'map') tex.colorSpace = THREE.SRGBColorSpace;
                mesh.material[mapKey] = tex;
                mesh.material.needsUpdate = true;
            });
        }

        function updateObjectMaterial(id, matData) {
            const entry = objectsRegistry.find(o => o.id === id);
            if (!entry || !entry.mesh) return;

            const mesh = entry.mesh;
            const mat = mesh.material;

            if (matData.color) mat.color.set(matData.color);
            
            if (matData.mapUri) setMaterialTexture(mesh, 'map', matData.mapUri);
            if (matData.normalMapUri) setMaterialTexture(mesh, 'normalMap', matData.normalMapUri);
            if (matData.roughnessMapUri) setMaterialTexture(mesh, 'roughnessMap', matData.roughnessMapUri);
            if (matData.aoMapUri) {
                setMaterialTexture(mesh, 'aoMap', matData.aoMapUri);
                if (!mesh.geometry.attributes.uv2) {
                     mesh.geometry.setAttribute('uv2', mesh.geometry.attributes.uv);
                }
            }
            if (matData.glossinessMapUri) setMaterialTexture(mesh, 'roughnessMap', matData.glossinessMapUri);
            
            log("Material Updated");
        }
        
        function addObjectAnimation(id, animData) {
            if (!activeAnimations[id]) activeAnimations[id] = {};
            
            const entry = objectsRegistry.find(o => o.id === id);
            const initialPos = entry ? entry.mesh.position.clone() : new THREE.Vector3();

            activeAnimations[id][animData.type] = { 
                ...animData.params, 
                active: animData.active,
                offset: Math.random() * 100,
                initialX: initialPos.x,
                initialY: initialPos.y,
                initialZ: initialPos.z
            };
            log("Anim " + animData.type + " added to " + id + " (Found: " + !!entry + ")");
        }

        function updateObjectAnimation(id, type, params) {
             if (activeAnimations[id] && activeAnimations[id][type]) {
                 Object.assign(activeAnimations[id][type], params);
             }
        }
        
        function selectObjectById(id) {
             if (!id) {
                 transformControl.detach();
                 return;
             }
             const entry = objectsRegistry.find(o => o.id === id);
             if (entry) {
                 transformControl.attach(entry.mesh);
                 sendMessage({ 
                     type: 'object-selected', 
                     id: id,
                     animations: activeAnimations[id] || {}
                 });
             }
        }

        function addImage(id, uri, originalUri) {
            log("Loading Image: " + uri.substring(0, 50) + "...");
            const loader = new THREE.TextureLoader();
            loader.load(uri, (texture) => {
                log("Image Loaded: " + texture.image.width + "x" + texture.image.height);
                texture.colorSpace = THREE.SRGBColorSpace; 
                const aspect = texture.image.width / texture.image.height;
                const geometry = new THREE.PlaneGeometry(1, 1 / aspect);
                const material = new THREE.MeshBasicMaterial({ 
                    map: texture, 
                    transparent: true, 
                    side: THREE.DoubleSide 
                });
                
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(0, 0.5, 0);
                mesh.userData = { id: id, type: 'image-plane', uri: uri, originalUri: originalUri }; // Store persistent URI
                
                scene.add(mesh);
                objectsRegistry.push({ id, mesh, type: 'image-plane' });
                transformControl.attach(mesh);
                log("Added Image");
            }, undefined, (e) => log("Img Load Err: " + e));
        }

        function addVideo(id, uri, originalUri) {
            log("Loading Video with Full Diagnostics...");
           
            const video = document.createElement('video');
            
            // Diagnostics Listeners
            video.addEventListener('loadeddata', () => log("Video Event: loadeddata (ReadyState: " + video.readyState + ")"));
            video.addEventListener('play', () => log("Video Event: play"));
            video.addEventListener('playing', () => log("Video Event: playing"));
            video.addEventListener('error', (e) => log("Video Event: error - " + (video.error ? video.error.message : 'Unknown')));
            video.addEventListener('stalled', () => log("Video Event: stalled"));
            video.addEventListener('waiting', () => log("Video Event: waiting"));

            video.src = uri;
            video.crossOrigin = "anonymous";
            video.loop = true;
            video.muted = true;
            video.playsInline = true;
            
            // STRICT STYLING: Prevent video from rendering on top of canvas
            // We append it to body but hide it so texture can update
            Object.assign(video.style, {
                position: 'fixed',
                top: '0',
                left: '0',
                width: '1px',
                height: '1px',
                opacity: '0',
                pointerEvents: 'none',
                zIndex: '-1000',
                visibility: 'hidden' // Try visibility hidden, if texture stops updating revert to opacity only
            });
            document.body.appendChild(video); // Append to DOM is sometimes needed for playback

            // CRITICAL for iOS: Set attributes explicitly to prevent fullscreen takeover
            video.setAttribute('playsinline', 'true'); 
            video.setAttribute('webkit-playsinline', 'true'); 
            
            video.play().then(() => {
                log("Video Play Promise Resolved");
                
                const aspect = video.videoWidth / video.videoHeight || 1.77; 
                log("Video Dimensions: " + video.videoWidth + "x" + video.videoHeight + " Aspect: " + aspect.toFixed(2));

                const geometry = new THREE.PlaneGeometry(1, 1 / aspect);
                const material = new THREE.MeshBasicMaterial({ 
                    map: null, // Start with no map
                    color: 0xff0000, 
                    side: THREE.DoubleSide 
                });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(0, 0.5, 0);
                mesh.userData = { id: id, type: 'video-plane', uri: uri, originalUri: originalUri, videoElem: video }; // Store video ref + persistent URI
                
                scene.add(mesh);
                objectsRegistry.push({ id, mesh, type: 'video-plane' });
                log("Added Video Mesh (Red Placeholder)");

                // Video Texture Optimization for iOS Crash Prevention
                const texture = new THREE.VideoTexture(video);
                // texture.colorSpace = THREE.SRGBColorSpace; // DISABLED: Reducing memory overhead
                texture.generateMipmaps = false; // CRITICAL: Mipmaps are expensive for video
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
                
                mesh.material.map = texture;
                mesh.material.color.setHex(0xffffff);
                mesh.material.needsUpdate = true;
                log("Texture Applied (Optimized)");
                
            }).catch(e => log("Video Play Err: " + e.message));
        }

        function resetScene() {
            objectsRegistry.forEach(o => {
                scene.remove(o.mesh);
                
                // Dispose Geometry
                if(o.mesh.geometry) o.mesh.geometry.dispose();
                
                // Dispose Material & Textures
                if(o.mesh.material) {
                    if (o.mesh.material.map) o.mesh.material.map.dispose();
                    o.mesh.material.dispose();
                }
                
                // Stop Video!
                if (o.mesh.userData.videoElem) {
                    const v = o.mesh.userData.videoElem;
                    v.pause();
                    v.removeAttribute('src'); // Detach source
                    v.load(); // Force unload
                    if (v.parentNode) v.parentNode.removeChild(v); // Remove from DOM
                    log("Video Resource Released");
                }
            });
            objectsRegistry.length = 0;
            transformControl.detach();
            // Force GC hint?
            renderer.render(scene, camera);
            log("Scene Reset & Resources Cleared");
        }

        function loadScene(sceneData) {
            log("Loading Scene...");
            resetScene(); 
            if (!sceneData || !sceneData.objects) return;
            sceneData.objects.forEach(obj => {
                if (obj.type === 'primitive') {
                     addPrimitive(obj.id, obj.primitiveType, false);
                     const entry = objectsRegistry.find(o => o.id === obj.id);
                     if (entry && entry.mesh) {
                         const m = entry.mesh;
                         if (obj.transform.position) m.position.fromArray(obj.transform.position);
                         if (obj.transform.rotation) m.rotation.fromArray(obj.transform.rotation); 
                         if (obj.transform.scale) m.scale.fromArray(obj.transform.scale);
                         if (obj.material) {
                             if (obj.material.color) m.material.color.set(obj.material.color);
                             if (obj.material.textures) {
                                 if (obj.material.textures.map) setMaterialTexture(m, 'map', obj.material.textures.map);
                                 if (obj.material.textures.normalMap) setMaterialTexture(m, 'normalMap', obj.material.textures.normalMap);
                                 if (obj.material.textures.roughnessMap) setMaterialTexture(m, 'roughnessMap', obj.material.textures.roughnessMap);
                                 if (obj.material.textures.aoMap) {
                                     setMaterialTexture(m, 'aoMap', obj.material.textures.aoMap);
                                     m.material.aoMapIntensity = 1;
                                 }
                             }
                         }
                         if (obj.animations) {
                             Object.keys(obj.animations).forEach(type => {
                                 const anim = obj.animations[type];
                                 addObjectAnimation(obj.id, { type, params: { intensity: anim.intensity }, active: anim.active });
                             });
                         }
                     }
                } else if (obj.primitiveType === 'image-plane' && obj.uri) {
                    addImage(obj.id, obj.uri);
                    // Defer transform application? Ideally separate creation from transform logic or pass transform to creation
                    // For now simplest is create it at default then update it. But addImage is async!
                    // Fix: We need to wait for load or apply transform in callback if we want precise restore.
                    // For prototype velocity, we'll accept default then user adjusts, or improve later.
                    // ACTUALLY: Let's pass transform to addImage if we care.
                    // Current simplified restore just creates it.
                } else if (obj.primitiveType === 'video-plane' && obj.uri) {
                    addVideo(obj.id, obj.uri);
                }
            });
            log("Scene Loaded.");
        }

        function exportScene() {
            const savedSelection = transformControl.object;
            if (savedSelection) transformControl.detach();
            renderer.render(scene, camera); 
            const objects = objectsRegistry.map(o => {
                const mesh = o.mesh;
                return {
                    id: o.id,
                    type: 'primitive',
                    primitiveType: o.type,
                    uri: mesh.userData.originalUri || mesh.userData.uri, // Use persistent URI if available (Fixes Blob export crash)
                    transform: { 
                        position: mesh.position.toArray(),
                        rotation: mesh.rotation.toArray(),
                        scale: mesh.scale.toArray()
                    },
                    material: {
                         color: '#' + mesh.material.color.getHexString(),
                         textures: mesh.userData.textures || {}
                    },
                    animations: activeAnimations[o.id] || {}
                };
            });
            let coverImageURI = null;
            try {
                coverImageURI = renderer.domElement.toDataURL('image/jpeg', 0.8);
            } catch (e) { log("Screenshot Err"); }
            if (savedSelection) transformControl.attach(savedSelection);
            finalizeRecording(() => {
                setTimeout(() => {
                    sendMessage({
                        type: 'export-complete',
                        scene: { objects },
                        finalVideoUri: null, 
                        coverImageURI: coverImageURI
                    });
                }, 100);
            });
        }
        function loadEnvironment(uri) {
            new THREE.TextureLoader().load(uri, (texture) => {
                texture.mapping = THREE.EquirectangularReflectionMapping;
                scene.environment = texture;
                // scene.background = null; // DISABLED: Keep debug background for now
                log("Env Loaded");
            }, undefined, (e) => log("Env Err"));
        }

        // --- Stream Receiver Logic ---
        const streamBuffer = {}; // { [id]: { chunks: Uint8Array[], total: 0, mime: '' } }

        function handleStreamStart(id, totalChunks, mimeType, originalUri) {
            streamBuffer[id] = { chunks: new Array(totalChunks), receivedCount: 0, mimeType: mimeType, originalUri: originalUri };
            log("Stream Start: " + id + " (" + totalChunks + " chunks)");
        }

        function base64ToUint8Array(base64) {
            const binary_string = window.atob(base64);
            const len = binary_string.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binary_string.charCodeAt(i);
            }
            return bytes;
        }

        function handleStreamChunk(id, index, base64Data) {
            if (!streamBuffer[id]) return;
            
            try {
                // Decode immediately to save memory (avoid holding huge Base64 strings)
                // CHUNK_SIZE must be multiple of 4 for this to work safely, which it is (512000).
                const byteArray = base64ToUint8Array(base64Data);
                streamBuffer[id].chunks[index] = byteArray;
                streamBuffer[id].receivedCount++;
                
                if (streamBuffer[id].receivedCount % 50 === 0) {
                     log("Stream: " + Math.round((streamBuffer[id].receivedCount / streamBuffer[id].chunks.length) * 100) + "%");
                }
            } catch (e) {
                log("Chunk Err: " + e.message);
            }
        }

        function handleStreamEnd(id, type) {
            if (!streamBuffer[id]) return;
            
            const buffer = streamBuffer[id];
            if (buffer.receivedCount < buffer.chunks.length) {
                log("Stream Incomplete: " + buffer.receivedCount + "/" + buffer.chunks.length);
                return;
            }

            log("Stream Assembling...");
            try {
                // Create Blob directly from the array of Uint8Arrays
                // This is extremely efficient and avoids huge string re-allocation
                const blob = new Blob(buffer.chunks, { type: buffer.mimeType });
                const blobUrl = URL.createObjectURL(blob);
                log("Blob Created: " + (blob.size / 1024 / 1024).toFixed(2) + " MB");
                
                if (buffer.mimeType.startsWith('video')) {
                    addVideo(id, blobUrl, buffer.originalUri);
                } else {
                    addImage(id, blobUrl, buffer.originalUri);
                }
                
                // Cleanup
                streamBuffer[id].chunks = null; // Help GC
                delete streamBuffer[id];
            } catch (e) {
                log("Blob Err: " + e.message);
            }
        }

        // --- Bridge Logic ---
        document.addEventListener("message", handleMessage); 
        window.addEventListener("message", handleMessage);

        function handleMessage(event) {
            try {
                const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                if (!data || !data.type) return;

                switch (data.type) {
                    case 'add-primitive':
                        addPrimitive(data.id, data.primitive);
                        break;
                    case 'add-image':
                        addImage(data.id, data.uri, data.originalUri);
                        break;
                    case 'add-video':
                        // Usually comes via stream, but if direct:
                        addVideo(data.id, data.uri, data.uri); // Assume uri is persistent if passed directly
                        break;
                    case 'reset-scene':
                        resetScene();
                        break;
                    case 'start-recording-segment':
                        startRecording();
                        break;
                    case 'stop-recording-segment':
                        stopRecording();
                        break;
                    case 'set-environment':
                        loadEnvironment(data.uri);
                        break;
                    case 'request-export':
                        exportScene();
                        break;
                    case 'load-scene':
                        loadScene(data.scene);
                        break;
                    case 'update-object-material':
                        updateObjectMaterial(data.id, data.material);
                        break;
                    case 'add-object-animation':
                        addObjectAnimation(data.id, data.animation);
                        break;
                    case 'update-object-animation':
                        updateObjectAnimation(data.id, data.animationId, data.params);
                        break;
                    case 'select-object':
                         // Programmatic selection
                         selectObjectById(data.id);
                         break;
                    case 'stream-start':
                        handleStreamStart(data.id, data.totalChunks, data.mimeType, data.originalUri);
                        break;
                    case 'stream-chunk':
                        handleStreamChunk(data.id, data.chunkIndex, data.data);
                        break;
                    case 'stream-end':
                        handleStreamEnd(data.id, data.mediaType);
                        break;
                }
            } catch(e) { log("Err: " + e.message); }
        }

        // Helper functions moved up

        // --- Recording via Canvas Stream (Continuous Mode) ---
        let mediaRecorder;
        let recordedChunks = [];
        let startTime = 0;
        let cumulativeDuration = 0;
        let previouslySelected = null;
        let isRecordingActive = false;

        function startRecording() {
            if (transformControl.object) {
                previouslySelected = transformControl.object;
                transformControl.detach();
            }
            if (mediaRecorder && mediaRecorder.state === 'paused') {
                mediaRecorder.resume();
                startTime = Date.now();
                isRecordingActive = true;
                log("Recording Resumed...");
                return;
            }
            try {
                const stream = renderer.domElement.captureStream(30); 
                const mimeType = 'video/mp4';
                mediaRecorder = new MediaRecorder(stream, { 
                    mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined 
                });
                recordedChunks = [];
                startTime = Date.now();
                cumulativeDuration = 0;
                isRecordingActive = true;

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data && event.data.size > 0) recordedChunks.push(event.data);
                };

                mediaRecorder.onstop = () => {
                   const finalDuration = cumulativeDuration;
                   const blob = new Blob(recordedChunks, { type: 'video/mp4' });
                   const reader = new FileReader();
                   reader.readAsDataURL(blob);
                   reader.onloadend = () => {
                       sendMessage({
                           type: 'recording-complete',
                           data: reader.result,
                           durationMs: finalDuration
                       });
                       log("Recording Complete: " + finalDuration + "ms");
                       if (mediaRecorder._exportCallback) {
                           mediaRecorder._exportCallback();
                           mediaRecorder._exportCallback = null;
                       }
                   };
                };

                mediaRecorder.start(100); 
                log("Recording Started...");
            } catch (e) {
                log("Record Error: " + e.message);
            }
        }

        function stopRecording() {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                const segmentDuration = Date.now() - startTime;
                cumulativeDuration += segmentDuration;
                mediaRecorder.pause();
                isRecordingActive = false;
                sendMessage({ type: 'recording-paused', durationMs: cumulativeDuration });
                log("Paused at " + cumulativeDuration + "ms");
            }
            if (previouslySelected) {
                transformControl.attach(previouslySelected);
                previouslySelected = null;
            }
        }

        function finalizeRecording(onComplete) {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                if (mediaRecorder.state === 'recording') {
                    cumulativeDuration += Date.now() - startTime;
                }
                mediaRecorder._exportCallback = onComplete;
                mediaRecorder.stop(); 
            } else if (onComplete) {
                onComplete();
            }
        }
    </script>
</body>
</html>
`;
