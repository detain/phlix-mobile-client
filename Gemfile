source 'https://rubygems.org'

# Pin the iOS toolchain gems (MOB-21): CI runs `bundle exec pod install` so the
# CocoaPods version is lock-controlled instead of whatever the macOS runner
# image ships. Same culture as android/gradle/wrapper/gradle-wrapper.properties.
gem 'cocoapods', '1.17.0'
# RN's Podfile needs these on newer Rubies (see react-native template Gemfile).
gem 'activesupport', '>= 6.1.7.5', '!= 7.1.0'
gem 'concurrent-ruby', '< 1.3.4'
gem 'bigdecimal'
gem 'logger'
gem 'benchmark'
gem 'mutex_m'
