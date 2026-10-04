# Changelog

## 0.1.32 - 2026-10-04

- Canonicalize playback signatures to the absolute file path used by the
  player. Relative and absolute spellings of the same sound no longer cause a
  replay after configuration recovery.

## 0.1.31 - 2026-10-04

- Expose the playback-signature registry in read-only Diagnostics so recovery
  can be verified without inferring internal state from an audible result.

## 0.1.30 - 2026-10-04

- Preserve completed finite playback signatures across a fail-closed Node-RED
  configuration suspension. Recovery no longer replays an unchanged active
  notification, while interrupted loops/repeats and genuinely changed sound
  configurations remain eligible to start under the recovered valid rules.

## 0.1.29 - 2026-10-04

- Increase the Alarm Centre notification request deadline from six to twelve
  seconds and the stale threshold from eight to fifteen seconds. This avoids
  false offline indications when a healthy Pi snapshot occasionally takes
  longer than six seconds, while browser offline events still disable actions
  immediately.

## 0.1.28 - 2026-10-01

- Add optional `payload.sound.pauseSeconds` for a zero-to-five-second delay
  between complete finite or looping sound plays. Missing or zero keeps the
  existing no-delay behaviour.
- Reject a deployed rule when `pauseSeconds` is not an integer from zero
  through five instead of coercing or clamping it.

## 0.1.27 - 2026-10-01

- Start the next finite or looping audio process only after the previous
  child-process close event has fully unwound. Exact playback counts no longer
  depend on a re-entrant player start.
- Track and unit-test finite playback progress independently from the
  completed-signature registry.

## 0.1.26 - 2026-09-30

- Replace the internal sound mode/repeat-count pair with one canonical
  playback `count`: `0` loops, `1` plays once, and `2` through `99` play the
  exact finite count.
- Continue reading the existing Node-RED and Plugin Config
  `mode`/`repeatCount` fields during migration, and reject conflicting mixed
  definitions instead of guessing.

## 0.1.25 - 2026-09-30

- Retain a completed `once` or finite `repeat` sound signature for the active
  notification occurrence. Snapshot and condition refreshes no longer replay
  an unchanged finite sound; lifecycle end, Silence, or a changed sound
  configuration still permits the appropriate later playback.

## 0.1.24 - 2026-09-30

- Preserve `payload.sound.active: false` from an activated Node-RED rule branch
  through policy normalization, so a specific inactive sound rule suppresses
  inherited state audio instead of silently re-enabling it.
- Validate the sound activation flag and regression-test extraction,
  normalization, and inherited-state suppression.

## 0.1.23 - 2026-09-30

- Label the selected-notification action buttons as well as showing their
  pictograms, require explicit confirmation before requesting an authoritative
  Signal K Clear, and hide the selected-history delete action after success.
- Document the current Raspberry Pi package, backup, health-timer, deployment,
  verification, and recoverable rollback sequence.

## Development series 0.1.4-0.1.22

- Fix the audible self-test failure latch: `Ton nicht gehört` now uses a
  distinct internal failure origin, so the recursion guard for the published
  audio-system notification no longer suppresses the visual warning.

- Add authenticated, bounded runtime test slots for safe simultaneous audio
  and lifecycle validation without restarting Signal K or using real anchor,
  bilge, or GPS alarms. Slots are restricted to a fixed plugin namespace,
  auto-expire, and cannot update or clear foreign notification ids.
  Treat Signal K's expected `not found` response after a transition to
  `normal` as successful idempotent slot cleanup.

- Document the deployed audio ownership boundary: the retained embedded
  Node-RED `Audio Alarms` legacy tab is disabled, both legacy scripts are
  stopped, and Notification Engine is the only active rule-based audio path.

- Expand read-only audio diagnostics with active-process and last-result
  metadata: lifecycle key, player, device, file, PID, start/end timestamps,
  duration, exit code, and signal.

- Show audible-test maintenance due state as a round `7` to `0` day counter in
  the main action row. At zero it flashes; opening it shows a dedicated process
  window with the explicit start action, live 15-second feedback countdown, and
  technical details. Restore the last terminal result from persistent history
  after a plugin restart.

- Add an authenticated, bounded audible operator self-test to the WebApp. It
  records actor, device, file, player result, and explicit counter-feedback;
  after a technically successful playback it keeps `Ton nicht gehört` available
  for 15 seconds and reports only `technically played - no counter-report`,
  never that a person heard the tone. A reported or technical failure latches
  the visual audio-system notification until a later technical success receives
  no counter-report for the complete feedback window.

