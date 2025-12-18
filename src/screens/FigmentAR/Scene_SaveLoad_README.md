# Scene Save/Load System

This document explains how AR scenes are saved, loaded, and restored in the Figment AR editor.

## Overview

The scene save/load system allows users to:
1. **Save** complete AR scenes (models, portals, media, effects, lighting) to cloud storage
2. **Load** saved scenes and restore them with accurate transforms (position, rotation, scale)
3. **Resume editing** with objects exactly where they were placed

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           SAVE FLOW                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  User Interaction    →    Redux State    →    Serializer    →    R2     │
│  (drag/rotate/pinch)     (arobjects)        (JSON)          (cloud)     │
│                                                                          │
│  ModelItemRender ──┐                                                     │
│  MediaItemRender ──┼─→ onTransformUpdate → UPDATE_*_TRANSFORMS           │
│  PortalItemRender ─┘                       (reducer action)              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                           LOAD FLOW                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  R2 (cloud)    →    Store    →    Redux    →    Render Components       │
│  (scene.json)      (fetch)       (LOAD_SCENE)   (read from props)       │
│                                                                          │
│                                  isFromDraft: true                       │
│                                  position/rotation/scale                 │
│                                         ↓                                │
│                               getInitialState() uses saved transforms    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Key Components

### 1. Transform Syncing (Real-time Updates to Redux)

Each render component (`ModelItemRender.js`, `MediaItemRender.js`, `PortalItemRender.js`) syncs transforms to Redux during user gestures:

```javascript
// Example from ModelItemRender.js
_onDrag(dragToPos, source) {
  this.setState({ position: dragToPos });
  
  // Throttled sync to Redux (every 100ms)
  const now = Date.now();
  if (!this._lastDragSync || now - this._lastDragSync > 100) {
    this._lastDragSync = now;
    this.props.onTransformUpdate(uuid, { position, rotation, scale });
  }
}
```

**Important:** ViroReact's gesture callbacks don't reliably send `state === 3` (gesture end), so we sync **continuously during gestures** with throttling.

### 2. Redux Actions for Transform Updates

| Action Type | Description |
|------------|-------------|
| `UPDATE_MODEL_TRANSFORMS` | Updates position/rotation/scale for 3D models |
| `UPDATE_MEDIA_TRANSFORMS` | Updates transforms for images/videos |
| `UPDATE_PORTAL_TRANSFORMS` | Updates transforms for portals |

### 3. Scene Serializer (`FigmentSceneSerializer.js`)

Converts Redux state to a portable JSON format:

```javascript
export function serializeScene(arobjects, effects, hdri) {
  const objects = [];
  
  // Serialize models
  Object.values(arobjects.modelItems).forEach((item) => {
    objects.push({
      id: item.uuid,
      type: 'viro_model',
      position: item.position,    // [x, y, z]
      rotation: item.rotation,    // [rx, ry, rz] in degrees
      scale: item.scale,          // [sx, sy, sz]
      // ... model-specific data
    });
  });
  
  // Similar for portals and media...
  return { objects, effects, hdri, ... };
}
```

### 4. Scene Saver (`sceneSaver.ts`)

Handles cloud upload:
- Generates unique scene ID (`scene_<timestamp>_<random>`)
- Uploads `scene.json` to R2
- Uploads preview image
- Creates Firestore metadata document

### 5. Scene Loader (`LOAD_SCENE` in `arobjects.js` reducer)

Parses saved scene and restores Redux state:

```javascript
case 'LOAD_SCENE':
  sceneData.objects.forEach((obj) => {
    if (obj.type === 'viro_model') {
      loadedModels[obj.id] = {
        uuid: obj.id,
        isFromDraft: true,  // Critical flag!
        position: parseTransform(obj.position),
        rotation: parseTransform(obj.rotation),
        scale: parseTransform(obj.scale),
        // ...
      };
    }
  });
```

---

## The `isFromDraft` Flag

