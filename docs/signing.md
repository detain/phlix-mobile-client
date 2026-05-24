# Signing Guide

This document describes how to sign the Phlix Mobile client for both iOS and Android release builds.

## Why Signing Is Required

Code signing cryptographically authenticates the identity of the application publisher and ensures that the binary has not been tampered with since it was signed.

- **iOS**: Apple requires all apps distributed outside the App Store (including Ad Hoc and Enterprise distributions) to be signed with a valid Apple Distribution Certificate and provisioning profile.
- **Android**: Android requires APKs and AABs to be signed before they can be installed on devices or published to the Google Play Store.

---

## iOS Signing

### Prerequisites

- An active **Apple Developer Program** membership ([developer.apple.com](https://developer.apple.com))
- A Mac with **Xcode** installed
- An **App-Specific Password** for your Apple ID (required for CI signing)
- A **Distribution Certificate** (`.p12` file)
- A **Provisioning Profile** (`.mobileprovision` file)

### Required Credentials

| Credential | Purpose |
|---|---|
| Apple ID | Authentication with Apple developer services |
| App-Specific Password | Used by CI to authenticate Apple ID |
| Distribution Certificate (`.p12`) | Code signing identity — contains private key + certificate |
| Provisioning Profile (`.mobileprovision`) | Grants permission to install/publish the app for specific devices or distribution types |

### Types of Distribution Certificates

| Type | Use Case |
|---|---|
| **Apple Distribution** | App Store Connect submissions and Ad Hoc/Enterprise distribution |
| **Developer** | Internal testing only (not for release) |

### Step-by-Step Manual Signing

#### 1. Export or Import Your Certificate

If you have a certificate on another Mac, export it:

```bash
# Export from Keychain Access
security export -k "Apple Distribution: Your Name (TEAMID)" -t identity -f pkcs12 -o cert.p12
```

To import a certificate on a new machine:

```bash
security import cert.p12 -k ~/Library/Keychains/login.keychain
```

#### 2. Obtain or Renew a Provisioning Profile

1. Go to [developer.apple.com → Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/profiles)
2. Create a new **Provisioning Profile**:
   - Type: **App Store** (for TestFlight/App Store) or **Ad Hoc** (for direct device testing)
   - App ID: Select the App ID matching your bundle identifier (`com.phlixmobile` by default)
   - Select your Distribution Certificate
   - Add device UDIDs if using Ad Hoc
3. Download the `.mobileprovision` file

#### 3. Install the Provisioning Profile

```bash
# Copy to ~/Library/MobileDevice/Provisioning Profiles/
cp your_profile.mobileprovision ~/Library/MobileDevice/Provisioning\ Profiles/
```

#### 4. Configure Xcode Signing

1. Open `ios/PhlixMobile.xcworkspace` in Xcode
2. Select the **PhlixMobile** scheme → **Product** → **Archive**
3. In the Xcode Organizer, select your archive and click **Distribute App**
4. Choose your distribution method (App Store Connect / Ad Hoc / Enterprise)
5. Select the signing identity and provisioning profile
6. Complete the export

Alternatively, configure signing in the Xcode project directly:

- **Signing & Capabilities** tab: Set "Automatically manage signing" = OFF for manual control
- Set Code Signing Identity → Release → "Apple Distribution: Your Name (TEAMID)"
- Set Provisioning Profile → your profile

#### 5. Build a Signed IPA (Manual)

```bash
cd ios
xcodebuild -workspace PhlixMobile.xcworkspace \
  -scheme PhlixMobile \
  -configuration Release \
  -archivePath build/PhlixMobile.xcarchive \
  -exportArchive \
  -exportOptionsPlist exportOptions.plist \
  CODE_SIGNING_ALLOWED=YES
```

Create `exportOptions.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store</string>
    <key>signingCertificate</key>
    <string>Apple Distribution: Your Name (TEAMID)</string>
    <key>provisioningProfiles</key>
    <dict>
        <key>com.phlixmobile</key>
        <string>Your Provisioning Profile Name</string>
    </dict>
</dict>
</plist>
```

### CI Signing Configuration (When Ready)

When you are ready to wire CI to sign builds automatically:

1. Store the following as **GitHub Actions secrets** in the repository:
   - `APPLE_ID` — your Apple ID email
   - `APPLE_APP_SPECIFIC_PASSWORD` — app-specific password for your Apple ID
   - `APPLE_TEAM_ID` — your Apple Developer Team ID
   - `CERTIFICATE` — base64-encoded `.p12` distribution certificate
   - `CERTIFICATE_PASSWORD` — password for the `.p12` file
   - `PROVISIONING_PROFILE` — base64-encoded `.mobileprovision` file

2. In `.github/workflows/build-ios.yml`, add an `Import Certificate` step before building:

```yaml
- name: Import Certificate
  env:
    CERTIFICATE: ${{ secrets.CERTIFICATE }}
    CERTIFICATE_PASSWORD: ${{ secrets.CERTIFICATE_PASSWORD }}
  run: |
    echo "$CERTIFICATE" | base64 --decode --output /tmp/cert.p12
    security import /tmp/cert.p12 -k ~/Library/Keychains/login.keychain -P "$CERTIFICATE_PASSWORD" -T /usr/bin/codesign -T /usr/bin/codesign_allocate

- name: Install Provisioning Profile
  env:
    PROVISIONING_PROFILE: ${{ secrets.PROVISIONING_PROFILE }}
  run: |
    echo "$PROVISIONING_PROFILE" | base64 --decode --output ~/Library/MobileDevice/Provisioning\ Profiles/profile.mobileprovision
```

3. Remove `CODE_SIGNING_ALLOWED=NO` from the release build step and provide `EXPORT_OPTIONS_PATH` pointing to a plist with `method`, `signingCertificate`, and `provisioningProfiles` entries.

> **Note**: Signing configurations that require private keys and certificates are intentionally **not hardcoded** in the repository. Store all secrets in GitHub Actions secrets or a proper secrets manager.

### Known Issues

- **"No profiles for bundle identifier"**: Ensure the provisioning profile's App ID matches the Xcode project's bundle identifier exactly.
- **"Certificate identity not found"**: The distribution certificate has not been imported into the machine's Keychain, or it has expired.
- **Expired certificates**: Apple Distribution certificates expire after 3 years. Renew in Apple Developer portal and re-sign any in-flight builds.

---

## Android Signing

### Prerequisites

- A **Java Keystore** (`.jks` or `.pkcs12`) file containing your release signing key
- The **key alias**, **keystore password**, and **key password** for the signing key

### Required Credentials

| Credential | Purpose |
|---|---|
| Keystore file (`.jks` / `.pkcs12`) | Contains the private key used to sign APKs/AABs |
| Key alias | Identifies the specific key within the keystore |
| Keystore password | Password that protects the keystore file |
| Key password | Password that protects the private key (may be same as keystore password) |

### Creating a New Signing Key

If you do not yet have a keystore:

```bash
keytool -genkey -v -storetype JKS \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -keystore my-release-keystore.jks \
  -alias phlix-signing-key \
  -storepass <keystore-password> \
  -keypass <key-password> \
  -dname "CN=Phlix, O=Phlix, C=US"
```

### Step-by-Step Manual Signing

#### 1. Build the Release APK

```bash
cd android
./gradlew assembleRelease
```

The unsigned APK is output to: `android/app/build/outputs/apk/release/app-release-unsigned.apk`

#### 2. Sign the APK

```bash
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 \
  -keystore /path/to/my-release-keystore.jks \
  -storepass <keystore-password> \
  -keypass <key-password> \
  app-release-unsigned.apk \
  phlix-signing-key
```

#### 3. Verify the Signature

```bash
jarsigner -verify -verbose -certs app-release-unsigned.apk
```

#### 4. Align the APK (Recommended)

```bash
zipalign -v -p 4 app-release-unsigned.apk app-release-aligned.apk
```

#### 5. Build a Signed AAB (For Google Play Store)

If you need an AAB instead of an APK:

1. Add signing config to `android/app/build.gradle`:

```groovy
android {
    ...
    signingConfigs {
        release {
            storeFile file("/path/to/my-release-keystore.jks")
            storePassword "<keystore-password>"
            keyAlias "phlix-signing-key"
            keyPassword "<key-password>"
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            ...
        }
    }
}
```

2. Build the AAB:

```bash
./gradlew bundleRelease
```

The signed AAB is output to: `android/app/build/outputs/bundle/release/app-release.aab`

### CI Signing Configuration (When Ready)

When you are ready to wire CI to sign builds automatically:

1. Store the following as **GitHub Actions secrets**:
   - `KEYSTORE_FILE` — base64-encoded keystore file
   - `KEYSTORE_PASSWORD` — keystore password
   - `KEY_ALIAS` — signing key alias
   - `KEY_PASSWORD` — signing key password

2. Add a `Create Keystore` step to `.github/workflows/build-android.yml` before the release build:

```yaml
- name: Create Keystore
  env:
    KEYSTORE_FILE: ${{ secrets.KEYSTORE_FILE }}
    KEYSTORE_PASSWORD: ${{ secrets.KEYSTORE_PASSWORD }}
    KEY_ALIAS: ${{ secrets.KEY_ALIAS }}
    KEY_PASSWORD: ${{ secrets.KEY_PASSWORD }}
  run: |
    echo "$KEYSTORE_FILE" | base64 --decode --output app-signing.jks
    echo "storePassword=$KEYSTORE_PASSWORD" >> keystore.properties
    echo "keyPassword=$KEY_PASSWORD" >> keystore.properties
    echo "keyAlias=$KEY_ALIAS" >> keystore.properties
    echo "storeFile=app-signing.jks" >> keystore.properties
```

3. Reference `keystore.properties` in `android/gradle.properties` or `android/app/build.gradle` to avoid hardcoding credentials.

> **Note**: Never commit a keystore file or raw credentials to version control. The `.jks` file should be generated locally and the CI step decodes it from a secret at runtime.

### Known Issues

- **"Keystore was tampered with, or password was incorrect"**: The keystore password or key password is wrong. Double-check the credentials.
- **"Single JAR signature" warning**: The APK was signed with an older `jarsigner` algorithm. Use `-sigalg SHA256withRSA -digestalg SHA-256` for modern compatibility.
- **Missing upload key for Google Play**: If you lose your signing key, Google Play App Signing can help recover — but only if you enrolled in Play App Signing before the issue occurred.
