//
//  VideoMerger.m
//  PortalsRaw
//
//  Objective-C bridge for the VideoMerger Swift module
//

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE (VideoMerger, NSObject)

RCT_EXTERN_METHOD(merge : (NSArray *)videoPaths outputPath : (NSString *)
                      outputPath resolver : (RCTPromiseResolveBlock)
                          resolve rejecter : (RCTPromiseRejectBlock)reject)

@end
