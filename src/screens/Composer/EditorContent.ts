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
        // Transparent background for AR (User Request - Reverted)
        scene.background = null;

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 1.5, 3);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(renderer.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        dirLight.position.set(5, 10, 7.5);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 50;
        scene.add(dirLight);

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
                sendMessage({ type: 'object-selected', id: selected.userData.id });
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
                            mesh.rotation.y += delta * intensity;
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
        }
        animate();
        log("3D Engine Ready");

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
                        addImage(data.id, data.uri);
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
                }
            } catch(e) { log("Err: " + e.message); }
        }

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
            
            log("Material Updated");
        }

        // --- Animation Logic ---
        
        function addObjectAnimation(id, animData) {
            if (!activeAnimations[id]) activeAnimations[id] = {};
            
            const entry = objectsRegistry.find(o => o.id === id);
            const initialPos = entry ? entry.mesh.position.clone() : new THREE.Vector3();

            activeAnimations[id][animData.type] = { 
                ...animData.params, 
                active: animData.active,
                offset: Math.random() * 100,
                // Store initial position for stable wiggling/random movement
                initialX: initialPos.x,
                initialY: initialPos.y,
                initialZ: initialPos.z
            };
            log("Anim " + animData.type + " added");
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
                 sendMessage({ type: 'object-selected', id: id });
             }
        }

        function loadScene(sceneData) {
            log("Loading Scene...");
            resetScene(); // Clear current
            
            if (!sceneData || !sceneData.objects) return;

            sceneData.objects.forEach(obj => {
                if (obj.type === 'primitive') {
                     addPrimitive(obj.id, obj.primitiveType);
                     
                     const entry = objectsRegistry.find(o => o.id === obj.id);
                     if (entry && entry.mesh) {
                         const m = entry.mesh;
                         // Transform
                         if (obj.transform.position) m.position.fromArray(obj.transform.position);
                         if (obj.transform.rotation) m.rotation.fromArray(obj.transform.rotation); 
                         if (obj.transform.scale) m.scale.fromArray(obj.transform.scale);
                         
                         // Material
                         if (obj.material) {
                             if (obj.material.color) m.material.color.set(obj.material.color);
                             if (obj.material.textures) {
                                 if (obj.material.textures.map) setMaterialTexture(m, 'map', obj.material.textures.map);
                                 if (obj.material.textures.normalMap) setMaterialTexture(m, 'normalMap', obj.material.textures.normalMap);
                                 if (obj.material.textures.roughnessMap) setMaterialTexture(m, 'roughnessMap', obj.material.textures.roughnessMap);
                             }
                         }
                         
                         // Animations
                         if (obj.animations) {
                             Object.keys(obj.animations).forEach(type => {
                                 const anim = obj.animations[type];
                                 addObjectAnimation(obj.id, { type, params: { intensity: anim.intensity }, active: anim.active });
                             });
                         }
                     }
                }
            });
            log("Scene Loaded.");
        }

        function exportScene() {
            // Hide gizmo
            const savedSelection = transformControl.object;
            if (savedSelection) transformControl.detach();
            renderer.render(scene, camera); 

            // Serialize
            const objects = objectsRegistry.map(o => {
                const mesh = o.mesh;
                return {
                    id: o.id,
                    type: 'primitive',
                    primitiveType: o.type,
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
            
            // Capture Screenshot
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
                scene.background = null; 
                log("Env Loaded");
            }, undefined, (e) => log("Env Err"));
        }

        function addPrimitive(id, type) {
            let geometry;
            let material = new THREE.MeshStandardMaterial({ 
                color: Math.random() * 0xffffff,
                roughness: 0.2,
                metalness: 0.1,
            });
            
            if (type === 'cube') geometry = new THREE.BoxGeometry(1, 1, 1);
            else if (type === 'sphere') geometry = new THREE.SphereGeometry(0.6, 64, 64);
            else geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set((Math.random()-0.5)*2, 0.5, (Math.random()-0.5)*2);
            mesh.userData = { id: id, type: type };
            
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            const edges = new THREE.EdgesGeometry(geometry);
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 }));
            mesh.add(line);
            
            scene.add(mesh);
            objectsRegistry.push({ id, mesh, type });
            
            transformControl.attach(mesh);
            log("Added Premium " + type);
        }

        function addImage(id, uri) {
            const loader = new THREE.TextureLoader();
            loader.load(uri, (texture) => {
                const aspect = texture.image.width / texture.image.height;
                const geometry = new THREE.PlaneGeometry(1, 1 / aspect);
                const material = new THREE.MeshBasicMaterial({ 
                    map: texture, 
                    transparent: true, 
                    side: THREE.DoubleSide 
                });
                
                const mesh = new THREE.Mesh(geometry, material);
                mesh.position.set(0, 1.5, 0);
                mesh.userData = { id: id, type: 'image-plane' };
                
                scene.add(mesh);
                objectsRegistry.push({ id, mesh, type: 'image-plane' });
                transformControl.attach(mesh);
                log("Added Image");
            }, undefined, (e) => log("Img Load Err"));
        }

        function resetScene() {
            objectsRegistry.forEach(o => {
                scene.remove(o.mesh);
                if(o.mesh.geometry) o.mesh.geometry.dispose();
            });
            objectsRegistry.length = 0;
            transformControl.detach();
            log("Scene Reset");
        }

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
