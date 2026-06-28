// ios/LocalPods/PhlixPlayer/PhlixWebAuthn.swift
//
// UNTESTED-in-CI / device-only: no simulator can run a passkey ceremony — the
// platform shows a system biometric/PIN sheet that only exists on a real
// device. The JS wrapper (src/native/PhlixWebAuthn.ts) reports isSupported()
// false and the UI hides the affordances when this module is absent, so Jest +
// non-native runs stay functional.
//
// Method names / arg order / the JSON-string in & JSON-string out shape MUST
// match src/native/types.ts (PhlixWebAuthnInterface) and the Android module
// (android/.../webauthn/PhlixWebAuthnModule.kt).
//
// Uses ASAuthorizationPlatformPublicKeyCredentialProvider (iOS 15+ passkeys).
// The bridge stays thin: it parses the server's WebAuthn options JSON (rpId,
// challenge base64url -> Data, user.id base64url -> Data), runs an
// ASAuthorizationController, and returns the attestation/assertion as the
// standard WebAuthn JSON the server's verify endpoint expects (binary fields
// base64url-encoded).
import Foundation
import React
import AuthenticationServices

@objc(PhlixWebAuthn)
class PhlixWebAuthn: NSObject {

    // Strong reference to the in-flight controller + its delegate so ARC does
    // not deallocate them mid-ceremony. Only one ceremony runs at a time.
    private var activeDelegate: CeremonyDelegate?

    override static func requiresMainQueueSetup() -> Bool {
        return true
    }

    // MARK: - base64url helpers

    private static func dataFromBase64url(_ s: String) -> Data? {
        var base64 = s
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        // Pad to a multiple of 4.
        let remainder = base64.count % 4
        if remainder > 0 {
            base64 += String(repeating: "=", count: 4 - remainder)
        }
        return Data(base64Encoded: base64)
    }

    private static func base64url(_ data: Data) -> String {
        return data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private static func jsonString(_ object: [String: Any]) -> String? {
        guard let data = try? JSONSerialization.data(withJSONObject: object, options: []) else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    // MARK: - Exported methods

    @objc(isSupported:rejecter:)
    func isSupported(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        if #available(iOS 15.0, *) {
            resolve(true)
        } else {
            resolve(false)
        }
    }

    @objc(register:resolver:rejecter:)
    func register(
        _ optionsJson: String,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        guard #available(iOS 15.0, *) else {
            reject("unsupported", "Passkeys require iOS 15 or newer.", nil)
            return
        }
        guard
            let data = optionsJson.data(using: .utf8),
            let options = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        else {
            reject("bad_options", "Invalid registration options JSON.", nil)
            return
        }

        let rp = options["rp"] as? [String: Any]
        let user = options["user"] as? [String: Any]
        guard
            let rpId = rp?["id"] as? String,
            let challengeStr = options["challenge"] as? String,
            let challenge = PhlixWebAuthn.dataFromBase64url(challengeStr),
            let userIdStr = user?["id"] as? String,
            let userId = PhlixWebAuthn.dataFromBase64url(userIdStr)
        else {
            reject("bad_options", "Missing rp.id / challenge / user.id in options.", nil)
            return
        }
        let userName = (user?["name"] as? String) ?? (user?["displayName"] as? String) ?? ""

        let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(
            relyingPartyIdentifier: rpId
        )
        let request = provider.createCredentialRegistrationRequest(
            challenge: challenge,
            name: userName,
            userID: userId
        )

        runCeremony(request: request, isRegistration: true, resolve: resolve, reject: reject)
    }

    @objc(authenticate:resolver:rejecter:)
    func authenticate(
        _ optionsJson: String,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        guard #available(iOS 15.0, *) else {
            reject("unsupported", "Passkeys require iOS 15 or newer.", nil)
            return
        }
        guard
            let data = optionsJson.data(using: .utf8),
            let options = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
        else {
            reject("bad_options", "Invalid authentication options JSON.", nil)
            return
        }

        guard
            let rpId = options["rpId"] as? String,
            let challengeStr = options["challenge"] as? String,
            let challenge = PhlixWebAuthn.dataFromBase64url(challengeStr)
        else {
            reject("bad_options", "Missing rpId / challenge in options.", nil)
            return
        }

        let provider = ASAuthorizationPlatformPublicKeyCredentialProvider(
            relyingPartyIdentifier: rpId
        )
        let request = provider.createCredentialAssertionRequest(challenge: challenge)

