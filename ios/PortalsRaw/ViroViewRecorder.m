#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE (ViroViewRecorder, NSObject)

RCT_EXTERN_METHOD(startRecording : (nonnull NSNumber *)viewTag fileName : (
    nonnull NSString *)fileName resolver : (RCTPromiseResolveBlock)
                      resolve rejecter : (RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(stopRecording : (RCTPromiseResolveBlock)
                      resolve rejecter : (RCTPromiseRejectBlock)reject)

@end