This flag is critical for proper scene restoration:

| Component | Without `isFromDraft` | With `isFromDraft: true` |
|-----------|----------------------|--------------------------|
| Models | Places at AR hit test location | Uses saved position |
| Portals | Starts at [0, 2, 1], billboards | Uses saved position, no billboard |
| Media | Places at [0, 0, -1] | Uses saved position |

**Usage in `getInitialState()`:**
```javascript
getInitialState() {
  const isLoadedFromDraft = item.isFromDraft === true;
  return {
    position: isLoadedFromDraft ? item.position : defaultPosition,
    rotation: isLoadedFromDraft ? item.rotation : [0, 0, 0],
    scale: isLoadedFromDraft ? item.scale : defaultScale,
  };
}
```

---

## Scene Data Format

Saved `scene.json` structure:

```json
{
  "title": "My AR Scene",
  "createdAt": "2025-12-18T07:02:40.967Z",
  "sceneType": "figment_ar",
  "hdri": "studio-09",
  "postProcessEffects": "None",
  "objects": [
    {
      "id": "uuid-1234",
      "type": "viro_model",
      "modelIndex": 5,
      "position": [0.12, -0.92, -1.89],
      "rotation": [0, 78.67, 0],
      "scale": [0.43, 0.43, 0.43],
      "animation": { "name": "idle", "loop": true }
    },
    {
      "id": "uuid-5678",
      "type": "viro_portal",
      "portalIndex": 2,
      "portal360Image": { "source": {...}, "type": "360_image" },
      "position": [-0.5, -1.0, -2.0],
      "rotation": [0, 45, 0],
      "scale": [1.5, 1.5, 1.5]
    },
    {
      "id": "uuid-9012",
      "type": "image",
      "uri": "file:///path/to/image.jpg",
      "position": [0.3, -0.8, -1.5],
      "rotation": [0, 0, 0],
      "scale": [1, 1, 1]
    }
  ],
  "effects": [
    { "name": "sepia", "selected": false },
    { "name": "bloom", "selected": true }
  ]
}
```

---

## File Locations

| File | Purpose |
|------|---------|
| `src/screens/FigmentAR/helpers/FigmentSceneSerializer.js` | Converts Redux state → JSON |
| `src/services/sceneSaver.ts` | Uploads to R2 + Firestore |
| `src/store/index.ts` | `fetchDrafts()`, `loadDraft()` |
| `src/screens/FigmentAR/redux/reducers/arobjects.js` | `LOAD_SCENE` reducer |
| `src/screens/FigmentAR/component/ModelItemRender.js` | Model rendering + transform sync |
| `src/screens/FigmentAR/component/MediaItemRender.js` | Media rendering + transform sync |
| `src/screens/FigmentAR/component/PortalItemRender.js` | Portal rendering + transform sync |
| `src/screens/FigmentAR/app.js` | Transform update handlers |
| `src/screens/FigmentAR/figment.js` | Passes callbacks to render components |

---

## Troubleshooting

### Positions not saving
- Check that `onTransformUpdate` callback is wired in `figment.js`
- Verify gesture handler syncs continuously (not waiting for `state === 3`)
- Ensure throttle interval isn't too long

### Positions not loading correctly
- Verify `isFromDraft: true` is set in `LOAD_SCENE` reducer
- Check `getInitialState()` uses saved transforms when `isFromDraft` is true
- Ensure `parseTransform()` handles stringified arrays

### Objects appear at wrong location
- Check if AR hit test placement is being triggered (should be skipped for draft items)
- Verify billboarding is disabled for loaded items

---

## Best Practices

1. **Always sync transforms during gestures**, not just on gesture end
2. **Use throttling** (100ms) to prevent Redux spam
3. **Mark loaded items with `isFromDraft: true`** to differentiate from newly placed items
4. **Skip AR hit test placement** for draft-loaded items
5. **Disable billboarding** for portals loaded from drafts (they have saved rotations)
