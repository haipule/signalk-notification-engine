# Architecture

## Component boundary

```text
Signal K notifications and API
             │ snapshot + deltas + permitted actions
             ▼
Server plugin
  ├─ notification store       local reconstructed view
  ├─ classifier               automatic base category
  ├─ classification rules     persistent Plugin Config overrides
  ├─ policy resolver          display/audio/retention decisions
  ├─ actions adapter          safe app.notifications calls
  ├─ history repository       audit trail, never alarm authority
  └─ WebApp API / event feed
             ▼
WebApp
  active centre · history · diagnostics · link to Plugin Config
             ▼
Optional audio backends
  mock → existing script adapter → native ALSA / other backends
```

Diagnostics are a read-only observation path. Server-side snapshot and delta
timings, Node-RED revision/configuration health, audio process results, and
history persistence status are exposed separately from notification authority.
Audio process diagnostics identify the affected local lifecycle key and expose
player, device, file, PID, start/end time, duration, exit code, and signal; they
observe playback without changing Signal K notification state.
The WebApp adds its own local poll start/end, duration, and network error so a
slow client can be distinguished from a slow Signal K snapshot.

Runtime integration tests use a separate bounded maintenance adapter around
the Signal K Notification API. It can raise only fixed
`notifications.system.notificationEngine.runtimeTest.<slot>` paths and stores
the returned ids privately. Update and clear operations resolve through that
registry, so caller-supplied notification ids and foreign producer paths never
reach the Signal K lifecycle methods. Tests auto-expire; marked leftovers from
an unclean prior runtime are removed at startup.

The audio watchdog is deliberately passive. It verifies that the configured
player executable and ALSA playback PCM exist once per minute, but never opens
the device or emits sound. It therefore cannot prove the amplifier, speaker,
volume, or audible signal; that remains the responsibility of an explicit
operator-initiated test.

### Agreed audio circuit-breaker boundary

The following safety rule was agreed on 2026-09-28 and implemented in 0.1.14.
Circuit-breaker state is local audio-policy state and never
changes, clears, hides, or replaces the authoritative Signal K notification.

Each notification lifecycle has an independent breaker. Five consecutive
technical player failures open it. A process start failure, non-zero player
exit, or unexpected terminating signal counts as a failure. A lifecycle ending
authoritatively, an operator silence, a policy decision not to play, and an
intentional process stop do not count as failures. A successful player exit
closes the breaker and resets its counter.

While open, normal retries are suppressed and at most one half-open probe is
allowed every five minutes. A passive-watchdog transition from `unavailable`
to `ready` may permit one earlier probe, but watchdog health alone never closes
the breaker because it does not prove playback. Only one probe process may run
globally at a time, so simultaneous failing notifications cannot create a
recovery storm. A failed probe reopens the breaker for another five minutes.

Silenced lifecycles neither retry nor probe and retain their breaker state.
Acknowledge does not independently change that state; the resolved audio policy
continues to decide whether playback is required. An authoritative lifecycle
end removes its breaker. Breaker state for still-active lifecycles must survive
a plugin restart so restart cannot reset every failed alarm to a burst of five
new attempts.

Diagnostics expose the breaker state, lifecycle identity, failure count, last
failure, next probe, probe-in-progress flag, suppressed retry count, and latest
transition. Local history records real transitions such as open, probe,
probe-failed, recovered, and lifecycle-end close; it does not record every
suppressed timer tick. These records are local audit events, not Signal K
notification transitions.

### Visual audio-system notification

Technical player failures also latch the plugin-owned Signal K notification
`notifications.system.notificationEngine.audio`. It is always visible, uses
only the `visual` alarm method, advertises neither silence nor acknowledge
support, and is emitted as an external notification so Signal K does not offer
Clear. The audio controller rejects this path before resolving Node-RED policy;
therefore even a broad alarm sound rule cannot make the audio-error report
play sound or recurse.

The recovery boundary was agreed on 2026-09-28: only a successful player exit
for the exact notification occurrence that previously failed removes that
occurrence's latch. Passive watchdog health, another notification's successful
sound, lifecycle end, restart, and a general test tone are not evidence for
that failed occurrence. With multiple failed occurrences, the system
notification returns to `normal` only after every occurrence has recovered by
this rule. Unresolved occurrence latches are persisted atomically across plugin
restarts independently of circuit-breaker lifecycle cleanup.

### Audible operator self-test

The WebApp exposes a deliberately initiated, single-play maintenance tone. It
uses a separate playback key and therefore neither stops nor replaces audio for
an active notification lifecycle. The server records the Signal K request
identity available to the plugin, device, file, timestamps, exit code, signal,
technical outcome, and operator counter-feedback in local audit history.

