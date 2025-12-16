# Figment AR Screen

AR scene composer with 3D models, portals, and effects. Ported from the original [ViroReact Figment AR](https://github.com/viromedia/figment-ar) sample app.

## Architecture

```
FigmentAR/
├── app.js                 # Main component with UI and Redux dispatch
├── figment.js             # ViroARScene with model/portal/effect rendering
├── component/
│   ├── ModelItemRender.js # Renders individual 3D models
│   ├── PortalItemRender.js # Renders individual portals
│   ├── EffectItemRender.js # Renders effects (particles, post-processing)
│   ├── FigmentListView.js # Bottom item picker list
│   └── ListViewItem.js    # Individual list items
├── model/
│   ├── ModelItems.js      # 3D model data definitions
│   └── PortalItems.js     # Portal data definitions
├── redux/
│   ├── actions/index.js   # Redux action creators
│   └── reducers/arobjects.js # Redux reducer for AR objects
└── res/                   # 3D assets, textures, icons
```

---

## Critical Code Patterns

### Pattern 1: _isMounted Guard

**ALWAYS guard async callbacks with `_isMounted` check to prevent crashes.**

```javascript
// In component definition:
componentDidMount() {
  this._isMounted = true;
},

componentWillUnmount() {
  this._isMounted = false;
},

// In async methods:
_someAsyncMethod() {
  if (!this._isMounted) return;
  
  somePromise.then(() => {
    if (!this._isMounted) return;  // Check again after await
    this.setState({ ... });
  });
}
```

### Pattern 2: ForceUpdate on Mount

**Required to work around ViroReact batching - items won't render on first tap without this.**

```javascript
componentDidMount() {
  this._isMounted = true;
  
  // CRITICAL: Force re-render after 100ms
  this.setTimeout(() => {
    if (this._isMounted) {
      this.forceUpdate();
    }
  }, 100);
},
```

### Pattern 3: Hidden Instead of Delete

**NEVER delete objects from Redux - mark as hidden instead.**

```javascript
// In redux/reducers/arobjects.js:
function removeModelItem(state = {}, action) {
  // DON'T DO THIS - causes native crash:
  // delete newState[action.uuid];
  
  // DO THIS - set hidden flag:
  if (state[action.uuid] != null) {
    let newState = { ...state };
    newState[action.uuid] = { ...state[action.uuid], hidden: true };
    return newState;
  }
  return state;
}
```

### Pattern 4: Visibility Based on Hidden Prop

```javascript
// In ModelItemRender.js / PortalItemRender.js render():
const isVisible = this.props.isHidden ? false : this.state.nodeIsVisible;

return (
  <ViroNode visible={isVisible} ...>
```

---

## Known Issues & Workarounds

### 1. Object Removal Crash

**Problem:** App crashes when removing models or portals via the trash button or "Remove All Objects".

**Root Cause:** ViroReact native unmount code crashes when ViroPortalScene or Viro3DObject is removed from the scene graph.

**Solution:** Instead of deleting objects from Redux state, mark them as `hidden: true` and filter them out in rendering.

**Files modified:**
| File | Change |
|------|--------|
| `redux/reducers/arobjects.js` | `removeModelItem` sets `hidden: true` instead of deleting |
| `figment.js` | Passes `isHidden` prop to render components |
| `ModelItemRender.js` | Sets `visible={false}` when `isHidden=true` |
| `PortalItemRender.js` | Sets `visible={false}` when `isHidden=true` |

---

### 2. First-Tap Visibility Issue

**Problem:** First tap on an item adds it to Redux but doesn't make it visible. Second tap makes both items visible.

**Root Cause:** ViroReact batching issue where first render cycle doesn't properly attach new nodes to the scene graph.

**Solution:** Force a re-render after 100ms delay in `componentDidMount`.

**Files modified:**
- `component/ModelItemRender.js` - Added `forceUpdate()` in `componentDidMount`
- `component/PortalItemRender.js` - Added `forceUpdate()` in `componentDidMount`

---

### 3. setState After Unmount

**Problem:** Async callbacks (timers, promises) executing after component unmount cause crashes.

**Solution:** Added `_isMounted` flag guards to all `setState` and `setNativeProps` calls.

**Affected methods in ModelItemRender.js:**
- `_onClickState` - Timer callback
- `_onItemClicked` - setState
- `_onRotate` - setState and setNativeProps
- `_onPinch` - setState and setNativeProps
- `_setInitialPlacement` - setState
- `_updateInitialRotation` - Promise callback with setState

**Affected methods in PortalItemRender.js:**
- `_onClickState` - Timer callback
- `_onPortalEnter` / `_onPortalExit` - setState
- `_onRotate` - setState and setNativeProps
- `_onPinch` - setState and setNativeProps
- `_setInitialPlacement` - setState
- `_updateInitialRotation` - Promise callback with setState

---

### 4. Model Crash with Animation/Materials

**Problem:** Adding complex props to Viro3DObject (animation, materials, bitmasks) causes native crashes.

**Solution:** Simplified Viro3DObject to essential props only.

**Working configuration:**
```javascript
<Viro3DObject
  source={modelItem.obj}
  type={modelItem.type}
  resources={modelItem.resources}
  scale={this.state.scale}
  onClickState={this._onClickState(this.props.modelIDProps.uuid)}
  onError={this._onError(this.props.modelIDProps.uuid)}
  onLoadStart={this._onObjectLoadStart(this.props.modelIDProps.uuid)}
  onLoadEnd={this._onObjectLoadEnd(this.props.modelIDProps.uuid)}
/>
```

**DO NOT ADD these props (they cause crashes):**
- ❌ `materials={"pbr"}`
- ❌ `animation={{...modelItem.animation, "run": this.state.runAnimation}}`
- ❌ `lightReceivingBitMask={...}`
- ❌ `shadowCastingBitMask={...}`
- ❌ `onRotate={this._onRotate}`
- ❌ `onPinch={this._onPinch}`

---

### 5. ViroSpotLight Crash

**Problem:** ViroSpotLight within individual render components causes crashes when objects are removed.

**Solution:** Commented out ViroSpotLight in ModelItemRender and PortalItemRender. Use global ambient light only (defined in figment.js).

---

## Critical Functions Flow

### Adding an Object

```
User taps item in list
    ↓
FigmentListView._onListItemPressed(index)
    ↓
app.js._onListPressed(index)
    ↓
dispatchAddModel(index) or dispatchAddPortal(index)
    ↓
Redux adds item to modelItems/portalItems with new UUID
    ↓
figment.js._renderModels() / _renderPortals()
    ↓
ModelItemRender / PortalItemRender created
    ↓
componentDidMount → forceUpdate after 100ms
    ↓
Viro3DObject/ViroPortalScene loads
    ↓
onLoadEnd triggers
    ↓
_onARHitTestResults positions object
    ↓
Object visible in AR
```

### Removing an Object

```
User taps trash button
    ↓
app.js._onContextMenuRemoveButtonPressed()
    ↓
dispatchChangeItemClickState(-1, '', '') // Clears selection immediately
    ↓
TimerMixin.setTimeout 200ms
    ↓
dispatchRemoveModelWithUUID(uuid) or dispatchRemovePortalWithUUID(uuid)
    ↓
Redux sets hidden:true (NOT delete)
    ↓
figment.js passes isHidden={true} to component
    ↓
Component renders with visible={false}
    ↓
Object hidden (NOT unmounted - prevents crash)
```

---

## Debugging Tips

### Model Not Appearing
1. Check console for `[ModelItemRender] render - UUID:` logs
2. Verify `nodeIsVisible: true` in initial state
3. Check if `forceUpdate` is in `componentDidMount`
4. Look for errors in `onLoadStart`/`onLoadEnd` callbacks

### Crash on Delete
1. Check if using `hidden: true` pattern (not `delete`)
2. Verify `isHidden` prop is passed in `figment.js`
3. Check `_isMounted` guards on all async callbacks
4. Look for ViroSpotLight that should be commented out

### Items Duplicating
1. Check UUID generation is using `uuidv4()` correctly
2. Verify `key={item.uuid}` is set on components
3. Check Redux reducer for proper immutable updates

---

## Dependencies

- `@reactvision/react-viro` - AR/VR components (NOT original `react-viro`)
- `react-redux` - State management
- `react-native-video` - Video playback in portals
- `react-native-share` - Share functionality
- `uuid` - UUID generation for object IDs

---

## Testing Checklist

After making changes, verify:

- [ ] Tap model icon → model appears immediately (not on second tap)
- [ ] Tap portal icon → portal appears immediately
- [ ] Tap trash icon → object disappears (no crash)
- [ ] Tap "Remove All Objects" → all objects removed (no crash)
- [ ] Add multiple items → all visible and interactive
- [ ] Walk through portal → 360 image/video visible inside
- [ ] Rapid tapping → no crashes, no duplicates

---

## Restoration Instructions

If something breaks, compare with: `_ref/figment-ar/js/`

### To restore object removal:
1. Revert `redux/reducers/arobjects.js` to use `hidden: true` pattern
2. Ensure `figment.js` passes `isHidden` prop
3. Ensure render components check `isHidden` in visibility

### To restore first-tap visibility:
1. Add `forceUpdate()` in `componentDidMount` for both render components
2. Set `nodeIsVisible: true` in `getInitialState()`

### To restore safe async:
1. Add `_isMounted` flag in `componentDidMount` / `componentWillUnmount`
2. Guard ALL `setState` calls with `if (this._isMounted)`
3. Guard ALL `setNativeProps` calls with `if (this.arNodeRef)`

---

## Version History

| Date | Change |
|------|--------|
| 2024-12-16 | Fixed object removal crash (hidden instead of delete) |
| 2024-12-16 | Fixed first-tap visibility (forceUpdate workaround) |
| 2024-12-16 | Fixed async crashes (_isMounted guards) |
| 2024-12-16 | Simplified Viro3DObject props |

