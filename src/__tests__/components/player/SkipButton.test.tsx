// src/__tests__/components/player/SkipButton.test.tsx
//
// SkipButton is a pure, hook-less presentational component: its only logic is the
// marker range check + label + onPress wiring. We test it by invoking it as a
// function and inspecting the returned element, which exercises that logic
// directly without a React renderer. (RNTL v14 + React 19 + test-renderer@1 is
// not yet a stable combo under the @react-native/jest-preset; the rest of the
// suite is renderer-free too.)
import type { ReactElement } from 'react';
import { SkipButton } from '../../../components/player/SkipButton';

type SkipButtonProps = Parameters<typeof SkipButton>[0];
type SkipElement = ReactElement<{ accessibilityLabel: string; onPress: () => void }>;

// Invoke the function component directly (no hooks) → element tree or null.
// React 19 types ReactElement.props as `unknown`, so annotate the props we read.
const renderSkip = (props: SkipButtonProps): SkipElement | null =>
  SkipButton(props) as SkipElement | null;

describe('SkipButton', () => {
  const onSkip = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('intro button', () => {
    const introMarker = { start: 10, end: 90 };

    it('shows button when position is within intro marker range', () => {
      const el = renderSkip({ type: 'intro', marker: introMarker, currentTime: 50, onSkip });
      expect(el).not.toBeNull();
      expect(el?.props.accessibilityLabel).toBe('Skip Intro');
    });

    it('hides button when position is before intro marker start', () => {
      const el = renderSkip({ type: 'intro', marker: introMarker, currentTime: 5, onSkip });
      expect(el).toBeNull();
    });

    it('hides button when position is after intro marker end', () => {
      const el = renderSkip({ type: 'intro', marker: introMarker, currentTime: 100, onSkip });
      expect(el).toBeNull();
    });

    it('shows button at exactly the intro start position', () => {
      const el = renderSkip({ type: 'intro', marker: introMarker, currentTime: 10, onSkip });
      expect(el?.props.accessibilityLabel).toBe('Skip Intro');
    });

    it('shows button at exactly the intro end position', () => {
      const el = renderSkip({ type: 'intro', marker: introMarker, currentTime: 90, onSkip });
      expect(el?.props.accessibilityLabel).toBe('Skip Intro');
    });

    it('calls onSkip with the marker end position when pressed', () => {
      const el = renderSkip({ type: 'intro', marker: introMarker, currentTime: 50, onSkip });
      el?.props.onPress();
      expect(onSkip).toHaveBeenCalledTimes(1);
      expect(onSkip).toHaveBeenCalledWith(introMarker.end);
    });
  });

  describe('outro button', () => {
    const outroMarker = { start: 2340, end: 2520 };

    it('shows button when position is within outro marker range', () => {
      const el = renderSkip({ type: 'outro', marker: outroMarker, currentTime: 2400, onSkip });
      expect(el).not.toBeNull();
      expect(el?.props.accessibilityLabel).toBe('Skip Outro');
    });

    it('hides button when position is outside outro marker range', () => {
      const el = renderSkip({ type: 'outro', marker: outroMarker, currentTime: 2300, onSkip });
      expect(el).toBeNull();
    });

    it('calls onSkip with the marker end position when pressed', () => {
      const el = renderSkip({ type: 'outro', marker: outroMarker, currentTime: 2400, onSkip });
      el?.props.onPress();
      expect(onSkip).toHaveBeenCalledTimes(1);
      expect(onSkip).toHaveBeenCalledWith(outroMarker.end);
    });
  });

  describe('null markers', () => {
    it('renders nothing when intro marker is null', () => {
      expect(renderSkip({ type: 'intro', marker: null, currentTime: 50, onSkip })).toBeNull();
    });

    it('renders nothing when outro marker is null', () => {
      expect(renderSkip({ type: 'outro', marker: null, currentTime: 2400, onSkip })).toBeNull();
    });
  });
});
