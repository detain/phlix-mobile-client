#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  self.moduleName = @"PhlixMobile";
  self.initialProps = @{};

  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  // Also, any additional props passed to the RCTRootView from the JS side
  // will be in this dictionary.

  // Set the rootView background color to match the app's theme
  self.window.backgroundColor = [UIColor colorWithRed:0.059 green:0.059 blue:0.102 alpha:1.0];

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
