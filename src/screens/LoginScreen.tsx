/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/screens/LoginScreen.tsx
import React, { useEffect, useRef, useState } from 'react';
import { DEFAULT_SERVER_HOST } from '../utils/serverLabel';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeContainer } from '../components/layout';
import { useAuthStore } from '../stores/useAuthStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { apiErrorMessage } from '../api/client';
import { webAuthnService } from '../services/WebAuthnService';
import {
  cleanUsername,
  webauthnErrorMessage,
} from './webauthn/webauthnHelpers';

/**
 * Normalize a hand-typed server address (audit M6).
 *
 * Scheme-less input defaults to **https** — mirroring the hub's
 * `HubAuthService.normalizeHubUrl` ("ensure https") — so a missed prefix can
 * never silently downgrade a remote connection to cleartext. Plaintext http
 * stays reachable by EXPLICIT opt-in (typing `http://` yourself, e.g. a LAN
 * lab box); it is never the implicit outcome.
 */
function normalizeServerUrl(rawUrl: string): string {
  const url = rawUrl.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  return url;
}

/**
 * MW-024 (review mobile__casualgamer #3): the Server field is OPTIONAL.
 * A brand-new viewer has no address to type — refusing blank turned the
 * README's "the app defaults to https://api.phlix.app" promise (tier 3 of
 * `src/api/client.ts` getServerRoot) into dead prose: nobody could reach
 * that default through the form. Blank now means "no override": the saved
 * address is CLEARED and the API tiers dial the app's built-in default, so
 * what the field shows is exactly what the app connects to. A typed address
 * keeps the audit-M6 https-by-default law untouched ({@link
 * normalizeServerUrl}).
 *
 * @returns '' for the default lane; otherwise the normalized address.
 */
function resolveServerTarget(rawField: string): string {
  const raw = rawField.trim();
  return raw === '' ? '' : normalizeServerUrl(raw);
}

