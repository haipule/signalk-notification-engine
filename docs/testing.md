# Testing strategy

## Unit tests

- Translation-catalog tests require identical complete built-in English and
  German key sets, English fallback for missing custom entries, safe locale
  normalization, and rejection of HTML-bearing custom values. Localization
  failure must remain independent from notification and Node-RED readiness.

- Store: snapshot reconstruction, delta upsert, normal/cleared state, duplicate
  input, restart recovery, and rejection of phantom parent notifications when
  a nested notification path contains a child named `state`.
- Source boundary: normalize Signal K `label`, `$source`, `type`, and string
  representations from both deltas and snapshots.
- Classifier: path before source before structured data before optional text
  fallback; unknown notifications remain `OTHER`.
- Actions: `canSilence`, `canAcknowledge`, `canClear`, emergency behaviour, and
  disabled Notification API mode.
- Policy: deterministic property inheritance from general state rules to
  specific path rules, safe default policy, all configured base match fields
  combined with AND, unsatisfied specific conditions falling back to a matching
  general rule, and longer satisfied condition chains overriding shorter chains.
- History: once an occurrence has entered the audit trail, retain its final
  authoritative normal/cleared transition even when that terminal state is not
  independently configured for history.
- Audio backend: use process exit code and signal as the result; ordinary
  player diagnostics on stderr are not failures when the process exits zero.
  Diagnostics retain start/end time, duration, file, device, process ID, exit
  code, signal, and notification lifecycle key for active and last playback.
- Audio lifecycle: translate legacy playback fields into count, enforce the
  `0` through `99` range, reject conflicting mixed definitions, and retain the
  completed signature for every finite count so an unchanged snapshot or condition update cannot replay it;
  permit playback again only for a changed signature or ended lifecycle.
- Node-RED rule extraction: payload-state sources independent of node type,
  path/condition branch isolation, canonical supported states, rejection of
  unknown states, activation at `Activate`, and preservation of an explicit
  `payload.sound.active: false` through policy normalization. The inactive
  branch must suppress, rather than fall back to, an inherited state sound.
  An explicitly empty or whitespace-only sound path must reject an active
  rule, while the same empty path remains valid only with
  `payload.sound.active: false`.
- WebApp table sorting: newest-first default, column A–Z/Z–A toggles, persisted
  sort selection, and segment-wise Signal K path grouping for the Notification
  column within each authoritative state hierarchy level.
- WebApp connectivity: abort an unreachable poll at its deadline, clear the
  deadline after success, and coalesce overlapping interval/reconnect refreshes
  into one serialized follow-up request.
- Playback recovery registry: a fail-closed configuration suspension retains
  completed finite signatures, discards interrupted loops and pending repeats,
  and still permits an actually changed sound signature.
- Diagnostics: snapshot duration/error recovery, delta counters, Node-RED
  configuration state, audio process/result and playback-registry state,
  history persistence health, critical-input source freshness and current-
  browser poll timing remain read-only. Critical inputs distinguish fresh,
  stale, missing, source-mismatched and timestamp-less data.
- Configuration service: state order, palette-backed colors, visual rules,
  explicit inactive sound, legacy compact policies, shortcuts, timeouts and
  history-rule normalization are tested independently from runtime side effects.
- Passive audio watchdog: present/missing backend, present/missing hardware PCM,
  and an explicit statement that no audible end-to-end result is inferred.
- Audio circuit breaker: independent counters per notification lifecycle,
  opening on the fifth consecutive technical player failure, five-minute
  half-open probes, immediate single probe after watchdog recovery, global
  single-probe exclusion, success reset, failed-probe reopen, silence without
  retries/probes, acknowledge without an implicit reset, lifecycle-end cleanup,
  and restart restoration for still-active lifecycles. Verify that intentional
  stops and policy suppression do not increment the failure count.
- Circuit-breaker observability: Diagnostics show state, lifecycle identity,
  failure count, last error, next probe, probe activity, and suppressed retry
  count; history records state transitions but not suppressed timer ticks.
- Audio-system notification: a genuine player failure publishes the fixed path
  as visual-only and actionless, its own delta never reaches audio playback,
  and success for a different occurrence cannot resolve it. Verify persistence
  across restart and require a successful player exit for every failed
  occurrence before publishing `normal`.
