// src/components/player/quality.ts
//
// Pure, side-effect-free helpers backing the player `QualityMenu` (G3). All the
// testable logic lives here (the `.tsx` component is a thin renderer), mirroring
// the repo convention of extracting screen/component logic into a helper module
// unit-tested under `__tests__/`.
//
// The rendition/variant shape is consumed DIRECTLY from `@phlix/contracts`
// (v0.2.0, step B1) rather than a locally-mirrored copy — following the
// phlix-console (G5) precedent of importing the shared DTO. `AUTO_QUALITY` is the
// UI-only "let native ABR decide" sentinel; it never matches a `RenditionId`.
import { AUTO_QUALITY } from '@phlix/contracts';
import type { QualitySelection, Rendition } from '@phlix/contracts';

/** One selectable row in the quality picker. */
export interface QualityOption {
  /** The persisted/exposed choice: `'auto'` or a concrete rung id. */
  value: QualitySelection;
  /** Human label (`'Auto'` or the server rung label, e.g. `'720p'`). */
  label: string;
  /**
   * The URL the native player should load for this choice: the multi-variant
   * MASTER playlist for `'auto'` (native ABR), or the rung's own signed
   * `media_v{id}.m3u8` for a pin. `null` when unplayable (should be filtered).
   */
  url: string | null;
}

/**
 * Build the picker option list from a job's `variants[]` and the master URL.
 *
 *   - `'auto'` is always first when a master URL exists (native ABR).
 *   - Each rung follows in the server's HIGHEST-FIRST order, but only rungs
 *     with a real (non-null, non-empty) signed `url` are pinnable and kept.
 *
 * Returns `[]` when there is neither a master nor any pinnable rung, so the
 * caller hides the menu (graceful no-op on a legacy/pre-ABR server).
 */
export function buildQualityOptions(
  variants: Rendition[] | null | undefined,
  masterUrl: string | null | undefined,
): QualityOption[] {
  const options: QualityOption[] = [];

  const master = typeof masterUrl === 'string' ? masterUrl : '';
  if (master !== '') {
    options.push({ value: AUTO_QUALITY, label: 'Auto', url: master });
  }

  if (Array.isArray(variants)) {
    for (const variant of variants) {
      if (variant && typeof variant.url === 'string' && variant.url !== '') {
        options.push({ value: variant.id, label: variant.label, url: variant.url });
      }
    }
  }

  return options;
}

/**
 * Resolve the URL the player should load for a given selection.
 *   - `'auto'` → the master playlist (native ABR).
 *   - a rung id → that rung's signed media playlist (a hard pin), falling back
 *     to the master when the rung is unknown/urlless.
 */
export function resolveQualityUrl(
  variants: Rendition[] | null | undefined,
  selection: QualitySelection,
  masterUrl: string,
): string {
  if (selection === AUTO_QUALITY) {
    return masterUrl;
  }
  if (Array.isArray(variants)) {
    const rung = variants.find((variant) => variant && variant.id === selection);
    if (rung && typeof rung.url === 'string' && rung.url !== '') {
      return rung.url;
    }
  }
  return masterUrl;
}

/**
 * Seed the initial selection from the persisted `useSettingsStore.defaultQuality`
 * (an arbitrary persisted string) against the actual available rungs:
 *   - a value that exactly matches an available pinnable rung id → that rung
 *     (the user's saved pin is honoured);
 *   - anything else (`'auto'`, an unavailable rung, a stale/unknown value) →
 *     `'auto'` (native ABR), which is always safe.
 */
export function seedQualitySelection(
  preferred: string | null | undefined,
  variants: Rendition[] | null | undefined,
): QualitySelection {
  if (typeof preferred === 'string' && preferred !== AUTO_QUALITY && Array.isArray(variants)) {
    const match = variants.find(
      (variant) =>
        variant &&
        variant.id === preferred &&
        typeof variant.url === 'string' &&
        variant.url !== '',
    );
    if (match) {
      return match.id;
    }
  }
  return AUTO_QUALITY;
}

/** The label to show for the active selection (e.g. on the toolbar button). */
export function activeQualityLabel(
  options: QualityOption[],
  selection: QualitySelection,
): string {
  const active = options.find((option) => option.value === selection);
  return active ? active.label : 'Auto';
}
