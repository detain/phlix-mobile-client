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
