import { requireNativeView } from 'expo';
import * as React from 'react';

import { ArViewRecorderViewProps } from './ArViewRecorder.types';

const NativeView: React.ComponentType<ArViewRecorderViewProps> =
  requireNativeView('ArViewRecorder');

export default function ArViewRecorderView(props: ArViewRecorderViewProps) {
  return <NativeView {...props} />;
}
