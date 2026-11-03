// ios/LocalPods/PhlixPlayer/PhlixRandom.m
//
// M7 (deferred lane): Obj-C bridge for the Swift PhlixRandom module. Method
// name + arg order MUST match PhlixRandom.swift, the Android module
// (android/.../random/PhlixRandomModule.kt) and src/native/types.ts
// (PhlixRandomInterface).
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(PhlixRandom, NSObject)

RCT_EXTERN_METHOD(randomHex:(nonnull NSNumber *)byteCount
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
