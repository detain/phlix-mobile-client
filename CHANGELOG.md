# Changelog

All notable changes to **phlix-mobile-client** are documented here.

Format: Keep a Changelog 1.1.0 in spirit (change-type sections, newest first)
but deliberately not strict: pre-1.0 every entry lives under the single
`## [Unreleased]` heading below — version sections arrive with the first
tagged release. Each entry is one `###` heading shaped
`### Type — subject — YYYY-MM-DD` (the date rides inside the heading; cured
finding IDs stay part of the subject). Entries are prepended by the lane that
lands the change; once written, history stays verbatim — newer truth arrives
as a fresh entry, never by editing old ones.

## Reading this changelog

Recurring estate shorthand, defined once here:

- **M-MOBILE-NN** — a review finding ID for this repo in the estate-wide
  minors queue (`MINORS_QUEUE.md`); entry subjects name the IDs they cure.
- **W-minNN** — a fix-batch label grouping several M-MOBILE findings into one
  dispatched review lane (e.g. `W-min54`).
- **S-number** (e.g. S280, S181) — an estate campaign ticket ID shared across
  repos; named here it means the change or gate that ticket required of this
  repo (S280 = the vendored contract-fixture provenance gate, S181 = the
  hub-side stale-client pin check).
- **csNN / cs#NN** — a currency-sync cascade lane from the estate pin/doc
  cascade program; **WNNN** — the estate wave number that dispatched it.
- **regen #N** — the Nth re-generation of the vendored `@phlix/contracts`
  fixtures (route manifest / error-code registry) under the S280 gate.
- **era-N** — the Nth wire-contract era: each `@phlix/contracts` tag-pin
  generation of the error-codes/route-manifest trio counts as a new era.

## [Unreleased]

### Changed — MOB-32, MOB-33, MOB-34: user-facing string sweep (Hub caps, role term, error punctuation) — 2026-11-12

- Hub is written with a capital H everywhere a user reads it, matching the
  existing "Sign in to Hub" button and README Hub Mode section. Changed:
  the sign-in success alert, the sign-out confirm title and body, the
  sign-in modal intro, and the `hubStore` fallback/thrown messages
  ("Failed to sign in to Hub.", "Not signed in to Hub.").
- LoginScreen names the server-side role the same way in all three places,
  using "server administrator" like the rest of the app (admin screens,
  `auth.not_admin` copy). It replaces "its administrator", "household admin"
  and "server admin".
- Full-sentence validation and fallback errors now end with a period, as the
  REST and SyncPlay catalogs already do: LoginScreen, SettingsScreen Hub
  sign-in, SyncPlayModal ("Room name is required.", "Room ID is required.")
  and the `hubStore` `apiErrorMessage` fallbacks. The SyncPlayModal
  malformed-row errors say "room ID" to match the Room ID label.
- Updated copy pins: `src/__tests__/hub/hubStore.test.ts` (2) and
  `src/__tests__/components/syncplay/SyncPlayModal.inflight.test.tsx` (2).

### Changed — MOB-35: server-unreachable copy single-sourced — 2026-11-12

