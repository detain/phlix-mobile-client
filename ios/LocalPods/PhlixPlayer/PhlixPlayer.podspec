# ios/LocalPods/PhlixPlayer/PhlixPlayer.podspec
Pod::Spec.new do |s|
  s.name         = "PhlixPlayer"
  s.version      = "1.0.0"
  s.summary      = "Native video player for Phlix Mobile"
  s.description  = "AVKit-based video player with HLS support for Phlix Media Server"
  s.homepage     = "https://github.com/phlix-media/phlix-mobile"
  s.license      = "MIT"
  s.author       = { "Phlix" => "contact@phlix.media" }
  s.platform     = :ios, "15.1"
  s.source       = { :path => "." }
  s.source_files = "*.{h,m,swift}"
  s.swift_version = "5.0"
  s.dependency "React-Core"
end
