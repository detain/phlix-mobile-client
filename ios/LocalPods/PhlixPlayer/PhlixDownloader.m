// ios/LocalPods/PhlixPlayer/PhlixDownloader.m
//
// UNTESTED-in-CI: no device/simulator build runs in this environment.
// Obj-C bridge for the Swift PhlixDownloader (RCTEventEmitter). Method names,
// arg order and the 5-arg startDownload shape MUST match src/native/types.ts
// (PhlixDownloaderInterface) and the Android module.
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(PhlixDownloader, RCTEventEmitter)

RCT_EXTERN_METHOD(startDownload:(NSString *)taskId
                  url:(NSString *)url
                  localPath:(NSString *)localPath
                  resumeOffset:(nonnull NSNumber *)resumeOffset
                  totalBytesHint:(nonnull NSNumber *)totalBytesHint)

RCT_EXTERN_METHOD(pauseDownload:(NSString *)taskId)
RCT_EXTERN_METHOD(resumeDownload:(NSString *)taskId)
RCT_EXTERN_METHOD(cancelDownload:(NSString *)taskId)

RCT_EXTERN_METHOD(deleteFile:(NSString *)localPath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