const LoginScreen: React.FC = () => {
  // M-MOBILE-73 (review mobile__casualgamer Minor 1): "sign out and you
  // retype the server URL" no more — the last-connected address is a
  // persisted preference (setServerUrl runs on every login), not a secret.
  // Seed once; the field stays fully editable.
  const [serverUrl, setServerUrl] = useState(() =>
    useSettingsStore.getState().serverUrl
  );
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  // M-MOBILE-05 — account creation reachable from day 1. `mode` flips the
  // same form between sign-in and signup; the server decides whether signup
  // is open (token response = signed in), gated by approval (pending notice),
  // or disabled (contract error surfaced verbatim through apiErrorMessage).
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [notice, setNotice] = useState<string | null>(null);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  // M-MOBILE-47 (review mobile__gameux m13): the form had no Enter path at
  // all — returnKeyType next/go plus a focus chain makes the keyboard's own
  // action walk Server → Username → (go) Sign in.
  // MW-008 (review mobile__exploiter #1): the chain and the submit are now
  // MODE-AWARE. Signup inserts an Email field between Username and Password,
  // so the keyboard must walk it (not skip it), and the Password "Go" key
  // dispatches the SAME action as the button (was: handleLogin hard-coded —
  // keyboard Go in signup mode fired POST /auth/login and the signup path
  // was unreachable by keyboard).
  const usernameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const isLoading = useAuthStore((state) => state.isLoading);

  useEffect(() => {
    let active = true;
    webAuthnService
      .isSupported()
      .then((ok) => {
        if (active) {
          setPasskeySupported(ok);
        }
      })
      .catch(() => {
        if (active) {
          setPasskeySupported(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  // Passwordless sign-in: reuses the server URL + username fields. The auth gate
  // (RootNavigator reads useAuthStore) navigates on success, exactly like a
  // password login.
  const handlePasskeyLogin = async () => {
    const name = cleanUsername(username);
    if (!name) {
      setError('Enter your username to sign in with a passkey.');
      return;
    }

    // Persist the connection target before authenticating (same as password
    // login — the server URL is an input, not part of the response).
    // MW-024: blank is the DEFAULT lane — it must also CLEAR a stale saved
    // override, so what the field shows is exactly what the app connects to.
    const url = resolveServerTarget(serverUrl);
    useSettingsStore.getState().setServerUrl(url);

    try {
      setError(null);
      setPasskeyBusy(true);
      await webAuthnService.loginWithPasskey(name);
    } catch (err) {
      setError(webauthnErrorMessage(err));
    } finally {
      setPasskeyBusy(false);
    }
  };

  const handleLogin = async () => {
    // MW-024: the Server field is optional — blank means "dial the app's
    // built-in default" (client.ts tier 3), so only the identity fields are
    // required here any more.
    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    // Scheme-less input goes https (audit M6 — cleartext http only by explicit
    // opt-in). See {@link resolveServerTarget}. The store's login persists a
    // typed address; the blank lane must explicitly drop the override so the
    // tiers actually fall through to the default.
    const url = resolveServerTarget(serverUrl);
    if (url === '') {
      useSettingsStore.getState().setServerUrl('');
    }

    try {
      setError(null);
      await login(url, username, password);
    } catch (err) {
      // The store already parsed the server's contract `{ error, code }` body;
      // read it through the SAME parser here (audit M2) so the viewer sees the
      // real reason ("Invalid credentials (auth.invalid_credentials)") instead
      // of axios' transport string.
      setError(apiErrorMessage(err, 'Sign-in failed.'));
    }
  };

  // M-MOBILE-05 — account creation. Validates the same server/user/pass fields
  // plus the email `/auth/register` requires; routes the outcome either to the
  // auth gate (mode flips to an open session) or to a notice (approval-gated).
  const handleSignup = async () => {
    // MW-024: same optional-server law as sign-in (see handleLogin).
    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (!email.trim()) {
      setError('Email is required to create an account.');
      return;
    }

    const url = resolveServerTarget(serverUrl);
    if (url === '') {
      useSettingsStore.getState().setServerUrl('');
    }
    try {
      setError(null);
      setNotice(null);
      const result = await register(url, username, email, password);
      if (result.outcome === 'pending') {
        setNotice(result.message || 'Account created — awaiting approval.');
      }
      // 'authenticated' → the auth gate navigates on the store state change.
    } catch (err) {
      setError(apiErrorMessage(err, 'Account creation failed.'));
    }
  };

  return (
    <SafeContainer>
      {/* MOB-19: Android already resizes the window (AndroidManifest
          windowSoftInputMode=adjustResize), so a 'height' behavior here
          double-adjusts and jumps the form. Pad on iOS only. */}
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo/Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>📺</Text>
            <Text style={styles.appName}>Phlix</Text>
            <Text style={styles.tagline}>Media Server</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {mode === 'signup' && notice && (
              <View style={styles.noticeContainer}>
                <Text style={styles.noticeText}>{notice}</Text>
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Server URL</Text>
              <TextInput
                style={styles.input}
                value={serverUrl}
                onChangeText={setServerUrl}
                placeholder="http://192.168.1.100:8096"
                placeholderTextColor="#888"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="next"
                onSubmitEditing={() => usernameRef.current?.focus()}
                blurOnSubmit={false}
              />
              {/* M-MOBILE-02 (review mobile__casualgamer #2): the placeholder
                  advertised http:// while a prefix-less address dials https
                  (audit-M6 law — kept verbatim). Say what the field does.
                  MW-024: one plain sentence for a day-one viewer — whose
                  server this is and where the address comes from — plus the
                  blank-field default lane. */}
              <Text style={styles.inputHelp}>
                No prefix connects over https — for a server on your network,
                use the full http:// address. This app connects to your own
                Phlix server: ask its server administrator for the address. Leave the
                field blank to use the app's built-in default server
                ({DEFAULT_SERVER_HOST}) instead.
              </Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Username</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Enter your username"
                placeholderTextColor="#888"
                autoCapitalize="none"
                autoCorrect={false}
                ref={usernameRef}
                returnKeyType="next"
                onSubmitEditing={() => (mode === 'signup' ? emailRef.current?.focus() : passwordRef.current?.focus())}
                blurOnSubmit={false}
              />
            </View>

            {mode === 'signup' && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor="#888"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  ref={emailRef}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor="#888"
                secureTextEntry
                ref={passwordRef}
                returnKeyType="go"
                onSubmitEditing={mode === 'signup' ? handleSignup : handleLogin}
              />
            </View>

            <TouchableOpacity
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
              onPress={mode === 'signup' ? handleSignup : handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>
                  {mode === 'signup' ? 'Create account' : 'Sign in'}
                </Text>
              )}
            </TouchableOpacity>

            {/* M-MOBILE-05 — the toggle a newcomer needs: `AuthManager.register`
                was wired to the API but no screen could reach it. */}
            <TouchableOpacity
              style={styles.modeToggle}
              onPress={() => {
                setError(null);
                setNotice(null);
                setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
              }}
              disabled={isLoading}
            >
              <Text style={styles.modeToggleText}>
                {mode === 'signup'
                  ? 'Already have an account? Sign in'
                  : "New to Phlix? Create an account"}
              </Text>
            </TouchableOpacity>

            {mode === 'signup' && (
              <Text style={styles.signupHint}>
                Whether accounts can be created here is decided by your server —
                some require a server administrator to approve new accounts first.
              </Text>
            )}

            {mode === 'signin' && passkeySupported && (
              <TouchableOpacity
                style={[
                  styles.passkeyButton,
                  passkeyBusy && styles.loginButtonDisabled,
                ]}
                onPress={handlePasskeyLogin}
                disabled={passkeyBusy || isLoading}
              >
                {passkeyBusy ? (
                  <ActivityIndicator color="#0066cc" />
                ) : (
                  <Text style={styles.passkeyButtonText}>
                    🔑 Sign in with a passkey
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            {/* M-MOBILE-48: the old footer asserted agreement to a
                "Terms of Service" that rendered as dead prose — no link,
                no sheet, nothing to agree to exists in this app. Honest
                copy states what actually governs the session: the user's
                own server. */}
            <Text style={styles.footerText}>
              You sign in to your own Phlix server; its access terms are set
              by your server administrator.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    fontSize: 64,
    marginBottom: 16,
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  tagline: {
    fontSize: 16,
    color: '#888',
    marginTop: 4,
  },
  form: {
    marginBottom: 32,
  },
  errorContainer: {
    backgroundColor: 'rgba(220, 53, 69, 0.2)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#dc3545',
    fontSize: 14,
    textAlign: 'center',
  },
  // M-MOBILE-05 — signup surface.
  noticeContainer: {
    backgroundColor: 'rgba(40, 167, 69, 0.18)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  noticeText: {
    color: '#28a745',
    fontSize: 14,
    textAlign: 'center',
  },
  modeToggle: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  modeToggleText: {
    color: '#0066cc',
    fontSize: 14,
  },
  signupHint: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 17,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputHelp: {
    color: '#888',
    fontSize: 12,
    marginTop: 6,
    lineHeight: 17,
  },
  inputLabel: {
    color: '#888',
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#2d2d44',
  },
  loginButton: {
    backgroundColor: '#0066cc',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  passkeyButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#0066cc',
  },
  passkeyButtonText: {
    color: '#0066cc',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
  },
});

export default LoginScreen;
