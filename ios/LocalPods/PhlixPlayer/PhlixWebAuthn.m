// ios/LocalPods/PhlixPlayer/PhlixWebAuthn.m
//
// UNTESTED-in-CI / device-only: a passkey ceremony cannot run in CI or a
// simulator (the system biometric/PIN sheet only exists on a real device).
//
// Obj-C bridge for the Swift PhlixWebAuthn module. Method names + arg order +
// the JSON-string in / JSON-string out shape MUST match src/native/types.ts
// (PhlixWebAuthnInterface) and the Android module.
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(PhlixWebAuthn, NSObject)

RCT_EXTERN_METHOD(isSupported:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(register:(NSString *)optionsJson
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(authenticate:(NSString *)optionsJson
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