After a successful player exit, `Ton nicht gehört` remains available for exactly
15 seconds. A counter-report latches the visual audio-system notification. With
no counter-report, the test passes operationally only after the full window and
is described as technically played without counter-report; it never claims
that a person heard the sound. A prior self-test latch clears only after this
later technical success and complete quiet feedback window. Technical success
still proves neither amplifier nor loudspeaker output. Automatic end-to-end
proof requires a hardware loopback or microphone.

The self-test uses a private failure-origin path distinct from the published
audio-system notification. This preserves the recursion guard on
`notifications.system.notificationEngine.audio` while allowing an explicit
operator `not heard` report to latch that visual warning.

The maintenance UI boundary was agreed on 2026-09-29. A compact round button
in the main action row shows the whole days remaining from `7` to `0` since the
last operationally passed audible test; `0` flashes as a due indication. The
button opens a separate process window but does not itself emit sound, avoiding
an accidental audible test. The window contains the explicit start action,
live playback/feedback state, the 15-second counter-report window, and the last
technical details. The last terminal test is reconstructed from persistent
local audit history after restart.

### Legacy audio-flow boundary

The embedded Node-RED tab `Audio Alarms` is retained as a recoverable legacy
reference but is deployed with `disabled: true`. Its Bilge/Anchor exec nodes
and `/home/pi/.signalk/{bilgealarm,anchoralarm}/audio-control.sh` therefore do
not participate in live notification playback. Both scripts were confirmed
stopped on 2026-09-29. The Notification Engine is the only active rule-based
notification audio path in the current deployment. The disabled tab and
scripts must not be deleted until a controlled rollback test has been agreed;
re-enabling the tab would reintroduce competing ALSA ownership and is a
separate migration decision.

The plugin normalizes producer identity at the Signal K boundary. Deltas and
data-model/API snapshots may represent the same source as `label`, `$source`,
`type`, or a string; internally they are stored as `{ label }` (with `type`
preserved when present). The WebApp and policy layer therefore never need to
interpret a server-version-specific source shape.

Node-RED is a graphical policy authoring layer, not a second notification
engine. The extractor reads the declarative `msg.payload` produced by any
connected node. A chain ending at the `Activate` debug node becomes one policy;
`payload.match.path` and `payload.match.conditions` stay attached to that chain.
Matching policies are composed property by property from general to specific.
A path-specific sound rule can therefore inherit visibility and history from a
general state rule, while a longer fully satisfied condition chain overrides
only the properties it explicitly defines.

Runtime Node-RED validation has a fail-closed boundary. If a deployed
configuration cannot be validated or restored, the plugin latches the error,
stops rule-dependent subscriptions, snapshot polling, and audio, and rejects
write actions. WebApp polling exposes the latched health state but does not
revalidate the same bad flow repeatedly; only a later deploy attempts recovery.

## Product model

Every incoming notification is represented in the active view. The plugin first assigns an automatic
base category from its path/source/data rules; unknown notifications become
`OTHER`. The built-in classifier is display-only. Policies then match path or
source and determine local presentation behaviour. No matching
policy means visible and no custom audio; history is recorded only when the
matching rule enables it through `visibleInTable` or an explicit `history`
override.

This avoids an allow-list failure mode where a new notification is invisible.
It also keeps complex policy configuration out of the immediate active-alarm
view.

The local history is a notification audit trail, not Signal K's measurement
History API. Signal K remains authoritative for current notification state;
deleting this local history never changes Signal K notifications or provider
measurement data.

## Initial release boundary

The first implementation now includes an in-memory bounded history and a
WebApp. It exposes `silence`, `acknowledge`, and `clear` only after server-side
capability checks. It does not replace existing audio or implement a full rule
language. The anchor alarm is observed first and its existing audio script
continues to operate independently.

The WebApp is an observation and action surface, not the authority for
classification or configuration. It links to Signal K's Plugin Config for
persistent rule changes. The compact-card and responsive detail-sheet design
changes presentation only; all action capability checks remain server-side.
The WebApp treats connectivity as a safety boundary. Browser `offline` events,
failed API polling, and an independent eight-second snapshot-age watchdog
disable actions, every API request has a six-second deadline, and refreshes are
serialized so interval and reconnect polls cannot overlap. The age watchdog
defers to an in-progress bounded refresh, preventing timer coalescing on slow
clients from producing a false stale state. The last rendered
table is explicitly marked stale with a fixed banner above alarm overlays until
the authoritative current-notification snapshot completes successfully. Local
history refreshes independently because audit display latency must not make a
current Signal K notification snapshot appear offline or disable otherwise
permitted actions. This avoids presenting a frozen tablet as a current alarm
display while keeping Signal K as the action authority.

Notification source reconstruction distinguishes the producer from Signal K's
notification-handler projection. Snapshot and delta processing read the source
of the corresponding underlying data path where available. Once a producer is
known, a later `self.notificationhandler` projection cannot replace it; this
keeps classification and local history keys stable without changing Signal K's
authoritative notification lifecycle.
