---
paths:
  - src/syncplay/**
  - src/hub/**
  - src/store/**
---

# SyncPlay & Hub-Relay Conventions

- `src/store/` (singular) holds `syncplayStore.ts`, `hubStore.ts`, `downloadStore.ts` and is a SEPARATE directory from the Zustand `src/stores/` (plural). Keep these here; do not merge the two trees.
- The SyncPlay HTTP surface is the five `/syncplay/groups` rails in `src/api/SyncPlayManager.ts` — there is no `/syncplay/rooms` route and no `session` envelope. The server's snake_case group snapshot is modelled by the manager-local `RawSyncPlayGroup` and adapted to the view models there; do not clone that mapper into another module.
- Wire positions are MILLISECONDS; internal state and the native player are SECONDS. Convert at the send boundary only — `toSyncPlayPositionMs` in `src/screens/PlayerScreen.tsx`.
- `@phlix/syncplay` is pinned (`github:detain/phlix-syncplay#v0.1.4`) and is a constants-only surface — take protocol constants from it rather than re-declaring them.
- The hub relay is a WebSocket on `HUB_SYNC_PLAY_PORT = 8804` (`src/syncplay/hubRelay.ts`): `openHubRelayConnection` / `closeHubRelayConnection` / `parsePendingCommandFrame` / `buildHubRelayUrl` / `getHubRelaySocket`. `src/syncplay/HubRelayConsumer.ts` (`startHubRelayConsumer` / `stopHubRelayConsumer`) is booted exactly once, from `src/App.tsx`.
- The socket authenticates with a per-(user, server) CLIENT RELAY TOKEN minted by `createHubRelayTokenProvider` (`src/hub/RelayTokenProvider.ts`) — not the hub session JWT. Every failure path returns `null` so the socket stays closed; never present a token that failed to mint.
- The consumer runs OUTSIDE the navigator tree, so it navigates through `navigationRef` (created in `src/navigation/RootNavigator.tsx`, re-exported from `src/navigation/index.ts`) — never `useNavigation`.
- Delivered `play_media` frames park on `useSyncplayStore.pendingPlayMedia` via `applyPendingPlayMedia` and are cleared with `consumePendingPlayMedia`. Frames arrive regardless of SyncPlay room membership — the primary case has no group at all.
