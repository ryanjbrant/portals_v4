# CRITICAL_README.md - iOS App Launch Requirements

> ⚠️ **READ THIS BEFORE RUNNING THE APP** ⚠️

This document outlines critical issues with the iOS build and how they are managed.

---

## 🚨 Known Issues & Fixes

### 1. ViroReact Version (CRITICAL)

**Problem**: ViroReact 2.50.0 causes native crashes on iOS due to missing dynamic framework dependencies (`GTMSessionFetcher`, `GoogleToolboxForMac`).

**Fix**: `@reactvision/react-viro` is pinned to version `2.43.6` exactly.

```json
// package.json - DO NOT CHANGE THIS
"@reactvision/react-viro": "2.43.6"
```

⚠️ **Never use `^2.43.6`** - the caret allows npm to install newer broken versions.

---

### 2. ViroMaterials Asset Registry Patch (CRITICAL)

**Problem**: ViroMaterials.js uses `__importDefault` wrapper but React Native 0.81.5's AssetRegistry only has named exports. This causes:
```
TypeError: Cannot read property 'getAssetByID' of undefined
```

**Fix**: A patch is applied automatically via `patch-package`.

**Files involved**:
- `patches/@reactvision+react-viro+2.43.6.patch` - The fix
- `package.json` → `"postinstall": "patch-package"` - Auto-applies on install

⚠️ **The `patches/` directory MUST be committed to git.**

---

### 3. Metro Connection Issues on Physical Device

**Problem**: Physical iOS devices show "No development servers found" when using local network.

**Fix**: Use tunnel mode for reliable connectivity:

```bash
npx expo start --dev-client --tunnel
```

Then enter the tunnel URL manually on device (e.g., `https://xxxxx-anonymous-8081.exp.direct`).

---

## 📋 Development Setup Checklist

1. **Install dependencies**:
   ```bash
   npm install
   ```
   (This automatically applies patches via postinstall)

2. **Install CocoaPods**:
   ```bash
   cd ios && pod install && cd ..
   ```

3. **Build & Run**:
   ```bash
   # Option A: Build via Expo (recommended)
   npx expo run:ios --device
   
   # Option B: Open in Xcode
   open ios/PortalsRaw.xcworkspace
   ```

4. **Start Metro with tunnel** (if device can't find server):
   ```bash
   npx expo start --dev-client --tunnel
   ```

---

## 🔧 Troubleshooting

### App crashes immediately on launch
- Verify ViroReact version is exactly `2.43.6`
- Run `npm install` to ensure patches are applied
- Run `pod install` in `ios/` directory

### "Cannot read property 'getAssetByID' of undefined"
- Check that `patches/@reactvision+react-viro+2.43.6.patch` exists
- Run `npm install` to apply the patch
- Restart Metro with `--clear` flag: `npx expo start --clear`

### "No development servers found"
- Use tunnel mode: `npx expo start --dev-client --tunnel`
- Manually enter the tunnel URL on device

### Videos/content not loading
- Ensure device has internet connectivity
- Use tunnel mode instead of local network

---

## 📦 For TestFlight / Production Builds

The patches are automatically applied during the build process:

1. ✅ `patch-package` is in devDependencies
2. ✅ `postinstall` script applies patches after `npm install`
3. ✅ **Commit the `patches/` directory to git**

No manual intervention needed for CI/CD builds.

---

## 🔗 Related Files

| File | Purpose |
|------|---------|
| `package.json` | ViroReact version + postinstall script |
| `patches/@reactvision+react-viro+2.43.6.patch` | AssetRegistry fix |
| `ios/Podfile` | CocoaPods configuration |
| `ios/Podfile.lock` | Locked pod versions |

---

*Last updated: December 19, 2024*