- Audible self-test: reject overlapping tests, record technical failure without
  opening a feedback window, keep `Sound not heard` available for 15 seconds
  after technical success, latch explicit inaudible feedback, and pass without
  claiming audibility only after the complete window. Verify that a later pass
  clears only the stable self-test failure occurrence and does not stop normal
  notification audio.
  Verify that the private self-test failure origin is accepted by the
  audio-system latch while the published audio-system path remains rejected as
  recursive input.
- Runtime test notifications: fixed plugin-owned namespace, two independent
  slots, bounded expiry, duplicate/invalid input rejection, state transition,
  exact-id cleanup, and startup removal of marked stale tests without touching
  foreign or unmarked notifications.

## Integration tests

HTTP adapter tests verify readonly/readwrite access separation, the complete
route inventory, literal global-action precedence, and fail-closed 503
responses when notification processing is unavailable. Domain behaviour stays
covered by the notification, action, runtime-test, audio, and history tests;
route tests use injected fakes and do not acquire Signal K authority.

Snapshot-service tests cover merging all supported Signal K views, retaining
the official API projection when an optional in-process view fails, filtering
the disabled manager-owned test notification, subscribing to notification and
mirrored producer paths, preserving the original producer source, and owning
exactly one periodic reconciliation timer.

Use a fake Signal K application object to simulate `app.notifications` and
notification deltas. Cover an API-managed alarm and a classic producer delta,
where clear must be unavailable.

The first real-device test is the anchor alarm on the Raspberry Pi. Confirm
that its alarm appears, status/actions are accurate, and the manager does not
interfere with the existing `audio-control.sh`.

For the circuit-breaker integration test, use an isolated simulated
notification and a deliberately unavailable ALSA device. Confirm the alarm
remains visible and authoritative throughout, the fifth technical failure opens
the breaker, no retry storm occurs, only one five-minute probe is admitted, and
restoring the device causes at most one watchdog-triggered early probe. Repeat
with two simultaneous simulated lifecycles and across a plugin restart before
claiming the feature complete.

Use the authenticated `runtime-tests/{slot}` maintenance routes for that live
matrix. Never substitute a real anchor, bilge, GPS, or other producer path.
For a lifecycle-transition matrix, end a slot with `normal` and then `DELETE`;
use direct DELETE only for the explicit active-Clear case. Expiry is a fallback,
not the normal cleanup procedure.

The controlled live test matrix and captured evidence are maintained in
[End-to-end safety validation](e2e-safety-matrix.md). Do not execute cases
marked blocked while the vessel depends on the live anchor watch or Android
GPS source.

## Manual WebApp checks

- Active alarms are legible from a distance and ordered by severity.
- `Test alarm sound` produces one bounded tone. After technical success the
  counter-feedback button is immediately visible for 15 seconds; its absence
  yields only `technically played - no counter-report`. Confirm audit fields
  for actor, device, file, exit code, signal, and outcome.
- The UI clearly distinguishes active, silenced, and acknowledged.
- Lifecycle-rule tests cover a producer that ends an alarm with a normal
  `Off` notification and then raises again with the same technical ID.
- Unsupported operations cannot be triggered.
- Selected-notification actions show both pictograms and text labels on the
  tablet. Clear opens an explicit confirmation before any request is sent.
- After confirmed deletion of one local occurrence, its delete action stays
  hidden while that history window remains open; the active Signal K
  notification remains present and unchanged.
- A reload reconstructs the current state without stale phantom alarms.
- Disconnect a client for more than one polling interval: the last table may
  remain visible only when a prominent stale/offline banner is shown and all
  notification actions are disabled. Verify both an immediate browser
  `offline` event and a network failure where the request must reach its
  twelve-second deadline. Reconnect and verify automatic recovery after the
  authoritative notification snapshot succeeds. A slow local-history request
  must not make a current notification snapshot appear offline.
- On a small tablet viewport, verify that the stale banner remains fixed above
  alarm overlays and appears no later than eight seconds after the last good
  snapshot, even when the browser emits no `offline` event.
- Deploy an invalid embedded Node-RED configuration: audio, subscriptions,
  snapshot polling, and write actions stop; one visible latched error remains
  without poll-driven log spam. A later valid deploy resumes processing.
