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
  # The glob already includes PhlixWebAuthn.swift/.m (E10e passkey module) — no
  # explicit source list to maintain.
  s.source_files = "*.{h,m,swift}"
  s.swift_version = "5.0"
  # AuthenticationServices powers the WebAuthn/passkey ceremony (E10e); AVKit +
  # AVFoundation back the video player. All are system frameworks.
  s.frameworks   = "AVKit", "AVFoundation", "AuthenticationServices"
  s.dependency "React-Core"
end
