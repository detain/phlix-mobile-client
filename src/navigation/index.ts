/**
 * Phlix Mobile client.
 *
 * @copyright 2026 Joe Huss <detain@interserver.net>
 * @license   MIT
 */

// src/navigation/index.ts
export { default as RootNavigator } from './RootNavigator';
// S298 — the navigation ref the hub-relay pending-command router navigates the
// player with (see src/syncplay/HubRelayConsumer.ts).
export { navigationRef } from './RootNavigator';