- Add a persistent, visual-only
  `notifications.system.notificationEngine.audio` alarm for technical player
  failures. It is hard-excluded from audio and operator lifecycle actions and
  returns to normal only after successful playback of every exact lifecycle
  that previously failed.

- Add a persistent per-notification-lifecycle audio circuit breaker. Five
  consecutive technical playback failures stop normal retries, permit at most
  one globally serialized probe every five minutes or after passive watchdog
  recovery, and expose state transitions through Diagnostics and local audit
  history without changing the authoritative Signal K notification. Startup
  reconstruction removes persisted breakers whose lifecycle is no longer
  active instead of leaving stale diagnostic state.

- Add a silent, periodic audio watchdog that checks the configured player and
  ALSA playback PCM without opening the device or producing a test tone, and
  expose its limitations and current result through Diagnostics.

- Add a read-only Diagnostics API and WebApp panel for client polls, server
  snapshots and deltas, Node-RED configuration, audio processes/results, and
  local-history persistence health.

- Sort the Notification table column by dot-delimited Signal K path segments so
  notifications from the same path hierarchy remain grouped within each state.

- Preserve a recovered producer source when later Signal K notification-handler
  deltas project the same notification as `self.notificationhandler`, and read
  the underlying data-path source immediately when processing such a delta.

- Bound Alarm Centre API polls to six seconds, react immediately to browser
  offline events, serialize refreshes, and keep all notification actions
  disabled until a complete notifications-and-history refresh succeeds.
- Keep the disconnected/stale warning fixed above alarm overlays, make disabled
  actions visually unmistakable, and mark the view stale within eight seconds
  even when the browser does not emit an `offline` event.
- Do not let the snapshot-age watchdog report a false stale state while a
  timeout-bounded refresh is already in progress on a slow tablet.
- Base connectivity and action availability on the authoritative current
  notification snapshot; a slow local-history response no longer makes the
  live alarm view falsely appear offline.

- Compose matching notification policies property by property so specific
  sound rules inherit general visibility and history behaviour.
- Preserve the final authoritative normal/cleared transition for occurrences
  that already entered local history.
- Treat audio-player exit status as authoritative, ignore harmless stderr on a
  zero exit, and back off failed loop playback exponentially up to 60 seconds.
- Fail closed after an invalid runtime Node-RED configuration: stop audio and
  rule-dependent processing, expose a latched error, reject actions, and retry
  only after a later deploy.
- Mark a disconnected Alarm Centre view as stale/offline and disable local and
  global notification actions until connectivity returns.

- Reject unknown Node-RED notification states while canonicalizing supported
  states, and remove the invalid `Info` rule from the deployed builder flow.
- Do not manufacture parent notifications from nested Signal K paths ending in
  `.state`.
- Require every configured policy match field and condition to match, and fall
  back to the next applicable general rule when a specific condition is not
  satisfied.

- Make `visibleInTable` the default opt-in for local history, with explicit
  `history: true/false` overrides; remove forced emergency/alarm retention.

- Normalize Signal K notification sources from label, `$source`, type, and
  string representations so the centre does not incorrectly show `Unknown
  source`.

- Interpret Node-RED notification rules from `msg.payload` independent of the
  producing node type; preserve path/condition branches and prefer longer
  satisfied condition chains.
- Keep new notifications at the top of the centre by default and allow
  user-selected A–Z/Z–A sorting for table columns.
- Keep notification hierarchy authoritative, including INFO; status and state
  are not user-sortable and text sorting only applies within each hierarchy level.
- Reuse the existing Node-RED Rule Builder tab when opening it from the WebApp.
- Add declarative Signal K conditions to Node-RED notification rules.
- Prioritize path-specific rules and apply conditions to alarm and warn presentation.

- Keep unclassified `notifications.environment.*` notifications in `OTHER`
  instead of assuming they are weather; explicit path rules can still assign a
  category.

- Categories are now display-only metadata; Node-RED builder rules and
  presentation policies no longer assign or match them.

- Version 0.1.4: keep unclassified `notifications.environment.*`
  notifications in `OTHER` instead of assuming they are weather.

- Add configurable color and sound palettes for notification presentation.
- Add state-based standard sound mapping and specific sound overrides.
- Simplify the main action bar and rename the active notification section to
  Selected notifications.
- Start a new local notification lifecycle after configured producer-specific
  end markers such as Hoekens `normal`/`Off`.
- Keep table visibility controlled by Notification Engine Rule Builder, with emergency and alarm always visible; mark acknowledged states green.
- Update the Node-RED administration link.
- Back up the last valid internal Node-RED notification flow and recover it
  automatically when a deploy removes or corrupts the Notification Engine
  configuration.
