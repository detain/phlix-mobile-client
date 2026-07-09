// ios/LocalPods/PhlixPlayer/PhlixPlayerViewManager.m
#import <React/RCTViewManager.h>

@interface RCT_EXTERN_MODULE(PhlixPlayerView, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(src, NSString)
RCT_EXPORT_VIEW_PROPERTY(autoPlay, BOOL)
RCT_EXPORT_VIEW_PROPERTY(startPosition, double)
RCT_EXPORT_VIEW_PROPERTY(volume, float)
RCT_EXPORT_VIEW_PROPERTY(muted, BOOL)
// E3-native (UNTESTED in CI): selected subtitle VTT URL, "" = off.
RCT_EXPORT_VIEW_PROPERTY(subtitleUrl, NSString)
RCT_EXPORT_VIEW_PROPERTY(onPlaybackEvent, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onProgress, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onError, RCTDirectEventBlock)

RCT_EXTERN_METHOD(play)
RCT_EXTERN_METHOD(pause)
RCT_EXTERN_METHOD(seekTo:(double)position)
RCT_EXTERN_METHOD(updateVolume:(float)volume)
RCT_EXTERN_METHOD(updateMuted:(BOOL)muted)
// P3-S4: Picture-in-Picture
RCT_EXTERN_METHOD(startPiP)
RCT_EXTERN_METHOD(stopPiP)

@end
