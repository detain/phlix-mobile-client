// ios/LocalPods/PhlixPlayer/PhlixRandom.swift
//
// M7 (deferred lane): CSPRNG-backed random bytes for device identity — the
// iOS twin of android/.../random/PhlixRandomModule.kt. RN core has no
// crypto.getRandomValues on the JS side, so we expose the platform CSPRNG
// (SecRandomCopyBytes, kSecRandomDefault) directly instead of adding a
// third-party crypto package.
//
// Method name + arg order + the hex-string out shape MUST match
// src/native/types.ts (PhlixRandomInterface) and the Android module.
//
// CI venue: the Build iOS job compiles this (xcodebuild simulator); no device
// run in this environment.
import Foundation
import React
import Security

@objc(PhlixRandom)
class PhlixRandom: NSObject {

    // Plain RCT_EXTERN_MODULE export (not a view manager) — same idiom as
    // PhlixWebAuthn in this pod. No UI, no main-queue requirement.
    @objc static func requiresMainQueueSetup() -> Bool {
        return false
    }

    @objc(randomHex:resolver:rejecter:)
    func randomHex(_ byteCount: NSNumber,
                   resolver resolve: @escaping RCTPromiseResolveBlock,
                   rejecter reject: @escaping RCTPromiseRejectBlock) {
        let count = byteCount.intValue
        guard count > 0, count <= 4096 else {
            reject("E_RANDOM_ARGS", "byteCount must be within 1..4096, got \(count)", nil)
            return
        }
        var bytes = [UInt8](repeating: 0, count: count)
        let status = SecRandomCopyBytes(kSecRandomDefault, count, &bytes)
        guard status == errSecSuccess else {
            reject("E_RANDOM_NATIVE", "SecRandomCopyBytes failed with OSStatus \(status)", nil)
            return
        }
        var hex = String()
        hex.reserveCapacity(count * 2)
        for b in bytes {
            hex += String(format: "%02x", b)
        }
        resolve(hex)
    }
}
