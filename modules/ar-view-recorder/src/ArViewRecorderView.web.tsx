import * as React from 'react';

import { ArViewRecorderViewProps } from './ArViewRecorder.types';

export default function ArViewRecorderView(props: ArViewRecorderViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