        // Constrain to the server-supplied allowCredentials when present.
        if let allow = options["allowCredentials"] as? [[String: Any]] {
            let descriptors = allow.compactMap { entry -> ASAuthorizationPlatformPublicKeyCredentialDescriptor? in
                guard
                    let idStr = entry["id"] as? String,
                    let idData = PhlixWebAuthn.dataFromBase64url(idStr)
                else { return nil }
                return ASAuthorizationPlatformPublicKeyCredentialDescriptor(
                    credentialID: idData
                )
            }
            if !descriptors.isEmpty {
                request.allowedCredentials = descriptors
            }
        }

        runCeremony(request: request, isRegistration: false, resolve: resolve, reject: reject)
    }

    @available(iOS 15.0, *)
    private func runCeremony(
        request: ASAuthorizationRequest,
        isRegistration: Bool,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        DispatchQueue.main.async {
            let delegate = CeremonyDelegate(
                isRegistration: isRegistration,
                resolve: resolve,
                reject: { code, message, error in reject(code, message, error) },
                onFinish: { [weak self] in self?.activeDelegate = nil }
            )
            self.activeDelegate = delegate

            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = delegate
            controller.presentationContextProvider = delegate
            controller.performRequests()
        }
    }
}

// MARK: - Ceremony delegate

@available(iOS 15.0, *)
private class CeremonyDelegate: NSObject,
    ASAuthorizationControllerDelegate,
    ASAuthorizationControllerPresentationContextProviding {

    private let isRegistration: Bool
    private let resolve: RCTPromiseResolveBlock
    private let reject: (String, String, Error?) -> Void
    private let onFinish: () -> Void

    init(
        isRegistration: Bool,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping (String, String, Error?) -> Void,
        onFinish: @escaping () -> Void
    ) {
        self.isRegistration = isRegistration
        self.resolve = resolve
        self.reject = reject
        self.onFinish = onFinish
    }

    private static func base64url(_ data: Data) -> String {
        return data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private static func jsonString(_ object: [String: Any]) -> String? {
        guard let data = try? JSONSerialization.data(withJSONObject: object, options: []) else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        defer { onFinish() }

        if let reg = authorization.credential
            as? ASAuthorizationPlatformPublicKeyCredentialRegistration {
            let rawId = CeremonyDelegate.base64url(reg.credentialID)
            var response: [String: Any] = [
                "clientDataJSON": CeremonyDelegate.base64url(reg.rawClientDataJSON),
            ]
            if let attestation = reg.rawAttestationObject {
                response["attestationObject"] = CeremonyDelegate.base64url(attestation)
            }
            let credential: [String: Any] = [
                "id": rawId,
                "rawId": rawId,
                "type": "public-key",
                "response": response,
            ]
            if let json = CeremonyDelegate.jsonString(credential) {
                resolve(json)
            } else {
                reject("encode_failed", "Failed to encode attestation.", nil)
            }
            return
        }

        if let assertion = authorization.credential
            as? ASAuthorizationPlatformPublicKeyCredentialAssertion {
            let rawId = CeremonyDelegate.base64url(assertion.credentialID)
            var response: [String: Any] = [
                "clientDataJSON": CeremonyDelegate.base64url(assertion.rawClientDataJSON),
                "authenticatorData": CeremonyDelegate.base64url(assertion.rawAuthenticatorData),
                "signature": CeremonyDelegate.base64url(assertion.signature),
            ]
            response["userHandle"] = CeremonyDelegate.base64url(assertion.userID)
            let credential: [String: Any] = [
                "id": rawId,
                "rawId": rawId,
                "type": "public-key",
                "response": response,
            ]
            if let json = CeremonyDelegate.jsonString(credential) {
                resolve(json)
            } else {
                reject("encode_failed", "Failed to encode assertion.", nil)
            }
            return
        }

        reject("unexpected_credential", "Unexpected credential type.", nil)
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        defer { onFinish() }
        let nsError = error as NSError
        if nsError.domain == ASAuthorizationError.errorDomain,
           nsError.code == ASAuthorizationError.canceled.rawValue {
            reject("user_canceled", "Passkey prompt was cancelled.", error)
        } else {
            reject("ceremony_failed", error.localizedDescription, error)
        }
    }

    func presentationAnchor(
        for controller: ASAuthorizationController
    ) -> ASPresentationAnchor {
        // Prefer the active foreground scene's key window (multi-scene / iPad
        // safe; `UIApplication.shared.windows` is deprecated since iOS 15).
        let keyWindow = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }?
            .windows
            .first { $0.isKeyWindow }
        return keyWindow ?? ASPresentationAnchor()
    }
}
