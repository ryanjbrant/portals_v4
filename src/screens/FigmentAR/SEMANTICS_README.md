# Scene Semantics API
Scene Semantics is an ARCore feature that uses machine learning to classify each pixel in the camera feed into semantic categories like sky, buildings, roads, trees, and more. This enables powerful outdoor AR experiences that can understand and react to the real-world environment.

## Overview
The Scene Semantics API provides:

- Real-time semantic segmentation of the camera feed
- 12 semantic labels covering common outdoor scene elements
- Per-frame label fractions showing what percentage of the view contains each element

## Requirements
### Platform Support
| Platform | Requirements |
|----------|--------------|
| Android  | ARCore 1.31+ and a compatible device. Scene Semantics is included in the standard ARCore SDK. |
| iOS      | ARCore SDK for iOS with Semantics extension. Requires API key with ARCore API enabled. |

### Device Requirements
- Scene Semantics requires significant GPU/NPU resources
- Not all ARCore-compatible devices support Scene Semantics
- Always check `isSemanticModeSupported()` before enabling

## Expo Projects
For Expo projects, the plugin handles all native configuration automatically. Scene Semantics is automatically included when you enable Cloud Anchors or Geospatial features.

1. Configure `app.json` or `app.config.js`:

```json
{
  "expo": {
    "plugins": [
      [
        "@reactvision/react-viro",
        {
          "googleCloudApiKey": "AQ.Ab8RN6KGfX_x0kf5ob_SIXlrmk_3DqGQwr5kZUBFewMjsnPpaQ",
          "cloudAnchorProvider": "arcore",
          "android": {
            "xRMode": ["AR"]
          }
        }
      ]
    ]
  }
}
```
Note: Setting `cloudAnchorProvider: "arcore"` or `geospatialAnchorProvider: "arcore"` automatically includes Scene Semantics support.

2. Rebuild your app:

```bash
npx expo prebuild --clean
npx expo run:ios
# or
npx expo run:android
```

That's it! The Expo plugin automatically configures:

| Platform | What the plugin adds |
|----------|----------------------|
| iOS      | `GARAPIKey` in Info.plist, `use_frameworks! :linkage => :dynamic` in Podfile, ARCore/CloudAnchors and ARCore/Semantics pods |
| Android  | `com.google.android.ar.API_KEY` meta-data in AndroidManifest.xml (Scene Semantics is included in standard ARCore SDK) |

## Semantic Labels
The API classifies pixels into 12 categories:

| Label | Description |
|-------|-------------|
| unlabeled | Pixels that couldn't be classified |
| sky | Sky, clouds, sun |
| building | Buildings, houses, structures |
| tree | Trees, bushes, vegetation |
| road | Paved roads, streets |
| sidewalk | Sidewalks, pedestrian paths |
| terrain | Grass, dirt, natural ground |
| structure | Fences, poles, signs, bridges |
| object | Cars (parked), benches, trash cans |
| vehicle | Moving vehicles |
| person | People, pedestrians |
| water | Rivers, lakes, pools, fountains |

## Quick Start
### 1. Check Support
Always verify that Scene Semantics is supported on the current device:

```typescript
import { ViroARSceneNavigator } from "@reactvision/react-viro";

function MyARScene({ arSceneNavigator }) {
  const [semanticsSupported, setSemanticsSupported] = useState(false);

  useEffect(() => {
    async function checkSupport() {
      const { supported } = await arSceneNavigator.isSemanticModeSupported();
      setSemanticsSupported(supported);

      if (supported) {
        // Enable semantics
        arSceneNavigator.setSemanticModeEnabled(true);
      }
    }
    checkSupport();
  }, []);

  // ...
}
```

### 2. Enable Semantic Mode
```typescript
// Enable semantic processing
arSceneNavigator.setSemanticModeEnabled(true);

// Disable when no longer needed (saves battery/resources)
arSceneNavigator.setSemanticModeEnabled(false);
```

### 3. Get Label Fractions
Retrieve the percentage of pixels for each semantic label:

```typescript
// Get all label fractions at once
const { success, fractions } =
  await arSceneNavigator.getSemanticLabelFractions();

if (success && fractions) {
  console.log(`Sky: ${(fractions.sky * 100).toFixed(1)}%`);
  console.log(`Building: ${(fractions.building * 100).toFixed(1)}%`);
  console.log(`Road: ${(fractions.road * 100).toFixed(1)}%`);
  console.log(`Tree: ${(fractions.tree * 100).toFixed(1)}%`);
}
```

Or get a specific label:

```typescript
// Get fraction for a specific label
const { success, fraction } = await arSceneNavigator.getSemanticLabelFraction(
  "sky"
);

if (success) {
  console.log(`Sky covers ${(fraction * 100).toFixed(1)}% of the view`);
}
```

## API Reference
### `isSemanticModeSupported()`
Check if Scene Semantics is supported on the current device.

```typescript
const result: ViroSemanticSupportResult =
  await arSceneNavigator.isSemanticModeSupported();
```
**Returns**: `Promise<ViroSemanticSupportResult>`
- `supported: boolean` - Whether semantics is supported
- `error?: string` - Error message if check failed

### `setSemanticModeEnabled(enabled: boolean)`
Enable or disable Scene Semantics processing.

```typescript
arSceneNavigator.setSemanticModeEnabled(true); // Enable
arSceneNavigator.setSemanticModeEnabled(false); // Disable
```
**Parameters**:
- `enabled: boolean` - Whether to enable semantic processing
*Note: Enabling semantics uses additional GPU/battery resources. Disable when not needed.*

### `getSemanticLabelFractions()`
Get the fraction of pixels for all semantic labels in the current frame.

```typescript
const result: ViroSemanticLabelFractionsResult =
  await arSceneNavigator.getSemanticLabelFractions();
```
**Returns**: `Promise<ViroSemanticLabelFractionsResult>`
- `success: boolean` - Whether the operation succeeded
- `fractions?: ViroSemanticLabelFractions` - Object with all label fractions
- `error?: string` - Error message if failed

### `getSemanticLabelFraction(label: ViroSemanticLabel)`
Get the fraction for a specific semantic label.

```typescript
const result: ViroSemanticLabelFractionResult =
  await arSceneNavigator.getSemanticLabelFraction("sky");
```
**Parameters**:
- `label: ViroSemanticLabel` - The label to query ("sky", "building", "road", etc.)

**Returns**: `Promise<ViroSemanticLabelFractionResult>`
- `success: boolean` - Whether the operation succeeded
- `fraction: number` - Fraction of pixels (0.0 to 1.0)
- `error?: string` - Error message if failed

## Use Cases
### Outdoor Detection
Determine if the user is outdoors by checking sky visibility:

```typescript
async function isOutdoors(arSceneNavigator) {
  const { success, fraction } = await arSceneNavigator.getSemanticLabelFraction(
    "sky"
  );

  if (success) {
    // If more than 10% sky is visible, likely outdoors
    return fraction > 0.1;
  }
  return false;
}
```

## Troubleshooting
### "Semantics not supported"
- Ensure you're running on a compatible device
- Check that ARCore is up to date
- Verify the app has camera permissions

### Fractions are all zero
- Make sure `setSemanticModeEnabled(true)` was called
- Wait a few frames after enabling for ML processing to start
- Ensure the camera has a clear view (not blocked/covered)
- iOS: Verify the `GARAPIKey` is correctly set in Info.plist

### iOS-specific issues
- "GARAPIKey not found": Add `<key>GARAPIKey</key><string>YOUR_KEY</string>` to Info.plist
- "Failed to create GARSession": Check that `ARCore/Semantics` pod is installed (`pod install`)
