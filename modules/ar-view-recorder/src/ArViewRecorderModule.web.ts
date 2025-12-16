import { registerWebModule, NativeModule } from 'expo';

import { ChangeEventPayload } from './ArViewRecorder.types';

type ArViewRecorderModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
}

class ArViewRecorderModule extends NativeModule<ArViewRecorderModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(ArViewRecorderModule, 'ArViewRecorderModule');