- New `src/utils/serverUnreachableCopy.ts` exports `SERVER_UNREACHABLE_STEM`
  ("Can't reach your Phlix server. Check that it's running and that this
  device is on the same network."), dependency-free so the pure Home policy
  need not import the axios client graph.
- `SERVER_UNREACHABLE_MESSAGE` (`src/api/client.ts`) and
  `HOME_SERVER_BLACKOUT_MESSAGE` (`src/screens/homeFailurePolicy.ts`) now
  build on that stem; the two copies had drifted ("you're" vs "this device
  is", `;` vs `.`). Each keeps its own remedy tail because the remedies are
  genuinely different: the transport lane also fires at sign-in, so it keeps
  the full-address hint (`http://192.168.1.100:8096`); the Home blackout only
  fires with an address already stored, so it keeps sign out → sign in at
  the new address.
- New pin `src/utils/__tests__/serverUnreachableCopy.test.ts`.

### Docs — MOB-9 follow-up: ATS comment qualifies the WAN claim (raw public-IP literals stay exempt; banner flags them) — 2026-11-12

- `ios/PhlixMobile/Info.plist`: the comment above the
  `NSAppTransportSecurity` dict now says a WAN *hostname* can never ride
  plaintext, and adds that a raw public-IP literal is still exempt under
  `NSAllowsLocalNetworking` (the insecure-connection banner,
  `src/components/ui/InsecureConnectionBanner.tsx`, flags it). Comment-only:
  no key or value changes, `iosInfoPlist.gate.test.ts` unchanged. Qualifies
  the "every fully-qualified internet host keeps ATS enforcement" wording of
  the MOB-9 entry below, which stays verbatim.

### Security — MOB-9: iOS ATS swaps NSAllowsArbitraryLoads for NSAllowsLocalNetworking — 2026-11-12

- `ios/PhlixMobile/Info.plist`: the `NSAppTransportSecurity` dict now carries
  `NSAllowsLocalNetworking=true` instead of `NSAllowsArbitraryLoads=true`.
  Arbitrary loads let ANY internet hostname ride plaintext http; local
  networking exempts only the LAN class (IP-address literals, `.local`
  hosts, unqualified single-label names), so every fully-qualified
  internet host keeps ATS enforcement. Supersedes the M-MOBILE-12 rationale
  ("per-domain exceptions are not expressible") — the local-networking key
  expresses the LAN set without enumerating domains. The M-MOBILE-03
  comment beside `NSLocalNetworkUsageDescription` is reworded to match
  (the purpose string remains a separate, still-required gate).
- **Disclosed behaviour change (WAN-refusal posture, as ratified):** a
  user-typed `http://<FQDN>` server address — e.g.
  `http://media.example.com:8096`, even one that resolves to a box on the
  LAN — is now refused by iOS ATS. Use https, the raw IP
  (`http://192.168.x.x:8096`), or the `.local` name. `http://<IP>` and
  `http://<name>.local` keep working. Scheme-less input still defaults to
  https (LoginScreen), and the `useConnectionSecurityStore` insecure-session
  banner is unchanged.
- Android keeps its global `android:usesCleartextTraffic="true"`
  (`AndroidManifest.xml`): `network_security_config` has no
  local-network-only switch, a documented platform limitation.
- Pinned by `src/__tests__/iosInfoPlist.gate.test.ts`: the ATS dict must
  hold `NSAllowsLocalNetworking=true`, and no `NSAllowsArbitraryLoads*` or
  `NSExceptionDomains` key may appear anywhere in the plist.

### Changed — latest-secure dependency wave: glob override ^13.0.6 → ^14.0.5, one allowlist entry retired by its removal ritual — 2026-11-11

- Owner ruling 2026-11-11 (estate latest-secure dependency wave): for every
  open dependabot item, do NOT take the PR's version — find the LATEST of
  each related library, advisory-check it, take latest-SECURE, and close the
  PR as superseded. At dispatch this repo carried ZERO open dependabot PRs
  (every in-range fix had already landed via the 2026-11-08 group PRs; all
  three residuals are beyond declared ranges, so dependabot opens none) — the
  wave's real work here was the three standing ALERTS: adjudicated below.
- glob advisory 3g3m (dev-chain, hoisted copy held by THIS repo's own
  override "glob": "^13.0.6"): CURE EXECUTED. The gate entry's own removal
  ritual was run verbatim — override bumped to "^14.0.5" (registry @latest,
  clean of both known glob advisories: the 3g3m line ends at 14.0.1; the
  11.x-only 5j98 CLI-injection line is below it; engines node
  18/20/22-compatible with CI's 24.x), FULL jest battery re-run green on the
  bumped tree, then the allowlist entry + its mirror fixture + the census row
  dropped IN THE SAME commit. The v8-provider law in `jest.config.js` held
  untouched (the test-exclude@6 `promisify(require('glob'))` shape never
  executes under `coverageProvider: 'v8'` — it didn't under the ^13 pin
  either; the battery is the executed proof).
- minimatch advisory g3hv (`>=7.0.0 <11.0.1`): NO-CHANGE adjudication —
  latest-secure (11.0.8) was TAKEN where reachable: glob@14 declares
  minimatch ^11.0.5 and now materialises a CLEAN 11.0.8 nested under glob.
  The flagged hoisted copy stays 10.2.6 because its ONLY remaining declaring
  parent, @typescript-eslint/typescript-estree, caps at ^10.2.2 (@latest
  still declares it — probe-measured); the entry's docblock/justification
  were truth-rotated from the two-parent coupling law to the single-parent
  reality same-commit. Alert stays open (dependabot can't PR it either);
  re-verify duty 2027-02-04. The three HIGH minimatch advisories (7r86,
  23c5, 3ppc) sit below the 10.2.x patch lines — 10.2.6 is not in any of
  their ranges.
- deepmerge advisory gcqx: NO-CHANGE, TRUE no-patch — registry version list
  ends at 4.3.1, which IS the vulnerable copy (first_patched null, upstream
  dormant since 2023; dependabot opened no PR — no remedy to supersede).
  Entry + fixture + census row stay; re-verify 2027-02-04.
- @phlix curated pins (contracts #v0.5.7, syncplay #v0.1.8) untouched per
  estate law; react/react-native EXACT pins untouched (0.88.x is the
  rejected-major lineage per the 11-08 adjudication — no RN major in a deps
  wave).
- Lock mechanics: the bump re-resolves 398 lock lines — glob/path-scurry/
  minimatch/nested-@isaacs-subtree moves, a root picomatch hoist inversion
  (root 2.3.2 → 4.0.7, prod-reachable both eras; 2.x consumers keep nested
  2.3.2 — npm's correct re-dedupe), and 149 dev/devOptional/prod marker-only
  flips. All five workflow install legs run bare `npm ci --allow-git=all`
  with no `--omit` flag, so markers cannot change any CI installed set; the
  output is accepted verbatim rather than hand-reverted (a hand-edit would
  diverge from what npm regenerates and re-churn later). Strict
  `npm ci --allow-git=all` re-clone proof green on the final lock.
- Files: `package.json` (the glob override line is the only dependency edit),
  `package-lock.json`, `scripts/audit-gate.mjs` (entry deleted, minimatch
  record truth-rotated, HISTORY gained the 2026-11-11 line),
  `src/__tests__/workflowInstalls.gate.test.ts` (census 3→2),
  `src/__tests__/fixtures/audit-gate/{allowed-mirror,allowed-subset,unknown-id}.json`
  (glob block dropped / anchor rotated to the minimatch copy),
  `jest.config.js` (comment `^13`→`^14` wording only).

### Fixed — w36L4-MAJOR-1: key the access/stream-limit Alerts on the wire code; cure the born-broken AccessSchedule matcher — 2026-11-10

- The friendly `Playback error` Alert for server playback-lane denials was
  dead on arrival: `PlayerScreen`'s 403 arm strict-matched
  `data.error === 'AccessSchedule'`, but the server has never emitted that
  byte string — `AccessScheduleMiddleware.php` (:112/:122/:130) emits
  `error(403, 'access.scheduled', 'AccessScheduled', …)`, and `Response::error`
  renders the body as `{error: <message>, code: <code>, …}`. The arm shipped in
  mobile `10a3cb2` AFTER the server string had already landed (server
  `982d94ad`), so the matcher never had a chance to fire.
- Cure (wire-contract law: the error CODE is the frozen contract surface,
  English messages drift): BOTH arms — the 403 access-schedule and the 429
  stream-limit — now key primarily on the registered codes
  `access.scheduled` / `stream.limit_exceeded` (present in the
  `@phlix/contracts` error-code registry; zero new codes), with the EXACT
  legacy texts `AccessScheduled` / `StreamLimitExceeded` kept only as the
  fallback for code-less payloads from pre-code servers. This mirrors the
  in-estate template `@phlix/ui` `src/pages/playerErrors.ts` (code-primary,
  legacy-text fallback) and this repo's own W5 code-primary Alert doctrine.
- Tests: a new `PlayerScreen.test.tsx` describe drives the REAL Alerts through
  both screen call sites (direct-play `getStreamUrl` rejection and the
  transcode-fallback `prepare()` rejection). It pins the premise — each
  fixture asserts byte-faithfulness to the quoted server emitter — then, per
  arm: a faithful server body fires the friendly Alert (red at the parent for
  the born-broken 403 arm), a correct code with DRIFTED message text still
  fires (proving no strict-message dependency survives in the primary path),
  a legacy text-only payload still fires via the fallback, unrelated codes and
  wrong statuses fire nothing, and the bare word `AccessSchedule` (no code)
  must NOT fire — the broken literal is gone, not kept as a fallback. OK on
  the Alert navigates back through the real handler.

### Fixed — CP-022 doc-currency: name the hubRelay dial seam in the wsEndpoint carrier-law proof — 2026-11-09

- The `:8097` `?token=` -> `['bearer', <jwt>]` two-entry subprotocol
  migration (cookie program CP-022, COOKIE-DESIGN.md §4.5) had ALREADY
  landed at `bdbe1e1` ("fix(syncplay): flip :8097 direct lane to
  bearer-subprotocol carrier"), an ancestor of this entry's parent
  `de4ceb5a`; the design doc's "wsEndpoint.ts still mints the `:8097`
  `?token=` URL" premise is stale disk-wise. Verified this lane end to
  end: the CP-006 premise is live (server `SyncPlayAuthMiddleware::
  resolveHandshakeToken()` — bearer subprotocol priority-1 TARGET carrier,
  echoed on the 101 — and hub `:8804` bearer-only via
  `ClientRelayWorker::extractClientToken()`), both mobile lanes hand
  `protocols: ['bearer', …]` to the two-value `WebSocket` constructor
  (`resolveSyncPlayWsEndpoint` + `SyncPlayService` `openSocket` dial), no
  `?token=` producer survives in `src/`, and planting the pre-migration
  query shape into a scratch copy reddens exactly 8 law-pinning tests
  (URL-equality, no-`token=`/no-`?` negatives, mock-WebSocket
  `lastProtocols` captures on first dial and the reconnect ladder).
- Delta shipped here: two stale raw-line coordinates in the
  `wsEndpoint.ts` docblocks — the in-repo two-arg-constructor proof cited
  `hubRelay.ts:256`, but that dial lives at `hubRelay.ts:454` inside
  `connectHubRelaySocket()` — now cite the seam BY NAME (estate LW-037
  rot-proof prose law). Comment-only; zero behavior change; relay lane
  untouched and stays bearer-conformant. Battery parent-vs-post
  identical: jest `--runInBand` 134 suites / 1944 pass + 1 skip (1945),
  tsc 0, eslint 0 errors / 2 pre-existing held warnings.

### Changed — LW-089 re-pin cascade: @phlix/contracts #v0.5.6→#v0.5.7 + @phlix/syncplay #v0.1.7→#v0.1.8 — 2026-11-09

- Tag-form pins bumped to `github:detain/phlix-contracts#v0.5.7` (tag object
  `eee7e776…`, peel `bedfe69b…`) + `github:detain/phlix-syncplay#v0.1.8`
  (tag object `b150e236…`, peel `d3cbfc7a…`), both ls-remote-verified.
  `package-lock.json` moved EXACTLY 6 lines (+6/−6: root-echo pair + each
  node entry's version/resolved pair, resolved SHAs = the tag peels) — hand
  applied, no `npm install` churn; `npm ci` (npm 11, `--userconfig=/dev/null`)
  exits 0 against the hand-edited lock and re-materializes byte-identical
  dist payloads (contracts `dist/phlix-contracts.js` md5 `2bde36ad…`,
  syncplay `dist/phlix-syncplay.js` md5 `f7e19892…`, each cmp-equal to its
  tag blob) — the idempotency + supply-chain proof (CI re-runs the same form).
- Incident-law procedure (the .23-era crown) EXECUTED for the behavioral
  `#v0.1.7→#v0.1.8` bump: parent baseline measured FIRST (jest --runInBand
  134 suites / 1945 tests, 1944 pass + 1 sanctioned skip — the dispatch
  card's 121/1720 era figures were stale; measure-at-red governs), then the
  bump, then the re-run: EXACT parent figures, suite list identical, every
  syncplay decode/law suite green — zero inbound-decode reds, zero law-test
  adaptations. v0.1.8 lands clean on this client.
- contracts v0.5.7 (the LW-001..071 docs-currency + wire-truth DTO rewrite
  wave) moved one type surface onto mobile: `SubtitleTrack` now REQUIRES
  `delivery: 'external'` — verified wire truth at server
  `StreamTrackShaper.php:165/:198` (S507/AD-8: every subtitle is a signed
  sidecar, none muxed; vectors provenance re-verified at server `a63dc0db`).
  12 compile sites (TS2741/TS2345, measured from red) fixed honestly: the
  production transcode-synthesised picker rows (`PlayerScreen.tsx`) carry
  the key the server would emit, and every `SubtitleTrack` fixture row —
  the golden ones RE-VENDORED from the tag's
  `test/fixtures/stream-track-vectors.json` @ `da8c1e3` (its subtitle rows
  gained `delivery`; the audio rows are byte-held and untouched), plus the
  wire-shape exemplars in `playback.test.ts`/`usePlayerStore.test.ts`.
  Golden provenance stamps rotated to the tag era with the delta disclosed;
  S404/S407 historical narration kept verbatim.
- S280 re-vendor: HONEST-ZERO, measured — the route-manifest trio is
  byte-held across v0.5.6→v0.5.7 (tag-vs-tag-vs-installed-vs-vendored all at
  md5 `90b79e35…` / registry `5d1783a7…` / scopes `8c92c070…`), so
  `src/api/test/server-route-manifest.json` was NOT re-vendored; only the
  integrity comment records the v0.5.7 measurement.
- Union hazard probe: `error-codes.json` is byte-identical across the tag
  pair, so `SyncPlayErrorCode` stands UNMOVED at 20 (12 legacy + 8 twins) —
  zero `syncplayErrors.ts` catalog rows, zero count-pin rotations, zero
  union TS2741 (the delivery cohort above is a DTO surface, not the
  registry). Live pin-era stamps in `syncplayErrors.ts`/`.test.ts` and the
  two playback-info era cites (`playback.ts`, `PlayerScreen.tsx`) rotated to
  #v0.5.7/`a63dc0db` truth; the pin-scoped `serverTimeToMs` mirror-retirement
  follow-up stays open (export verified live at v0.1.8).
- Gates: `jest --runInBand` 134 suites / 1945 tests (1944 pass + the
  sanctioned skip) — EXACT vs the measured-at-parent baseline, zero
  suite/test drift; `tsc --noEmit` clean (0); eslint 0 errors / the 2
  pre-existing warnings held; copyright `--check` 179/179; `npm ci` rc 0.

### Fixed — wave w20 mobile L8: relay-lane liveness (watchdog + OS suspend/resume), the player follows the group (media/queue/chat), design-token SSOT + raw-hex ratchet — 2026-11-09

- Hub-relay liveness (MW-122, review mobile__crossfe #3):
  `src/syncplay/hubRelay.ts` gained the two halves the SyncPlay lane
  already carried. (1) A ping/pong watchdog: every opened relay socket
  fires a canonical `syncplay_time_ping` immediately and then on a
  30s cadence (`RELAY_PING_INTERVAL_MS` / `RELAY_PONG_TIMEOUT_MS`); an
  answer older than the pong window declares the socket a zombie and
  kills it on OUR terms (handlers detached before close, so the ladder
  never double-drives), then re-dials. The hub answers this frame from
  `SyncPlayRelayWorker::handleCanonicalTimePing` with NO room guard, so
  liveness outlives rooms; the pong is consumed by the watchdog before
  the pending-command parse and never reaches the navigation seam.
  (2) OS lifecycle: `handleHubRelayBackground()` closes the socket
  while KEEPING the dial intent (config survives; the armed ladder and
  ping loop are torn down; the connect generation bumps so a leg parked
  mid token-mint can never materialise a socket into a backgrounded
  process — the MW-010 lesson, relay edition);
  `handleHubRelayForeground()` re-dials from attempt 0, and VALIDATES
  before trusting: a pipe the OS buried without an event (readyState
  CLOSED) is dropped and re-dialed, while a CONNECTING dial in flight
  is left alone. `HubRelayConsumer` subscribes the `AppState` `change`
  rail for the relay half (background/active routed; `inactive`
  deliberately NOT a teardown, matching the App.tsx SyncPlay law) —
  App.tsx itself unchanged: it already owns the :8097 rail, and the
  consumer owns the relay socket's whole lifecycle (one owner, one
  teardown story). The review's rec (a) half was already disk-law for
  the :8097 lane (single `connected` setter `handleOpen` arms
  `startSyncInterval()` on every path); the register carries the proof.
- Group media + queue/chat rails (MW-125, review mobile__crossfe #2):
  the phone had been silently evaporating the server's
  `syncplay_playback_queue` and `syncplay_chat` fan-outs for its whole
  life — the message switch's `default:` arm broke without a sound.
  Now: `syncplay_playback_queue` parses at the boundary into typed
  `SyncPlayQueueEntry[]` (host's `media_info.name` optional → id
  fallback; a non-array `queue` drops WHOLE and loud — no partial
  snapshot), lands on the store's new `playbackQueue` rail (pairing
  law: `setCurrentGroup(null)` clears it with the room; `reset()`
  re-allocates the seed), and fires `onQueueUpdate`.
  `syncplay_chat` decodes to `{memberId, message}` (either missing =
  loud drop) and fires `onChatMessage`. `syncplay_typing` is refused
  BY NAME in a documented arm (per-keystroke signal, no mobile
  surface); any OTHER unroutable type now warns with its name — the
  silent `break` is dead law. `PlayerScreen` finally acts on group
  ownership: `onGroupStateUpdate` follows a genuinely-differing
  `currentMediaId` through the same `replace()` seam autoplay-next
  uses (null and already-there echoes do not re-navigate), anchoring
  the new title at the room position in seconds (S441 — no
  re-conversion); queue and chat ride the established overlay notice
  rail (sender resolved from the roster at event time, MW-101 law),
  the store rail keeps the FULL list for whoever mounts a surface
  later. The review's `setWatchPartyActive` clause is a stale premise:
  no such call exists anywhere in `src/` (zero grep hits, register).
- Design tokens + raw-hex ratchet (MW-123, review mobile__gameux #8):
  `src/theme/tokens.ts` names the color family the census convicted
  (47 distinct raw hex values hand-copied 865 times across 66 files,
  measured at this wave's parent) — including the two
  near-identical-dark confusables (`appBackground` #0f0f1a vs
  `sheetBackground` #1a1a2e, one value two roles each, finally
  told apart by their names). Convicted retired inks get NO token
  home: the 666-gray that MW-104 proved cannot clear either contrast
  floor was not re-baptised as `textTertiary` — PlayerScreen's last
  survivor site was PROMOTED to the floor-clearing #888 token
  instead, the same cure the seven promoted screens already carry,
  and the MW-104 `#666` census survivor list rotated in this commit
  (measured red first — the rotation law the test itself states).
  `PlayerScreen.tsx` and `SyncPlayModal.tsx` (42 sites: 34 literals +
  8 JSX props) are fully tokenized, and `.eslintrc.js` gained the
  grow-only ratchet: raw hex literals are ERRORS in the listed
  converted files (rule teeth probed by planting one), new files join
  by converting. rgba() alpha composites stay legal per the
  documented scope note in tokens.ts.
- Tests: 29 new (hubRelay watchdog + OS lifecycle + rec-b validation
  12; HubRelayConsumer AppState rail 3; service queue/chat/typing/
  loud-default boundary 5; store pairing law 4; playerGroupRails
  source pins 5 — new suite file). Mutation-toothed: watchdog-arm
  strip 3 reds, pong-consumption strip 1, queue-arm strip 2,
  silent-default restore 1, typing-arm strip 1, foreground-validate
  strip 1, planted raw hex 1 lint error.
- Pins: none moved — `@phlix/syncplay` stays `#v0.1.7`, `@phlix/contracts`
  untouched, zero new wire codes, `syncplayErrors.ts` not edited (no
  TS2741 surface touched).
- Battery: jest `--runInBand` 134 suites 1,944 passed + 1 skipped
  (parent 9a599d7 measured baseline 1,915 + 1 skip; +29 exact);
  tsc 0; eslint 0 errors / the two pre-existing era-held warnings
  (era pins rotated ONLY from measured red: the #666 census above).

### Fixed — wave w13 mobile L9: stack bottom safe-area opt-in, vault read memo, inset-aware player chrome, issued-origin logout revoke, single-source modal keyboard sheet, watch-party entry surfaces — 2026-11-07

- Behavior (review mobile__gameux #6): root-stack screens render WITHOUT the
  tab bar, and the earlier home-indicator fix only grew the TAB BAR itself —
  so a stack screen keeping the SafeContainer top-only default parked its
  last row under the gesture strip (the profile-select CTA was the measured
  victim). SafeContainer now exports a single-source `STACK_EDGES`
  (top + bottom) and the profile screen's three branch states opt into it;
  tab screens must not (the bar carries the inset — a new source pin holds
  the no-double-pad law for all five).
- Perf (review mobile__crossfe #13): the request interceptor ran a fresh
  keychain decrypt plus two storage reads on EVERY api call. The three
  server-vault reads now serve a read-through memo inside the vault facade —
  one physical read per session snapshot — with write-side invalidation at
  both ends of every store/wipe and never-cached failed reads, so a rotated
  or revoked pair is visible to the very next request. Semantics (host
  binding, fail-closed pre-pin) unchanged; three interceptor pins measure the
  read count and the two invalidation laws.
- Behavior (review mobile__gameux #7): the player chrome used hardcoded
  20pt paddings while hiding the status bar — the notch sat under the top
  bar in portrait and intruded edge-side in landscape, and the progress rail
  ignored the home indicator. The top bar and the rail now pad by the LIVE
  safe-area insets of the ACTIVE edge (the rotation lesson: never assume
  the cutout sits at the top).
- Security (review mobile__secnet #2): logout POSTed its best-effort revoke
  leg to the CURRENT server setting — after a server change that was a no-op
  for the host that actually minted the pair, whose refresh token stayed
  valid there. The vault now pins the raw minting base URL beside the
  canonical host (absolute http(s) origins only; bare-host and pre-existing
  pairs keep the old fallback), and the revoke leg targets the issuing
  origin with an explicit bearer header read before the wipe — immune to
  the cross-host ride refusal it previously depended on.
- Behavior (review mobile__gameux #1 + mobile__crossfe #6): six modal sheets
  — SyncPlay's in-group panel AND its room browser, the hub sign-in form,
  collection create, profile editor and PIN prompts, passkey add, admin
  user form — placed TextInputs with no keyboard avoidance, so the keyboard
  buried the focused field and its submit button. `src/components/ui/
  ModalSheet` makes the fix single-source with the repo's established
  modal law (behavior="padding" on both platforms); the seven sheet mounts
  across the six files now render through it, and source pins forbid
  hand-rolling the avoidance away again.
- Behavior (review mobile__gameux #2): the watch-party pill was chrome — it
  faded with the controls, silently leaving an active member without even a
  reminder of the room. It now lives on an always-on, tap-through layer in
  its historic top-right home (with a stable testID), the chrome's entry
  glyph appears only when NOT in a room, and the media-detail page gained a
  labeled "Watch with friends" row opening the shared room modal, so the
  feature is findable before playback.

### Docs — correction: the w12 contrast entry's 2.98:1 quote for the retired meta ink should read 2.97:1 — 2026-11-07

- The previous wave's entry quotes 2.98:1 for `#666` on the darkest
  back-office ground. The repo's own assertion anchor and a fresh WCAG
  relative-luminance computation both say 2.97:1 (2.9707). Prose-only
  rounding drift in the quoted figure — the code comment and the test
  always carried the correct number; no behavior, threshold or file census
  changes. The other three quotients the entry quotes (2.33:1, 4.81:1,
  3.77:1) measure correct. History stays verbatim per the append-only law;
  this entry IS the correction.

### Fixed — wave w12 mobile L1: bootstrap hub-hydration memo, CI audit allowlist gate, SyncPlay liveness rail + membership notices, touch-target sizing, CloseGlyph law, meta-text contrast, download-copy arm order — 2026-11-06

- Behavior (hub): the persisted-state restore of the hub store ran ONLY from
  the Settings screen, so the relay consumer could boot against a
  pre-hydration store. The restore is now an idempotent memo — one shared
  round-trip per process; a swallowed error or a vault-deferred migration
  re-arms it per the M-MOBILE-12 deferral law — and App.tsx hydrates at
  bootstrap BEFORE the relay consumer starts; the Settings path remains a
  belt. A `__resetHubHydrationForTests()` seam mirrors the relay
  token-provider reset precedent; four new laws pin the memo, the re-arm and
  the bootstrap order.
- CI (security): a reviewed-allowlist audit gate (`scripts/audit-gate.mjs`,
  mobile port of the windows design: subset law over advisory ids, exact
  GHSA census, exit 0/1/2 taxonomy, anti-neutering — a broken audit can
  never read clean) runs as its own test.yml leg, replacing the severity-
  floor posture that hid 35 sub-high advisories and greened on garbage.
  The committed package-lock.json IS the in-range re-resolve: 12 advisories
  cleared (all six highs: body-parser, follow-redirects ×3, joi,
  launch-editor ×3, qs, zod, image-size via the metro-family patch bump);
  every package.json dependency RANGE untouched; react-native-reanimated
  stays at 4.5.1 — inside its declared range — so the strict-peer `npm ci`
  CI runs resolves clean (4.7.1's peer floor is react-native 0.86–0.88).
  Exactly three dev-chain advisories cannot clear in-range and are
  allowlisted with measured justifications, removal plans and a 2027-02-04
  re-verify duty: glob (held by this repo's own `^13.0.6` test-tooling
  override), minimatch (declaring parents cap below 11.0.1), deepmerge (4.3.1
  is the last version ever published). Eight fixture-driven gate tests + the
  census pin cover the exit taxonomy.
- Behavior (SyncPlay): the overlay's member-count pill was a LIVENESS LIE —
  it kept counting members while the socket was down. The pill now carries a
  rail ("Disconnected" / "Reconnecting…", gray dot when offline) and
  PlayerScreen surfaces membership notices ("X joined" / "X left" /
  "host changed") for 4 s, with the pending timer cleared on unmount; the
  service's snapshot diff now carries member NAMES on leave events (roster
  is a name-carrying map, previously ids only).
- Accessibility (touch targets): the 28pt collection-item remove control and
  the 20pt blocked-tag × are widened by hitSlop to a 44pt effective box and
  named to assistive tech; the direct/relay mode rail announces button +
  selected state and its segments clear the 44pt floor.
- Accessibility (close glyphs): new `ui/CloseGlyph` component — the 20pt ✕
  with 10pt slop per side (44pt), mandatory `accessibilityLabel`,
  `role="button"`, bounded `maxFontSizeMultiplier` — replaces the eight
  bare un-governed close glyphs (SyncPlayModal ×2, ServerSwitcher, subtitles
  / quality / audio / sleep-timer menus, the schedule-recording modal);
  dead per-screen close styles deleted with the swaps.
- Visual (contrast): the recurring 40% gray text token failed WCAG on BOTH
  of this repo's dark grounds (2.98:1 / 2.33:1 against the 4.5:1 / 3.5:1
  floors); 22 meta-text and placeholder sites across seven screens are
  promoted to the 53% gray token (4.81:1 / 3.77:1 — clears both). The
  contrast math itself is now code: `relativeLuminance` / `contrastRatio`
  with named floors live in `textScalePolicy`, fail loud on bad hex, and a
  census pin lists the nine back-office files whose residue is deliberately
  out of this wave's scope.
- Copy (fold, from the previous lane's review): the download-failure mapper
  comment asserted "connectivity is tested BEFORE resource-gone" without
  the code enforcing it; the arms are reordered so the comment is the law,
  and a hostname-carrying "could not be found" message now lands in the
  connectivity bucket (new inventory row pins the double-hit case).

### Fixed — wave w09 mobile L1: actionable download-failure copy; cast/detail error surfaces ride the apiErrorMessage door; writer doc-currency pass — 2026-11-06

- Behavior (review mobile__casualgamer #2 / MW-045): a failed download
  rendered the RAW native string after "Failed: " — Android `finishError`
  emits `HTTP ${code}`, "Empty response body" and unwrapped OkHttp exception
  text; iOS emits `NSError.localizedDescription`. The new pure boundary
  mapper `describeDownloadFailure` (src/services/DownloadService.ts) maps
  the whole inventory to short actionable prose (expired link for 401/403,
  item-gone for 404/410 and the iOS resource-missing wording, server/storage/
  connectivity sentences, code-carrying copy for other HTTP shapes) and
  falls back to generic retry prose for unmappable text — machine noise
  never reaches the UI; the raw string now rides a console diagnostic in
  `handleNativeError`. The `beginDownload` JS-side catch, which previously
  stored `err.message` verbatim, routes through `apiErrorMessage` (the
  app's own throw sentences pass through quarantine unchanged). The existing
  pin that stored the raw echo verbatim was converted to the new law.
- Behavior (review mobile__casualgamer #1 / MW-098): seven error surfaces
  printed raw `err.message` as the entire user-facing response — CastScreen
  through a local `errText` helper (now retired) at its four Alerts, and
  MediaDetailScreen at its load-failure ErrorView plus the favorite/rating
  Alerts. All seven now call the repo's existing REST error door
  `apiErrorMessage(err, fallback)`: catalog copy for a known wire code,
  quarantined "Server says:" prose otherwise, the reachability checklist for
  transport-class failures, and the surface's own fallback for junk. Pinned
  behaviorally through the real CastScreen hook-host harness (transport copy
  and `not_found` catalog copy asserted at the Alert) and by source-routing
  pins (src/__tests__/screens/w09L1ErrorRouting.test.ts,
  w04L4StructuralPins.test.ts precedent).
- Docs (review mobile__writer #4/5/6/7 — MW-041..044): CLAUDE.md's summary
  said React Navigation v6 while AGENTS.md and the pinned dependency say v7
  — now v7 with the pinned shape; README's Live TV section quoted a friendly
  string neither screen shows — replaced with the actual "Live TV is not
  set up" empty-state title and both screens' real body copy; DEVELOPER.md's
  screen paragraph had a line-initial `+` (Markdown bullet artifact) — moved
  to end of the previous line; and the structure docs no longer label
  `src/index.ts` (a types re-export barrel) as the app entry point — the
  real registration entry, the root-level `index.js` (AppRegistry), joined
  the Project Structure Summary tree and both labels were corrected.
- Tests: +32 (failure-copy inventory table + store wiring 23, error-routing
  source pins 7, cast Alert copy behavior 2); battery 128 suites,
  1829 pass + 1 skipped (parent 126/1797+1); skip identity unchanged
  (`deviceIdentity.test.ts` stored-id pin); tsc 0; eslint 0 errors with the
  two pre-existing unused-disable warnings (PlayerScreen, SleepTimer) held.

### Fixed — wave w08 mobile L1: hub server-roster parse degrades wire-legal empty labels per row; writer doc pass — 2026-11-06

- Behavior (carry-in, review w05L3 verdict): one roster row with an empty or
  non-string `serverName`/`version` threw inside `servers.map(parseHubServer)`
  and failed the user's ENTIRE hub server list — the client boundary was
  stricter than the wire. The hub's own read projection coerces NULL/non-string
  `server_name`/`version` to `''` before constructing the DTO
  (`ServerInfoHandler.php:203,205`), so an empty label is a reachable row
  value, not a contract violation. `parseHubServer` now degrades labels per
  row: an empty/non-string name falls back to the row's guaranteed identity
  (`serverId`), the version to `''`, mirroring the hub's degradation. Identity
  (`serverId`) and session fields keep the fail-loud law — the pin above owns
  that. Red-first at the parent (the new `listServers` conviction threw
  `carried no usable 'serverName'` pre-fix); battery 126 suites
  1796P+1skip -> 1797P+1skip exact (+1, same file).
- `src/api/SyncPlayManager.ts` epoch-guard docblock re-told to the w07L2
  wire-truth pass (comment-only): the production conviction lane is
  `members[].joined_at` on the create/join envelope (`GroupState.php:433`
  emits from `time()`); list rows carry no `created_at` at all
  (`SyncPlaySnapshotService::listGroups`), so the `mapRoom` epoch arm is belt.
- Writer pass (review mobile__writer #8-#13): README "not a generic
  multi-server client" reworded to kill the collision with "Multi-Server
  Support"; serial comma restored ("Chromecast, Roku, AirPlay, and DLNA"),
  "Seek bar" lowered to match the file's "seek bar", "Favorites & ratings"
  title-cased to its sibling labels; passkey note says "the server"
  throughout (server/host drift); the mode table row "Via Hub Relay" was
  trimmed to "Relay" so its name derives from the list's "Relay Mode"
  (parallel with the untouched "Direct"/"Direct Mode" pair);
  `ios/PhlixMobile.xcworkspace` is now marked created by `pod install` at its
  first mention in each document (README, docs/signing.md).
- DEVELOPER.md heading separators unified to the em dash and the opaque
  ticket markers "(E10e)" / ", M7" dropped from headings; docs/signing.md
  bundle-id parenthetical comma splice split into "note: ... — the two are
  not the same string."

### Fixed — wave w07 mobile L2 docs forward-correction: component inventory completed; boot-gate visual wording corrected — 2026-11-06

- Forward-correction to two documentation claims in the wave w07 mobile L2
  entry below. History stays verbatim — newer truth rides this fresh entry,
  never an edit of the old one.
- The component-inventory bullet (review mobile__docmaint #11) claimed four
  shipped components had been added to the DEVELOPER.md inventory —
  `ErrorBoundary` (layout section) plus `ContentSkeleton` /
  `InsecureConnectionBanner` / `LocalPlaceholder` (UI section), "each
  described from its real source behavior". Only the `ErrorBoundary` bullet
  actually landed in that change. The other three are real shipped
  components (`src/components/ui/`) whose promised inventory coverage was
  never delivered. It is delivered now: three bullets in the UI Components
  section, each described from verified source behavior at this tip.
- The boot-gate bullet (review mobile__gameux #9) called the swap to
  `<LoadingSpinner fullScreen />` "the identical prior visual (centered
  ActivityIndicator on #0f0f1a)". It was not identical: the prior gate was
  static centered Text ("Loading…", white 16pt) on that same background —
  there was no ActivityIndicator before the swap. The background and
  centering carried over; the indicator is precisely the text→spinner
  unification the finding asked for — new behavior, not a preserved visual.

### Fixed — wave w07 mobile L2: shared boot-gate spinner, hub-concept copy, yarn/overrides caveat, CocoaPods floor, settings-store doc regen, component inventory (MW-029–MW-034) — 2026-11-06

- MW-029 (review mobile__devops #6): the README's yarn endorsement now
  qualifies the hazard — yarn v1 ignores npm's `overrides` field, so the
  declared transitive mitigations (`glob`, `rimraf`, `compression`,
  `shell-quote`) silently do NOT apply on a plain yarn install; the
  Prerequisites bullet and the install-step comment both say so and name
  the `resolutions`-entries path for anyone who installs that way.
- MW-030 (review mobile__devops #7): the CocoaPods prerequisite moves from a
  bare `sudo gem install cocoapods` to Homebrew-preferred with a v1.17 floor
  — the floor is the generation version recorded in the committed
  `ios/Podfile.lock` footer (`COCOAPODS: 1.17.0`); an older pod rewrites
  that header line and churns the very diff `check:podfile-lock` protects.
- MW-031 (review mobile__docmaint #10): DEVELOPER.md's `useSettingsStore`
  block was a fossil (theme/playbackQuality/subtitlesEnabled/subtitleLanguage/
  autoPlay + loadSettings/updateSettings never existed together; only the
  quality field had been corrected in prose). Regenerated from the real
  store: all 14 fields with their defaults, all 14 persisting setters, the
  load/save/reset trio, and the `sanitizeSettings` boundary law
  (unknown-key drop, type-mismatch drop, theme whitelist) — the subsumed
  correction note is gone.
- MW-032 (review mobile__docmaint #11): the component inventory was missing
  four shipped components — `ErrorBoundary` (layout section) and
  `ContentSkeleton` / `InsecureConnectionBanner` / `LocalPlaceholder` (UI
  section), each described from its real source behavior.
- MW-033 (review mobile__gameux #9): the cold-boot auth-hydrate gate rendered
  a hand-rolled Text while every other loading surface speaks through the
  shared components. The gate now returns `<LoadingSpinner fullScreen />` —
  the identical prior visual (centered ActivityIndicator on #0f0f1a) from
  the component that owns it — with the now-dead `loadingContainer`/
  `loadingText` styles and the unused `Text` import retired. Pinned by the
  new source-read `rootNavigatorBootGate.test.ts` (3 pins, measured RED 3/3
  at parent b4a6338 — repo doctrine: no React renderer in test deps, so the
  gate's render shape is pinned against the real source on the
  w04L4StructuralPins precedent).
- MW-034 (review mobile__casualgamer #5): the Hub sign-in modal asked only
  for a "Hub URL". One honest explainer now sits under its title — a hub is
  the OPTIONAL remote-access service for reaching claimed servers from
  outside the home network, and the address comes from the hub's operator
  (the app ships no default hub to point at) — and the signed-out card's
  hint now leads with "Optional". Inline copy per the repo's no-catalog
  precedent.
- Review carry-in (w06L3 minor): `SyncPlayManager.rooms.test.ts` told a
  false wire story — it drove room-LIST rows carrying `created_at` (and
  `group_id`), but the live list wire (`SyncPlaySnapshotService::listGroups`
  at server tip a63dc0db) emits only `{id, name, member_count,
  has_password, current_media, is_playing}`. The header now says what is
  true: the list-path epoch leg is BELT (a fabricated field must degrade,
  never throw — still pinned that way), and the guard's PRODUCTION
  conviction arm is `group.members[].joined_at` on the create/join envelope
  (`GroupState::getState` members), so the out-of-range suite
  (1e20/-1e20/8.641e12/non-numeric) moved there. Test-only: zero behavior
  change; suite 5→7 pins, full battery 125/1,792+1skip → 126/1,797+1skip
  (new gate-pin file +3, rooms net +2, exact attribution).
- Zero wire codes; no dependency or lock churn; `@phlix/contracts`/
  `@phlix/syncplay` pins unmoved.

### Fixed — wave w06 mobile: SyncPlay room-list hardening, login server-field guidance, hub display identity, download fail-loud, signing-docs re-anchor (MW-023–MW-028) — 2026-11-06

- MW-023 (review mobile__exploiter #3): the room-list Refresh button is now
  a gated control — `disabled={isLoadingRooms}` with the repo's existing
  dim style — and `loadPublicRooms()` carries a monotonic request-sequence
  token: every state write (rooms, error, loading-clear) belongs to the
  LATEST press, so an out-of-order response can no longer overwrite a fresh
  room list with a stale one. Pinned by the new renderer-free
  `SyncPlayModal.inflight.test.tsx` (SlotHost doctrine, testID seam like
  SeekBar's): the control is disabled mid-flight and live after; two
  overlapping loads resolve second-then-first and only the fresh roster
  renders.
- MW-024 (review mobile__casualgamer #3): the Server URL field is now
  optional by law, matching how `client.ts` already resolves the target
  (runtime setting → build-time `PHLIX_BASE_URL` → `https://api.phlix.app`).
  A blank field means "no override": the persisted address is cleared and
  the tiers dial the built-in default; typed addresses keep the audit-M6
  prefix-less → https law untouched. All three handlers (sign-in, signup,
  passkey) share one `resolveServerTarget()`, and the field gained the plain
  sentence the finding asked for — what the app connects to, where the
  address comes from, and what blank does. The README's "No configuration is
  required to start" promise is now TRUE at the UI instead of contradicted
  by it. fs-gate pins in `loginScreen.gate.test.ts` (+4).
- MW-025 (review mobile__casualgamer #4): "Signed in as {36-char UUID}" is
  gone. `HubAuthService.parseSession` now reads the hub's
  `createAuthResponse` `user` object (provenance re-read at phlix-hub
  @30012378: `AuthManager.php:673-688`; the row carries `username` and
  `email`) into an optional `HubSession.displayName` (username, else email;
  `claims.sub` is deliberately NOT a display candidate — it re-couples to a
  JWT payload field), the sanitized AsyncStorage blob persists it next to
  `userId` (same non-secret envelope class, needed on cold start), and
  `refreshHubSession` carries a known label across rotation when an older
  hub's refresh envelope omits `user`. SettingsScreen renders
  "Signed in as {displayName}" and degrades to "Signed in to Hub" — never
  the raw id. 7 new pins (service parse 4, store persistence 3) +
  `mw025HubIdentity.test.ts` source pin.
- MW-026 (review mobile__exploiter #7): hostile-epoch room lists can no
  longer redden themselves — `isoFromUnixSeconds` range-checks against the
  Date ceiling (±8.64e12 s) and degrades an absurd `created_at` to an empty
  timestamp while the row itself still maps; and an id-less create/join
  response is refused BEFORE the socket dial in both modal paths (empty
  `group_id` never reaches `connectWithRoom`/`joinRoom`), with the failure
  surfaced through the existing error lane. New `SyncPlayManager.rooms.test.ts`
  (+5) + 3 modal pins in the inflight file.
- MW-027 (review mobile__crossfe #14): `downloadSimulated` is deleted.
  When `NativeModules.PhlixDownloader` is unregistered, `beginDownload`
  now fails the task up front — before the stream-URL dial — with the named
  missing-module error, instead of faking progress to 100% and marking the
  task completed over a file that was never written. The old test that
  celebrated the phantom was flipped to pin the refusal; the Wi-Fi-gate
  suite now runs on a stubbed native module (its sim-interval rationale
  retired with the simulator). `DEVELOPER.md`/`src/native/types.ts`/
  DownloadService prose corrected to match.
- MW-028 (review mobile__devops #5): `docs/signing.md` coordinate drift
  re-anchored at this tip (all three claims re-verified on disk first):
  build-ios.yml `CODE_SIGNING_ALLOWED=NO` sites `:56,:121` → `:67,:141`;
  `android/app/build.gradle:43-48` debug signingConfig → `:63-79`
  (`signingConfig signingConfigs.debug` at :75); build-android.yml release-APK
  upload `:98-104` → `:125-133`. The pbxproj `:317,:402` cite re-checked —
  still true, untouched.
- Battery: 122 → 125 suites, 1767 → 1792 tests (+25: rooms 5, modal 6,
  login gate 4, hub service 4, hub store 3, SettingsScreen pin 3;
  DownloadService sim-fallback pin flipped in place), 1 skipped unchanged;
  tsc 0; eslint 0 errors, the 2 pre-existing warnings held. 21 pins measured
  RED at parent 018acc5a3 (`/tmp` red capture 21 failed / 93 passed across
  the seven files) before any source edit; zero new wire codes.

### Fixed — wave w05 mobile: hub wire-truth boundary parsing + doc-truth pass (MW-017–MW-022) — 2026-11-06

- MW-022 (review mobile__exploiter #5/#6) is the behavior cure: every hub
  payload this client parses is now checked at the BOUNDARY against the wire
  the hub actually answers — provenance re-read at phlix-hub @30012378
  (`ServerListController.php:46-61` → `ServerInfoDto::toPayload()`:
  camelCase `serverId`/`serverName`/`version`/`status`/`hostnameCandidates`,
  and `AuthController` login/refresh → `createAuthResponse` snake_case token
  envelope). The old `listServers` mapping read `server_id`/`server_name`/
  `relay_hostname`/`capabilities` — fields that NEVER exist on the
  `/api/v1/me/servers` body — so against a real hub every roster row
  resolved `undefined` and direct-mode sign-in TypeErrored inside
  `resolveEffectiveUrl`; the repo's own fixtures fabricated the same dead
  snake_case shape, which is how it stayed green. `HubServer` is now
  `{serverId, serverName, version, status, hostname}` (hostname = first
  non-empty candidate — the hub's own best-direct law; the roster carries no
  relay string, so the relay lane's estate-pinned URL is BUILT from the
  encoded serverId exactly as the secnet m8 law always intended); a body
  without the `servers` array or a row without a usable `serverId`/
  `serverName`/`version` fails loud; every non-`online` hub status
  convention collapses to `offline`; `signIn`/`refresh` parse
  `access_token`/`refresh_token`/`expires_in` with fail-loud boundary checks
  (no more `Bearer undefined` persisted from a malformed 200), the same law
  curing the server-refresh leg in `src/api/client.ts`; and `fetchServers`
  routes failures through the code-first `apiErrorMessage` choke point
  instead of surfacing raw axios prose. 11 new/converted pins measured RED
  at parent a5f7d1f (`/tmp` red capture: 11 failed / 80 passed across the
  three files); suite 122/1757 → 122/1767 (+10 exact: HubAuthService +8
  net — 1 fabricated-shape test flipped to 5 wire pins + 3 signIn + 1
  refresh boundary pins, hubStore routing pin +1, client garbage-envelope
  pin +1); zero new wire codes, envelopes untouched.
- MW-017 (review mobile__docmaint #5, mobile__writer #3): DEVELOPER.md store
  table gains the missing `useConnectionSecurityStore` row (16 rows) and the
  tree count reads `16 use*Store.ts modules total` — both measured against
  `src/stores/`.
- MW-018 (review mobile__docmaint #6): DEVELOPER.md iOS pod tree shows all 9
  files (four families: `PhlixPlayer*`, `PhlixDownloader*`, `PhlixRandom*`,
  `PhlixWebAuthn*` — the "holds both" claim corrected), new native-module
  sections document iOS `PhlixDownloader` (event names byte-ident with
  `DOWNLOAD_EVENTS`, JS falls back to the simulated downloader) and
  `PhlixRandom` (CSPRNG device-id minting, `SecRandomCopyBytes` /
  `SecureRandom`, sole consumer `src/api/deviceIdentity.ts`); the repo
  structure tree gains `android/.../random/`; AGENTS.md header describes the
  pod/package inventory truthfully.
- MW-019 (review mobile__docmaint #7): README SyncPlay bullet now states BOTH
  WS lanes carry the JWT in the `Sec-WebSocket-Protocol: bearer, <jwt>`
  subprotocol and NEVER in the URL (was relay-only — the law lives in
  `src/syncplay/SyncPlayService.ts` transport docblock).
- MW-020 (review mobile__docmaint #8): AGENTS.md layout inventories marked
  representative-with-totals (api: 17 managers; stores: 16 hooks; screens:
  27 root + subfolders) — the 2026-era partial lists that read as complete
  inventories, each pointing at DEVELOPER.md for the full table.
- MW-021 (review mobile__docmaint #9): README maintenance scripts document
  `npm run check:podfile-lock` (M-MOBILE-09 auto-linked-pod presence gate,
  CI leg `test.yml:60`, no macOS needed) and DEVELOPER.md's iOS native-work
  workflow gains the Podfile.lock regeneration step.

### Fixed — wave w04 mobile: playback-state union parity, roster identity, media-permission retirement, global route params, sleep-timer purity, CI serial truth (MW-011–MW-016) — 2026-11-06

- MW-011 (review mobile__crossfe): `wirePlaybackState` admitted only 3 of the
  4 SPEC §4 states — a legitimate `buffering` group frame collapsed to
  `stopped`, telling the group UI the party had ended. `SyncPlayGroup.playbackState`
  is now the library union itself (`PlaybackState` from @phlix/syncplay,
  messages.d.ts:64) and the whitelist carries all four members; typing the
  array `readonly PlaybackState[]` makes drift in EITHER direction a compile
  error. Pinned by a new exhaustive `Record<PlaybackState, true>` parity
  section in `wireUnits.test.ts` (6 tests) — the M-MOBILE-26/54 hostile
  narrowing law stays intact (garbage still lands `stopped`); the parser is
  now exported. Zero wire codes touched; the syncplay error-union tests are
  unmodified.
- MW-012 (review mobile__crossfe): the phone broadcast a hardcoded
  'Mobile User' on every join/create frame, leaving it anonymous in shared
  rosters other clients fill with profile names. `getMemberName()` now reads
  the signed-in user from the auth store (display_name → username → the
  'Mobile User' fallback reserved for signed-out); the auth store imports
  this module statically, so the reverse edge is resolved by lazy `require`
  at call time (PlayerScreen's own lazy-require precedent), keeping the
  module graph cycle-free. Pinned by 2 new join-frame tests; the existing
  signed-out pin stays green as the fallback law.
- MW-013 (review mobile__crossfe): the `READ_MEDIA_IMAGES/VIDEO/AUDIO` trio
  retired — the M-MOBILE-13 note beside it already stated the premise that
  indicts the trio (zero MediaStore/Environment usage in `android/` and
  `src/`, zero `PermissionsAndroid` calls anywhere, so on API 33+ it was
  never even requested; it only surfaced in the Play Store disclosure). The
  contradicting "stays as the review directs" clause is gone; the retirement
  is fs-pinned by 5 new ABSENCE pins in `androidPermissions.gate.test.ts`
  (the trio + the legacy external-storage pair).
- MW-014 (review mobile__crossfe): `PlayerScreen` and `MediaDetailScreen`
  dropped their private route-param twins; both now derive from the GLOBAL
  param lists in `src/types/navigation.ts` (`RouteProp<RootStackParamList,
  'Player'>`; the Home|Library stack union for MediaDetail — the two stacks
  that actually mount it). The episode-advance `replace()` cast — the twin's
  hidden second consumer — moved to `RootStackParamList['Player']`.
  Structural law pinned by source-read tests (wmin61UiPins precedent).
- MW-015 (review mobile__crossfe): the sleep-timer tick is now a PURE
  decrement; `clearTimer`/`onFire` moved out of the `setRemainingSeconds`
  updater into a transition effect guarded by the still-armed interval
  handle — React 19 StrictMode double-invokes updaters in dev, which had
  been double-dispatching the terminal pause. Cancel-vs-expiry semantics
  preserved (an explicit `clearTimer()` nulls the handle first, so the
  effect stays inert). Structural law pinned by source-read tests.
- MW-016 (review mobile__devops): README claimed the CI Jest suite runs
  serial while `test.yml` executed default parallel workers. The
  `package.json` `test` script is now `jest --runInBand` (estate law, the
  form every CHANGELOG-gated local run already used), so CI's
  `npm test -- --coverage` and the README sentence describe the same
  execution; the workflow comment and the README line carry the proof.
- Suite attribution: parent 121 suites / 1,737 tests (1 sanctioned skip) →
  122 / 1,757 — +20 tests exactly = MW-011 (6) + MW-012 (2) + MW-013 (5) +
  structural pins MW-014/MW-015 (7); +1 suite = `w04L4StructuralPins.test.ts`.
  Red-first: all 17 behavioral/absence pins and 6 of 7 structural pins
  measured RED at parent 23032fffb (the seventh is an invariant pin, green
  by design). Gates: tsc 0, eslint 0 errors / 2 warnings (parent-identical
  pair), copyright 176/176, Podfile.lock in sync.

### Fixed — wave w01 mobile: SyncPlay re-anchor reaches the player + toolchain/docs truth (MW-118, MW-001–MW-004, LW-099-d) — 2026-11-06

- MW-118 (behavior, Critical): the room's authoritative position rode every
  `syncplay_playback_sync` echo and host-stamped play/pause command, was
  decoded at the service boundary — and then dropped: `PlayerScreen`'s
  play/pause arms applied only the state change (position reached the native
  player exclusively on explicit `seek`), and the server's DIRECTED S446
  nudge frame (same family + additive `nudge` object,
  SyncPlayManager::sendOutOfSyncNudge :1593-1630) was never parsed at all —
  a mobile member stayed parked at the wrong position while its own
  position-report loop kept the server informed. The service now marks nudge
  frames `forceReanchor` (parse-not-cast: a non-object `nudge` degrades to
  the plain echo), and the member play/pause arms re-anchor FIRST: the
  command position is applied — through the M-MOBILE-27 clamp — before the
  play/pause dispatch, unforced only past a tolerance window mirroring the
  server's own in-sync law (`GroupState::POSITION_TOLERANCE` = 2000 ms,
  GroupState.php:136), a forced nudge unconditionally (its 1 s server
  cooldown bounds churn). No rate command was invented — the native bridge
  still exposes none (S407 refusal stands); the mobile answer to drift is
  the authoritative seek the frame already carries. Zero new wire codes; the
  syncplay error union stays frozen; hub-relay frames carry no nudge and are
  untouched. New pins: 4 in `wireUnits.test.ts` (decision table + the
  source-carries-proof read-pin), 3 in `SyncPlayService.test.ts` (whole-
  shape nudge command, inert echo, malformed-nudge vectors), 6 in
  `PlayerScreen.test.tsx` (apply-beyond-window play AND pause, tolerated
  small delta, forced inside-window apply, clamp leg, host-gate stands).
- LW-099-d (recorded, behavior untouched): `TimeSync.addSample` gained the
  ruling comment — the `+rtt/2` offset sign is ESTATE WIRE LAW, byte-matching
  the server's compute (phlix-server src/Session/SyncPlay/TimeSync.php:153)
  and phlix-syncplay SPEC §5, not a textbook-NTP porting slip; any future
  sign flip is a lockstep estate-wide wire change, never a local edit.
- MW-001 (README truth): the iOS toolchain floor moved v15.0 → v16.1 — RN
  0.85's `pod install` hard-fails below it (`min_xcode_version_supported`
  returns '16.1'; react-native `scripts/cocoapods/helpers.rb:87-88`).
- MW-002 (README truth): the install step is now the CI form
  `npm ci --allow-git=all` (all three workflows; verbatim-lock install + npm
  11 hardening admitting the `@phlix/*` github: tag pins), with the `.env`
  narrative line carried to the same form and yarn kept as the honest
  floating alternative.
- MW-003 (DEVELOPER.md truth): the API Managers table listed 4 of 17 —
  completed with every manager's real exported surface, plus the three
  non-manager supporting modules; the structure-tree `api/` block matches.
- MW-004 (DEVELOPER.md truth): the TypeScript Interfaces section documented
  `NativePlaybackSession`/`SubtitleTrack`/`AudioTrack` as `src/native/types.ts`
  exports — none of the three is declared there (or anywhere in the repo).
  Replaced with the file's real export surface (player/download/WebAuthn/
  random interfaces + event payload shapes + `DOWNLOAD_EVENTS`), a pointer
  that the store's track types are the verbatim `@phlix/contracts` re-export
  (`src/types/playback.ts:55`), and the iOS Integration example rewritten to
  the actual `PhlixPlayerViewProps` (`src`/`autoPlay`/`startPosition`/…, not
  the invented `streamUrl`/`onPlaybackStart`).

### Fixed — wave w03 mobile docs truth + login/syncplay cures (MW-005–MW-010) — 2026-11-06

- MW-005 (DEVELOPER.md truth): dropped the `UserRatingPicker` component
  bullet — no such component exists in `src/` (the personal star row is an
  inline `handleStarPress` row inside `MediaDetailScreen`, documented in
  README's Features; the absence is gated by `wmin61UiPins.test.ts`).
- MW-006 (DEVELOPER.md truth): rewrote both native "Key Features" lists
  from the executed bridge surfaces. iOS: deleted "Playback rate control"
  (zero rate APIs in `PhlixPlayerView.swift`/`.m`) and demoted "Subtitle
  rendering via AVPlayerLayer" to the honest open `TODO(E3-native)`
  sidecar seam; added PiP + background-audio + the actual prop/command
  surface. Android: deleted "DASH" (`dash_url` is type-only, zero
  consumers) and "Quality selection" (no track-selector surface); stated
  the media3 1.4.1 HLS + WebVTT-sidecar reality and the five-command
  bridge (no PiP/speed).
- MW-007 (terminology): the one user-facing Group/Room mix — the active
  party's "Leave Group" button in `SyncPlayModal` — now reads "Leave
  Room", matching every other visible string. Wire payloads and internal
  identifiers (`currentGroup`, `hashGroupPassword`, …) keep the protocol's
  "group" law; README's SyncPlay bullet unified to room voice.
- MW-008 (behavior): keyboard Go on the login Password field dispatched
  `handleLogin` regardless of mode — in signup it fired POST /auth/login
  and the signup path was unreachable by keyboard (exploiter #1). The
  submit now mirrors the button (`mode === 'signup' ? handleSignup :
  handleLogin`), the Username step walks the signup Email field, and the
  focus-chain refs are finally ATTACHED to their TextInputs (at the parent
  zero `ref=` props existed — the whole chain was inert decoration).
  Red-first: mode-ternary + chain pins measured 2 red at the parent.
- MW-009 (behavior): `useAuthStore.login()` gained a module-level
  in-flight re-entry guard — a second concurrent call no-ops instead of
  double-dispatching /auth/login (a dedicated flag rather than an
  `isLoading` gate because the store boots `isLoading: true` for
  hydration; the initial-state law is pinned by this suite). `register`
  left unguarded (out of card scope). Red-first: guard test measured
  `Expected number of calls: 1, Received: 2` at the parent.
- MW-010 (behavior): `handleAppBackground()` now bumps
  `connectionGeneration` before closing, so a dial still awaiting
  endpoint resolution is superseded instead of constructing a WebSocket +
  30s ping timer while backgrounded (exploiter #4; pairs with the M10
  close-on-our-terms law). Red-first: mid-dial background test measured
  `Expected: 0, Received: 1` socket builds at the parent.

### Changed — wave-5 contracts re-pin: @phlix/contracts #v0.5.5→#v0.5.6 + S280 route-manifest re-vendor (regen #36) — 2026-11-04

- Tag-form pin bumped to `github:detain/phlix-contracts#v0.5.6` (tag object
  `9f04fc50…`, peel `c89c8420…`, ls-remote-verified). `@phlix/syncplay`
  `#v0.1.7` HELD — its tag still peels to the lock's `1a80b1d…` (drift
  checked, none). `package-lock.json` moved EXACTLY 3 lines (+3/−3: root
  echo + the contracts node's version/resolved pair, resolved SHA = the tag
  peel) — no `npm install` churn; `npm ci` (npm 11, `--userconfig=/dev/null`)
  exits 0 against the hand-edited lock, the idempotency proof (CI re-runs
  the same command with its npm 12 `--allow-git=all` form).
- S280 fixture re-vendor (this wave's real work):
  `src/api/test/server-route-manifest.json` replaced byte-for-byte with the
  v0.5.6 payload's `dist/server-route-manifest.json` — regen #36: 415 tuples
  @ serverSha `58530ec2…`, md5 `90b79e35…`; cmp-proven tag blob → codeload
  tarball → installed package → vendored file. The 412-era bytes it replaces
  had held since the v0.5.3 re-vendor. Gate pins rotated IN THE SAME COMMIT:
  provenance serverSha/total/length, test title, scan-log prose (412→415).
  Parent-red measured: with the new fixture over the OLD pins the integrity
  test failed exactly on the serverSha assert and the other six legs stayed
  green — the +3 tuples (`GET /api/v1/me/history`, `GET /api/v1/servers/{id}`,
  `GET /api/v1/users/me/history`) are strictly manifest-growth; no mobile
  call-site moved, no tripwire (S279-class, ws/relay-out) perturbed.
  The CS46 currency-ritual survival token stays in place (no external
  referent rotates it; presence is the assertion).
- Trio law measured, not assumed: the v0.5.5→v0.5.6 payload delta is the
  route-manifest regen ONLY — error-codes registry byte-held (`5d1783a7…`,
  205 codes) and mcp-scopes byte-held (`8c92c070…`); the `errors.ts`/
  `errors.d.ts` churn (cite re-anchors) classified comment-only via the diff
  (zero non-comment lines), so `SyncPlayErrorCode` stands at 20 — zero TS2741,
  zero catalog-row/count-pin rotations (jest census anchors re-attested,
  docblock pin references moved to v0.5.6 truth).
- Docs currency carried by the bump: stale `#v0.5.4`/`#v0.1.6` Wire-contracts
  line in `AGENTS.md` corrected (pre-existing staleness from the v0.5.5 wave,
  now doubly stale — made honest at this pin).
- Gates: `tsc --noEmit` clean (0); eslint 0 errors / the 2 pre-existing
  warnings held; `jest --runInBand` 121 suites / 1721 tests (1720 pass +
  1 sanctioned skip) — EXACT vs the measured-at-parent baseline, zero
  suite/test drift from the wave.

### Fixed — contracts/syncplay re-pin cascade (`#v0.5.4→#v0.5.5`, `#v0.1.6→#v0.1.7`) — 2026-11-03

- Tag-form pins bumped to `github:detain/phlix-contracts#v0.5.5` (peel
  `e215981…`, ls-remote-verified) + `github:detain/phlix-syncplay#v0.1.7`
  (peel `1a80b1d…`, verified). `package-lock.json` moved EXACTLY 6 lines
  (root-echo pair + each node entry's version/resolved pair, resolved SHAs =
  the tag peels) — no `npm install` churn; `npm ci` (npm 12.0.2, scoped
  `allow-git=all` userconfig) exits 0 against the hand-edited lock, which is
  the idempotency proof (CI re-runs the same command).
- S280 re-vendor: `src/api/test/server-route-manifest.json` verified
  BYTE-IDENTICAL tag → installed package → vendored file (md5
  `915796837d38a77733c169996d97640c`, 412 tuples @ serverSha `758f9149`) —
  the v0.5.5 wave moved only error-codes.json, so the manifest gate keeps its
  provenance pins untouched (zero rotation, re-vendor-verified).
- Registry 204→205 (`common.not_found` minted, md5 now
  `5d1783a71a3c4e128b2021327cad3717`): the syncplay domain is UNMOVED, so
  `SyncPlayErrorCode` stays 20 codes — MEASURED zero TS2741 (`tsc` clean at
  the new pin, contrast the v0.5.3 era where the union growth forced the
  playback-cap row), zero count-pin rotations (`jest --runInBand` re-attested
  121 suites/1720 green on the new pins before any prose edit). The
  era-honest mirror law was taken ahead of the emitters: `REST_ERROR_USER_MESSAGES`
  gains the bare `not_found` row + a catalog-beats-prose pin (the hub C1 flip
  onto the code is owed by the hub lane; this client is ready day-one), and
  the stale "frozen at `40c1da48`" prose in `syncplayErrors.test.ts` /
  `syncplayErrors.ts` / `routeManifest.gate.test.ts` was re-worded per the
  estate-wide truth law (CHANGELOG history entries stay verbatim).
- `wireUnits.ts` / `SyncPlayService` mirror notes updated to v0.1.7-era truth:
  `SyncPlayClient.serverTimeToMs` is importable at the live pin, but the wave
  stayed pin-scoped (contracts RESULT: consumers "Pin bump only") — the
  mirror retirement is recorded as an open follow-up, behavior-identical and
  unit-pinned meanwhile. No runtime code changed.
- Gates: `tsc --noEmit` clean; eslint 0 errors / 2 pre-existing warnings;
  copyright 176/176 (no new files this leg), `--check` green;
  `jest --runInBand` 121 suites / 1721 tests (1720 pass + the sanctioned skip)
  — +1 test exact vs the review-cures baseline (the `not_found` pin).

### Fixed — review-cures lane: Major 1–2, Minor 1–3, Info 6 (adversarial review of `fdc82f4..201a39d`) — 2026-11-03

- **Major 1 (ios/Podfile.lock drift — M-MOBILE-09 lock law):** the range's
  two new native pods (`react-native-netinfo` 12.0.1,
  `react-native-vector-icons-material-icons` 14.0.0) had ZERO entries in the
  committed lock while build-ios.yml's BARE `pod install` (non-deployment)
  silently re-resolved them every run — the caret float the lock exists to
  pin. CURED by regeneration against this range's node_modules, +34/−3
  lines: the two pods enter PODS/DEPENDENCIES/CHECKOUT/SPEC CHECKSUMS, and
  three spec-checksum lines (`PhlixPlayer`, `React-Core-prebuilt`,
  `ReactNativeDependencies`) move — the committed lock was STALE against
  today's podspecs even before the drift, now disclosed, not hidden.
  `PODFILE CHECKSUM` and the `COCOAPODS: 1.17.0` stamp are UNCHANGED.
  VENUE DISCLOSURE: generated on a Linux host (CocoaPods 1.17.0, the same
  version the lock stamps). React Native's Podfile pipeline shells out to
  exactly two macOS-flavored commands; both were inert probes for
  lock-metadata purposes and were shimmed in scratch only:
  `xcodebuild -version` (feeds a minimum-Xcode warning gate) and
  `` `command -v ccache` `` (a shell builtin Ruby backticks exec'd as a
  binary — ENOENT on Linux; ccache is not installed here). Podfile.lock
  content is resolver metadata (spec graph + checksums) — neither probe can
  alter it; the podspec inputs are this repo's own node_modules files. The
  canonical macOS re-verification stays paste-ready for the owner:
  `cd ios && pod install && git diff ios/Podfile.lock` (expect zero diff).
  PERMANENT TOOTH: `scripts/check-podfile-lock.mjs` (+ `npm run
  check:podfile-lock`, + a blocking test.yml step per the M38 copyright-gate
  posture) asserts every pod `react-native config` auto-links is named in
  the lock — host-agnostic (node only), so the Linux test job catches
  iOS-lock drift the macOS build leg structurally cannot see. Teeth proven:
  against the pre-cure lock it reddens on EXACTLY the two convicted pods;
  against the regenerated lock it greens on all 13.
- **Major 2 (+ Minor 2, iOS notification storm):** the M14 playback lane is
  now ENFORCED Android-only (`Platform.OS !== 'android'` early-return in
  `PlayerScreen.updatePlaybackNotification`) — its own docblock always said
  iOS MPNowPlayingInfoCenter is a companion follow-up, but the bare
  notifee display posted a REAL UNUserNotificationCenter banner on every
  play/pause and the first-play `requestPermissions()` prompted the OS
  (both fields `ongoing`/`channelId` are Android-only; presentation is
  not). Minor 2 rides the same path: a permission-grant resolve landing
  AFTER a pause taken during the OS prompt used to resurrect a "Now
  Playing" banner for paused media — a generation counter now voids the
  in-flight ask. Five jest pins in `PlayerScreen.test.tsx` (iOS no-display
  ×2, Android full lifecycle, delayed-grant race, toggle-OFF): the iOS and
  race pins measured RED (3 convictions) against the pre-cure source;
  Android behavior is held identical by the same suite.
- **Minor 1 (Kotlin listener leak):** `PhlixPlayerView.onDropViewInstance`
  now mirrors the detach-side `removeLifecycleEventListener` — a view
  dropped WITHOUT ever attaching (closed mid-mount) skipped detach and
  leaked the whole view via the ReactContext-held listener; on the normal
  detach-then-drop order the reference-based removal is a safe no-op.
  Source-shape pins ×3 in the new `androidPlayerLifecycle.gate.test.ts`.
- **Minor 3 (stale pinned notification):** the SettingsScreen Notifications
  OFF arm now calls `notificationService.cancelPlaybackNotification()` —
  flipping OFF mid-play used to leave the ongoing "Now Playing" up (the
  player's update path early-returns on the setting, so its dismiss arms
  never ran). Source-shape pin added to the store's settings gate describe.
- **Info 6:** `deviceIdentity.csprng.test.ts` layout comment corrected
  (hex[16] is byte 8's high nibble; byte 7 is hex[14..15]) — comment-only,
  arithmetic was already right.
- Gates: `tsc --noEmit` clean; eslint 0 errors / 2 PRE-EXISTING warnings
  (SleepTimer/PlayerScreen unused `exhaustive-deps` disables — not this
  lane); copyright check 176/176; `jest --runInBand` 121 suites / 1720
  tests (1719 pass + the sanctioned skip) — baseline 1711+1 skip, +9 new
  pins exact, +1 suite exact.

### Added — deferred-items lane (M3, M7, M14, M29, M36, M38 landed; M1 wave-2; M20/M21/M34 owner-only) — 2026-11-03

- **M3 (data-plan guard):** `@react-native-community/netinfo` 12.0.1 added
  (dep-add now permitted by owner). `src/utils/networkState.ts` classifies the
  connection (fail-OPEN by law: a broken probe never strands downloads);
  `DownloadService.processQueue()` became a coalesced async pump that HOLDS
  queued tasks (status stays `queued`) while `downloadOverWifiOnly` + cellular
  are both true, auto-starting them via a live NetInfo subscription when the
  connection leaves cellular — the switch is back in Settings as a Downloads
  section, wired and consumer-pinned (the M-MOBILE-01 theater-cure pins were
  inverted in the same commit: a real toggle must stay IN). The player shows an
  amber "⚠ Mobile data" badge in the top bar instead of blocking an in-progress
  watch. Cellular video-quality capping deliberately NOT in this slice —
  follow-up.
- **M7 (CSPRNG device id):** no third-party crypto package — new in-repo
  native module `PhlixRandom` (Android `java.security.SecureRandom`, iOS
  `SecRandomCopyBytes` + `Security` framework on the podspec) exposed as
  `randomHex(byteCount)`. `deviceIdentity.generateUuidV4Async()` maps OS-random
  bytes onto the RFC-4122 v4 template (version/variant nibbles forced); the
  documented Math.random path remains the Jest/bridge-absent fallback, and the
  pre-boot `TEMP_DEVICE_ID` is unchanged. **device-test-pending** (CI compiles
  both arms; no device venue here).
- **M14 (Android audio focus + playback notification):** `PhlixPlayerView.kt`
  builder gains `setAudioAttributes(AudioAttributes.DEFAULT,
  handleAudioFocus=true)` + `setWakeMode(C.WAKE_MODE_NETWORK)`, and a
  ReactContext `LifecycleEventListener` pauses playback on host-pause
  (manual-resume posture; listener removed on detach). The DEAD
  `showPlaybackNotification`/`cancelPlaybackNotification` API is now driven by
  the `play`/`pause`/`ended` events + screen teardown, gated on
  `enableNotifications`, with the M-MOBILE-72 ask-on-first-use doctrine.
  Full media3 MediaSession/lock-screen controls and iOS
  MPNowPlayingInfoCenter are named companion follow-ups.
  **device-test-pending.**
- **M29 (tab-bar icons):** emoji-as-Text replaced by
  `@react-native-vector-icons/material-icons` v14 (the maintained family
  successor; `react-native-vector-icons` itself is DEPRECATED) via the
  expo-modules-free `/static` export — Android font copy is the family gradle
  plugin's own step; iOS gets `UIAppFonts=[MaterialIcons.ttf]` in Info.plist;
  node10-tsc bridged by `src/types/rnvi-static-bridge.d.ts`; icons tint on
  focus. Metro android bundle probe resolves the graph.
- **M36 (CI caching):** `actions/cache@v6` Gradle caches (`~/.gradle/caches`,
  `~/.gradle/wrapper`; key over gradle scripts + wrapper props + npm lock) in
  both Android jobs; CocoaPods DOWNLOADS cache keyed on `ios/Podfile.lock` in
  both iOS jobs — the `ios/Pods` purge (M-MOBILE-09 law) is untouched.
- **M38 (copyright gate):** `scripts/add-copyright.mjs --check` mode + a
  blocking `Copyright headers` step in test.yml (planted-file probe: exit 1 on
  drift, 0 clean). All 172 walked src files already carry the header.
- **Gates:** tsc 0; eslint 0 errors / 2 baseline warnings; jest --runInBand
  120 suites / 1711 tests (baseline 117/1689 + 3 suites / +22 tests, exact
  additions: networkState 10, wifiGate 5, csprng 7), 1 pre-existing skip held;
  mutation probe: neutering the gate reddens exactly the 3 gate laws.
  **Dep adds:** netinfo 12.0.1 + @react-native-vector-icons/{common,material-icons}
  14.0.0 — lock +187/−0 lines (12 packages; npm 12 under
  `NPM_CONFIG_USERCONFIG=/dev/null --allow-git=all`), `npm audit` shows none of
  the added packages in the vulnerability map (pre-existing dev-chain entries
  only).
- **Dispositions NOT landing here:** M1 (QR/LAN pairing discovery) = WAVE-2
  feature build — needs server pairing endpoints (none exist) + camera/mDNS
  native modules; design note in the owner reel. M20 (rolling-release
  permanence), M21 (store signing/pipeline), M34 (store copy/privacy policy) =
  OWNER-ONLY decisions.

### Fixed — review-campaign UX/hygiene minors batch (Minor 1–5, 11, 15–28, 30–33, 35, 37, 39) — 2026-11-03

- **Minor 1 (M-MOBILE-73):** LoginScreen now pre-fills the server field from
  the persisted `serverUrl` — sign-out no longer forces retyping the address.
- **Minor 2 (M-MOBILE-72):** the notifee permission prompt moved off app boot
  to the first download completion and the Settings notifications toggle;
  `configure()` no longer requests at cold launch (channels/handlers stay
  boot-safe). A denial is no longer permanently baked in at launch.
- **Minor 3 / Minor 15 (M-MOBILE-74 / 75):** `MediaCard`/`PosterCard` art now
  swaps to the local placeholder `onError` (dead/expired image URLs stop
  rotting into grey voids), and every remote `<Image>` site on the hot rails
  got `resizeMethod="resize"` (Android downscales instead of full-decode).
- **Minor 5 (M-MOBILE-89):** `showAdultContent` — persisted, typed, read by
  nothing — was removed per the M-MOBILE-33 theater-switch doctrine ("make
  it real or remove it"); real restriction lives server-side via profile
  `content_rating`. Old blobs self-clean through `sanitizeSettings`.
- **Minor 11 (asphp m3):** dead REST `SyncPlayManager.leaveRoom` deleted (the
  WS `leaveGroup` is the live path; one shared server-side member map made
  the twin a drift trap). S280 per-file census rotated 4→3 with the
  POST-not-DELETE wire lore kept in the rotation comment.
- **Minor 16 (M-MOBILE-76):** `ServerSwitcher` and `SettingsScreen` dropped
  whole-store hook subscriptions for `useShallow` selector blocks — no more
  re-render on unrelated state churn.
- **Minor 17 (M-MOBILE-90, JS side):** PlayerScreen's `any`-typed shadow of
  the native contract deleted; the screen consumes the canonical
  `PhlixPlayerViewProps` (`NativeSyntheticEvent` handlers, `style` moved into
  the canonical type). The three-way native COMMAND surface (Android
  `setVolume` vs iOS `updateVolume` vs the never-called
  `PhlixPlayerInterface`) stays a deferred native-code item.
- **Minor 18 (crossfe m4, M-MOBILE-82):** LiveTvRecordingsScreen's fake
  `<FlatList data={[]}>` (all rows crammed in a ListHeaderComponent) became a
  real `SectionList` — Upcoming/All-recordings sections window properly, the
  series-rules footer is static, and the pasted-empty props lie is gone.
- **Minor 19 (crossfe m5, M-MOBILE-83):** MusicScreen keyExtractors — albums
  key on `artist::name`, artists stay on name (the wire aggregates by name;
  no ids exist to key on — law comment records that per list).
- **Minor 20 (crossfe m6):** the false-stub `src/stubs/reanimated.js` (zero
  references, comment claims a role it never played — jest uses the official
  mock) deleted. The twin `src/store/` vs `src/stores/` merge is deferred as
  structural, not hygiene.
- **Minor 21 (M-MOBILE-84):** the LogBox non-serializable ignore is now gated
  under `__DEV__` — release builds no longer silence real warnings.
- **Minor 22 (M-MOBILE-85):** notification handlers stopped printing payload
  `data` objects to device logs — event type only. The full 45-site
  `console.*` → gated-logger sweep stays deferred; the worst instances are
  cured.
- **Minor 23 (M-MOBILE-88):** `UIUserInterfaceStyle=Dark` pinned in
  Info.plist — Alert/share/keyboard chrome on a light-mode iPhone no longer
  clashes with the all-dark app; matches the Android dark commitment.
- **Minor 24 (M-MOBILE-77):** `CastSessionPill` computes its bottom offset
  from `useSafeAreaInsets()` with the tab-bar height law — no more overlap
  on gesture-bar phones.
- **Minor 25 (M-MOBILE-80):** SearchScreen debounces (350 ms) while typing —
  the dead zone between "typed" and "ran" is gone — and the field auto-focuses
  via a new explicit `autoFocus` prop on SearchBar.
- **Minor 26 (M-MOBILE-81):** SyncPlayModal's two sheets and QualityMenu
  became scrim-tap-dismissible, matching the ProfileSelect/Settings law.
- **Minor 27 (M-MOBILE-79):** the U+2BE8 half-star (tofu on many Android
  fonts) replaced by a dimmed full star (`starHalf` opacity) in both the
  detail row and `RatingBadge`.
- **Minor 28 (M-MOBILE-78):** CastScreen shows `formatTime` instead of raw
  seconds — one clock across the product again.
- **Minor 30:** `.env.example` no longer claims a Settings-screen server-URL
  input exists; both it and the SettingsScreen comment now say the editable
  field is on the login screen (README truth).
- **Minor 31 (M-MOBILE-86):** the Settings "Version 1.0.0" literal is now
  pinned by `versionSync.test.ts` (positive containment of
  `Version ${pkgVersion}`) — the first `npm version` bump can no longer make
  the About screen lie silently.
- **Minor 32:** ParentalControlsScreen's five raw `e.message` surfaces route
  through `apiErrorMessage` like every other screen (code-first catalog →
  quarantine → fallback); the two Alerts got the house titles.
- **Minor 33 (M-MOBILE-87):** Alert titles normalized to the dominant
  sentence case ("Cancel download", "Delete download", "Delete schedule");
  "Transport failed" — internal vocabulary — became "Playback control failed".
- **Minor 35:** `docs/signing.md` coords re-anchored (`build-ios.yml :56,:121`
  for the `CODE_SIGNING_ALLOWED=NO` legs) and the phantom
  `app-release-unsigned.apk` claim corrected — the release job's uploaded
  artifact is the DEBUG-SIGNED `app-release.apk`; no unsigned file exists.
- **Minor 37:** README §CI/CD now states the simulator-only gate's blind
  spot: the arm64 device slice never compiles in CI; device-only breaks
  surface at the manual archive.
- **Minor 39:** README §Deployment gained the iOS personal-device story:
  manual Xcode + free Apple ID only, with the 7-day free-provisioning
  expiry trap stated plainly (and what a paid account changes).

### Fixed — review-campaign UX-major batch: card memoization + hoisted render fns, couch-facing a11y labels, audio-picker honesty, ErrorBoundary — 2026-11-02

- **Major 15 (crossfe):** `PosterCard`/`MediaCard`/`RecommendationCard` are
  now `React.memo` at BOTH export names, and the cards gained an unbound
  `onPressItem(item)` seam — per-cell `() => onItemPress(item)` arrows change
  identity every render and defeat memoization entirely. `MediaList`,
  `ContinueWatching`, `LibraryScreen` and `HomeScreen` hoisted their
  render fns/handlers through `useCallback`. The review's `getItemType`
  ask: verified absent from RN 0.85's Lists layer (zero prop across
  `Libraries/Lists`) — passing it would be theater, recorded in-place.
- **Major 16 (crossfe):** labeled the surfaces the review ranked first —
  the raw "▶" resume target (`Play {title}`), "View All" (`View all
  {title}`), both card kinds (whole-card label; decorative art opted out),
  and the library grid tabs (tab role + selected state — the active tab was
  color-only before). M-MOBILE-68.
- **Major 2 (casualgamer):** the audio rows read as live controls while the
  saved choice reaches nothing (verified: no native command, no wire param).
  Copy now states remembered-vs-heard plainly, and every row carries an
  `accessibilityHint` saying the same to screen readers. M-MOBILE-70.
- **Major 19 (devops):** new `ErrorBoundary` wraps the app tree —
  render-phase crashes report to the device log through `console.error`
  (the sanctioned release sink; a future crash-upload hooks in beside it)
  and show a recoverable "Try again" card instead of the white screen.
  No new dependency; async/timer errors deliberately NOT claimed.
  M-MOBILE-71, +6 seam tests (the repo keeps its no-renderer doctrine).

### Fixed — review-campaign Major 9: signed-out deep links now survive sign-in (M-MOBILE-67) — 2026-11-02

- **Major 9 (gameux):** a `phlix://…` link arriving while the session was
  unauthenticated resolved against the Login-only tree and was silently
  dropped — for a media-sharing app, the acquisition moment died. The
  disclosed gap in `linking.ts` is now cured: `deepLinkGate.ts` wraps the
  SAME prefixes/config with a park-and-replay gate (latest-wins, one slot);
  RootNavigator's gate reads auth state per-event and drains the slot the
  tick the authenticated tree can host routes, replaying through the
  identical resolve → `CommonActions.reset` pipeline react-navigation uses.
  THE LAW is untouched: unmapped paths still drop honestly, the gate parks
  requests, it invents no routes. 13 new gate tests + a rotated
  container-wiring pin (the review's own verdict changed that law).

### Fixed — review-campaign docs/truth batch: Direct-mode example contradicted the https-default law, no user-facing connect checklist, profile PIN gate disclosed as verification it never performs — 2026-11-02

- **Major 17 (writer):** the Hub-Mode table advertised
  `https://192.168.1.100:8096` — TLS to the plain-HTTP server port, a
  copy-paste guaranteed failure that contradicts the same README's build
  example and the LoginScreen hint. The Direct row now shows `http://`.
- **Major 18 (writer):** Troubleshooting covered only developer build
  failures. Added a "Can't connect?" checklist for the app's core journey:
  the prefix-less-https trap, the iOS Local Network permission denial
  (silent-failure recovery path: Settings → Privacy & Security → Local
  Network), DHCP address drift, self-signed https refusal-by-design,
  offline/off-network guidance, and the Android 13+ notification-denial
  consequence.
- **Major 5 (exploiter, honest-label arm):** `handleConfirmPin` accepts any
  well-formed 4/6-digit PIN — no server round-trip, and the bearer token is
  never scoped per profile (`/profiles/{id}/switch` deliberately unadopted).
  The sheet said "requires a PIN" with an "Unlock" button, implying
  enforcement it does not provide. It now reads "is PIN-gated" with an
  explicit note that the check is an on-device courtesy lock, the button
  says "Continue", and the code comment no longer claims server validation.
  Full token-scoping adoption stays an owner-gated wire-flow decision.

### Fixed — review-campaign security/network batch: hub-HTTP cleartext lane, boot-order token loss, unbounded fetches, stalled refresh, path-bending ids, backup-migratable vault, foreign-scheme player URLs — 2026-11-02

- **M6 (exploiter):** the cleartext banner listened to three lanes and the
  hub HTTP traffic was a fourth, invisible one — an explicit `http://hub…`
  carried username/password sign-in, refresh, `/me/servers` and
  relay-token mints in plaintext with zero UI signal. `hubApi` joins the
  lane union in `useConnectionSecurityStore`; the three hub-HTTP seams
  (`HubAuthService.normalizeHubUrl`, the raw-fetch mint provider,
  `hubAwareClient.buildUrl`) now report their resolved origin.
  Posture unchanged (LAN http stays accepted-but-visible).
- **M8 (exploiter):** `checkAuth()` used to boot CONCURRENT with
  `loadSettings()`, so on a cold settings hydrate it could dial `/auth/me`
  against the build-time fallback host; the per-origin vault pin refused
  the token and a foreign-host 401 routed to `clearTokens()` — a
  legitimate session destroyed by load ORDER. Settings hydrate first now;
  the device-id leg (which never rejects) stays parallel.
- **M12 (asphp):** RN's `fetch` has NO default timeout. The Live TV
  stream probe (`LiveTvManager.getStreamUrl`) and the relay-token mint
  (`RelayTokenProvider`) awaited captive-portal stalls forever — the probe
  froze the channel tap (documented fallback never fired); the stall froze
  the relay lane pre-socket (no ladder, no status). Both now abort inside
  15 s and take their existing failure paths.
- **M13 (asphp):** the refresh single-flight rode the bare global axios
  with no timeout — one stalled `/auth/refresh` held `refreshPromise`
  forever and every concurrent 401 (and the whole REST surface) froze
  with no path to `clearTokens()`. A 30 s per-call timeout makes a stalled
  refresh reject, `finally` releases the promise, failure routes to the
  honest signed-out leg.
- **m8 (secnet):** two path seams interpolated HUB-SUPPLIED server ids
  raw — the `relay.phlix.app` fallback in `hubStore.resolveEffectiveUrl`
  and the relay prefix in `hubAwareClient.getBaseUrl`. Both now
  `encodeURIComponent` exactly like the live WS lane (`hubRelay.ts`) and
  the mint already did, so no id can bend the request path.
- **m13 (secnet):** the token vault wrote with the keychain DEFAULT
  (backup-eligible) while the biometric marker deliberately pinned a
  THIS_DEVICE_ONLY class — a device-backup extraction could carry live
  JWTs the marker's own policy would refuse, mitigated on Android only by
  `allowBackup="false"`. Vault secret writes now pin
  `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` (no backup, no device migration;
  unlike WHEN_PASSCODE_SET, a legitimate passcode change does not
  silently vaporize the session).
- **m4 (secnet):** `absolutizeApiPath` demotes server-supplied strings
  that LOOK scheme-bearing but are not http(s) (`file://…`, `content://…`)
  to a same-root path, loudly, instead of handing the native player an
  arbitrary-scheme fetch primitive.

### Fixed — review-campaign sync cluster: watch-party reconnect, host liveness, position reporting, socket lifecycle, gate-digest replay, reconnect park, WS-error quarantine — 2026-11-02

- **C1 (asphp):** the auto-rejoin sent a BARE `group_join` into gated rooms
  (no credential) — a reconnect silently dropped the member from their own
  watch party. The service now caches the SPEC §4 `password_hash` digest
  process-locally (keyed by group id; cleared on leave/disconnect);
  `connectWithRoom` carries it for the REST-proven create/join legs and
  `joinGroup` replays it on every rejoin. An `invalid_password` landing
  during the auto-rejoin wipes the stale group from the store (the UI stops
  presenting a party this phone is not in) instead of lying connected.
- **C2 (asphp):** the command handler closed over RENDER-TIME `isHost` —
  host promotion/demotion never reached the command path. The check now
  reads the store at DISPATCH time.
- **C3 (asphp):** `reportPosition` had ZERO callers — the member's drift was
  invisible to the S291 host re-anchor and the S446 policy. PlayerScreen's
  progress tick now feeds `noteLocalPosition` (wire-ms, S293), throttled to
  one `playback_sync` frame per 2 s inside the service.
- **C4 (asphp):** PlayerScreen's unmount wiped the store + socket MID-PARTY
  (rotate/episode-advance lost the member's own group) and unregistered
  handlers without identity. `off(event, handler)` is now identity-guarded
  and the socket only comes down when no group is active.
- **M10 (asphp):** AppState pair — background closes the socket on the
  app's terms (iOS jetsam / Android Doze were the unpredictable owners);
  foreground re-dials an intended group at attempt 0. Plus a pong
  watchdog: a `time_ping` unanswered for 10 s declares the OPEN-but-deaf
  socket dead and lets the ladder re-dial.
- **M11 (asphp):** both reconnect ladders (SyncPlay socket + hub relay)
  self-terminated after 5 attempts — one ~31 s commute-zone outage stranded
  the phone deaf forever. Park-at-cap (hub Federation 229d3d1 shape): after
  the fast budget a 60 s probe keeps retrying and restarts the ladder. The
  two budget-tail assertions were CONVERTED to the new law (disclosed).
- **M7/M9 (exploiter/asphp):** the WS `syncplay_error` fallback renders
  server prose QUARANTINED (URL-masking, control-strip, one-line, 140-cap —
  same sanitizer as REST, lifted to `utils/quarantineProse.ts`); and the
  connection state + pong results now mirror into the store (the modal's
  time-sync row read constants before).
- **M4 (gameux):** the Join tab gained its missing password field (gated
  rooms were unjoinable by shared Room ID — the exact purpose of the tab);
  both modal connect legs carry the gate digest. Plus m6 (secnet: hub-relay
  rebind identity is the serverId+hubBaseUrl PAIR — a hub switch kept the
  dead socket), m10 (secnet: relay ladder equal-jitter + 30 s ceiling — the
  docblock claimed it, the code did not), m12 (casualgamer: identical
  SyncPlay failures Alert once per 5 s window, not per frame), m4 (gameux:
  the member's display-only seek bar now says WHY on the bar itself).- **Spec read-only law honored:** no wire fields, codes or payload shapes
  changed — everything above aligns the client to `phlix-syncplay` SPEC
  §4/§9/§10 as documented.

### Changed — tag-wave C5 re-pin: @phlix/contracts #v0.5.3→#v0.5.4, @phlix/syncplay #v0.1.5→#v0.1.6 — 2026-11-02

- **Inert-by-measurement cascade landing:** contracts v0.5.4 carries the
  frozen trio UNMOVED (error-codes.json md5 `40c1da48…`, route manifest
  `91579683…`, mcp-scopes `8c92c070…` — all md5-verified at the tag peel
  `c491985317` and again in the installed tree) and its errors.ts delta vs
  v0.5.3 is comment-only (cite-law sweep; strip-comments diff of the two
  peels is empty). The `SyncPlayErrorCode` union therefore did not move:
  the catalog census in `syncplayErrors.ts` stays 12 legacy + 8 twins = 20
  with ZERO row rotations — the v0.5.3-era TS2741 hazard class did not
  recur this wave (tsc measured exit 0 on the new bytes, not just inferred).
  The vendored S280 route fixture is byte-identical to the v0.5.4 artifact
  (md5 equality proven both directions) — no re-vendor, gate-test comment
  now records the equality. syncplay v0.1.6 (peel `081687742`) grows the
  client +1053 lines (chat/queue frames, seek-throttle, host_elect cure,
  SPEC-correct time-sync) but its public export surface (`src/index.ts`)
  is byte-identical to v0.1.5, `SYNCPLAY_MESSAGE_TYPES` holds 19 members,
  and every constant this app consumes is value-unchanged
  (PROTOCOL_VERSION 1, OFFSET_SAMPLE_COUNT 5, MAX_ACCEPTABLE_RTT 1000,
  STABILITY_VARIANCE_THRESHOLD 50). No new wire codes; chat/queue client
  seams are NOT adopted here (opt-in feature work, not pin hygiene).
- **Currency folded in the same commit:** `syncplayErrors.ts` header now
  tells the v0.5.4-era truth — `syncplay.queue_limit_exceeded` is LIVE on
  the server since srv `7baa398a` (it was RESERVED when this catalog
  localized it at the v0.5.3 pin, per the registry's "localize early" rule);
  the census test comment records the HELD-UNMOVED state at v0.5.4 with the
  19→20 precedent kept verbatim as history. AGENTS.md pin prose rotated.
- **Lock mechanics:** package.json 2+/2−; package-lock.json surgical 6+/6−
  hand-edit (root-mirror pair + version + resolved per pin, the 32fc7b8
  shape at two-pin scale — both local npm builds rewrite unrelated
  metadata so no `npm install` touch was allowed near the lock); integrity
  proven by `npm ci --allow-git=all` under npm11 exiting 0 WITHOUT lock
  rewrite (M-MOBILE-08's own CI law used as the verifier).
- **Gates on the new bytes:** tsc 0 errors; eslint 0 errors / 2 warnings
  (pre-existing `no-unused-disable` pair, held era); jest `--runInBand`
  115 suites / 1646 passed + 1 skipped, 0 failures — the brief's carried
  "83 suites / 1243+1skip" figure is the v0.5.3-era (38d5a63) baseline:
  52 landed review-campaign commits since then added 43 test files
  (M-MOBILE-*, R-MOBILE-01, W-min*, playjump cure); this lane added zero
  tests and rotated zero floors.

### Fixed — playjump incident class: transcode fallback now re-anchors the start position to the LIVE playback clock — 2026-11-02

- **startTranscodeFallback stale re-anchor (INCIDENT-playjump-clients.md,
  mobile latent defect):** the direct→transcode fallback swapped the player
  `src` without re-pointing `playerStartPosition`, so a mid-playback
  direct-URL failure (e.g. an expired signed stream URL) restarted the item
  from the MOUNT-time position — a resumed item jumped back to its resume
  point, a fresh one jumped to 0. The G3 finding-1 law already lived in
  `handleQualitySelect` (native players restart from `startPosition` on a
  `src` change; snapshot `currentPositionRef` immediately before the swap);
  the fallback path simply never obeyed it. Fix reuses that exact idiom —
  `setPlayerStartPosition(Math.max(0, currentPositionRef.current || 0))`
  directly before `setStreamInfo(hlsStreamInfo)`. New pin mirrors the
  quality-swap test: mount at a non-zero resume (42 s), advance to 300 s,
  fire the direct-play error, assert the swapped player carries
  `startPosition === 300` — red on the pre-fix tree (received 42), green
  after. Gates: tsc clean, eslint 0 errors (2 pre-existing warnings held
  identical), jest --runInBand 115 suites / 1645→1646 pass +1 skip (delta
  exactly the one new pin).

### Fixed — M-MOBILE-08 (majors): every CI install leg now honors the tracked lockfile — `npm ci --allow-git=all` replaces `npm install` x5, with a workflow fs-gate — 2026-10-31

- **M-MOBILE-08 (MAJORS queue; review mobile__devops MAJ-2 — not the
  same-numbered minors-era item):** all five legs (`test.yml`,
  `build-android.yml` ×2, `build-ios.yml` ×2) ran `npm install` against a
  tracked `lockfileVersion 3` lock — the command that silently rewrites the
  committed lock mid-CI (this repo's CHANGELOG records exactly that churn:
  152 devOptional→dev marker flips, 2026-10-01). All five now run the
  tizen-proven `npm ci --allow-git=all`: lock-verbatim install, failing loud
  on drift (npm ci IS the drift gate — a redundant
  `git diff --exit-code package-lock.json` step was deliberately not added).
  Satisfiability proven on a clean clone at tip: npm 11 `ci --allow-git=all`
  exit 0 with ZERO lock drift after install. New fs-gate pins the count at
  exactly five legs. DISCLOSED residuals, out of this lane's authority: no
  dependency-audit leg / allowlist exists yet (the known-red transitive
  `image-size` and the windows/website audit-gate port need their own
  owner-approved dispatch — external advisory data), and no Dependabot
  config lives in-repo (org-level scope).

### Fixed — M-MOBILE-07 (majors): Android release-chain docs told a story the repo doesn't ship — publish notes now disclose debug signing + runner-identity churn; the fictional CI-secret/tag-trigger Gradle comment replaced with truth — 2026-10-31

- **M-MOBILE-07 (MAJORS queue; review mobile__devops MAJ-1 — not the
  same-numbered minors-era item):** the rolling `latest` `app-release.apk`
  is deliberately debug-key-signed (an unsigned APK can't be sideloaded) —
  but the release NOTES promised it without saying so, and the Gradle
  comment pointed at "CI secrets on a version tag" machinery that exists
  nowhere (verified: no workflow has a `tags:` trigger; only CODACY +
  GITHUB_TOKEN secrets are read; no keystore seeding). Runner debug
  keystores are per-machine, so consecutive `latest` builds may not
  upgrade in place. Both texts now carry the truth, with fs-gate pins
  across the three docs that make the claim. The finding's other clauses
  were already terminal at tip: eternal `versionCode 1` is cured (the
  version stamps derive from package.json under a sync test — SHA-cited
  era commits) and the README store claims were already honestly rewritten
  to sideload-only + manual-store procedure (SHA-cited era commit; the
  fixlog carries the ancestry proofs).

### Fixed — M-MOBILE-02 (majors): connection-failure honesty — Home server-blackout view with retry, transport-class error guidance, visible https-default law — 2026-10-31

- **M-MOBILE-02 (MAJORS queue; review mobile__casualgamer #2 — not the
  same-numbered minors-era item):** first-evening and connection-change
  pain. LIVE cures here: Home's rails no longer swallow failures into
  empty arrays — when EVERY rail the screen attempted fails (the classic
  router-reboot IP change), the connection-error `ErrorView` with retry
  renders instead of a cheerful empty shelf-world (pure policy extracted to
  `src/screens/homeFailurePolicy.ts`, homeEmptyState pair-law precedent);
  `apiErrorMessage` gained a transport lane — response-less
  `ERR_NETWORK`/`ETIMEDOUT`/`ECONNABORTED` failures now show the app's own
  reachability checklist (including the explicit `http://` LAN path)
  instead of the raw axios string "Network Error" after the 30 s timeout;
  and the Login server field SAYS that prefix-less input dials https
  (audit-M6 law deliberately untouched — the complaint was silence, not
  the rule). The scheme-less→https law and display-only Settings card
  clauses carry dispositions in the fixlog: automatic server DISCOVERY
  (mDNS/QR) is an honest PARK — a native-feature decision, not a JS fix —
  and direct-mode address recovery is now the clean one-step sign-out →
  sign-in flow M-MOBILE-10's vault teardown made safe.

### Fixed — M-MOBILE-03 (majors): iOS local-network privacy purpose string declared; blank-usage-string class guard — 2026-10-31

- **M-MOBILE-03 (MAJORS queue; review mobile__casualgamer #3 — not the
  same-numbered minors-era item):** iOS 14+ gates local-network access with
  a privacy prompt that requires `NSLocalNetworkUsageDescription`; the key
  was absent from `ios/PhlixMobile/Info.plist`, so the prompt could never
  appear and LAN-server connections were silently denied on modern iOS.
  The ATS block's `NSAllowsArbitraryLoads` (deliberate, documented) subsumes
  `NSAllowsLocalNetworking` but NOT this purpose string — separate gate.
  The finding's sibling clauses were already terminal: the empty-string
  `NSLocationWhenInUseUsageDescription` was trimmed in the W-min59 era
  (SHA-cited), and arbitrary-load ATS is the documented LAN tradeoff. New
  gate test pins the key with a real string and guards the whole
  blank-`NS*UsageDescription` class.

### Fixed — M-MOBILE-01 (majors): settings theater completed — defunct Wi-Fi-only toggle removed, Autoplay wired to the native start prop, notifications row honestly labeled — 2026-10-31

- **M-MOBILE-01 (MAJORS queue; review mobile__casualgamer #1 — not the
  same-numbered minors-era item):** five Settings toggles were claimed
  theater. At tip, the Autoplay-next-episode and Biometric rows were already
  genuinely consumed (wired under other findings — fixlog carries the
  ancestry proofs, no re-cure invented here); what remained is closed in this
  commit. The "Download over Wi-Fi only" toggle had ZERO readers and bare RN
  exposes no network-type API (no netinfo in the lock) — a data-fear guard
  that cannot exist in JS; the honest minimal cure is removal of the lying
  row and key (an old persisted blob simply loses the unknown key at the
  sanitize boundary — tolerance pinned). `autoplay` gained its real consumer:
  PlayerScreen now hands the setting to the native `autoPlay`
  start-immediately prop that was hardcoded `true` (default ON = byte-same
  behavior). The "Push notifications" row is labeled "Notifications": no
  FCM/APNs registration exists anywhere — the toggle gates the LOCAL
  notifee lane wired by the M-MOBILE-06 fix above.

### Fixed — M-MOBILE-06 (majors): notifications shipped — download-complete wired through the service, POST_NOTIFICATIONS declared, press router routes the wired type — 2026-10-31

- **M-MOBILE-06 (MAJORS queue; review mobile__crossfe M3 — not the
  same-numbered minors-era item):** `@notifee/react-native` shipped full
  native code and `NotificationService` implemented channels, permission
  request and a press router — with ZERO production call sites, while the
  manifest omitted `POST_NOTIFICATIONS`, so `notifee.requestPermission()`
  could never grant at Android 13+ (targetSdk 36): the review's landmine.
  Shipped, not dropped: `DownloadService.handleNativeComplete` displays the
  completion notification through the service, gated by the existing
  `enableNotifications` setting (which ceases to be theater with this); the
  foreground press router learned the wired `download_complete` type; the
  manifest declares the permission. Laws: call-site ON/OFF pair
  (DownloadService.test.ts), press routing with an unknown-type control
  (NotificationService.test.ts), manifest fs-gate
  (androidPermissions.gate.test.ts). The playback-notification lane and the
  sibling router stubs stay unwired (no producer ships), and press
  navigation is an open service-layer seam — both disclosed, not silent.

### Fixed — M-MOBILE-04 (majors): Android downloads now land in the native-published private dir — the scoped-storage-forbidden hardcoded path is gone (JS↔native contract unified) — 2026-10-31

- **M-MOBILE-04 (MAJORS queue; review mobile__crossfe M1 — not the
  same-numbered minors-era item):** `getLocalPath()` consumed the native
  `documentsPath` constant ONLY on iOS; on Android it returned the literal
  `/storage/emulated/0/Download/Phlix/<file>`, where enforced scoped storage
  at targetSdk 36 forbids raw `File` creation (no `MANAGE_EXTERNAL_STORAGE`,
  legacy `WRITE_EXTERNAL_STORAGE` a no-op) — jest could not see it because
  the suite's own fallback mock fed the simulated lane. The Kotlin module had
  been exporting `reactContext.filesDir` as `documentsPath` all along; JS
  simply never used it there. Cure: ONE constant on both platforms
  (`documentsPath || ''` + filename); the forbidden literal is pinned OUT of
  the file by a source-text law gate (versionSync/routeManifest fs-read
  precedent) and an exact-destination Android test (the harness already
  loads the service under `Platform.OS === 'android'`). The manifest's
  existing "downloads land in app-private dirs" claim becomes literally true.

### Security — M-MOBILE-10 (majors): the vault token and refresh token can never ride to a host that did not mint them — per-origin binding on both REST legs + target-change teardown — 2026-10-31

- **M-MOBILE-10 (MAJORS queue; review mobile__exploiter M1 — not the
  same-numbered minors-era item):** switching the server URL leaked the
  PREVIOUS server's entire credential set to the NEW host. The request
  interceptor attached `secureStorage.getAccessToken()` unconditionally —
  including to the login POST aimed at a just-typed host B — and the first
  401 POSTed A's REFRESH token to `{B}/auth/refresh`; a crafted 200 from B
  then replaced the vault pair, keeping the victim connected to the
  attacker. Cure, three belts, one parser (`hostOf`, the same machine-identity
  anchor the direct SyncPlay pin already uses):
  - `api/client.ts` request interceptor: a vault token is attached ONLY when
    `getIssuedHost()` (written by every `storeTokens` since the M2-era pin)
    equals `hostOf` of the dialled base URL; a pre-pin (migrated) session has
    no vouched origin and fails CLOSED — one honest re-login, same law the
    SyncPlay lane already enforces.
  - `api/client.ts` refresh leg: refuses BEFORE the POST when the vault pin
    and the dialled host disagree; the failure route wipes the vault and
    drops the store to signed-out, so attacker B never receives — and never
    gets to re-issue — A's refresh token.
  - `stores/useAuthStore.ts`: a module-level settings subscription performs
    target-change teardown — ANY host change (even a FAILED login attempt)
    clears the vault and signs the UI out before the next request leaves.
- **`services/SecureStorage.ts` write ordering:** `storeTokens`/`clearTokens`
  now serialize on one internal chain, so the teardown's async wipe can never
  land after a same-gesture login's fresh issuance and orphan the new session
  (call order is the law; rejections still propagate; reads stay unchained).
- **Tests (+8, one law test rotated):** three interceptor laws replace the old
  "stored token → header" pin (bound-attach / cross-host refusal / migrated-
  orphan fail-closed); cross-host refresh refusal asserts `axios.post` was
  NEVER called; two chain-ordering tests (held-reset gate proves the FIFO;
  later wipe still wins); `useAuthStore.targetWipe.test.ts` (3) drives the
  real settings store + vault: host-change teardown, same-host re-entry NOT
  wiping, port-only hop NOT wiping. Mutation teeth: strip the interceptor
  binding → exactly 2 reds; strip the refresh guard → exactly 1; unchain the
  vault → exactly 1; disable the subscription → exactly 1. The existing 401
  test was rotated (pin to the dialled host) to keep its failure-mode meaning
  under the new guard.

### Fixed — R-MOBILE-01: the `server_time` carrier unit is normalized at the decode boundary — the mixed-unit field no longer leaks :8097 seconds into the ms-declaring command event — 2026-10-31

- **R-MOBILE-01 (review rider):** the four playback-family decode sites in
  `SyncPlayService` (`handlePlaybackPlay/Pause/Seek/Sync`) read
  `msg.server_time` through the plain finite-check parser, bypassing the
  carrier normalization the library itself applies (`SyncPlayClient.serverTimeToMs`,
  shipped post-v0.1.5 by M-SYNCPLAY-04): the :8097 server worker stamps that
  field UNIX SECONDS (`SyncPlayManager` `time()` echoes and `?? time()`
  fallbacks) while the hub relay stamps ms (`nowMs()`) — so over the server
  carrier the event's `serverTime`, whose contract declares milliseconds,
  arrived 1000×-small. The frozen `#v0.1.5` tag-pin predates the library
  export (the v0.1.6 wave is owner-scheduled and rider lanes do not bump
  pins), so the law now lives as `serverTimeToMs` in `src/syncplay/wireUnits.ts`
  — a byte-mirror of the library function beside its unit-decode siblings —
  composed with the boundary parse as `wireServerTimeMs` at the four sites.
  Scope kept exact: the `time_pong` `t2` stays RAW (ms on BOTH carriers —
  server `TimeSync.php` `microtime(true)*1000`, hub `nowMs()`), the
  `time_sync` advisory keeps its seconds-by-contract name, outbound frames
  keep the local synchronized clock, and the absent/non-numeric fallback to
  `getSynchronizedTime()` is untouched (M-SYNCPLAY-19 law).
  -9 tests: five service-level pins (server/hub carrier vectors, the 1e12
    boundary pair, the non-numeric fallback, the pong-raw jurisdiction pin)
    + four `wireUnits` table pins; the existing `playback_sync` fixture's
    honest seconds-shaped `server_time` now also pins its ms delivery —
    inert before the cure, decisive after (the raw leak reads 1.7e9).
  -`onPlaybackCommand` consumers (`PlayerScreen`, `HomeScreen`) never read
    `serverTime` today, so nothing downstream changes behavior; the fix
    makes the declared ms contract true the moment they do.

  Gates: jest `--runInBand` 108 suites / 1606 tests (1 skipped, 1605 passed;
  baseline 1597 + 9, exact) exit 0; `tsc --noEmit` clean; eslint on all four
  touched files 0 errors. Tag-pins frozen and untouched: contracts `#v0.5.3`,
  syncplay `#v0.1.5`; no plaintext-token surfaces added (SecureStorage law
  era untouched); CHANGELOG history verbatim.

### Fixed — W-min58 rework (M-MOBILE-20): README CI/CD note corrected to truth — manual dispatch is real, additive, and present on all three workflows — 2026-10-30

- **M-MOBILE-20 (REWORK cure)**: the batch's doc-only cure had replaced the
  stale "manual trigger" prose with an annotation claiming no
  `workflow_dispatch` existed on any of the three workflows — false at the
  shipping commit (test.yml since b8dad21; build-android.yml and
  build-ios.yml since 1b1b167). The README note now states the shipped-bytes
  truth: dispatch EXISTS on all three, is ADDITIVE, and never replaced the
  push/PR triggers; the visible section gained the manual-run sentence.
  Triggers, jobs, and artifact prose unchanged. Doc-only, no code surface.

### Fixed — W-min59 minors cluster (M-MOBILE-08, -13, -14, -17, -37, -42, -55): media3 migration, manifest/plist residue trimmed, day-one Home guidance, local placeholder art, relay replay window — 2026-10-30

- **M-MOBILE-08 (CURED)**: legacy (pre-API-26) launcher bitmaps generated in
  the exact adaptive-icon art (`#0066CC` field + white diamond from
  `ic_launcher_foreground.xml`) across mdpi–xxxhdpi, square + circle-masked
  round variants. minSdk 24 sat below the anydpi-v26-only resources' API 26
  floor — Android 7.x installs had no launcher icon.
- **M-MOBILE-13 (CURED)**: `READ`/`WRITE_EXTERNAL_STORAGE` retired from the
  manifest (zero MediaStore/Environment usage; downloads are app-private);
  the API-33 `READ_MEDIA_*` trio stays per the review's own advice.
- **M-MOBILE-14 (CURED)**: `com.google.android.exoplayer` 2.19.1 (archived
  line, no security fixes) → maintained `androidx.media3`
  (media3-exoplayer/media3-ui 1.4.1). The single consumer
  (`PhlixPlayerView.kt`) is a direct API rename; E3-native surface stays
  compile-gated by CI Build Android. Doc prose followed.
- **M-MOBILE-17 (CURED)**: iOS Info.plist template residue trimmed —
  empty `NSLocationWhenInUseUsageDescription` (CoreLocation never linked)
  and `UIRequiredDeviceCapabilities` armv7 (RN 0.85 ships no armv7 slice).
- **M-MOBILE-37 (CURED)**: day-one Home (no history, no recently-added, no
  rendered library content) now shows the `EmptyState` guidance tile with a
  Browse-library action instead of a blank scroll region; decision extracted
  as the pure `homeShowsEmptyState` (slice(0, 3) render-window mirror) with
  unit pins.
- **M-MOBILE-42 (CURED)**: all six `via.placeholder.com` fallbacks retired —
  a self-hosted client phoning a third-party image service leaked user IPs
  and rendered nothing offline. Missing art now renders the local
  `LocalPlaceholder` tile through the pure `firstUsableUri` seam; a
  source-scan law test keeps the service URL out of `src/` permanently.
- **M-MOBILE-55 (CURED — clause b; clause a same-defect credit to
  W-min60)**: `parsePendingCommandFrame` no longer mints the phone's own
  clock for a missing/non-finite `issued_at` (that made every replay of a
  stamp-less frame look fresh to the dedupe key — the negative-contract test
  that pinned the fallback was flipped to the new law). Strict parse +
  documented seconds-scale replay window
  (`PENDING_COMMAND_MAX_AGE_SECONDS` 900 / future skew 60) with an injected
  clock seam; every wire fixture rotated to stamps fresh-in-window so the
  M-MOBILE-29 server_id-contradiction test keeps its mutation teeth.
  Clause a (server_id vs bound socket) was landed by W-min60 — verified.
- **M-MOBILE-01 (STALE-VERIFIED)**: the deep-link-entry ask was cured
  pre-queue (`8467014`: `src/navigation/linking.ts` + NavigationContainer
  `linking` prop; iOS `CFBundleURLTypes phlix`; Android intent-filter — all
  on-disk at tip, cat-file + merge-base exit 0). The windows-client's
  `accept-invite` family remains a DISCLOSED route-law gap in linking.ts's
  own header (no mobile screen exists; registering phantom routes is
  forbidden) — feature-scale, not silently re-claimed here.

### Fixed — W-min58 minors cluster (M-MOBILE-20, -56): CI/CD section to workflow truth, unresolvable version badge retired — 2026-10-30

- **M-MOBILE-20 (CURED)**: README §CI/CD now states the verified workflow
  truth — all three workflows trigger on push AND pull request
  (`main`/`master`/`develop`); "iOS Build … manual trigger" was live-false
  (no `workflow_dispatch` exists on any file; iOS is an unsigned simulator
  compile gate on every push/PR), and the Android line now covers PR
  builds, the master-only release job, and the rolling `latest`
  prerelease republish. Doc-only change; claims re-read from
  `.github/workflows/*.yml` at this tip.
- **M-MOBILE-56 (CURED — second clause; first clause STALE)**: the
  header's `github/v/tag … sort=semver` version badge queried tag data
  the repo never publishes (`git tag -l` and `ls-remote --tags` = the
  CI-reset rolling `latest` alone, non-semver) — retired with an honest
  HTML comment. The React Native badge clause was already cured
  pre-queue by `0a9969f` (0.76 → 0.85, content-verified + ancestor).
- **M-MOBILE-11 (STALE-VERIFIED — cured by sibling batch W-min57)**:
  `.env.example` lists `PHLIX_SYNCPLAY_WS_PORT` (added in `1b1b167`,
  ancestor-verified) and `src/syncplay/wsEndpoint.ts` reads the
  react-native-config seam — the queue item predated the sibling cure.

### Fixed — W-min61 minors cluster (M-MOBILE-26, -27, -28, -32, -41, -48, -49, -50): seek clamped at the native boundary, frame admission capped, hold-to-delete discovered, detail-page IA untangled, hub roster scheme-allowlisted, WS predicate unified — 2026-10-30

- **M-MOBILE-26 (CURED — same defect as M-MOBILE-54)**: the review's number/
  object payload vector is the un-narrowed `playback_state` cast; the W-min60
  `wirePlaybackState` whitelist parser landed the cure, and its hostile-shape
  it.each (number 7, object, null, absent, garbage string) already pins this
  exact clause. Proof-over-recode: `wmin61UiPins` additionally pins the
  routing so the checked cast inside the parser is the only one left.
- **M-MOBILE-27**: seek targets are now BOUNDED, not just finite —
  `clampSeekSeconds(position, duration)` caps at the known duration (24 h
  sanity ceiling when it is unknown, 0 floor for negatives/NaN) and the
  `PlayerScreen` seek arm runs every host command through it before the
  native module; the SyncPlayService decodes floor at 0, and `formatTime`
  answers `0:00` for non-finite/negative input instead of sci-notation
  garble. The review's `1e303` vector lands exactly on the duration edge.
- **M-MOBILE-28**: both inbound JSON lanes ask the size question BEFORE the
  parse — `MAX_INBOUND_FRAME_BYTES` (1 MiB, shared `syncplay/frameLimits`)
  caps `SyncPlayService.handleMessage` and the `hubRelay` socket alike;
  oversize frames are dropped loud and the socket keeps running (one bad
  byte must not evict every member).
- **M-MOBILE-32 (CURED BY SIBLING — verified, not re-implemented)**: the
  badge this finding asked for shipped in the W-min62 lane as
  `useConnectionSecurityStore` + the root-mounted `InsecureConnectionBanner`
  (recorded there as M-MOBILE-51; the two asks are the same cure — a
  VISIBLE cleartext indicator instead of silent degradation). Disk-verified
  at 3b4ef40: all three dial seams report, the banner listens, and the
  platform-file posture (usesCleartextTraffic/NSAllowsArbitraryLoads) stays
  the ratified LAN tradeoff.
- **M-MOBILE-41**: the long-press delete on WatchHistory and Collections is
  now DISCOVERABLE — a stated hint rides the existing header row
  ("Press and hold an item to remove it" / "…a collection to delete it").
- **M-MOBILE-48**: five detail-page IA tangles — the poster's dead
  `onPress={() => {}}` Pressable now starts/resumes playback for playable
  items; Resume keeps a start-over path (long-press + stated caption); the
  duplicate rating UI is gone (inline optimistic row stays, the
  zero-call-site `UserRatingPicker` component was deleted with it); tapping
  a queued/downloading download answers with an Alert pointing at the
  Downloads tab instead of silently no-oping; and the Login footer stopped
  asserting agreement to a Terms of Service that does not exist.
- **M-MOBILE-49**: `resolveEffectiveUrl` parses the hub roster instead of
  trusting it verbatim — only `https://`/`http://` may become the base URL
  (the http LAN lane stays reachable and is made visible by the banner);
  scheme-less or foreign-scheme hostnames are refused loud into the
  existing no-server degradation.
- **M-MOBILE-50**: the two WS scheme predicates (`startsWith('https')` on
  the direct lane, `startsWith('https://')` on the relay lane) collapsed
  into ONE shared strict helper, `utils/serverHost.isHttpsBase` — the
  security-relevant direction of the drift is what stayed.

### Fixed — W-min60 minors cluster (M-MOBILE-05, -06, -16, -29, -31, -33, -54): signup path wired, private Room ID surfaced, safe-area back button, path-param encoding + relay server_id gate, restore shaping, biometric gate made real, `playback_state` boundary parser — 2026-10-30

- **M-MOBILE-05**: `AuthManager.register` had no call site — the app could not
  create an account. `LoginScreen` gains a sign-up mode (toggle row, email
  field, server-decides hint), `useAuthStore.register` returns
  `{outcome:'authenticated'|'pending'}` so an approved registration lands a
  session and a gated one shows the server message without faking login.
- **M-MOBILE-06**: after creating a private room the Room ID was never shown.
  The in-group panel now carries a selectable Room ID row (long-press copy on
  both platforms — no new dependency) plus a hint pointing friends to the
  Join tab, which was always functional but unreachable without an ID.
- **M-MOBILE-16**: the detail-screen back button hardcoded
  `Platform.OS==='ios'?50:20`; it now reads `useSafeAreaInsets()`
  (`insets.top + 8`), the repo standard (SafeContainer/PhotoViewer idiom).
- **M-MOBILE-29**: every path-interpolating `src/api` manager now wraps
  identifiers in `encodeURIComponent` (13-file sweep, ~77 sites) closing the
  traversal family a hub-relay `media_id` could reach; and the relay socket
  drops any `pending_command` whose `server_id` contradicts the bound
  socket's server (cross-server command injection).
- **M-MOBILE-31**: the three JSON restore sites are now parsed boundaries —
  `useSettingsStore` type-checks every persisted key (a non-string
  `serverUrl` previously made `getServerRoot` throw on every later call),
  `downloadStore` keeps only shaped task entries (a scalar blob previously
  crashed `Object.values` at boot), `hubStore.loadPersistedState` requires a
  string hub URL, string server id and `{expiresAt:number, userId:string}`
  session before hydrating, else refuses without touching state.
- **M-MOBILE-33**: the biometric toggle was theater — nothing ever consumed
  it. `authenticateWithBiometric` now reads the access-control-protected
  marker slot WITH a prompt (the only item whose read forces biometry; an
  absent slot means no gate), `checkAuth` runs it before touching the vault,
  the Settings switch arms/disarms the real marker (a device refusal shows
  an Alert and the flag never sticks), and a mount effect re-syncs the flag
  to marker truth.
- **M-MOBILE-54**: `handleGroupState` cast `playback_state` to the union
  un-narrowed; a `wirePlaybackState` whitelist parser (anything else falls
  back to `'stopped'`) matches the boundary-parser law every other field
  follows.

### Fixed — W-min62 minors cluster: Android hardware-back exit-confirm at dead roots, module-scope `Dimensions` frozen everywhere (6 surfaces → live `useWindowDimensions` + responsive grid seam), first haptics layer (Vibration wrapper — no new pod against the pinned lock), cold-load skeletons, 12pt font floor + bounded chrome scaling, keyboard traps (filter sheet, Login Enter path), cleartext-lane reporting + persistent insecure banner — 2026-10-30

- **M-MOBILE-35 (CURED)**: the app registered zero `BackHandler`s — hardware
  back from Login or the first tab with an empty stack silently quit.
  `src/utils/exitGuard.ts` is the pure decision (declines while the navigator
  can pop; pops are untouched law, including bottom-tabs' back loop),
  `RootExitGuard` in `RootNavigator` feeds it live `navigationRef.canGoBack()`
  verdicts and raises an explicit Exit/Stay confirm at true roots; iOS
  registers nothing (no hardware back exists). Player parity verified, not
  coded: ✕ is a plain `goBack()` and the hardware key pops the same route.
- **M-MOBILE-39 (CURED, one clause stale-verified)**: module-scope
  `Dimensions.get('window')` froze foldables/tablets/landscape at the
  import-time snapshot in HomeScreen, MediaDetail, MediaList, MediaCard and
  ContinueWatching — all five now read `useWindowDimensions()` (the pattern
  the Photos screens already demonstrated). The Search grid's hardcoded
  two-column literal became the pure seam `searchGridColumns(width)`
  (2/3/4 at <600/≥600/≥900). The review's sixth named file, SeekBar, was
  already cured by 2666d4f's responder rewrite (no `Dimensions` import
  remains; ancestor-verified). Law test fails any new module-scope snapshot.
- **M-MOBILE-40 (CURED — Android; iOS honestly deferred)**: new
  `src/utils/haptics.ts` wrapper on RN-core `Vibration` — light 8ms / medium
  16ms / destructive double-tap, never throws. Call sites: tab switches
  (light), long-press-delete starts on WatchHistory + Collections
  (destructive), the exit confirm (destructive), SyncPlay join success
  (medium). Why not expo-haptics: this is BARE RN and `ios/Podfile.lock` is
  deliberately pinned (M-MOBILE-09); an Expo module drags
  `expo-modules-core` pod-tree + AppDelegate-runtime integration behind it —
  that is its own native-wave lane, not a minors-cluster gamble. iOS
  `Vibration.vibrate()` is a documented no-op; the seam is swappable in one
  file when the pod wave lands.
- **M-MOBILE-43 (CURED; hold-clause already shipped)**: cold loads painted a
  spinner in the void; `ContentSkeleton.tsx` (RN-core Animated, no new pod)
  now shows the layout SHAPE — `DetailSkeleton` (hero + poster + rails) for
  MediaDetail, `GridSkeleton` for Search's first query and Home. The
  review's other half (previous-content hold across re-fetches) is
  M-MOBILE-17 law, already live (`setIsLoading(item === null)` re-pinned).
- **M-MOBILE-45 (CURED, two laws)**: FLOOR — all ten sub-12 `fontSize` sites
  (×5 at 10pt, ×5 at 11pt; worst the SyncPlayOverlay stats) now sit at
  ≥12pt and the scan test reddens anything lower. CEILING — the fixed-height
  chrome the review named (60pt tab bar, 44pt A–Z rail squares, the player
  pill, the two 44pt glyph circles) carries `maxFontSizeMultiplier={1.5}`
  as props. Venue truth recorded: RN 0.85's Fabric Text has NO app-wide
  `Text.maxFontSizeMultiplier` static anymore (verified in the vendored
  `Libraries/Text/Text.js`), so a global assignment would have been dead
  code pretending to be a fix.
- **M-MOBILE-47 (CURED)**: the Search filter sheet gained a
  `KeyboardAvoidingView` (`padding` — inside a transparent Modal Android's
  activity-level adjustResize never sees the dialog window) and
  `keyboardShouldPersistTaps="handled"` on its body ScrollView (first tap
  hits the field instead of dismissing the keyboard). Login's three fields
  now walk Server→Username→(go)Sign-in via `returnKeyType` + a focus chain,
  and Enter on the password SUBMITS (`onSubmitEditing={handleLogin}`).
- **M-MOBILE-51 (CURED — visibility; digest clause CROSS-REPO-ROUTED)**:
  the review's own minimum — a persistent insecure-connection indicator —
  shipped as `useConnectionSecurityStore` (one predicate, per-lane write-
  gated ledger) + `InsecureConnectionBanner` mounted at the root. The three
  dial seams report: `client.ts` server-root resolver (`rest`),
  `wsEndpoint.resolveSyncPlayWsEndpoint` both branches (`syncplayWs`),
  `hubRelay` pre-dial (`hubRelay`); logout resets the ledger. NOT changed,
  deliberately: `usesCleartextTraffic`/`NSAllowsArbitraryLoads` (the
  ratified LAN-http working mode) and the dial schemes themselves. The
  REST-join password-digest clause cannot be client-side honest: the
  server's `SyncPlayController` parses ONLY `password` from the body
  (`password_hash` is silently dropped — disk-verified at server master),
  while the WS lanes already ship `hashGroupPassword` SHA-256 per SPEC §4.
  Server roster item: have the controller read `password_hash` and forward
  it to the ALREADY-EXISTING `$passwordHash` parameter of
  `SyncPlayManager::createGroup/joinGroup` (canonical precedence, one-line
  change + tests); mobile flips the REST body to the digest when it lands.

### Fixed — Forward-fix W-min57 version stamping: the Gradle package.json lookup resolved one directory too shallow, failing `:app` evaluation (and the CI Android build) — 2026-10-30

- The JsonSlurper line shipped in the W-min57 cluster read
  `new File(projectDir, '../package.json')`. In `:app` that is
  `android/app/../package.json` = `android/package.json`, which does not
  exist — Gradle died with "Unable to process file" during configuration.
  Caught by a local `./gradlew :app:properties` probe before CI verdicts.
  The lookup now reads `new File(rootProject.projectDir.parentFile,
  'package.json')` (`android/..` — the repo root), and
  `src/__tests__/versionSync.test.ts` pins the corrected spelling plus a
  regression pin forbidding the wrong-depth one.

### Fixed — W-min57 minors cluster: committed Podfile.lock + CI stops deleting it, fail-loud CI artifact uploads (the iOS job had uploaded NOTHING while green), per-ref concurrency with master-safe cancellation, AGENTS.md drift (React Navigation v7, three-tier base URL), version stamping single-sourced to package.json with a drift gate test, README env-key truth (`PHLIX_SYNCPLAY_WS_PORT`, yarn float, versioning story), gradle lint gag narrowed to the one by-design suppression — 2026-10-30

- **M-MOBILE-09 (CURED)**: `ios/Podfile.lock` committed (242 dependency pins,
  `PODFILE CHECKSUM bb02a6b3…` matching the Podfile byte-for-byte). Venue
  truth: the lock was generated by CocoaPods 1.17.0 installed on this **Linux**
  host with two thin PATH stubs (`xcodebuild -version`, `command -v`) — pod
  resolution and lock writing are pure-Ruby/platform-independent; only the
  Xcodebuild version gate and RN's `command -v ccache` probe (a bash builtin
  that exists as a binary on macOS but not Ubuntu) needed faking. CI's two
  `rm -rf ios/build ios/Pods ios/Podfile.lock` steps now keep the lock so
  `pod install` honors the pins instead of floating every caret pod.
- **M-MOBILE-22 (CURED, four clauses)**: (1) `concurrency` groups on
  workflow+ref across all three workflows, `cancel-in-progress` conditional —
  PRs supersede, master/main never cancel mid `release-latest` (tag-reset
  stranding); (2) `if-no-files-found: error` on every upload-artifact step —
  which immediately caught real theater the warn-default had hidden: the iOS
  jobs' upload paths never matched anything (Metro appends `.js` to
  `--out ios/main.jsbundle`; a plain `build` emits no `*.app.dSYM.zip` and the
  Debug configuration emits no dSYM at all). Paths corrected to the real
  outputs (`ios/main.jsbundle.js`; Release-only dSYM glob
  `Products/**/PhlixMobile.app.dSYM/**`; Debug artifact is bundle-only, the
  docblock now says so); (3) `workflow_dispatch:` added to both build
  workflows; (4) `android/app/build.gradle` lint block: blanket
  `abortOnError false` removed (it gagged every finding; CI runs no lint task,
  so behavior there is unchanged), keeping only `disable 'ReleaseLifecycle'` +
  `checkReleaseBuilds false` with the debug-signing-hedge rationale.
- **M-MOBILE-10 / M-MOBILE-57 (CURED)**: `AGENTS.md` header said React
  Navigation **v6** (deps: `@react-navigation/native ^7.3.4` + v7 peers) and
  described `client.ts` as carrying `BASE_URL = 'https://api.phlix.app'` — the
  module has long resolved its base in three tiers (`getServerRoot()`/
  `getBaseUrl()`), so both sentences now tell the truth; the layout line also
  names the new code-first `apiErrorMessage` choke point from W-min56.
- **M-MOBILE-15 / M-MOBILE-25 (CURED)**: version stamping was three drifted
  literals (`1.0.0` / `1.0.0` / `1.0`; `versionCode 1` frozen — every rolling
  `latest` re-publish indistinguishable). Now `package.json` version is THE
  source: `build.gradle` derives `versionName` + `versionCode`
  (`major*1000000 + minor*1000 + patch`) from it at configure time; the pbxproj
  (Xcode can't read package.json) was realigned to `1.0.0`/`1000000` and the
  new `src/__tests__/versionSync.test.ts` gate fails the suite on ANY drift.
  README gained the Versioning story (bump = `npm version`; touch the four
  pbxproj lines in the same commit). Disclosed: `CURRENT_PROJECT_VERSION`
  jumping 1 → 1000000 is a one-time big step, monotonic from here.
- **M-MOBILE-18 (CURED — residual of the 69c432e pass)**: README step 4 still
  claimed "No other keys are read today" while `src/syncplay/wsEndpoint.ts`
  reads `PHLIX_SYNCPLAY_WS_PORT` (default 8097, malformed→fallback). The key,
  the hub-relay port asymmetry (compiled `8804`, no env override), and
  `.env.example` all brought to code truth.
- **M-MOBILE-19 (STALE-cured)**: prereq/toolchain trio — Node `v18.x`→v24
  +engines truth and the API-36/minSdk-24 SDK line landed in `0a9969f`; the
  `your-org/phlix-mobile` clone placeholder in `35669df`; both verified
  ancestors of `origin/master` this session (raw exit-0 merge-base).
  Forward-fix here: the npm/yarn prerequisite now discloses that only
  `package-lock.json` is committed — the yarn path installs floating.

### Fixed — W-min56 minors cluster: self-service profile routes, download-path id sanitization, code-first + quarantined REST error prose, full sign-out teardown, app-wide ellipsis normalization — 2026-10-30

- **M-MOBILE-07 (family access, casualgamer)**: `ProfileManager` repointed
  from the admin-gated `/admin/users/{userId}/profiles…` lane to the server's
  SELF-SERVICE `/api/v1/profiles…` routes (plain auth; the bearer token is the
  identity — no admin hat, no userId path). `useProfileStore.loadProfiles/
  createProfile` drop the userId parameter; `ProfileSelectScreen` loses its
  non-admin "managed by an administrator" wall — a signed-in parent can now
  make child profiles on their own phone. The create/update bodies carry the
  `content_rating` LABEL the self-service route speaks (the int 0–6 encoding
  stays documented as the admin-lane form). Every new URL leg is
  manifest-backed (`src/api/test/server-route-manifest.json` carries all of
  `/api/v1/profiles*`); activation via `POST .../switch` is deliberately NOT
  consumed yet (token-re-minting flow, documented seam in the manager).
- **M-MOBILE-30 (exploiter)**: `DownloadService.getLocalPath` now sanitizes
  `item.id` with the same class-preserving replace as the title — previously
  a server-minted id like `../../etc/passwd` smuggled separators into the
  filename and escaped the download directory.
- **M-MOBILE-34 + M-MOBILE-52 (phishing surface / code-first)**: the REST
  error lane stops rendering untrusted server prose verbatim. New doctrine
  mirrors `describeSyncPlayError`: app-owned catalog copy for every contract
  auth code wins; unknown-code server text renders only through
  `quarantineServerProse` (URLs masked, control/zero-width junk stripped,
  single line, 140-char cap) with an explicit `Server says:` attribution;
  thrown messages are quarantined too. The SettingsScreen hub sign-in alert
  and the hubStore error field route through the same parser instead of raw
  `err.message`.
- **M-MOBILE-53 (logout completeness)**: sign-out now tears the session down
  everywhere instead of only wiping the keychain. `AuthManager.logout` fires
  the root-level `/auth/logout` revocation leg (the server mints the JWT
  deny-watermark + ends all sessions for an attached bearer; the browser
  redirect answer is irrelevant) best-effort before wiping locally;
  `useAuthStore.logout` additionally disconnects the live SyncPlay socket and
  cancels scheduled notifications; `HubAuthService.signOut` — a literal
  no-op — now POSTs the hub's JSON `POST /api/v1/auth/logout` (204, refresh
  lineage revoked) before `hubStore` wipes the vault. Every network leg
  swallows failure by design: an offline device must not strand a signed-in
  app, and the local wipe always proceeds.
- **M-MOBILE-64 (writer)**: the two ellipsis styles are unified on the
  single-character `…` across the UI (Loading/Syncing/Saving/Adding/Creating/
  Signing-in/spinner placeholders) including `truncateText`'s suffix, whose
  kept prefix gains two characters; the three-dot pins in `formatters.test.ts`
  rotate to the new law.
- **M-MOBILE-03 (stale-verified, no code)**: hub-session keychain migration
  already landed at 8e3f717 — `persistSession` stores the JWT pair in the
  vault and AsyncStorage holds only non-secret metadata; verified at tip
  (ancestor of origin/master), no re-cure needed.


### Fixed — the progress bar survives the 3s chrome auto-hide (M-MOBILE-44 first clause) — 2026-10-30

- **M-MOBILE-44 r2 (player chrome, gameux — W-min55 review leftover)**: the
  W-min55 batch cured this item's title/label clauses but the review
  convicted its FIRST clause as untouched — "controls auto-hide after 3s …
  while the *decorative* seek bar is part of what hides". The cure is
  structural: the SeekBar now renders on a persistent rail OUTSIDE the
  auto-hiding overlay (VOD lane), so progress stays on screen after the
  chrome fades. While hidden the rail is display-only
  (`pointerEvents='none'`) — a tap there falls through to the video surface
  and reveals the controls instead of risking an unintended seek; with the
  chrome up it is the same interactive scrubber M-MOBILE-13 built, and the
  SyncPlay host-only `canSeek` law rides with it. Live TV grows no rail:
  with no duration clock its bar is a 0:00 artifact and hides with the
  chrome, honestly. The overlay keeps a fixed-height spacer where the row
  lived, preserving the space-between chrome geometry; the M-MOBILE-14
  no-ScrollView responder law is untouched (the rail sits beside the
  overlay, not inside a scroll host). Three new PlayerScreen pins —
  survive-the-hide, reveal-rearms-interactivity, live-gate — red against the
  pre-cure tree, green now. No wire surface touched.

### Added — changelog currency backfill (second pass): five more landed commits that never got an entry — 2026-10-30

- **Backfill (review W-min54 r2, M-MOBILE-61 leftover), no new code** — the
  independent review convicted the first pass above: its disk audit still
  missed the whole `mobile__writer` M21–M25 fix chain — five landed commits,
  each individually audited `git show --name-only` → zero CHANGELOG touches.
  Recorded here verbatim, one line each, newest first (subjects re-verified
  with `git show -s` before writing): `07556b3` brought the storage claims to
  shipped vault truth — the AsyncStorage oxymoron cured in README, CLAUDE and
  DEVELOPER; `8b93331` brought the compatibility claims to shipped truth —
  Phlix server/hub only, the Jellyfin/Emby fiction removed from README,
  AGENTS and CLAUDE; `69c432e` brought the configuration surface to code
  truth — the real env key documented, the fiction deleted (README +
  DEVELOPER); `35669df` fixed the clone coordinate to the real repo URL and
  swept placeholder coordinates; `0a9969f` brought the Node prerequisite to
  engines truth (>=24) and swept the README's version claims. The nine-row
  first-pass entry stays exactly as landed — history verbatim; this is the
  fresh top entry the currency law requires.

### Fixed — W-min55 minors cluster: iOS background audio + PiP honesty, player title & control labels, tab-bar insets + focus pill, 44pt chrome targets outside/inside the player, README feature-truth (SyncPlay/volume/speed), signing-doc contradictions — 2026-10-30

- **M-MOBILE-02 (background/lock-screen media, casualgamer)**: iOS gains the
  missing half of the "music in pocket" story — `UIBackgroundModes = [audio]`
  in `Info.plist` plus a `.playback` `AVAudioSession` activated before
  play/autoplay in `PhlixPlayerView.swift` (fail-soft: a refused session
  configuration degrades only the background promise, never the video). The
  📺 PiP button was decorative on Android (native `receiveCommand` implements
  only play|pause|seekTo|setVolume|setMuted — `startPiP` matched no branch);
  it now renders iOS-only, pinned both ways by a new PlayerScreen suite. The
  Android MediaSession/foreground-service gap stays feature-scale and is now
  disclosed in the README. The S407 iOS-boundary law was amended from a bare
  `/audio/i` substring ban (whose iOS quietness was incidental) to
  selection-specific tokens — the anti-fakery teeth are preserved and
  mutation-probed; the Kotlin-side substring pin is untouched.
- **M-MOBILE-44 (player chrome orientation, gameux)**: the top bar now shows
  WHAT is playing — the `liveTitle` route param verbatim when present (zero
  catalog reads), else exactly ONE fail-soft `getMediaItem(itemId)` lookup
  for on-demand; a failing lookup renders no title rather than an error arm.
  ✕ / ±15 / play-pause carry screen-reader labels that flip live. Four new
  PlayerScreen tests pin the dispatch law.
- **M-MOBILE-36 (tab-bar geometry, gameux)**: the bottom bar grows with
  `insets.bottom` instead of the fixed `height: 60` that collided with home
  indicators, and the focused tab gains a tinted pill behind the existing
  scale so selection is legible at a glance.
- **M-MOBILE-38 (Home profile button, gameux)**: 40×40 → 44×44 with an
  accessibility label ("Switch profile").
- **M-MOBILE-46 (sub-44 targets outside the player, gameux)**: Downloads
  action buttons 36 → 44 (five labels added), SearchBar clear gains hitSlop +
  label, MediaDetail back 40 → 44 and favorite/star/season controls get
  hitSlop + labels.
- **M-MOBILE-58 (README never mentions SyncPlay, writer)**: the feature list
  now states watch-parties/SyncPlay — the shipped `SyncPlayModal`/`Overlay`,
  contracts-pinned error catalog and wsEndpoint law make the claim true.
- **M-MOBILE-04 (README feature-trust, casualgamer)**: the README no longer
  promises an in-app volume slider or playback speed (system-volume is
  honest); the Jellyfin/Emby mis-claim was already cured at tip — verified,
  not re-fixed.
- **M-MOBILE-21 (docs/signing.md contradicts the project, devops)**: bundle
  id corrected to the committed `com.phlixmobile.PhlixMobile` (with the
  Android-vs-iOS id trap called out); the impossible unsigned-APK walk-through
  now leads with the truth that the committed release config debug-signs
  `app-release.apk` (and is conditionalized on removing it); all three
  `base64 --decode --output` snippets — broken on GNU (no `--output` at all,
  verified) and BSD alike — became portable `base64 -d > FILE`; and a new
  block documents the half-manual pbxproj vestige (`CODE_SIGN_IDENTITY[
  sdk=iphoneos*] = "iPhone Developer"`, zero `DEVELOPMENT_TEAM`/
  `CODE_SIGN_STYLE`, CI compile-gate only). The README-links-signing sub-claim
  was already cured pre-lane (three links at HEAD).

### Fixed — W-min54 minors cluster: security-rationale comments, dormant-flag truth, deployment/docs inventories, unified sign-in/sign-out + sentence-case alert copy — 2026-10-30

- **M-MOBILE-12 (cleartext rationale, crossfe)**: `usesCleartextTraffic="true"`
  and the iOS ATS `NSAllowsArbitraryLoads` now carry the tradeoff comment
  (self-hosted client, user-typed LAN servers over plain http, no domain
  allowlist expressible; scheme-less input defaults https at the RN layer).
  The redundant `NSAllowsLocalNetworking` key — already subsumed by
  arbitrary-loads — was dropped from `Info.plist` (plist parse verified).
- **M-MOBILE-23 (dormant-flag truth, devops)**: `gradle.properties` no longer
  claims R8 is enabled — `app/build.gradle` ships `minifyEnabled false`, so
  the full-mode flag is documented as dormant-by-design until shrinking is
  switched on. Both `build-ios.yml` metro-bundle steps now state their
  purpose: inspection artifacts uploaded beside the dSYM, NOT an OTA payload
  (the app embeds its own copy via the xcodebuild bundle phase).
- **M-MOBILE-24 (deployment fiction, devops)**: README §Deployment rewritten
  to shipped truth — Android: rolling debug-signed `latest` GitHub prerelease
  (sideload); Play/F-Droid are manual paths gated on docs/signing.md, no
  upload automation exists. iOS: CI builds simulator-only (unsigned);
  TestFlight/App Store is a manual Xcode archive. The "Sign the release APK
  and upload to Google Play Console" fiction is gone.
- **M-MOBILE-60 (format claim, writer)**: the CHANGELOG header no longer
  claims plain "based on Keep a Changelog 1.1.0" — the repo-local convention
  (single `[Unreleased]` pre-1.0, dated `###` headings, history verbatim) is
  now declared honestly.
- **M-MOBILE-61 (currency vocab, writer)**: added a "Reading this changelog"
  glossary (M-MOBILE/W-min/S-number/csNN/regen #N/era-N) and the backfill
  entry recording the nine landed commits that never got one.
- **M-MOBILE-62 (DEVELOPER.md inventories, writer)**: `src/` tree, layer
  table, screen roster (27 root + admin/ + six helper subfolders), component
  roster (cast/, syncplay/, track lists, sleep timer, rating widgets,
  ServerSwitcher), store tables (15 hooks + the four `src/store/` modules,
  with the store-vs-stores trap called out), and the bottom tree (fake
  `assets/` entry removed, android package dirs corrected to player/ +
  download/ + webauthn/) rewritten to disk truth.
- **M-MOBILE-63 (copy consistency, writer)**: user-facing alerts unified to
  sentence case — `SyncPlay Error` → `SyncPlay error`, `Playback Error` →
  `Playback error` (the 4 catalog-pin assertions re-anchored red-then-green);
  auth verbs unified on sign in/sign out — LoginScreen button `Login` →
  `Sign in` (+ failure string/footer), SettingsScreen `Logout` → `Sign out`
  everywhere (dialog, buttons) and hub modal `Sign In`/`Sign Out`/
  `Sign In Failed` → `Sign in`/`Sign out`/`Sign-in failed`.
- **M-MOBILE-65 (orphan docs/scripts, writer)**: README gained a Documentation
  table linking DEVELOPER.md, docs/signing.md, CHANGELOG.md and AGENTS.md;
  `scripts/add-copyright.mjs` is no longer orphaned (`npm run copyright`
  script + README mention) and its convergence claim is proven — the one
  unstamped file (`src/utils/mediaType.ts`) is now stamped; a second run
  updates 0 files.

### Added — changelog currency backfill: nine landed commits that never got an entry — 2026-10-30

- **Backfill (review M-MOBILE-61), no new code** — disk audit at `07556b3`
  found work that landed without a changelog entry. Recorded here verbatim,
  one line each, newest first: `31a56fd` (also `3ab6413`, its pre-rebase
  twin) catalog-routed the SyncPlay REST errors through
  `describeSyncPlayRestError` and fixed logout/library article copy;
  `13715d0` un-refused the hub relay lane now that `:8804` speaks the
  canonical `syncplay_*` catalog (estate owner decision #14); `d938608` +
  `5ef5b9b` dropped `--passWithNoTests` from the CI jest step (a zero-match
  run must exit 1) and updated the testing rule doc (estate CI-gate audit);
  `9e7f083` + `b790049` implemented and hardened the playback progress
  reporter (resume rails populate; session bound to account id to kill the
  stale-session 403 on account switch); `675c2ad` pinned CI to
  ubuntu-26.04 ahead of the `ubuntu-latest` rollover; `3bec415` bumped the
  codecov action to v6 for estate parity; `07e39a6` / `41f2478` merged the
  dependabot npm_and_yarn security updates.

### Fixed — Hub vault crash-residue sweep: both-copies state ends vault-won and plaintext-swept (M-MOBILE-20) — 2026-10-29

- **The last unsealed window of the hub token lane is closed** (review
  `mobile__secnet.md` M1, queue item `M-MOBILE-20`): the headline claim —
  hub JWTs persisted plaintext in AsyncStorage — was already cured at
  `d72dc0c` (vault slots `com.phlix.mobile.hub.access`/`.hub.refresh`,
  sanitizing `persistSession`, migrate-on-first-read) and hardened at
  `23482a5` (ordering pins). What stayed open was the residue of the
  migration's own crash window: if the process died (or the blob rewrite
  threw) AFTER `storeHubTokens` settled but BEFORE the sanitizing
  `setItem`, the next read took the vault branch, skipped migration, and
  **never rewrote the blob — plaintext JWTs living on** until an unrelated
  write happened to replace them. The server precedent
  (`SecureStorage.migrateSlot`) has no such hole: once the secure side is
  settled the legacy copy goes unconditionally. Cure: `loadPersistedState`
  now detects the both-copies state (vault holds the pair AND the blob
  still carries legacy strings), keeps the vault's pair for hydration
  (vault wins, observable via distinct fixture values), and sweeps the
  blob to the sanitized shape; a throwing sweep is fail-soft (blob stays
  for the next load's retry; the vault pair hydrates regardless — the
  sweep is hygiene, never the credential source). Both sanitizing writers
  now share one serializer (`buildSanitizedHubBlob`) so a migration
  rewrite can never drift from the issuance shape. Field classification
  carried from the server lane and documented at the builder: JWTs are
  secrets (vault); `hubUrl`/`activeServerId`/`connectionMode` and the
  `expiresAt`/`userId` envelope are configuration (blob). No token
  material is logged on any hub auth path (zero `console.*` call sites in
  `hubStore.ts`/`HubAuthService.ts`, pinned by grep at close).
  Sign-out already wipes blob + vault slots (M-MOBILE-05 pin held).
- Tests: 3 new in `src/__tests__/hub/hubStore.test.ts` (both-copies
  sweep with stale-vs-vault value discrimination and metadata-retention
  pins, idempotence guard for healthy v2 state — no rewrite churn, and
  the fail-soft sweep-failure leg using a whole-test implementation swap
  so an unconsumed rejection can never poison later suites). Mutation
  teeth: stripping the residue branch reddens exactly the two sweep
  tests (idempotence test stays green by design); the M-MOBILE-05
  migration pins keep the strip-the-migration mutation red.
- Gates: jest `--runInBand` **96 suites / 1466 pass + 1 skip (1467)** vs
  self-baseline at tip `6ca274a` of 96 / 1463 + 1 skip (1464) — delta
  exactly +3 new tests, zero moved; `tsc --noEmit` exit 0; eslint 0
  errors (2 pre-existing warnings held).

### Fixed — Search rail consumes the geometry seam; screen-level law pin (M-MOBILE-19 r2) — 2026-10-29

- **The 44pt law is now pinned through the RENDERED screen, not only the
  helpers** (review `M-MOBILE-19__r1` MAJOR-1): the r1 review's mutation M2b
  — `railButton: {...RAIL_BUTTON_LAYOUT, minHeight: 15}`, lint-clean and
  tsc-clean — left all 1459 tests green while silently re-breaking the exact
  law the item exists for, because no test imported `SearchScreen`. Cure
  (no geometry change — the r1 review judged the shipped numbers correct):
  the screen now computes its rail touch geometry **through the seam**
  (`railLetterTouchRect()` feeds both the 44pt column width and every
  letter's laid-out footprint; values identical to r1, only the conduit
  changed) and the NEW `src/screens/__tests__/SearchScreen.test.tsx` (5
  tests) drives the real screen through the repo's hook-host venue
  (PlayerScreen/CastScreen pattern — no React renderer in test deps) and
  pins the flattened style of the rendered tree: the rail root is a
  `ScrollView` SIBLING of the results list (never nested), all 27 letters
  carry a literal-44x44pt footprint with per-letter helper==inline
  equivalence, zero `hitSlop` anywhere plus exact row tiling (pitch ==
  touch height, no margins) — the reviewer's 12.3pt neighbour-bleed
  scenario is now structurally impossible **and screen-pinned** — and the
  1188pt > 320pt scroll premise holds from the tree. Mutation proofs:
  M2b (`minHeight: 15`) reddens 2 named screen tests (was: whole suite
  green); the 24x15 defect shape reddens 2; `RAIL_TARGET_MIN_SIZE_PT`
  44→40 reddens 7 tests across 2 suites (r1: 3).
- **Test-only seam removed** (review minor-1): `railContentHeightPt` had no
  production caller and cannot get one honestly — an explicit px column
  height in `contentContainerStyle` would override the blessed
  `minHeight: '100%'` percentage centering (r1 review §1), so it is deleted
  and its 27 × 44 = 1188 arithmetic is now pinned as a literal through
  `railLetterTouchRect()` in both the helper and the new screen test.
  `railLetterTouchRect` gains its production caller via the wiring.
- Gates: jest `--runInBand` **96 suites / 1463 pass + 1 skip (1464)** vs
  self-baseline at `fcd1118` of 95 / 1458 + 1 skip (1459) — delta exactly
  the new file (+5); `tsc --noEmit` 0 errors; eslint 0 errors / 2
  pre-existing warnings (law intact), none from touched files.

### Fixed — Search A–Z rail meets the 44pt touch-target law (M-MOBILE-19) — 2026-10-29

- **Every rail letter is now a laid-out 44x44pt square; the 27-square column
  scrolls.** The pre-cure rail sized letters with `paddingVertical: 1` around
  `fontSize: 11` text in a 24pt column — a ~15pt-tall target, 27 of them
  stacked shoulder-to-shoulder with no vertical budget to expand into
  (27 x 44pt = 1188pt exceeds any phone viewport), so mis-tapping a
  neighbour was structural, not incidental (review `mobile__gameux` M-H).
  Cure: the rail root became a `ScrollView` (`decelerationRate="fast"`,
  scroll indicator kept as the "more letters" affordance) and each button now
  takes its minimum from **layout, never hitSlop** — vertical slop across
  stacked siblings makes neighbour rects claim the same points, which is the
  failure mode the review called out. Geometry lives in
  `searchScreenHelpers.ts` (`RAIL_TARGET_MIN_SIZE_PT` 44,
  `RAIL_BUTTON_LAYOUT`, `railLetterTouchRect`, `railContentHeightPt`) as the
  single source the screen renders and the tests pin. Visual density is kept:
  11pt glyphs centred in invisible 44pt rows.
- **a11y honesty:** `accessibilityRole="button"`,
  `accessibilityLabel={letter}` (a single A–Z/"#" glyph is alphabet, not UI
  copy — no message-catalog entry is needed, and none would render correctly
  across locales), `accessibilityState={{ disabled }}` mirrors the no-entry
  letters. Press feedback: `TouchableOpacity`'s built-in `activeOpacity`
  already reports touches honestly; no `onPressOut` handler exists to
  contradict it.
- **New `src/screens/search/__tests__/searchRailTouchTargets.test.ts` (5
  tests)** — red 5/5 at parent (measure-from-red), asserting the platform
  floor as a literal against the exported StyleSheet object, the computed
  per-letter touch rect (44 x 44pt), the non-overlap row-pitch invariant,
  and the 1188pt > 320pt arithmetic that makes the ScrollView mandatory.
- Gates: jest `--runInBand` **95 suites / 1458 pass + 1 skip (1459)** vs
  self-baseline at `05a139a` of 94 / 1453 + 1 skip (1454) — delta exactly
  the new file; `tsc --noEmit` 0 errors; eslint 0 errors / 0 warnings on the
  three touched files.

### Fixed — hub server switch: caches, mounted screens, cross-server write trap (M-MOBILE-18) — 2026-10-29

- **`hubStore` gained `serverGeneration` and one switch law.**
  `setActiveServer` previously swapped `activeServerId`/`effectiveServerUrl`
  and persisted while every screen kept rendering the OLD server's cached
  rows and every queued write still carried OLD-server ids (review
  `mobile__gameux` M-G). All four identity sites — `setActiveServer`,
  `signInToHub`, `signOutOfHub`, `loadPersistedState` (lazy Settings-screen
  hydration can land a different id under warm caches) — now route through
  `switchServerIdentity()`: identity moves ⇒ `resetServerScopedState()` drops
  every old-server cache BEFORE the `set()` that commits (a synchronous
  generation subscriber can never observe a row of the server being left) and
  `serverGeneration` bumps; same-id re-select is a true no-op (no cascade, no
  stampede). `setConnectionMode` deliberately stays silent: same server, same
  ids — direct↔relay re-routes transport, not data.
- **New `src/store/serverScope.ts` — the single cascade owner** (imports
  stores, never `hubStore`; acyclic law): resets library (new `reset()` +
  hoisted `initialState`), favorites, watch-history (new `reset()` — local
  eviction, NOT the server DELETE `clearHistory`), search, collections,
  music, photos, live-TV, profiles (new in-memory `reset()`; the persisted
  `phlix_active_profile_id` pin survives — `.find() ?? null` rehydration
  makes a foreign id inert), discards an unconsumed `pendingPlayMedia`
  (new `discardPendingPlayMedia()`, distinct from consume for auditability)
  and cancels queued/paused download tasks (`cancelUnfinishedTasks()`:
  `cancelled`, not `failed` — retry would re-drain old ids; one persist;
  `downloading` tasks keep streaming — their signed URL is already
  old-server-bound, so the bytes are content-correct). Deliberate exclusions
  docblocked: player stream, syncplay ROOM state and cast (M-MOBILE-16
  lifecycle laws), direct-login settings/auth, admin/webauthn.
- **Mounted screens wake through the M-MOBILE-17 idiom (no second
  mechanism):** `createFocusRefetchGate` gains `onInvalidate(nowMs)` —
  invalidation outranks the staleness window and re-arms it (the next focus
  cannot double-fetch); pre-mount it stays silent (load-on-mount owns the
  first fetch). `useFocusRefetch` subscribes to the hub store's generation
  channel and refetches through the same extracted quiet fire-and-forget
  path — a synchronous loader throw can never poison the switcher's own
  `set()` notify loop.
- **The progress-report write trap is disarmed by generation stamp.**
  `PlaybackProgressReporter` mirrors its account-drift idiom: `ensureSession`
  stamps `sessionGeneration` beside `sessionOwner`; every entry point
  compares LIVE (`forgetSessionIfStale`); and `createSession`'s post-await
  commit guard re-reads the live generation — a session minted across a
  switch is discarded, never committed, never written to (mid-flight drift
  is invisible to a field-vs-captured compare: the live read is load-bearing,
  pinned by a red test before it was green).
- No new UI copy (a confirmation toast is not what the evidence demands; the
  post-switch truth is cache-drop + immediate refetch).
- **Tests:** +28 across 5 files (new `src/store/__tests__/serverScope.test.ts`
  ×8; hubStore switch law ×6 at the mocked `serverScope` seam; gate ×4; hook
  ×6 through the slot host's new mount-semantics `useEffect`; reporter ×4 with
  transport spies). Mutation teeth measured: cascade strip → exactly the 3
  named hubStore law tests red; sweep strip → 3 named serverScope tests red;
  forget-guard removal → 2 named reporter tests red; commit-guard removal →
  exactly the crossing-switch test red. Full suite serial: **94 suites,
  1453 passed + 1 skipped (1454)** vs parent `530bec7` measured
  **93 / 1425+1 (1426)** — +28 exact, zero moved baselines. `tsc --noEmit` 0,
  eslint 0 on all touched paths.

### Fixed — PhotoAlbum deep-link param law (M-MOBILE-17 r2) — 2026-10-29

- **Rework atop `8467014` per review `M-MOBILE-17__r1` (verdict REWORK).**
  MAJOR-1: the r1 mapping `PhotoAlbum: 'album/:albumId/photos'` carried only
  `albumId` while `RootStackParamList` requires BOTH `albumId` and
  `libraryId` — the bare canonical form deterministically rendered ErrorView
  (`getAlbum(albumId, undefined)` → server error), and a green test had
  pinned that broken resolution as spec (r1 `linking.test.ts:145-148`).
  Cured by LAW, not by guard: the mapping is removed and the test now pins
  the exclusion itself — `PhotoAlbum` is absent from the config AND
  `phlix://album/al-1/photos` resolves to `undefined` (measured: a full
  honest drop, not a stray `album/:albumName` match). Chosen over a
  screen-side libraryId guard because ZERO estate producers emit the link:
  windows' `deepLinkValidator.ts` owns only media/play/accept-invite/
  server/internal, and a grep of server/hub/ui/roku/tizen for
  album-photos link emission found none; the only real entry to the screen
  (`PhotosScreen.tsx` album tap) always passes both params in-app. Matches
  the file's own Cast/PhotoViewer param-law precedent. Mutation teeth:
  re-adding the mapping reddens the new law test exactly ×1.
- **MINOR-3 cured:** iOS `CFBundleURLName` was the label
  `app.phlix.mobile`, which no file in the project owns; set to the real
  bundle identifier `com.phlixmobile.PhlixMobile` (`project.pbxproj`) and
  pinned by a new cross-file equality test (plist label == pbxproj
  `PRODUCT_BUNDLE_IDENTIFIER`, no duplicated literal). Mutation: restoring
  the stale label reddens it exactly ×1. plist re-parsed with `plistlib`
  after the change.
- **MINOR-1 disclosed (not cured):** a link arriving while unauthenticated
  resolves against a tree rendering only `Login` and is dropped — no
  pending-URL replay after sign-in. Documented in `linking.ts` as an
  auth-gated `linking` callback follow-up.
- **MINOR-2 prose corrected:** the r1 entry above said "gate law ×7 /
  linking ×28"; measured per-file at r1 the counts were gate ×8, hook ×4,
  linking ×27 (sum 39 unchanged). Corrected in place.
- **Measured:** linking suite 27 → 29 tests; full serial
  `jest --runInBand` 93 suites / 1426 tests = 1425 passed + 1 skipped,
  0 failed (baseline 1424: +2 = the two new law tests). `tsc --noEmit`
  clean; eslint 0 errors (same 2 pre-existing warnings in files untouched
  here). Zero new deps, wire codes, or user-facing strings.

### Fixed — cross-device liveness and a `phlix://` front door — 2026-10-29

- **M-MOBILE-17 (review mobile__gameux M-F).** No screen had a focus
  listener and the app registered no OS URL scheme: every tab's data loaded
  once per mount (grep: `useFocusEffect`/`'focus'` = zero sites estate-wide
  for this client), and nothing external could deep-link in.
- **Liveness.** New `src/utils/focusRefetchGate.ts` (pure stampede guard:
  mount-focus never refetches; re-focuses inside the 15 s staleness window
  reuse loaded data; past it, exactly one refetch re-arms) +
  `src/utils/useFocusRefetch.ts` (react-navigation v7 `useFocusEffect`
  adapter; loader errors owned by the screen, sync throws and rejections
  swallowed by the adapter). Wired into all 14 consumer-facing server-data
  screens: Home, Library, WatchHistory, Favorites, Collections,
  CollectionDetail, Recommendations, MediaDetail, Music, MusicAlbum, Photos,
  PhotoAlbum, LiveTv, LiveTvRecordings. MediaDetail/MusicAlbum loaders now
  arm the full-screen spinner only on COLD loads (`item === null` /
  `album === null`), so focus refreshes repaint in place instead of
  blanking. Deliberately unmaintained-kept: Search (query-driven),
  Downloads (local store), Cast (owns its status polling), Admin screens
  (mount-load; the hook is available for a follow-up).
- **External entry.** New `src/navigation/linking.ts`: `phlix://` scheme →
  react-navigation `LinkingOptions` consumed by ONE new prop on the
  NavigationContainer (the library's own `useLinking` handles cold-start
  `getInitialURL` + warm `url` events — no new dependency). Paths are
  windows-client parity (`phlix://media/{id}`, `phlix://play/{id}` mean the
  same thing on every desktop) plus the five tabs and the param-self-
  sufficient routes; EXISTING routes only — unknown links resolve to nothing
  (no phantom routes). `Cast` is absent by law: its required `streamUrl` can
  never come from a URL. OS side: Android gains a VIEW+BROWSABLE
  intent-filter on `scheme="phlix"`; iOS gains `CFBundleURLTypes`
  (`app.phlix.mobile` / `phlix`). https app-links stay OUT — they need
  assetlinks / apple-app-site-association hosting this client does not
  control (disclosed gap, owner call).
- **Tests.** +3 suites / +39 tests (gate law ×8 incl fail-fast on bad
  intervals; hook law ×4 driven by the repo's slot-backed host with the
  focus callback captured as the event; linking ×27 driving the REAL
  `getStateFromPath` over the production config, incl windows-parity
  assertions and manifest-tripwire reads of both OS config files).
- **Measured full suite @this tree:** 93 suites, 1424 tests = 1423 passed +
  1 skipped, `jest --runInBand` serial, 0 failed. tsc --noEmit clean;
  eslint 0 errors (2 warnings pre-existing at parent in files untouched
  here). Zero new user-facing strings (code + XML config only) — this client
  carries no locale catalogs, so the estate locale-mirror law is not engaged;
  zero new wire codes; zero new dependencies.

### Fixed — the cast controller stays reachable after dismissal — 2026-10-29

- **M-MOBILE-16 (review mobile__gameux M-E).** Re-verified LIVE at HEAD
  (`6f3f3977`): `CastScreen`'s "Done (leaves X playing)" called
  `disconnect()`, clearing `activeDevice` from `useCastStore` — and the
  screen's transport view was that state's ONLY consumer. One dismissal
  therefore deleted every trace of a live cast: no pill, no entry point, no
  way to stop from the phone except re-finding the SAME title's detail page
  (3–4 taps cold). The native header back (the route has `headerShown: true`)
  never called the handler at all — two exits, two session semantics.
- **Why retention is honest here, not wishful:** the cast transport is
  server-mediated HTTP keyed by DEVICE ID (`CastManager.ts` — no native
  Google Cast SDK anywhere in the dep set). `status/pause/resume/seek/stop`
  are all re-attachable from the retained `CastDevice` alone, and the server
  `/status` routes report `active:false` ONLY when their per-(device,user)
  session map truly has no entry. Re-attachment is real wire capability, not
  a fabricated control channel; no new dependency was needed.
- **Cure — the store keeps the session; the screen only closes.** New root-
  mounted `CastSessionPill` (`src/components/cast/CastSessionPill.tsx`,
  rendered beside the `Stack.Navigator` in `RootNavigator`): "📡 Casting to
  {device}" while a session lives and the Cast screen is NOT mounted — tap
  re-opens the transport view with the STORED session params
  (`castPillNavigateParams` from `activeMedia`, never the launching route
  params, so re-entry from a different title can't mislabel the cast). Pure
  visibility/mapping law lives in `castPillHelpers.ts`. `CastScreen` "Done"
  becomes `goBack()` only; mount/cleanup publish `screenVisible` (one control
  surface at a time, and the two exits — Done and native back — now have
  IDENTICAL semantics by construction). New explicit "Switch device (leaves X
  playing)" inside the transport view preserves what old Done silently did,
  as a labelled choice. Stop remains reachable from re-entry for every
  backend that can serve it (`canStop` gates unchanged).
- **Lifecycle law (`useCastStore`).** `castTo` now retains `activeMedia`
  (the re-entry contract). The slot clears ONLY on: explicit switch
  (`disconnect()`), `stopAndDisconnect()`, or a SERVER-CONFIRMED end —
  `refreshStatus()` retiring the session on `active:false` so the pill
  cannot outlive the cast (a status ERROR never retires: fail-safe). The
  pill owns a 10s status poll while it stands in for the screen (immediate
  read on becoming visible); `CastScreen`'s 2.5s poll owns it while mounted.
  Documented residual: session retention is memory-only (no persistence
  exists in this store family) — an app RESTART still forgets a live cast;
  the device keeps playing and re-casting from the title page remains the
  recovery path.
- **Red→green:** `+3 suites / +24 tests` — measured full serial
  (`--runInBand`) baseline at HEAD was 87 suites / 1360 pass + 1 skip;
  this tip is **90 suites / 1384 pass + 1 skip** (1385 total). New
  `CastScreen.test.tsx` (6), `CastSessionPill.test.tsx` (6),
  `castPillHelpers.test.ts` (6), `useCastStore` lifecycle describe (+6) —
  screens/pill run the REAL store state machine through the house hook-host
  (HTTP manager stubbed only). Mutation probes: restoring
  `disconnect()`-on-Done reddens exactly the Done law (1); stripping the
  `active:false` retirement reddens the 3 retirement pins (store/pill/
  screen); ignoring `screenVisible` in the pill helper reddens its 2 pins.
- **Venue cure (pre-existing, worktree-proven at HEAD):** a real-timer
  describe in `SyncPlayService.test.ts` left the singleton's time-sync
  interval armed past the file's `afterAll`, which deletes the global
  `WebSocket` shim — the stray tick killed the jest worker at process
  teardown (`ReferenceError: WebSocket is not defined`) and aborted FULL
  serial runs. `afterAll` now disconnects the singleton before restoring
  globals (counts unchanged; exit 0 restored).
- **Gates:** `tsc --noEmit` 0; `eslint` 0 errors (2 pre-existing
  `no-unused-disable` warnings in untouched `SleepTimer.tsx`/
  `PlayerScreen.tsx`); full jest serial as above; `package.json` +
  `package-lock.json` byte-identical (zero new deps).

### Fixed — "Auto-play next episode" is wired (the toggle's first reader) — 2026-10-29

- **M-MOBILE-15 (review mobile__gameux).** Re-verified LIVE at HEAD
  (`37771ce`). The Settings toggle persisted (default true;
  `useSettingsStore` field + setter, `SettingsScreen` row) but NO component
  ever read it — `PlayerScreen`'s `'ended'` arm set `isPlaying: false` and
  that was the whole story: every episode ended in a dead stop regardless of
  the setting. Pure settings theater.
- **Cure — path (A), client-side over the EXISTING wire contract.** No new
  endpoints, no new wire codes (contracts law). The server's per-item next-up
  truth rides the rails the client already has: `GET /api/v1/media/{id}`
  detail + `GET /api/v1/media?parentId=` children browse both carry
  `parent_id`/`season_number`/`episode_number`/`episode_title`
  (`MediaItemShaper.php` `shape()` :303-313, `shapeDetail` :343-345).
  `GET /users/me/next-up` was evaluated and REJECTED as the cure vehicle:
  `WebPortalRouter.php` :358/:1864 serve a whole-user, per-series rail
  (recency-ordered, `WatchHistory::getNextUp` :331) — not a per-item
  end-of-episode decision. The rail stays discovery.
- **New `src/utils/autoplayNextEpisode.ts`:** positional continuation
  mirroring the server's ordering law (`NextUpSelector.php`: seasons
  participate only when numbered ≥1 — Specials excluded :123-131; episodes
  sort `episode_number` asc with unnumbered last and a
  `episode_title ?: name` tie-break :133-148; NO wraparound, the finale
  resolves to nothing :171-196). Deliberate documented divergence: the
  server rail is state-aware (skips watched/in-progress); autoplay is
  positional — finishing S1E3 advances into S1E4 even if watched, which is
  what the user's toggle means. Paging is mandatory: `Request.php`
  `PageLimit` DEFAULT=50/MAX=100 (:42,:51,:54) and `getSeasons`/
  `getEpisodes` page not at all — the resolver walks `limit=100` pages to the
  reported `total` with a 500-row ceiling, so a 30-episode anime season
  resolves its true successor instead of a wrong "finale".
- **New `PlayerScreen` ended-arm hook:** toggle read via
  `getState()` at event time (no subscription churn); suppressed for live /
  E8 direct-URL streams and for SyncPlay groups (the group owns media
  selection — per-episode rooms are a separate program); loop-protected by a
  one-shot `useRef` keyed on `itemId` registered BEFORE the async fetch (a
  failed next-load never retry-storms, a duplicate `'ended'` never
  double-navigates); `navigation.replace('Player', …, startPosition: 0)` so
  Back returns to where the viewer came from across a binge; EVERY refusal
  and failure path degrades to the exact stop-behavior that existed before
  (which is what toggle-OFF is).
- **Tests: +31** — 8 wiring cases in `PlayerScreen.test.tsx` (fires with
  toggle on, zero wire reads with off, non-episodic unchanged, failure =
  silent single attempt across double `'ended'`, single attempt on success,
  season→season crossing skipping Specials, SyncPlay-group suppression,
  live suppression; 4 of the 8 re-verified RED at the parent commit — the
  negative guards pass at parent by construction); 21 law cases in the new
  `src/utils/__tests__/autoplayNextEpisode.test.ts` (ordering table incl.
  string-typed numbers treated unnumbered, specials excluded, no-wraparound,
  degenerate self-successor, pagination offsets 0/100/200, 500-row cap,
  short-page stop); 2 persisted-key pins in `useSettingsStore.test.ts`
  (`autoPlayNextEpisode` round-trip, unknown-key tolerance). Suite measured
  at parent (re-baselined from the brief's stale 85/1292): 86 files → 87
  files, 1329 → 1360 passing + 1 pre-existing skip (exact +1 file/+31
  tests, serial `--runInBand`). `tsc --noEmit` 0, `eslint` 0 errors (2
  pre-existing `no-unused-disable` warnings byte-identical at parent, as is
  the pre-existing post-run `SyncPlayService` open-handle exit-1 — not
  lane-caused). The C17 seek/ended, M-MOBILE-13 and
  M-MOBILE-14 cures (`2666d4f`/`37771ce`) hold untouched.

### Fixed — the player top bar degrades gracefully on 320–390pt phones — 2026-10-29

- **M-MOBILE-14 (review mobile__gameux).** Re-verified LIVE at HEAD
  (`2666d4f`). The top bar's right cluster (✕ + quality + CC + audio + sync +
  sleep + PiP) renders up to six simultaneous targets on the online path
  (offline badge and the quality ladder are mutually exclusive by load
  path). The zero-glyph structural minimum of one cluster row is ≈316pt
  (4×44 circles + overlay `minWidth: 80` + sleep padding + 5×8 gaps) against
  a ≈224pt budget at 320pt (or ≈294pt at 390pt) — RN's default
  `flexShrink: 0` kept the row at full width and `justifyContent: 'flex-end'`
  packed the overflow off the LEFT edge, clipping the ✕ (the exit affordance)
  — worst during a SyncPlay group, when the overlay pill (minWidth 80) joins
  the row.
- **Cure — the wrap law, not a scroller:** `topBarRight` gains
  `flexWrap: 'wrap'` + `flexShrink: 1` (the shrinkable cluster box is the
  hinge — without it Yoga never constrains the row and wrap cannot fire);
  the ✕, every 44 circle, the quality pill, the offline badge and the
  SyncPlayOverlay pill gain explicit `flexShrink: 0` (targets never squish
  below their footprint); the bar top-aligns wrapped rows (`alignItems:
  'flex-start'` — identical render while single-line). The bar grows a second
  chrome row over the video instead of losing a button. A horizontal
  ScrollView in the overlay is deliberately NOT used: the M-MOBILE-13 seek bar
  captures the RN core responder system in this same chrome
  (`src/components/player/SeekBar.tsx` header @`2666d4f`) — no competing
  touch surface returns next to it.
- **Long text:** the bar has no item title; its only unbounded string is the
  SyncPlay room name, which already truncates (`numberOfLines: 1` under
  `maxWidth: 100`) and now announces the FULL name via
  `accessibilityLabel` (the accessible-name pattern for a truncated label).
  The quality pill and the previously unlabeled ungrouped 👥 button gained
  `numberOfLines: 1` / `accessibilityLabel="SyncPlay"` respectively.
- **Tests:** +6 (`PlayerScreen.test.tsx` — "M-MOBILE-14 narrow-screen top bar
  law"). No renderer exists in the repo's test deps (HookHost idiom), so the
  proof is a STATIC layout measurement: styles are read from the same
  StyleSheet objects the mounted tree references (jest resolves
  `StyleSheet.create` to plain objects) and summed against the 320/390pt
  budgets — overflow premise asserted first, then the wrap law, the non-shrink
  footprint of every rendered target, real affordances behind every press,
  and the overlay's truncate/announce/cap law via a direct FC call.
  Mutation-proven: parent styles 4 red; strip `flexWrap` 2 red; strip
  cluster `flexShrink` 2 red; strip ✕ `flexShrink: 0` 1 red; strip the
  overlay label 1 red. Full suite serial 1330 (1329 pass + 1 pre-skip),
  exact +6 vs the 1324 parent; `tsc --noEmit` 0; eslint 0 errors (2
  pre-existing warnings); CI-identical parallel run exit 0.

### Fixed — the player seek bar actually seeks: responder drag, single commit, syncplay-aware choke point — 2026-10-29

- **M-MOBILE-13 (review mobile__gameux).** Re-verified LIVE at HEAD (`23482a5`),
  not stale: `SeekBar.tsx` destructured `onSeek` as `_onSeek` and rendered the
  track/thumb as plain decorationless `View`s — zero responders — so dragging
  the bar did NOTHING (only the invisible double-tap/skip surfaces moved the
  clock). The screen side was already wired (`onSeek={handleSeek}` at the JSX);
  the defect lived entirely in the component.
- **Cure — dependency-free responder scrub:** the track surface captures the
  RN core responder (`onStartShouldSetResponder`/grant/move/release — the same
  no-package idiom the repo's modal surfaces already use;
  `@react-native-community/slider` sits in package.json wired to NOTHING and
  stays untouched, zero lock churn). The bar measures itself via `onLayout`
  and refuses capture until measured — an unmapped track can never commit a
  bogus position-0 seek. While a drag is in flight the bar renders the LOCAL
  drag position (`dragSeconds` state flag): the native `onProgress` ticker
  keeps its real-position feed to PlayerScreen (the resume reporter still
  eats every tick) but cannot repaint the thumb mid-drag. The seek COMMITS
  EXACTLY ONCE on release — per-move seeking (the native thrash bug class) is
  structurally absent; `onResponderTerminate` abandons without committing.
- **Units:** seconds end to end across the component (the native `seekTo` is
  a SECONDS API — the Android impl multiplies by 1000 at its own boundary);
  the wire-milliseconds law (`toSyncPlayPositionMs`) stays parked at the
  PlayerScreen SyncPlay send boundary where S293 put it.
- **SyncPlay disposition — `handleSeek` is THE seek choke point** (scrub-bar
  commit, ±15 buttons, SkipButton jumps all share it) and is now group-law
  aware: grouped HOST applies locally AND broadcasts `syncplay_playback_seek`
  with `(from_ms, to_ms)` — curing the second live defect this sweep found:
  `sendSeek` had ZERO production callers estate-side, so even a host's ±15/skip
  seeks silently desynced the group. Grouped NON-host member: seeking is a
  HOST-ONLY wire command (phlix-syncplay SPEC.md §9 item 2 — the server
  authorizes it by the connection's host identity), so the member's seek is
  REFUSED outright at the choke point (member-local seeks = the desync bug
  class), and the bar renders as a live, non-capturing display via the new
  `canSeek={currentGroup === null || isHost}` prop — the early exit is the
  belt for the button/skip surfaces sharing the choke point.
- **Tests:** +15 (`SeekBar.test.tsx` 12 — capture gating, drag preview with
  ZERO commits, ticker-cannot-repaint-mid-drag, single commit with the exact
  final SECONDS value, tap-commit, terminate-abandon, member non-capture,
  [0,duration] clamps, pure `scrubSecondsFromLocation` exactness; PlayerScreen
  M-MOBILE-13 describe 3 — host commit broadcasts `sendSeek(42_500, 480_000)`
  EXACTLY once with 1000×-sensitive wire ms, member seek refused with the
  clock held on the host timeline, ungrouped stays local with zero wire
  traffic). Mutation teeth M1–M8 all killed: decorative reversion (7 reds),
  seek-per-move (2), ticker-override (2), terminate-commits (1),
  member-local-seek (1), host-broadcast-stripped (1), seconds-on-wire (1),
  canSeek-unwired (1). Suite 85→86 files, 1309→1324 tests (1 skip held);
  tsc 0, eslint 0 err (2 pre-existing warnings).

### Fixed — hub session JWTs: plaintext-era audit closed at HEAD, vault LAW pinned by order- and failure-toothed tests — 2026-10-29

- **M-MOBILE-12 (review mobile__exploiter).** The queue entry — "HUB session
  tokens persist in PLAINTEXT AsyncStorage" — carried review-era evidence.
  Re-verified at HEAD (`74cce0f`): the cure had already landed one commit
  earlier (`d72dc0c`, the crossfe-M2 lane) — `persistSession` writes both hub
  JWTs to the dedicated keychain slots (`com.phlix.mobile.hub.access` /
  `.hub.refresh`) and keeps only `{hubUrl, expiresAt, userId, activeServerId,
  connectionMode}` in the `phlix_hub_session` blob; `loadPersistedState`
  migrates legacy plaintext blobs; `signOutOfHub` wipes blob AND vault.
  This lane re-swept EVERY AsyncStorage write site instead of re-doing the
  move: settings (no password/token fields exist in the state shape),
  download tasks (media metadata + local paths), the `user` envelope (profile
  data; `saveCredentials` routes both server JWTs to the vault), device id /
  active profile / the minted-host pin (identifiers, already judged
  configuration by the vault docblock). **No credential material remains in
  AsyncStorage plaintext.**
- **Bundle-shape judgment (disclosed, keeping the shipped split):** non-secret
  connection metadata stays in AsyncStorage rather than the vault — mirroring
  the ratified server-pair idiom (`AuthManager` keeps the profile envelope
  plaintext, tokens vaulted), and keeping boot honest: `loadPersistedState`
  awaits the async vault read inside a total try/catch, so nothing crashes
  before the vault resolves; the session simply hydrates when both halves
  agree, and an unsalvageable row (keychain wiped under a sanitized blob) is
  swept, never opened without a credential.
- **The real gap was unpinned LAW, and tests close it.** Four end-state-blind
  spots became order-aware pins (new `hub token vault ordering & failure law
  (M-MOBILE-12)` block in `src/__tests__/hub/hubStore.test.ts`): (1) sign-in
  writes the blob only after the vault already holds the pair — observed at
  the instant of each write, plus a hostile full-dump scan (no token material
  in ANY AsyncStorage payload); (2) the legacy migration's sanitizing rewrite
  is likewise vault-gated; (3) a keychain failure at sign-in fails LOUD —
  the rejection surfaces and zero plaintext is ever written; (4) a keychain
  failure mid-migration degrades honestly: the session stays usable from the
  retained plaintext row, no sanitize/sweep fires, and the retry after
  recovery completes the move (no silent token-loss loop).
  Mutation-proven: flipping `persistSession`'s order reddens (1)+(3);
  flipping the migration order reddens (2)+(4) and M-MOBILE-05's pin;
  deleting the legacy sanitizing sweep reddens (2)+(4) + the M-05 pin;
  removing the migration's catch-fallback (feeding a vault failure into the
  unsalvageable sweep) reddens (4) exactly.
- **Gates:** jest `--runInBand` 85 suites / 1309 tests (1308 pass + the
  pre-existing 1 skip) = parent 1305 + 4 exact; `tsc --noEmit` 0; eslint 0
  errors (2 pre-existing warnings in untouched `SleepTimer.tsx`/
  `PlayerScreen.tsx`). Venue note: the local jest process can exit with a
  stray `WebSocket is not defined` ReferenceError from a leaked
  `SyncPlayService` timer AFTER totals print — pre-existing at the parent
  baseline, totals unaffected.

### Fixed — the server JWT never rides to a hub-suggested host (direct-lane minted-host pin) — 2026-10-29

- **M-MOBILE-11 (review mobile__exploiter.md M2).** The direct SyncPlay lane
  presented the vault's SERVER JWT (`wsEndpoint.ts` direct branch, bearer
  subprotocol) to `effectiveServerUrl` — a hostname coming from the HUB's
  `/me/servers` payload (`hubStore.resolveEffectiveUrl` →
  `HubAuthService.listServers`, zero validation). A malicious or compromised
  hub listing `attacker.example` made the app dial `wss://attacker.example:8097`
  with the victim's real media-server token: the :8097 listener is
  possession-equals-auth, so one room join handed the attacker live access to
  the victim's private server. The hub is a DISCOVERY trust domain; the vault
  pair belongs to the server-AUTH domain — the code conflated them at the
  only place either was consumed. (M-MOBILE-05's vault migration changed the
  token READ path, not this dial law.)
- **Shipped (minted-host pin):** `SecureStorage.storeTokens` now REQUIRES the
  minting host (normalized through the new shared `utils/serverHost.hostOf`
  parser, fail-fast on empty) and stores it beside the pair; `clearTokens`
  wipes it with the pair — never an orphaned pin, never a token without its
  origin. Both server-token issuance sites pass it: `AuthManager.saveCredentials`
  (login/register/passkey/refresh — all POST through `getBaseUrl()`) and the
  `client.ts` refresh leg (the host that serves a rotation re-pins the pair,
  which also self-heals migrated pre-pin sessions). `resolveSyncPlayWsEndpoint`'s
  direct branch throws a typed `SyncPlayHostPinError` — codes
  `SYNCPLAY_HOST_MISMATCH` / `SYNCPLAY_HOST_UNPINNED`, copy owned by the
  `syncplayErrors` catalog (client-local codes; the contracts wire registry is
  frozen and gained nothing) — when the dial host ≠ the minted host or the
  vault holds no pin; `SyncPlayService.openSocket` surfaces it through the
  same `onError` → Alert rail as every other SyncPlay failure (fail-loud:
  never a silent error-state drop, never a downgrade to tokenless). The
  RELAY lane is untouched — it already presents only a hub-minted relay token
  to the hub itself, the conformant shape for hub-connected users.
- **Pins:** wsEndpoint suite — mismatch throws (never returns an endpoint),
  unpinned fails closed, same-host pass-through unchanged, case/port
  normalization pinned, relay proven pin-immune; service suite — refusal emits
  the catalog code+sentence with ZERO WebSocket builds; vault suite — pin
  write/normalize/wipe/migrated-stays-unpinned; AuthManager suite — login
  pins `login.example`.

### Fixed — hub session JWTs move into the keychain vault (SecureStorage law extended to the hub lane) — 2026-10-29

- **M-MOBILE-05 (review mobile__crossfe.md M2).** Audit M1's token-vault
  migration genuinely covered only the SERVER pair: `store/hubStore.ts`'s
  `persistSession` serialized the whole hub session — both hub JWTs
  (`HubAuthService.HubSession.accessToken`/`refreshToken`, minted by
  `signIn` and rotated by `refreshHubSession`) — into one plaintext
  AsyncStorage blob under `phlix_hub_session`, and the relay-token mint read
  them back from there. Same sandbox-exposure class the vault was built to
  close, with `SecureStorage.ts`'s "ONLY sanctioned home" docblock
  overstating coverage.
- **Shipped:** `SecureStorage` gains hub-scoped slots
  `com.phlix.mobile.hub.access` / `.hub.refresh` (mirroring the server
  ACCESS/REFRESH shape) with `storeHubTokens`/`getHubAccessToken`/
  `getHubRefreshToken`/`clearHubTokens`; `persistSession` routes the pair to
  the vault and the blob keeps only the non-secret envelope
  (`expiresAt`/`userId`) + `hubUrl`/`activeServerId`/`connectionMode`;
  `loadPersistedState` hydrates vault-first and MIGRATES pre-vault plaintext
  blobs on first read (secure-write BEFORE the sanitized re-persist — the
  never-orphan order of `migrateSlot`; a keychain failure leaves the blob
  intact for retry); `signOutOfHub` wipes the hub slots alongside the blob;
  a sanitized blob with an empty vault (OS keychain wipe) sweeps the
  unusable session instead of half-hydrating — the wsEndpoint
  "never open a socket without a credential" law. Lane isolation both
  ways: hub sign-out cannot clobber server tokens, server sign-out cannot
  clobber hub tokens.
- **Relay-URL core class verified STALE at HEAD:** the brief's
  `/api/v1/relay/syncplay` era-finding was already replaced — `src/syncplay/
  hubRelay.ts` ships the SPEC wire shape (`ws(s)://<hub-host>:8804/
  syncplay/<server_id>` at `buildHubRelayUrl` :151-167,
  `new WebSocket(url, ['bearer', token])` at :256, zero query-string
  tokens), matching `phlix-syncplay/SPEC.md` §8.4 (hub relay `:8804` —
  `Sec-WebSocket-Protocol: bearer, <token>` two-entry only, `?token=`
  refused per S237; JS idiom `new WebSocket(url, ['bearer', token])`)
  and the hub/server S298-era law; the crossfe review itself lists it
  as INFO-shipped. No
  relay-URL change was needed; this lane pins the persistence half.
- **Tests:** +11 (7 `hubStore` vault-law cases incl. blob-content negative
  pin, migration round trip, lane isolation, sign-out wipe, corpse sweep; 4
  `SecureStorage` hub-slot cases). Red-from-parent: 9 of 11 fail at parent
  HEAD (the 10th — vault-agnostic round trip — passes by design, its teeth
  live in the blob-content pins). Mutations killed inside the fix: blob
  re-serialization of the full session → `blob never carries JWT material`
  red; sign-out clear stripped → wipe test red; migration strip → migrate
  red AND the pre-existing legacy-blob restore test red (proven, restored).
  Full suite serial 85 files / 1292 pass / 1 skip (parent 1281+1, +11
  exact); `tsc --noEmit` 0; eslint 0 on all four files.

### Changed — contracts re-pin: `#v0.5.2` → `#v0.5.3` (registry-expansion release; SyncPlay union 19→20, S280 manifest re-vendored 410→412) — 2026-10-01

- **Pin advanced (lane: contracts-repin-v0.5.3 cascade).** `@phlix/contracts`
  moves to the `v0.5.3` tag (annotated object `eb90e6d`, peel
  `430981e3b231a04c9464382642f54c2eeea33c1c` — live-verified), closing the hub
  S181 flag that had this consumer pinned 1-behind. The committed lock moves
  surgically (3+/3−: root echo, the contracts node's `version` `0.5.2` →
  `0.5.3`, its `resolved` peel) — installed content proven against the tag:
  `dist/error-codes.json` 204 codes (md5 `40c1da48…`), registry additively
  expanded 202 → 204 (`leaf_hub_id_already_bound` +
  `syncplay.queue_limit_exceeded`). Note: `npm install` on this lock with local
  npm 11.21/12.0.2 rewrites 152 of the dependabot-era `devOptional` markers to
  `dev`; the edit was applied surgically instead, preserving the committed
  marker style with zero resolution change.
- **The union grew — measured from red.** `syncplayErrors.ts`'s
  `Record<SyncPlayErrorCode, string>` is compile-pinned to the CONTRACTS union
  (not to `@phlix/syncplay` — measured: syncplay `v0.1.5` declares
  `dependencies: {}`, so it carries no contracts edge and its own surface did
  not move). Minting the RESERVED `syncplay.queue_limit_exceeded` twin grew
  `SyncPlayTwinErrorCode` 7 → 8 and `SyncPlayErrorCode` 19 → 20, and the first
  `tsc` after the pin arrived exactly as designed: `TS2741 Property
  '"syncplay.queue_limit_exceeded"' is missing`. Fixed by measurement-from-red:
  one new catalog sentence (queue-cap overflow copy, distinct from the
  room-count `group_limit_reached` line the server stretches there today) and
  the header/census prose corrected to the honest era (7 twins LIVE since srv
  #798 + 1 RESERVED — the stale "4 on wire, 3 reserved for Wave-2" comment
  predates #798 and is retired). `syncplayErrors.test.ts` census rotates
  12/7/19 → 12/8/20 by measurement.
- **S280 route gate re-vendored from the v0.5.3 tag.**
  `src/api/test/server-route-manifest.json` is now byte-for-byte
  `git show v0.5.3:dist/server-route-manifest.json` (md5 `91579683…`, 412
  tuples, provenance serverSha `758f9149…`), superseding the 2026-09-16
  `730e55b7`/410-era vendoring that had outlived two contracts releases without
  movement (85bd68e7/32fc7b8 held it because those tags did not touch the
  manifest; this one did). Gate pins rotated to `758f9149…`/412/412; the
  per-module client-scan denominators are untouched (client code unchanged) and
  the S279 tripwires re-measured GREEN against the NEW manifest
  (`/api/v1/syncplay/rooms` still unserved; ws/relay still pinned out).
- **Doc prose carried:** `AGENTS.md`/`CLAUDE.md` wire-contract lines advanced to
  `#v0.5.3` (32fc7b8 precedent).
- **Gates.** `tsc --noEmit` 0 errors · `eslint` 0 errors / 2 pre-existing
  warnings · full `jest` — 83 suites, 1243 passed / 1 skipped (baseline
  1243+1-skip @ bdbe1e1 held exactly; the census changes moved within existing
  suites, no suite added or dropped).

### Changed — syncplay direct lane: `?token=` query carrier → bearer subprotocol (client flip, phlix-server 424c14d0) — 2026-09-29

- The server's `:8097` handshake now ships the TRANSITIONAL DUAL-CARRIER law
  (phlix-server `SyncPlayAuthMiddleware::resolveHandshakeToken()` +
  `docs/dev/WEBSOCKET_AUTH_CARRIERS.md`): priority 1 is the
  `Sec-WebSocket-Protocol: bearer, <jwt>` subprotocol (TARGET), priority 2 the
  legacy `?token=` query (RETIRING), with the 101 echoing the `bearer` marker
  so strict clients complete. This client flips to the TARGET, per the
  retirement table's `mobile wsEndpoint.ts direct lane` row:
  `buildDirectSyncPlayWsUrl` is now a credential-FREE location builder
  (`ws(s)://{host}:{port}/api/v1/syncplay/ws`, port/path law unchanged) and
  `resolveSyncPlayWsEndpoint` returns the direct lane as
  `{url, protocols: ['bearer', <serverJwt>]}`. `SyncPlayService.openSocket`
  needed no code change — it already constructs
  `new WebSocket(endpoint.url, endpoint.protocols)` whenever the descriptor
  carries protocols (the relay lane's shape since 3288b55; in-repo proof RN's
  global WebSocket honours the 2-arg form: `hubRelay.ts` dials `:8804` with
  `['bearer', token]` against the real hub). The relay refusal guard stays
  first, untouched.
- **Log-leak removal:** the JWT no longer exists in the connect URL, so it
  cannot surface in any URL-bearing surface — the app's RN network inspector /
  dev-tool request logs, upstream access/proxy logs, or future handshake
  diagnostics. Verified the app itself has no explicit `console.*` site
  dumping `endpoint.url` (`SyncPlayService` logs carry no URL material), and
  the test mock's `lastUrl` pin now asserts a credential-free string.
- `SyncPlayManager.getWebSocketUrl` (legacy accessor, no in-app caller) keeps
  its vault gate and returns the location only; its docblock states the dial
  law and points consumers at `resolveSyncPlayWsEndpoint`.
- Tests: direct URL-shape pins re-anchored credential-free + exact
  `['bearer', <jwt>]` offer asserted on first dial (wsEndpoint unit +
  service-level `MockWebSocket.lastProtocols`), a negative pin reddens any
  regression re-introducing `token=`/query in the builder output, the
  reconnect ladder additionally pins the carrier riding EVERY redial, and the
  vault-empty / no-server-root refusals keep dialling nothing. Relay-lane
  builder pins and the interim relay refusal unaffected.
  Gates: `tsc --noEmit` clean, eslint clean, jest 1243 pass + 1 pre-skip
  (baseline).

### Changed — syncplay relay lane: interim fail-loud refusal (reviewer follow-ups #1/#2) — 2026-09-29

- **#1 Relay dialect mismatch:** the hub's `:8804/syncplay/{server_id}` relay
  speaks its own bare room vocabulary (`group_join`, `playback_*`,
  `time_sync` in; `room_state` out — phlix-hub `SyncPlayRelayWorker::
  handleTextFrame`), not the server's `syncplay_*` typed frames this client
  sends. A relay socket connected, then every frame fell through the hub's
  default arm — group watch silently no-opped. `SyncPlayService.openSocket`
  now refuses relay mode up front (before the relay-token mint and before any
  `WebSocket` construction): `onError('RELAY_NOT_SUPPORTED', <clear
  sentence>)` + terminal `error` state, no ladder. The `wsEndpoint.ts`
  S237-law relay builder (URL + `['bearer', token]` carrier) stays wired and
  test-pinned for the day hub dialect bridging lands — delete the guard then.
- **#2 `hashGroupPassword` guard honesty:** the docblock promised a non-empty
  guard the function lacked (the call sites guarded). The guard now lives in
  the function as a fail-loud throw on `''` (signature unchanged; existing
  call-site omission guards make it unreachable today — it is the tripwire
  for future callers), and the call sites carry the omission-law comments.
- Tests: relay refusal pinned (zero `WebSocket` builds, zero token-provider
  creation, exact sentence via the exported `RELAY_UNSUPPORTED_MESSAGE`,
  terminal `error` state) on both `connect` and `connectWithRoom`;
  `hashGroupPassword('')` throw pinned. Gates: `tsc --noEmit` clean, eslint
  clean, jest suite green.

### Changed — contracts re-pin: `#v0.5.1` → `#v0.5.2` (version-alignment release; manifest-only, additive) — 2026-09-25

- **Hygiene pin bump (lane: contracts-repin-v0.5.2).** Advances the
  `@phlix/contracts` pin to the live `v0.5.2` tag (contracts PR #83). The
  annotated tag object peels to merge commit
  `7afb6a9171c33c18a2303716516572a4dfc405d9`, recorded as the lock `resolved`
  sha, keeping this repo's MASTER-pin row current against live contracts tags
  for the hub ui-pin-skew gate.
- **Version-field skew ENDS at this tag (new truth, supersedes the skew note
  in the `#v0.5.1` entry below).** `v0.5.2` is precisely the release that
  aligns the lagging `package.json` `version` field `0.4.7` → `0.5.2` —
  contracts' own CHANGELOG states this honestly ("version-field alignment
  ONLY … registry content untouched"). The lock entry's `"version"` therefore
  moves `0.4.7` → `0.5.2` and the field now agrees with the pinned tag for the
  first time since `v0.5.0` shipped ahead of it.
- **Manifest-only, zero code churn, proven from the tags.** `git diff
  v0.5.1..v0.5.2` in contracts is tooling/docblock/CI work only (#79 CI
  freshness gates + honest test claims, #80 `server.not_found` reuse-target
  docblock, #81 the third `src/errors.ts` coordinate re-sweep +
  `npm run verify:cites` tripwire, #82 `.gitattributes` LF shield):
  `dist/error-codes.json` is **byte-identical** across the tags — md5
  `b919685d3816940fc76f2f67c9b9eee2`, census holds at 202 codes / 37 domains —
  `dist/errors.d.ts` is declaration-surface identical once comments are
  stripped (verified programmatically, comments-only churn), the package
  `version` + a dev-only `verify:cites` script are the sole `package.json`
  changes, and no `prepare`/`postinstall` script exists to perturb installs.
  `dist/server-route-manifest.json` is untouched between the tags, so the S280
  route gate's provenance assertions (`730e55b7…`, total 410) hold unchanged
  against the newly-installed artifact. Mobile imports only wire types,
  `AUTO_QUALITY`, the `X_PHLIX_*` header constants + `buildPhlixHeaders`, and
  the tick/format helpers — none touched — so this remains zero code churn
  (the registry stays AVAILABLE to mobile, not consumed).
  Verification: `tsc --noEmit` 0 errors; eslint 0 errors (2 pre-existing
  warnings); jest 81 suites / 1 skipped / 1196 passed — the post-#100 baseline
  held exactly (re-derived on pristine master before the pin edits).

### Changed — contracts re-pin: `#v0.5.0` → `#v0.5.1` (W1b registry-expansion tag; additive) — 2026-09-23

- **Hygiene pin bump (lane: contracts-repin-v0.5.1).** Advances the
  `@phlix/contracts` pin to the live `v0.5.1` tag (contracts PR #78, the W1b
  error-registry expansion — 202 codes / 37 domains, +55 dotted codes over
  `v0.5.0`, every one re-verified file:line against server `838da686` and hub
  `c023a341`). The annotated tag object peels to merge commit
  `e3c14f07e8927224978a921e1f79406629ceb6c5`, recorded as the lock `resolved`
  sha, keeping this repo's MASTER-pin row current against live contracts tags
  for the hub ui-pin-skew gate. The tag is strictly additive over `#v0.5.0`:
  only the errors surface grows (`src/errors.ts`, `dist/errors.d.ts`,
  `dist/error-codes.json` — now carried IN the tag — and the rebuilt bundle);
  no code removed, renamed or re-parented, and no existing export moved.
  `dist/server-route-manifest.json` is byte-identical between the tags, so the
  S280 route gate's provenance assertions (`730e55b7…`, total 410) hold
  unchanged against the newly-installed artifact. Mobile imports only wire
  types, `AUTO_QUALITY`, the `X_PHLIX_*` header constants + `buildPhlixHeaders`,
  and the tick/format helpers — none touched — so this is zero code churn
  (the expanded registry remains AVAILABLE to mobile, not yet consumed).
  **Version-field skew, documented (windows lockwalk precedent):** the `v0.5.1`
  tag's own `package.json` `version` field still reads `0.4.7` (deliberate estate
  skew — the field lags the tag), so `package-lock.json`'s `@phlix/contracts`
  entry keeps `"version": "0.4.7"`. Pin identity is the package spec ref
  (`#v0.5.1`) plus the lock `resolved` commit sha (`e3c14f07…`); the field is
  derived data, not the pin, and no check in this repo asserts on it.
  Verification: `tsc --noEmit` 0 errors; eslint 0 errors; jest 80 suites /
  1 skipped / 1181 passed — baseline held exactly (same figures as the
  `#v0.5.0` entry below).

### Changed — contracts re-pin: `#v0.4.7` → `#v0.5.0` (error-code-registry tag; additive) — 2026-09-23

- **Hygiene pin bump (lane: contracts-repin-v0.5.0).** Advances the
  `@phlix/contracts` pin to the live `v0.5.0` tag (contracts PR #77, the estate
  error-code registry; tag peels to commit `8ef65d30be42623765c29ced34fc86d8ab3c51b5`,
  recorded as the lock `resolved` sha), clearing this repo's MASTER-pin row of
  the hub ui-pin-skew gate (hub PR #317 grades all four pinner repos' pins
  against live contracts tags). The tag is purely additive over `#v0.4.7`:
  new `src/errors.ts` / `dist/errors.d.ts` / `dist/error-codes.json` re-exported
  from the index; no existing export moved. Mobile imports only wire types,
  `AUTO_QUALITY`, the `X_PHLIX_*` header constants + `buildPhlixHeaders`, and the
  tick helpers — none touched — so this is zero code churn (the errors registry
  is AVAILABLE to mobile, not yet consumed by this lane). The `dist/phlix-contracts.js`
  bundle also carries the cs#47 route-manifest CONTENT regen (404→410 tuples,
  regen #34, folded between the tags): the v0.5.0 `dist/server-route-manifest.json`
  is byte-identical to the fixture cs#47 vendored, so the S280 gate's provenance
  assertions (`730e55b7…`, total 410) hold against both the vendored copy and the
  now-installed artifact.
  **Version-field skew, documented (windows lockwalk precedent):** the `v0.5.0`
  tag's own `package.json` `version` field still reads `0.4.7` (deliberate estate
  skew — the field lags the tag), so npm keeps writing `"version": "0.4.7"` in
  `package-lock.json`'s `@phlix/contracts` entry. Pin identity is the package
  spec ref (`#v0.5.0`) plus the lock `resolved` commit sha (`8ef65d30…`); the
  field is derived data, not the pin, and no check in this repo asserts on it.
  Verification: `tsc --noEmit` 0 errors; eslint 0 errors; jest 80 suites /
  1 skipped / 1181 passed — baseline held exactly (same figures as the
  `#v0.4.6` era anchor above).

### Changed — W111 (cs47b): route-manifest CONTENT re-vendor (404→410 tuples) — 2026-09-17

- **cs#47 currency re-vendor (lane cs47b) — CONTENT regen, not provenance-only.**
  `src/api/test/server-route-manifest.json` re-vendored byte-identical from the
  `@phlix/contracts` canonical master export (untagged regen #34), and
  `routeManifest.gate.test.ts` advances its it-title cite, full
  `provenance.serverSha`, the `total`/`routes.length` pins and the scan log's
  tuple wording in the same commit. This span IS a route change upstream — the
  quick-connect device-pairing endpoints and consent-gated client telemetry —
  so the union rises from 404 to 410 tuples (Application guard count 367→373;
  WebPortal 48 and shared 11 hold); route-content bytes move alongside the
  provenance lines. Mobile's own client-scan counts (`PER_MODULE_COVERAGE`) are
  HELD — no request site moved; mobile issues nothing against the new surface.
  No md5 currency pin exists in this repo by design. The contracts dependency
  stays pinned at the `#v0.4.7` tag (no tag was cut for the regen), so
  `package.json`/`package-lock.json` are unmoved; the change is the fixture +
  the gate test + this bullet.

### Changed — W93 (cs46a): route-manifest PROVENANCE re-vendor (404 tuples — route bytes unmoved) — 2026-09-15

- **cs#46 currency re-vendor (lane cs46a) — PROVENANCE-only, not a content regen.**
  `src/api/test/server-route-manifest.json` re-vendored byte-identical from the
  `@phlix/contracts` canonical master export (untagged regen #33), and
  `routeManifest.gate.test.ts` advances its it-title cite and full
  `provenance.serverSha` to the current phlix-server master tip in the same
  commit. The diff against the previous vendored bytes is provenance-only: no
  route-registration change upstream, so the `[method, path]` tuples are
  byte-for-byte identical and `total`/`routes.length`/unique all HOLD at 404 —
  only the embedded provenance moves, which rotates the vendored blob while the
  described route surface is unchanged. Mobile's own client-scan counts
  (`PER_MODULE_COVERAGE`) are HELD — no client request site moved this wave.
  The contracts dependency stays pinned at the `#v0.4.7` tag (no tag was cut
  for the regen; the vendored fixture carries the current canonical bytes), so
  `package.json`/`package-lock.json` are unmoved; the change is the fixture +
  the gate test.

### Changed — W85 (cs45): route-manifest PROVENANCE re-pin (404 tuples — route bytes unmoved) — 2026-09-13

- **cs#45 currency cascade (lane cs45) — PROVENANCE-only, not a content regen.**
  `src/api/test/server-route-manifest.json` re-vendored byte-identical from the
  `@phlix/contracts` canonical master export (untagged regen #32), and
  `routeManifest.gate.test.ts` advances its it-title cite and full
  `provenance.serverSha` to the current phlix-server master tip in the same
  commit. The server span since the previous pin is bundle-only: no
  route-registration file and nothing under the server's `include/` or `src/`
  moved, so the `[method, path]` tuples are byte-for-byte identical and
  `total`/`routes.length`/unique all HOLD at 404 (the dynamic human-readable
  scan line self-derives the new sha). Only the embedded provenance moves, which
  rotates the vendored blob while the described route surface is unchanged.
  Mobile's own client-scan counts (`PER_MODULE_COVERAGE`, the 404-era figures)
  are HELD — no client request site moved this wave. The post-S240
  `MusicManager` query-param migration is untouched. No survival-token home in
  this repo — the wave token lives in its two verified code homes.
  `package-lock.json` unmoved (pin already at the `#v0.4.7` tag); the change is
  the fixture + the gate test.

### Changed — W83 (cs44): route-manifest PROVENANCE re-pin (404 tuples — route bytes unmoved) — 2026-09-13

- **cs#44 currency cascade (lane cs44) — PROVENANCE-only, not a content regen.**
  `src/api/test/server-route-manifest.json` re-vendored byte-identical from the
  `@phlix/contracts` canonical master export, and `routeManifest.gate.test.ts`
  advances its it-title cite and full `provenance.serverSha` to the current
  phlix-server master tip in the same commit. The server span since the previous
  pin is bundle-only: no route-registration file and nothing under the server's
  `include/` or `src/` moved, so the `[method, path]` tuples are byte-for-byte
  identical and `total`/`routes.length`/unique all HOLD at 404 (the dynamic
  human-readable scan line self-derives the new sha). Only the embedded provenance
  moves, which rotates the vendored blob while the described route surface is
  unchanged. Mobile's own client-scan counts (`PER_MODULE_COVERAGE`, the 404-era
  figures) are HELD — no client request site moved this wave. The post-S240
  `MusicManager` query-param migration is untouched. No survival-token home in this
  repo — the wave token lives in its two verified code homes. `package-lock.json`
  churn (if any) is reclassification-only; the change is the fixture + the gate
  test.

### Changed — cs43 currency CONTENT regen (regen #30; 402→404 tuples) + S240 query-param client migration — 2026-09-12

- **cs#43 currency cascade (lane cs43) — this is a CONTENT regen, not a
  provenance re-pin.** phlix-server S240 merged two ADDITIVE query-param rails
  (`GET /api/v1/music/artist?name=` and `GET /api/v1/music/album?name=[&artist=]`)
  alongside the existing legacy `/music/artists/{mbid}` + `/music/albums/{mbid}`
  path routes, so the vendored route manifest grows **402 → 404 tuples**.
  `src/api/test/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen #30 against the current
   phlix-server tip of the era); the blob is content-identical across the whole
   estate.
- **S240 client migration.** `MusicManager.getArtist` and `getAlbum` now call
  the query-param rails: `/music/artist?name=${encodeURIComponent(name)}` and
  `/music/album?name=${encodeURIComponent(name)}` (was
  `/music/artists/${…}` / `/music/albums/${…}`). Mobile's `apiClient.get(url)`
  takes the whole path as a single literal (base already carries `/api/v1`), so
  the value rides in the query string, still `encodeURIComponent`-encoded —
  matching the repo's single-string convention for these detail methods.
- **Gate moves in the same commit.** `routeManifest.gate.test.ts`: it-title cite
   and the full `provenance.serverSha` advance to the era tip, `total`/`routes.length`
  and the human-readable scan line advance `402 → 404`. Mobile's own client-scan
  counts are UNCHANGED — the migration only swaps two path templates for two
  query templates (the `normalizePath` gate strips the query before matching), so
  `PER_MODULE_COVERAGE['src/api/MusicManager.ts']` stays honestly at **7**; the
  scan re-measured **171 request sites / 167 distinct tuples across 19 modules,
  all tuple-exact** against the vendored 404-route manifest. Mobile carries no
  md5 pin (the fixture md5 is its content identity, not an assertion).
- **Non-vacuity.** `MusicManager.test.ts` pins the exact new query URLs
  (`/music/artist?name=AC%2FDC`, `/music/album?name=The%20Dark%20Side%20of%20the%20Moon`);
  reverting the client to the legacy form turns those two assertions RED
  (verified). Jest baseline holds at this tip: **80 suites / 1 skipped /
  1181 passed**; lint 0 errors. Untagged wave — no dependency pin bump.

### Changed — cs42 currency re-pin (PURE provenance regen #29; 402 tuples unchanged; untagged) — 2026-09-12

- **cs#42 currency re-pin cascade (lane cs42).** Vendored
  `src/api/test/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen #29 against the current
  phlix-server master tip; purity re-proven before regenerating — the server
  span since the previous pin is four commits of SyncPlay bridge/worker/room
  and WebSocket plumbing work, a catalog-pin bump and an AGENTS.md theming
  paragraph, with an empty diff on the two route-bearing guard-constant
  files, so the stripped route-content digest measures equal old-vs-new and
  only the provenance sha + generatedAt bytes move). 402 `[method, path]`
  tuples unchanged. Gate pins advance in the same commit — it-title cite and
  the full provenance sha — while mobile's own client-scan counts (request
  sites and distinct tuples derived from this repo's code) stay exactly as
  pinned. Mobile carries no md5 pin. Untagged wave: the dependency tag pin
  stays put. Jest baseline holds at this tip: 80 suites / 1 skipped /
  1181 passed.

### Changed — S11-tail dash_url reconciliation: local transcode types mirror the wire truth again (contracts pin #v0.4.5 → #v0.4.6) — 2026-09-12

- **Premise inversion (lane s11tail).** phlix-server S59 restored `dash_url`
  on every transcode payload and `@phlix/contracts` re-declared it REQUIRED
  (`string | null`, key ALWAYS present — signed `/dash/{job}/manifest.mpd` when
  the job published a manifest, null for an mpegts job or pre-S60 jobs) at
  v0.4.4 (S325 fold-in). The local v0.4.0-era mirror in `src/types/playback.ts`
  still asserted the opposite ("deliberately NO dash_url — do not re-add"),
  falsifying the wire. `TranscodeJob`/`TranscodeStatus` now carry
  `dash_url: string | null`; the absence pin in
  `src/types/__tests__/playback.test.ts` is flipped to a presence pin
  (key-present + null-admittance + anti-optional Exact gates + Rendition
  counterweight), typed fixtures model both wire arms, and the stale "no
  dash_url" prose is corrected in AGENTS.md, CLAUDE.md,
  `.claude/rules/api-managers.md`, `.claude/rules/testing.md`,
  `TranscodeManager.ts` and `TranscodeManager.test.ts`. Contracts pin advances
  `#v0.4.5` → `#v0.4.6` (lock resolved-sha
  `97bcda069efa2bba3591f1143a000aec8fefae15`). Verification:
  `tsc --noEmit` green; red-green proven both ways (optionalising the key
  turns the pin RED, removing it turns pin AND fixtures RED); jest baseline
  holds: 80 suites / 1 skipped / 1181 passed.

### Changed — cs41 currency re-pin (PURE provenance regen #28; 402 tuples unchanged; untagged) — 2026-09-12

- **cs#41 currency re-pin cascade (lane cs41).** Vendored
  `src/api/test/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen #28 against the current
  phlix-server master tip; purity re-proven before regenerating — the server
  span since the previous pin is one merge confined to the
  parallel-suite junit-merge tooling, two new guard tests and
  changelog/release-journal prose, with an empty diff under the
  route-surface directories, so the stripped route-content digest
  measures equal old-vs-new and only the provenance sha + generatedAt bytes
  move). 402 `[method, path]` tuples unchanged. Gate pins advance in the same
  commit — it-title cite and the full provenance sha — while mobile's own
  client-scan counts (request sites and distinct tuples derived from this
  repo's code) stay exactly as pinned. Mobile carries no md5 pin. Untagged
  wave: the dependency tag pin stays put. Jest baseline holds: 80 suites /
  1 skipped / 1181 passed.

### Changed — cs40 currency re-pin (PURE provenance regen #27; 402 tuples unchanged; untagged) — 2026-09-12

- **cs#40 currency re-pin cascade (lane cs40).** Vendored
  `src/api/test/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen #27 against the current
  phlix-server master tip; purity re-proven before regenerating — the server
  span since the previous pin is three merges confined to parallel-harness
  suite-runner plumbing, an ignore-rule tidy and changelog/release-journal
  prose, with an empty diff under the
  route-surface directories, so the stripped route-content digest
  measures equal old-vs-new and only the provenance sha + generatedAt bytes
  move). 402 `[method, path]` tuples unchanged. Gate pins advance in the same
  commit — it-title cite and the full provenance sha — while mobile's own
  client-scan counts (request sites and distinct tuples derived from this
  repo's code) stay exactly as pinned. Mobile carries no md5 pin. Untagged
  wave: the dependency tag pin stays put. Jest baseline holds: 80 suites /
  1 skipped / 1181 passed.

### Changed — cs39 currency re-pin (PURE provenance regen #26; 402 tuples unchanged; untagged) — 2026-09-11

- **cs#39 currency re-pin cascade (lane cs39).** Vendored
  `src/api/test/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen #26 against the current
  phlix-server master tip; purity re-proven before regenerating — the server
  span since the previous pin is one packaging-and-installation merge
  confined to the install script, release-process and changelog journals,
  and one third-party clone pin-guard test, with an empty diff under the
  route-surface directories, so the stripped route-content digest
  measures equal old-vs-new and only the provenance sha + generatedAt bytes
  move). 402 `[method, path]` tuples unchanged. Gate pins advance in the same
  commit — it-title cite and the full provenance sha — while mobile's own
  client-scan counts (request sites and distinct tuples derived from this
  repo's code) stay exactly as pinned. Mobile carries no md5 pin. Untagged
  wave: the dependency tag pin stays put. Jest baseline holds: 80 suites /
  1 skipped / 1181 passed.

### Changed — cs38 currency re-pin (PURE provenance regen #25; 402 tuples unchanged; untagged) — 2026-09-11

- **cs#38 currency re-pin cascade (lane cs38).** Vendored
  `src/api/test/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen #25 against the current
  phlix-server master tip; purity re-proven before regenerating — the server
  span since the previous pin is two commits confined to CI workflow
  definitions, docker example files, helm chart value files, support test
  files and changelog prose, with an empty diff under the route-surface
  directories, so the stripped route-content digest
  measures equal old-vs-new and only the provenance sha + generatedAt bytes
  move). 402 `[method, path]` tuples unchanged. Gate pins advance in the same
  commit — it-title cite and the full provenance sha — while mobile's own
  client-scan counts (request sites and distinct tuples derived from this
  repo's code) stay exactly as pinned. Mobile carries no md5 pin. Untagged
  wave: the dependency tag pin stays put.

### Changed — cs37 currency re-pin (PURE provenance regen #24; 402 tuples unchanged; untagged) — 2026-09-11

- **cs#37 currency re-pin cascade (lane cs37).** Vendored
  `src/api/test/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen #24 against the current
  phlix-server master tip; purity re-proven before regenerating — the server
  route-relevant span is test-and-CI-only, so the stripped route-content digest
  measures equal old-vs-new and only the provenance sha + generatedAt bytes
  move). 402 `[method, path]` tuples unchanged. Gate pins advance in the same
  commit — it-title cite and the full provenance sha — while mobile's own
  client-scan counts (request sites and distinct tuples derived from this
  repo's code) stay exactly as pinned. Mobile carries no md5 pin. Untagged
  wave: the dependency tag pin stays put.

### Changed — cs36 currency re-pin (PURE provenance regen #23; 402 tuples unchanged; untagged) — 2026-09-11

- **cs#36 currency re-pin cascade (lane cs36).** Vendored
  `src/api/test/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen #23 against the current
  phlix-server master tip; purity re-proven before regenerating — the server
  route-relevant span is test-only, so the stripped route-content digest
  measures equal old-vs-new and only the provenance sha + generatedAt bytes
  move). 402 `[method, path]` tuples unchanged. Gate pins advance in the same
  commit — it-title cite and the full provenance sha — while mobile's own
  client-scan counts (request sites and distinct tuples derived from this
  repo's code) stay exactly as pinned. Mobile carries no md5 pin. Untagged
  wave: the dependency tag pin stays put.

### Changed — cs35 currency regen (manifest full regen 401 → 402 tuples; untagged) — 2026-09-11

- **cs#35 currency re-pin cascade (lane cs35).** Vendored
  `src/api/test/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen against the current phlix-server
  master tip). Genuine full regen, not provenance-only: the server gained one
  WebPortal route, so the manifest moves 401 → 402 `[method, path]` tuples
  (Application source count holds, WebPortal source count rises by one, shared
  overlap unchanged). Gate pins advance in the same commit — it-title cite, full
  provenance sha, and the provenance.total / routes-length tuple-count
  assertions — while mobile's own client-scan counts (request sites and distinct
  tuples derived from this repo's code) stay exactly as pinned because no Mobile
  request site calls the new server route: the manifest simply becomes a
  superset. Mobile carries no md5 pin. Untagged wave: the dependency tag pin
  stays put.

### Prior era snapshot — cs34 currency re-pin (PURE provenance → server 8ba7789c)

### Changed — cs34 currency re-pin (manifest provenance → current server tip; untagged regen #21) — 2026-09-10

- PURE provenance re-pin, zero route bytes: vendored
  `src/api/test/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen #21 against the current
  phlix-server master tip; purity re-proven before regenerating — the server
  route-relevant span is empty and both generator-input guard blobs hash
  identically). 401 `[method, path]` tuples unchanged, the provenance-stripped
  route-content md5 and the sorted-tuple fence digest measure equal
  old-vs-new; only serverSha + generatedAt move. Gate pins (it-title cite +
  full provenance sha) advance in the same commit; mobile carries no md5 pin.
  Untagged wave: the dependency tag pin stays put.

### Changed — cs33 currency re-pin (manifest provenance → current server tip; untagged regen #20) — 2026-09-10

- PURE provenance re-pin, zero route bytes: vendored
  `src/api/test/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen #20 against the current
  phlix-server master tip; purity re-proven before regenerating — the server
  route-relevant span is empty and both generator-input guard blobs hash
  identically). 401 `[method, path]` tuples unchanged, the provenance-stripped
  route-content md5 and the sorted-tuple fence digest measure equal
  old-vs-new; only serverSha + generatedAt move. Gate pins (it-title cite +
  full provenance sha) advance in the same commit; mobile carries no md5 pin.
  Untagged wave: the dependency tag pin stays put.

### Changed — cs32 currency re-pin (manifest provenance → current server tip; untagged regen #19) — 2026-09-10

- PURE provenance re-pin, zero route bytes: vendored
  `src/api/test/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen #19 against the current
  phlix-server master tip; purity re-proven before regenerating — the server
  route-relevant span is empty and both generator-input guard blobs hash
  identically). 401 `[method, path]` tuples unchanged, the provenance-stripped
  route-content md5 measures equal old-vs-new; only serverSha + generatedAt
  move. Gate pins (it-title cite + full provenance sha) advance in the same
  commit; mobile carries no md5 pin. Untagged wave: the dependency tag pin
  stays put.

### Changed — cs31 currency re-pin (manifest provenance → current server tip; untagged regen #18) — 2026-09-10

- PURE provenance re-pin, zero route bytes: vendored
  `src/api/test/server-route-manifest.json` re-vendored byte-identical from
  `@phlix/contracts` master (untagged regen #18 against the current
  phlix-server master tip; purity re-proven before regenerating — the server
  route-relevant span is empty and both generator-input guard blobs hash
  identically). 401 `[method, path]` tuples unchanged, the provenance-stripped
  route-content md5 measures equal old-vs-new; only serverSha + generatedAt
  move. Gate pins (it-title cite + full provenance sha) advance in the same
  commit; mobile carries no md5 pin. Untagged wave: the dependency tag pin
  stays put.

### Changed — cs30 era-2 currency re-pin (manifest provenance → server 5986b61d) — 2026-09-09

- Server moved mid-wave (`32183f5b` → `5986b61d`, S210 #749 — docker boot-gate bounds only,
  route-zero re-proven: Router/Application/guard blobs and Routes/+FastPath/ trees byte-identical).
  Vendored `server-route-manifest.json` re-vendored byte-identical from `@phlix/contracts` master
  `57a8528a` (era-2 regen; full-file md5 `cb53d53f` → `045c0984`, blob identity `dd0cbaca` verified
  against the contracts dist artifact; stripped route-content md5 `508a…` holds — 401 tuples).
  Gate pins advance in the same commit; counts unchanged.

### Changed — cs30 currency re-pin (manifest provenance → server 32183f5b) — 2026-09-09

- cs#30 — route-manifest PURE provenance re-pin to contracts `767146a8` (server `e15d9543` → `32183f5b`; span re-proven route-zero at the contracts leg — S266 #747 + S171 #748, guard tests/`Router.php`/`Routes/`+`FastPath/` blobs/trees identical, `WebPortalRouter.php` comment-only); 401 tuples unchanged, stripped route-content md5 `508a6415` old = new — only provenance moves; gate test-title cite + full serverSha pin `e15d9543` → `32183f5b` follow, vendored copy `git hash-object` = contracts dist blob `9068173e` (blob identity); client coverage pins (171 sites / 19 modules) unchanged, no-md5 posture retained (bytes verified against full-file md5 `cb53d53f`, none pinned).

### Changed — cs29 currency re-pin (manifest provenance → server e15d9543) — 2026-09-09

- cs#29 — route-manifest PURE provenance re-pin to contracts `8697c099` (server `a5cde27e` → `e15d9543`; span re-proven route-zero at the contracts leg — S211 #745 + S114 #746, route-authority blobs/trees identical); 401 tuples unchanged, stripped route-content md5 `508a6415` old = new — only provenance moves; gate test-title cite + full serverSha pin `a5cde27e` → `e15d9543` follow, vendored copy `git hash-object` = contracts dist blob `73b945aa` (blob identity); client coverage pins (171 sites / 19 modules) unchanged, no-md5 posture retained (bytes verified against full-file md5 `27834ef4`, none pinned).

### Changed — cs28 currency re-pin (manifest provenance → server a5cde27e) — 2026-09-09

- cs28 — route-manifest PURE provenance re-pin to contracts `a1ca39d8` (server `afe54c7c` → `a5cde27e`, route-zero); 401 tuples unchanged, stripped route-content md5 `508a6415` old = new — only provenance moves; gate test-title cite + full serverSha pin `afe54c7c` → `a5cde27e` follow, vendored copy `git hash-object` = contracts dist blob `a6048724` (blob identity); client coverage pins (171 sites / 19 modules) unchanged, no-md5 posture retained (bytes verified against full-file md5 `0331a2d8`, none pinned).

### Changed — cs27 currency re-pin (manifest provenance → server afe54c7c) — 2026-09-09

- cs27 — route-manifest PURE provenance re-pin to contracts `28000fa4` (server `afe54c7c`); seven route-zero server merges since `1e14b539` — all 401 tuples byte-identical (stripped route-set md5 `508a6415` old = new), only provenance moves; gate test-title cite + full serverSha pin `1e14b539` → `afe54c7c` follow, vendored copy `git hash-object` = contracts dist blob `81c56ea9` (blob identity); client coverage pins (171 sites / 19 modules) unchanged, no-md5 posture retained (bytes verified against full-file md5 `5c06306c`, none pinned).

### Changed — cs26 currency re-pin (manifest provenance → server 1e14b539) — 2026-09-08

- cs26 — route-manifest currency re-pin to contracts `97c87f27` (server `1e14b539`); NON-pure: 400→401 tuples, exactly one added (`POST /api/v1/admin/updates/check`, from S273), nothing removed — gate serverSha/total/length pins follow, client coverage pins (171 sites / 19 modules) unchanged, no-md5 posture retained.

### Changed — cs25 currency re-pin (manifest provenance → server 2746677e) — 2026-09-08

- cs25 — route-manifest currency re-pin to contracts `e837e31c` (server `2746677e`); 400-tuple SET byte-identical (stripped-md5 `0a4a642c`), gate serverSha pin follows, no-md5 posture retained.

### Changed — cs24 currency re-pin (manifest provenance → server df6aa8e5) — 2026-09-07

- cs24 — route-manifest currency re-pin to contracts `59fd9` (server `df6aa`).

### Changed — cs23 currency re-pin (manifest provenance → server bab33ff2) — 2026-09-06

- cs23 — route-manifest currency re-pin to contracts `bcd27` (server `bab33`).

### Changed — cs22 currency re-pin (manifest provenance → server e4853f0f) — 2026-09-06

- cs22 — route-manifest currency re-pin to contracts `876d0` (server `e485`).

### Changed — cs21 currency re-pin (manifest provenance → server e729d48a) — 2026-09-06

- cs21 — route-manifest currency re-pin to contracts `341fc` (server `e729d`).

### Fixed — S441 relay inbound ms→s conversion at the protocol boundary (finish-S293)

- **Inbound SyncPlay positions no longer land 1000× down the timeline.** S293 moved both SEND
  boundaries to wire milliseconds, but the receive legs kept consuming the raw ms as seconds:
  a host's 42 500 ms seek threw the native player to 42 500 s. The decode now happens ONCE at
  the protocol boundary — new `src/syncplay/wireUnits.ts` `wireMsToSeconds()` applied in
  `SyncPlayService`'s group-state/play/pause/seek handlers, in the optimistic store writes of
  `sendPlay/sendPause/sendSeek` (the store's field is SECONDS), and in
  `SyncPlayManager.mapPlaybackState()` (REST join). `PlayerScreen`'s seek arm and the internal
  clock stay seconds-native with no unit math of their own. Inbound fixtures rewritten
  1000×-sensitive both ways (identity and double-decode each turn five named tests red);
  send-side S293 pins untouched.

### Changed — W34 (cs20retag) currency re-pin (manifest provenance → server f35a5742) — 2026-09-05

- **cs#20 currency leg of the combined re-tag wave.** `src/api/test/server-route-manifest.json`
  re-vendored verbatim from `@phlix/contracts` master `f2e284b3` (regen against server master
  `f35a5742` — the web-ui `@phlix/ui` v0.99.1 re-pin commit: zero PHP, zero route hunks; previous
  provenance `2250def2`/`3a253991`). The 400-tuple SET is byte-identical — only provenance moved.
  The gate's serverSha pin follows to `f35a5742` in `src/api/test/routeManifest.gate.test.ts`
  (it-title + full-sha assertion); this gate keeps its no-md5 posture. All count pins (400/400,
  generator string) and coverage pins untouched. No version or install-pin moves in this repo.

### Changed — W33 (cs19) currency re-pin (manifest provenance → server 3a253991) — 2026-09-05

- **cs#19 currency cascade.** `src/api/test/server-route-manifest.json`
  re-vendored verbatim from `@phlix/contracts` master `2250def2` (regen
  against server master `3a253991`; previous provenance `e74cdc88` — S431
  executable census, one commit, no route hunks). The 400-tuple SET is
  byte-identical — only provenance moved. The gate's serverSha pin follows to
  `3a253991` in `src/api/test/routeManifest.gate.test.ts` (it-title + full-sha
  assertion); this gate keeps its no-md5 posture. All count pins (400/400,
  generator string) and coverage pins untouched. Untagged wave: no install-pin
  or version moves.

### Changed — W31 (cs18) currency re-pin (manifest provenance → server e74cdc88) — 2026-09-05

- **cs#18 currency cascade.** `src/api/test/server-route-manifest.json`
  re-vendored verbatim from `@phlix/contracts` master `51ed6cd3` (regen
  against server master `e74cdc88`; previous provenance `4b620f59`). The
  400-tuple SET is byte-identical — only provenance moved. The gate's
  serverSha pin follows to `e74cdc88` in `src/api/test/routeManifest.gate.test.ts`
  (this gate pins provenance sha, not md5). No coverage-pin move was needed.

### Changed — W29 (cs17) currency re-pin (manifest provenance → server 4b620f59) — 2026-09-04

- **cs#17 currency cascade.** `src/api/test/server-route-manifest.json`
  re-vendored verbatim from `@phlix/contracts` master `55311c68` (regen
  against server master `4b620f59`; previous provenance `888a42b2`). The
  400-tuple SET is byte-identical — only provenance moved. The gate's
  serverSha pin follows to `4b620f59` in `src/api/test/routeManifest.gate.test.ts`
  (this gate pins provenance sha, not md5). No coverage-pin move was needed
  (171 sites / 167 tuples / 19 modules unchanged).

### Changed — W22 currency re-pin (manifest provenance → server 01340633)

- **`src/api/test/server-route-manifest.json`** re-vendored from the merged
  `@phlix/contracts` master export (regen `068d5e86`, shipped untagged): the
  400-tuple SET is byte-identical — only provenance moved (server master is
  one CI-only commit above `8f72faec`). New vendored md5
  `6ea0eac92bfb0632d986b122608b9acc`; the gate's serverSha pin follows to
  `01340633`. No package.json pin move (gate reads the vendored copy); all
  coverage pins (171 sites / 167 tuples / 19 modules incl.
  `RecommendationsScreen.tsx: 1`) stayed green UNTOUCHED. jest 1151 baseline
  preserved.

### Added — S280 client route gate (mobile half)

- **`src/api/test/server-route-manifest.json`** — vendored byte-for-byte from
  `@phlix/contracts` `dist/server-route-manifest.json` (400 `[method, pathTemplate]`
  tuples derived from phlix-server `8f72faec`). No tag is consumed this wave;
  the copy is pinned by provenance sha inside.
- **`src/api/test/routeManifest.gate.test.ts`** — scans every request-issuing
  source and asserts each issued URL is tuple-exact against the vendored
  manifest (exact-segment compare, never substring — no sibling-wildcard
  absorption). Coverage is pinned per module: **171 request sites / 167
  distinct tuples / 19 modules**, hub-addressed + passthrough files excluded
  with enumerated reasons and negative pins. A planted unserved URL was
  demonstrated RED (and reverted to green). Tizen/console gates are the named
  W19 follow-up.

### Fixed — SyncPlay called four routes phlix-server never registered (S280)

- **`src/api/SyncPlayManager.ts`** called `GET|POST /api/v1/syncplay/rooms`,
  `POST /api/v1/syncplay/rooms/{id}/join` and `DELETE /api/v1/syncplay/rooms/{id}/leave`
  — none of which exists. The server's five SyncPlay rails are all under
  `/syncplay/groups` (and `leave` is **POST**, not DELETE). The same
  S264/S276/S279 defect class, now caught (and fixed) in mobile: the responses
  are the server's snake_case `{ groups }` / `{ success, group }` envelopes,
  mapped to the modal's existing view models by a deliberately minimal local
  mapper. No new behaviour shipped — the browse/create/join/leave flow simply
  stops 404ing at the wire. The WebSocket transport URL is unaffected (it is
  not an HTTP-router route; pinned out of the gate by design).

### Fixed — parental-controls creates 400'd on the wire shape (S234)

- **`@phlix/contracts` bumped to `v0.4.4`** (from `v0.4.3`) in `package.json` /
  `package-lock.json` (resolved SHA `981cac4c`, the v0.4.4 tag commit). The
  release declares the snake_case wire shapes (`tag_type`, `start_time`,
  `end_time`, `days_of_week`, `is_active`) and `profileId: string` (CHAR(36)).
- **`ParentalControlsManager`**: `addTag` now posts `{tag, tag_type}` and
  `createSchedule`/`updateSchedule` post `{name, start_time, end_time,
  days_of_week, is_active}` — the previous camelCase bodies (`tagType`,
  `startTime`, …) 400'd against the server. `profileId` is now `string`
  (CHAR(36) UUID) everywhere in the parental-controls surface.
- **`src/types/parental.ts`**: wire keys corrected to snake_case (mirroring
  contracts v0.4.4); GET read paths map the server's `profile_id` emission
  into the local `profileId` shape.
- **`ParentalControlsScreen`**: schedule read/display and the add-tag/create-
  schedule payloads use the snake_case keys; the active profile id now comes
  from `useProfileStore.activeProfileId` (the app's real profile model —
  `user.profileId` never existed on the auth `User` shape).

### Added — in-app stream quality picker (G3)

- **`@phlix/contracts` bumped to `v0.2.0`** (from `v0.1.1`) in `package.json` /
  `package-lock.json`, pulling in the `Rendition` / `RenditionId` /
  `QualitySelection` / `AUTO_QUALITY` types (step B1). Resolved SHA verified
  against `git ls-remote --tags` before landing.
- **New `QualityMenu`** (`src/components/player/QualityMenu.tsx`) — a
  bottom-sheet picker (matches the existing subtitle-picker Modal style/dark
  palette) letting the viewer choose **Auto** (native AVPlayer/ExoPlayer ABR on
  the multi-variant HLS master) or pin a specific resolution rung (that rung's
  own signed `media_v{id}.m3u8`, playable with **zero native code**). All the
  testable logic lives in the new pure helper module
  `src/components/player/quality.ts` (`buildQualityOptions`,
  `resolveQualityUrl`, `seedQualitySelection`, `activeQualityLabel`), which
  consumes the real `Rendition`/`variants` DTO from `@phlix/contracts` directly
  — no locally-reinvented shape (mirrors the `phlix-console-client` G5
  precedent).
- **The picker is gated on transcode playback.** The mobile player tries the
  signed direct-play `stream_url` first; a real, pinnable quality ladder only
  exists once a transcode job resolves (server A7 `variants[]`) — the mobile
  `MarkerManager.getPlaybackInfo` response carries markers only, no ladder. So
  the quality button/menu is **hidden entirely** whenever direct-play succeeds
  or the ladder has fewer than 2 usable options; it appears once a transcode
  fallback resolves ≥2 rungs. `TranscodeManager.prepare()` now surfaces
  `variants: Rendition[]` on its result (`[]` on a legacy/pre-ABR server).
- **`useSettingsStore.defaultQuality` is now genuinely wired.** This setting
  was persisted and user-settable from day one but never *read* by any
  playback code (a true orphan). `PlayerScreen` now seeds the initial pick
  from it via `seedQualitySelection` (falling back to `Auto` when the
  persisted rung isn't in the current job's ladder — the same failure class as
  the `phlix-roku-client` G4 `FindVariantUrl` bug, guarded here by a dedicated
  test) and persists a fresh pick back to it via `setDefaultQuality` whenever
  the viewer changes quality.
- **Fixed: mid-playback quality switches no longer restart from position 0.**
  Picking a different rung/Auto swaps the native `<PhlixPlayerView src>`, and
  AVPlayer/ExoPlayer reload from the `startPosition` prop on a `src` change.
  The initial implementation left `startPosition` bound to the screen's
  mount-time route param, so every switch jumped the viewer back to the
  beginning. Fixed with a live-position mirror: a `currentPositionRef`
  (updated from every `setCurrentTime` source — progress, seek, syncplay) is
  read at the moment of the switch and used to seed a new `playerStartPosition`
  state that actually drives the player prop, so Auto↔pin and pin↔pin switches
  resume near where the viewer left off, on both platforms. Covered by a
  dedicated mutation-tested case in `src/screens/__tests__/PlayerScreen.test.tsx`.
- **New tests**: `src/components/player/__tests__/quality.test.ts` (16 cases,
  the four pure helpers), `QualityMenu.test.tsx`, 3 new cases in
  `src/api/__tests__/TranscodeManager.test.ts` (variants default/from-start/
  from-poll), and a new `src/screens/__tests__/PlayerScreen.test.tsx` (6
  cases) exercising the screen wiring end-to-end via a renderer-free "hook
  host" technique (this repo intentionally has no React Native Testing
  Library / `react-test-renderer` — see `SkipButton.test.tsx`'s note on React
  19 instability under `@react-native/jest-preset`).

### Skipped — native `maxResolution` prop (flagged for a future native step)

A `maxResolution` prop on `PhlixPlayerView` (real ExoPlayer
`TrackSelectionParameters.maxVideoSize` / AVPlayer
`preferredMaximumResolution` track-selection code, on **both** iOS and
Android) was investigated and deliberately **not** added for this step. It is
not a limitation of the JS-side work above — it would be **redundant** with
the variant-URL pin this step ships: playing a rung's own media playlist
already hard-caps the decoded resolution to that rung with zero native
changes. A native cap would only add value on the **Auto/master** path (e.g.
capping the resolution ABR is allowed to pick) and would need genuine
cross-platform native code that is untestable in this CI environment (no
Xcode/Gradle device or simulator build). Flagged as a possible future
native-side enhancement, not a gap in this feature.

### Fixed — SyncPlay positions on the wire are now milliseconds (S293)

- **The SyncPlay send boundaries now convert the player's seconds to the
  wire's milliseconds unit (`phlix-syncplay/SPEC.md:91`).** `PlayerScreen`'s
  `currentTime` is seconds; the wire unit is milliseconds per
  `phlix-syncplay/SPEC.md:91` — Roku was the only client already compliant.
  A new `toSyncPlayPositionMs()` helper converts at each send boundary
  (`sendPlay`/`sendPause` in `handlePlayPause`, `_handlePlay`,
  `_handlePause`), asserted with 1000×-sensitive values and
  mutation-proved. The receive side is untouched: inbound positions are
  consumed exactly as before, and the player's internal seconds state and
  the native player keep seconds. KNOWN LIMIT: `sendSeek` still has no
  production callsite — a host seek is applied locally and never broadcast
  — so no seek-position conversion ships. The server (stores the payload
  raw, unit-agnostic) and Roku (already compliant) are not touched.

### Added — hub-relay pending_command consumer (S298, mobile half)

- **The mobile app now consumes "Alexa, play X" (`pending_command` /
  `play_media` frames) from the hub's SyncPlay relay.** New
  `src/syncplay/hubRelay.ts` opens a real `:8804` socket at
  `ws(s)://<hub>:8804/syncplay/{server_id}` with the **bearer subprotocol
  carrier** (`Sec-WebSocket-Protocol: bearer, <token>` — S237/S355-proven
  against the real hub; the relay refuses query-string tokens by design).
  The open-whenever lifecycle boots the socket whenever hub auth exists —
  NOT gated on a SyncPlay room join — with a capped exponential reconnect
  ladder that re-reads the token on every attempt (relay tokens expire
  hourly). Frames are parsed at the boundary (parse-don't-validate); only
  `pending_command` / `play_media` is consumed, everything else is dropped.
- **`src/hub/RelayTokenProvider.ts`** mints the per-(user, server) client
  relay token over `POST /api/v1/me/servers/{id}/relay-token` (S2a) with the
  hub session JWT, caches it until just before `expires_at`, and returns
  `null` (never a stale credential) on any failure or after sign-out.
- **`src/syncplay/HubRelayConsumer.ts`** wires it at app boot (`App.tsx`):
  hub-auth-gated socket lifecycle + a command router that consumes each
  delivered frame once and navigates the player to the media id — the
  mobile load-a-new-title path (PlayerScreen's itemId-driven load resolves a
  signed stream and auto-plays).
- **`current_media_id` carry-through paired caller.** The wire value was
  already mapped into `SyncPlayGroup` (`?? null` in
  `SyncPlayService.handleGroupState`); `applyPendingPlayMedia` is the caller
  that writes the delivered media id into the live group via the new
  `setCurrentMediaId` store action — the field is produced at the wire
  boundary and consumed here, not dead wiring.
- **Tests** (`src/__tests__/syncplay/hubRelay.test.ts`,
  `HubRelayConsumer.test.ts`, `syncplayStore.test.ts`,
  `src/__tests__/hub/RelayTokenProvider.test.ts`): carrier shape, parse
  boundary, lifecycle/reconnect, router (deliver → navigate → consume,
  once per unique command), store consumer pair, mint/cache/re-mint. Real
  hub proof: handshake OPEN + delivered=1 + control delivered=0 (see the
  lane report). KNOWN LIMIT: no device/emulator on the build box — the
  frame's path through the consumer into the player load is proven at the
  component/store level; pixel playback is unobservable here.

### Fixed — S404 track-shape alignment (local mirror retired)

- **`src/types/playback.ts` re-declared `SubtitleTrack`/`AudioTrack` with a
  required `display_title` — a key phlix-server has NEVER emitted**
  (`StreamTrackShaper` is the wire authority, verified at server `01340633`;
  `display_title`: zero hits in server `src/`). The mirror is retired: the
  file now re-exports the corrected `@phlix/contracts` v0.4.5 playback.ts
  pair verbatim (audio: `id, index, stream_index, codec, language, channels,
  bitrate (always present, nullable), title (nullable), default`; subtitle:
  `id, index, stream_index, language, label, codec, source, hearing_impaired,
  url (nullable)`).
- **`PlayerScreen`'s transcode subtitle rows now carry the full honest wire
  shape** (the old hand-literal held `display_title: s.language`; the display
  string moves to `label` — same value, same rendering; ordinals positional,
  `source: 'transcode'` marks client provenance). Behavior unchanged.
- **`@phlix/contracts` pinned to v0.4.5** (lockfile resolves the tag to the
  merge squash; the vendored route manifest shipped in the bundle stays
  byte-identical, md5 `cca4660dda7876fba840f9d108ad7c18`).
- **Tests rewritten honestly (not deleted)**: the `src/types/__tests__/playback.test.ts`
  track fixtures now pin the nine-key wire shapes plus compile-time ABSENCE
  pins (`display_title`/`title`-on-subtitle must never come back — gated by
  `tsc`, the file's documented executing check); the `usePlayerStore` track
  fixtures carry full wire rows. `tsc --noEmit` clean, eslint clean (2
  pre-existing disable-comment warnings unchanged), jest 76 suites /
  1151 passed + 1 skipped, metro android bundle emitted.
- Out of scope by ruling: the DEAD `audioTrackList`/`subtitleTrackList`
  pickers (setters have zero call sites; components still type against the
  `Stream*` DB mirrors) — wiring is S407.
