# Testing strategy

## Unit tests

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
- Node-RED rule extraction: payload-state sources independent of node type,
  path/condition branch isolation, canonical supported states, rejection of
  unknown states, and activation at `Activate`.
- WebApp table sorting: newest-first default, column A–Z/Z–A toggles, persisted
  sort selection, and segment-wise Signal K path grouping for the Notification
  column within each authoritative state hierarchy level.
- WebApp connectivity: abort an unreachable poll at its deadline, clear the
  deadline after success, and coalesce overlapping interval/reconnect refreshes
  into one serialized follow-up request.
- Diagnostics: snapshot duration/error recovery, delta counters, Node-RED
  configuration state, audio process/result state, history persistence health,
  and current-browser poll timing remain read-only.
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
  opening a feedback window, keep `Ton nicht gehört` available for 15 seconds
  after technical success, latch explicit inaudible feedback, and pass without
  claiming audibility only after the complete window. Verify that a later pass
  clears only the stable self-test failure occurrence and does not stop normal
  notification audio.

## Integration tests

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

The controlled live test matrix and captured evidence are maintained in
[End-to-end safety validation](e2e-safety-matrix.md). Do not execute cases
marked blocked while the vessel depends on the live anchor watch or Android
GPS source.

## Manual WebApp checks

- Active alarms are legible from a distance and ordered by severity.
- `Alarmton testen` produces one bounded tone. After technical success the
  counter-feedback button is immediately visible for 15 seconds; its absence
  yields only `technically played - no counter-report`. Confirm audit fields
  for actor, device, file, exit code, signal, and outcome.
- The UI clearly distinguishes active, silenced, and acknowledged.
- Lifecycle-rule tests cover a producer that ends an alarm with a normal
  `Off` notification and then raises again with the same technical ID.
- Unsupported operations cannot be triggered.
- A reload reconstructs the current state without stale phantom alarms.
- Disconnect a client for more than one polling interval: the last table may
  remain visible only when a prominent stale/offline banner is shown and all
  notification actions are disabled. Verify both an immediate browser
  `offline` event and a network failure where the request must reach its
  six-second deadline. Reconnect and verify automatic recovery after the
  authoritative notification snapshot succeeds. A slow local-history request
  must not make a current notification snapshot appear offline.
- On a small tablet viewport, verify that the stale banner remains fixed above
  alarm overlays and appears no later than eight seconds after the last good
  snapshot, even when the browser emits no `offline` event.
- Deploy an invalid embedded Node-RED configuration: audio, subscriptions,
  snapshot polling, and write actions stop; one visible latched error remains
  without poll-driven log spam. A later valid deploy resumes processing.
