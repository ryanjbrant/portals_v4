#!/bin/bash
# Patch ViroKit.podspec to add PromisesObjC dependency

PODSPEC="$PROJECT_DIR/node_modules/@reactvision/react-viro/ios/dist/ViroRenderer/ViroKit.podspec"

if [ -z "$PROJECT_DIR" ]; then
  PODSPEC="/Users/ryan/Projects/Portals_Raw/node_modules/@reactvision/react-viro/ios/dist/ViroRenderer/ViroKit.podspec"
fi

if [ -f "$PODSPEC" ]; then
  # Check if already patched
  if grep -q "PromisesObjC" "$PODSPEC"; then
    echo "ViroKit.podspec already patched"
    exit 0
  fi
  
  # Add the dependency before the 'end' line
  sed -i '' "s/s.dependency 'React'/s.dependency 'React'\n  s.dependency 'PromisesObjC', '~> 2.4'/" "$PODSPEC"
  echo "ViroKit.podspec patched successfully"
else
  echo "ViroKit.podspec not found at $PODSPEC"
  exit 1
fi
