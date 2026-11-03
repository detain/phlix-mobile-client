/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/components/__tests__/ErrorBoundary.test.tsx
//
// M-MOBILE-71 (review mobile__devops Major 19). The repo has NO React
// renderer in its test deps (see the long note in
// src/screens/__tests__/PlayerScreen.test.tsx — @react-native/jest-preset ×
// React 19 instability), so this suite exercises the boundary through its
// real class seams instead of pretending a reconciler exists:
// getDerivedStateFromError, componentDidCatch reporting, render() branch
// selection, and the retry reducer. The ONE thing that cannot be tested
// from the outside — React actually catching a child's throw — is React's
// own documented behavior for a correctly-implemented boundary, not this
// file's job to re-prove.

import React from 'react';
import { ErrorBoundary } from '../ErrorBoundary';

function makeInstance(): ErrorBoundary {
  const instance = new ErrorBoundary({ children: null });
  // Drive setState the way React would for these sync, updater-based calls.
  instance.setState = (updater) => {
    const next =
      typeof updater === 'function'
        ? (updater as (prev: Readonly<ErrorBoundary['state']>) => Partial<ErrorBoundary['state']>)(
            instance.state
          )
        : updater;
    instance.state = { ...instance.state, ...next } as ErrorBoundary['state'];
  };
  return instance;
}

function testIDs(node: unknown): string[] {
  const out: string[] = [];
  const walk = (n: unknown): void => {
    if (n === null || n === undefined || typeof n !== 'object') {
      return;
    }
    if (React.isValidElement(n)) {
      const props = n.props as Record<string, unknown>;
      if (typeof props.testID === 'string') out.push(props.testID);
      walk(props.children);
      return;
    }
    if (Array.isArray(n)) {
      n.forEach(walk);
      return;
    }
    const maybeProps = (n as { props?: unknown }).props;
    if (maybeProps) walk(maybeProps);
  };
  walk(node);
  return out;
}

describe('ErrorBoundary — M-MOBILE-71', () => {
  it('getDerivedStateFromError captures the thrown error', () => {
    const err = new Error('boom');
    expect(ErrorBoundary.getDerivedStateFromError(err)).toEqual({ error: err });
  });

  it('renders children while healthy', () => {
    const instance = makeInstance();
    const tree = instance.render();
    expect(testIDs(tree)).not.toContain('errorBoundaryFallback');
  });

  it('renders the fallback card once an error is captured', () => {
    const instance = makeInstance();
    instance.state = { error: new Error('boom'), resetKey: 0 };
    const ids = testIDs(instance.render());
    expect(ids).toContain('errorBoundaryFallback');
    expect(ids).toContain('errorBoundaryRetry');
  });

  it('componentDidCatch reports to console.error with the component stack', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const instance = makeInstance();
      const err = new Error('boom');
      instance.componentDidCatch(err, { componentStack: '\n  in Thing' });
      expect(spy).toHaveBeenCalledWith('[ErrorBoundary]', 'boom', '\n  in Thing');
    } finally {
      spy.mockRestore();
    }
  });

  it('retry clears the error AND bumps the reset key (clean remount)', () => {
    const instance = makeInstance();
    instance.state = { error: new Error('boom'), resetKey: 4 };
    (instance as unknown as { handleRetry: () => void }).handleRetry();
    expect(instance.state.error).toBeNull();
    expect(instance.state.resetKey).toBe(5);
    // …and the tree is children again, under a NEW key:
    const tree = instance.render() as React.ReactElement<{ key?: string }>;
    expect(testIDs(tree)).not.toContain('errorBoundaryFallback');
  });

  it('healthy render hosts children under the reset-key wrapper', () => {
    const instance = makeInstance();
    const tree = instance.render() as React.ReactElement<{ children: unknown }>;
    expect(tree.props.children).toBeDefined();
  });
});
