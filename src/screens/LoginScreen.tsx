/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/screens/LoginScreen.tsx
import React, { useState, useEffect } from 'react';
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

const LoginScreen: React.FC = () => {
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);

  const login = useAuthStore((state) => state.login);
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
      setError('Enter your username to sign in with a passkey');
      return;
    }

    // Persist the connection target before authenticating (same as password
    // login — the server URL is an input, not part of the response).
    let url = serverUrl.trim();
    if (url !== '') {
      url = normalizeServerUrl(url);
      useSettingsStore.getState().setServerUrl(url);
    }

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
    if (!serverUrl.trim() || !username.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }

    // Scheme-less input goes https (audit M6 — cleartext http only by explicit
    // opt-in). See {@link normalizeServerUrl}.
    const url = normalizeServerUrl(serverUrl);

    try {
      setError(null);
      await login(url, username, password);
    } catch (err) {
      // The store already parsed the server's contract `{ error, code }` body;
      // read it through the SAME parser here (audit M2) so the viewer sees the
      // real reason ("Invalid credentials (auth.invalid_credentials)") instead
      // of axios' transport string.
      setError(apiErrorMessage(err, 'Login failed'));
    }
  };

  return (
    <SafeContainer>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Server URL</Text>
              <TextInput
                style={styles.input}
                value={serverUrl}
                onChangeText={setServerUrl}
                placeholder="http://192.168.1.100:8096"
                placeholderTextColor="#666"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Username</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Enter your username"
                placeholderTextColor="#666"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor="#666"
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>Login</Text>
              )}
            </TouchableOpacity>

            {passkeySupported && (
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
            <Text style={styles.footerText}>
              By logging in, you agree to our Terms of Service
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
  inputContainer: {
    marginBottom: 16,
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
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
  },
});

export default LoginScreen;
