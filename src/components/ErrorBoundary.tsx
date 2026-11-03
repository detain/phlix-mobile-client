/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/components/ErrorBoundary.tsx
//
// M-MOBILE-71 (review mobile__devops Major 19): before this file the app had
// no error boundary and no global handler of any kind — a release build that
// hit an unhandled render error white-screened (or hard-exited) with zero
// signal, and the sideload `latest` distribution means nobody would hear
// about it. This is the minimum honest story, with NO new dependency:
//
//  - componentDidCatch reports: console.error is the sanctioned release sink
//    (react-native forwards it to the device log — logcat/sysdiagnose — the
//    same channel the estate's server-side lanes read). The message keeps
//    the component stack; a future crash-reporting upload hooks in HERE.
//  - render fallback: a readable card, not a dead frame — with a Retry that
//    remounts the protected subtree (clear the error, bump the reset key).
//
// Scope law: this catches RENDER-phase errors in the tree it wraps. JS
// errors from timers/async callbacks are outside React's error semantics —
// pretending otherwise would be theater, and installing a global handler
// for them is deliberately NOT claimed here.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  resetKey: number;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // The single report seam. Release builds reach device logs through
    // console.error; crash-upload (sentry/bugsnag/etc — an owner decision
    // with dependency implications) plugs in beside this line, not inline.
    console.error('[ErrorBoundary]', error.message, info.componentStack);
  }

  private readonly handleRetry = (): void => {
    this.setState((prev) => ({ error: null, resetKey: prev.resetKey + 1 }));
  };

  render(): React.ReactNode {
    const { error, resetKey } = this.state;
    if (error !== null) {
      return (
        <View style={styles.container} testID="errorBoundaryFallback">
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body} testID="errorBoundaryMessage">
            Phlix hit an unexpected error and stopped this screen from
            drawing. Try again — if it keeps happening, restart the app.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={this.handleRetry}
            accessibilityRole="button"
            accessibilityLabel="Try again"
            testID="errorBoundaryRetry"
          >
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    // Remount via key so a fixed tree starts from a clean slate.
    return <View key={resetKey} style={styles.resetHost}>{this.props.children}</View>;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  resetHost: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 24,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#0066cc',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ErrorBoundary;
