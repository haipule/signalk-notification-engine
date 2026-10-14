# Architecture

## Component boundary

Known Signal K notification states have one non-configurable descending
presentation order: `emergency`, `alarm`, `warn`, `alert`, `normal`,
`nominal`. Unknown foreign state strings remain visible after the known states.
Rule Builder visibility branches may control an individual treatment, but no
configuration source can redefine Signal K state severity.

Rule Builder treatment is resolved per notification. General state branches
provide defaults; matching path and condition branches override only the
fields they set. The resolved policy carries table visibility, display mode,
marker color, flashing, history and sound to their respective consumers.
An explicit local `display: banner` or `display: overlay` treatment is applied
independently of the producer's optional notification `method` list; that list
does not override Rule Builder presentation policy.
Ignore suppresses only local visibility and audio. External execution is
resolved independently at the bounded delivery boundary. None of these local
treatments changes Signal K state or grants a lifecycle action.

An optional legacy `Notification Engine config` node is accepted only for
upgrade compatibility; shipped flows and current installations do not require
or include it. Its effective surface is restricted to an explicit allowlist
of presentation, sound, and history treatment fields. Signal K Plugin Config always wins for host audio,
maintenance tests, persistence limits, browser shortcuts/timeouts, critical
input diagnostics, Rule Builder selection, and external-task authorization.
Known obsolete or misplaced Node-RED copies are excluded before checksumming,
so changing one cannot reload or alter notification processing.

The selected active Rule Builder tab and its connected branches are the
mandatory deployed configuration. The former inject node is no longer
required: its absence yields an empty compatibility object, while more than
one such node remains invalid. This does not weaken fail-closed startup for a
missing, disabled, or invalid selected tab or for invalid rule wiring.

### Localization boundary

The WebApp renders Notification Engine labels through stable keys. Built-in
English is complete and authoritative; built-in German and validated custom
locale JSON files override only presentation strings. `TranslationCatalog`
loads custom files from the persistent Signal K plugin data directory, rejects
unsafe input, and merges every valid locale over English before returning it
through the read-only translation API. Catalog failure is deliberately outside
Node-RED configuration readiness and notification processing.

The browser stores the selected locale locally, applies `navigator.languages`
only when there is no explicit choice, and uses `Intl` for locale-sensitive
date, time and plural rendering. Signal K messages, paths, sources, IDs,
machine-readable states, event codes and raw Diagnostics cross this boundary
unchanged.

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
timings, configured critical-input source freshness, Node-RED revision and
configuration health, audio process results, and history persistence status
are exposed separately from notification authority. Critical-input checks read
the existing local Signal K leaf and its producer timestamp on demand; they do
not subscribe broadly, publish a notification, or affect alarm processing.
Audio process diagnostics identify the affected local lifecycle key and expose
player, device, file, PID, start/end time, duration, exit code, and signal; they
observe playback without changing Signal K notification state.
The local restart-state repository atomically retains the exact authoritative
fields of active notifications and only their completed finite playback
signatures. On restart, an exact field-for-field match may reuse the local
occurrence and suppress an already completed finite sound. Any mismatch,
interrupted playback, or loop playback is treated as work that must start or
resume. This cache is not notification authority and cannot create or mutate a
Signal K lifecycle; its persistence health is exposed through Diagnostics.
Restart-correlation Diagnostics retain only bounded match outcomes, identity,
source label and mismatched field names. They never expose compared field
values and do not alter whether an occurrence or playback signature is reused.
The WebApp adds its own local poll start/end, duration, and network error so a
slow client can be distinguished from a slow Signal K snapshot.

Declarative Plugin Config normalization is isolated in the configuration
service. It loads optional palettes and normalizes presentation, sound,
shortcut, state-order, and history-rule values without starting subscriptions,
audio, HTTP routes, or notification processing. Runtime application remains in
the plugin lifecycle boundary so invalid Node-RED configuration still fails
closed before processing starts.

HTTP registration is isolated in a transport adapter. It owns only Signal K's
readonly/readwrite route selection, request parameter extraction, and HTTP
status/response formatting. The plugin runtime injects transport-neutral
operations; notification state, Signal K actions, audio suppression rollback,
configuration readiness, and persistence remain with their existing domain
owners. The literal global-action route is registered before the parameterized
single-notification route so Express cannot interpret `action-all` as an id.

The snapshot service owns the read-only reconstruction boundary for active
notifications. It merges the official local HTTP projection, both supported
in-process data-model views, and `app.notifications.list()`; enriches handler
projections with the original producer source; applies subscribed notification
deltas to the cache; and periodically reconciles startup-order gaps. It records
snapshot/delta diagnostics but never raises, clears, acknowledges, silences, or
otherwise becomes authoritative for a Signal K notification.

The history service owns the Notification Engine's local audit persistence
lifecycle: recording policy, bounded repository creation, startup loading and
retention, occurrence-scoped WebApp deletion, health reporting, and final
write flushing. Its clear operations update only the local audit
store and repository; they never call a Signal K notification action or imply
that an authoritative notification was removed.

The resolved history policy is latched to the local `occurrenceId` when that
occurrence first enters the store. A retained occurrence records its complete
lifecycle, including a terminal state that would not independently be visible.
A suppressed occurrence remains absent through its terminal transition,
avoiding an isolated `normal` entry when the original state-specific rule no
longer matches. Exact restart correlation carries this local decision; it never
changes the authoritative Signal K state or producer lifecycle.

The audio controller owns local playback presentation state: eligibility,
finite/loop repetition, inter-play pauses, retry/probe timers, completed
signature deduplication, optimistic silence rollback, circuit interaction,
passive watchdog recovery, and audio diagnostics. It never executes a Signal K
notification action; the action adapter remains authoritative for permitted
Silence requests, and a rejected request removes only the local marker.

The plugin runtime coordinator owns lifecycle tokens and the mandatory
Node-RED configuration boundary. Initial startup cannot proceed without a
valid runtime/configuration interface. A later invalid deploy is latched,
suspends snapshot subscriptions and local audio, and is not retried by WebApp
polling; only a subsequent deploy event may apply a valid configuration and
resume the injected services.

The local lifecycle-boundary adapter subscribes to authoritative Signal K
inputs that delimit an occurrence without changing notification state. Its
first built-in mapping treats an inactive `navigation.anchor.state` (`off` or
the value removal emitted by Hoekens 2.13.1) as the end of the
local `notifications.navigation.anchor` occurrence. While `off` persists,
snapshot refreshes retain that ended occurrence; after the input returns to
`on`, the next producer notification receives a fresh local occurrence ID.
This adapter never calls a Signal K notification lifecycle action.
It also sends an explicit local end event to the audio controller so a missed
producer-removal delta cannot leave local playback or circuit state running.

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

Finite audio is deduplicated by local notification occurrence plus the exact
resolved absolute sound file, playback count, and inter-play pause. Resolving
the file before comparison prevents equivalent relative and absolute path
spellings across configuration recovery from creating a false change. Count `0` is an unbounded
loop, `1` is one play, and `2` through `99` are exact finite counts. Optional
`pauseSeconds` is an integer from `0` through `5` and delays only the next play
after a complete successful play; a missing value means no added delay. A successful finite playback
keeps that signature until the occurrence ends, is silenced, or receives a
different sound configuration. Routine snapshot and condition refreshes must
not replay it. A fail-closed Node-RED configuration suspension cancels active
players, loops, and pending repeats but retains completed finite signatures;
recovery therefore resumes interrupted repeating audio without replaying an
unchanged completed finite sound. A genuinely changed sound signature remains
eligible for playback. A migration adapter still reads the former
`mode`/`repeatCount` representation. This registry is local playback state and
never changes the authoritative Signal K notification.

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

After a successful player exit, explicit `Alarm heard` and `Sound not heard`
choices remain available for exactly 15 seconds. Positive feedback records the
operator identity and confirms human audibility immediately. Negative feedback
latches the visual audio-system notification. With no selection, the test
passes operationally only after the full window and is described as technically
played without counter-report; it never claims that a person heard the sound.
The last terminal Alarm Sound Test result is stored atomically in the plugin
data directory as `audio-self-test.json`. This scheduling state is independent
of the bounded local audit History; History still receives test events for
operator review but may evict them without resetting the due date. On first
start after upgrading, a retained terminal result from the legacy History is
migrated when the dedicated file does not yet exist.
Technical success alone still proves neither amplifier nor loudspeaker output.
Automatic end-to-end proof requires a hardware loopback or microphone.

The Plugin Config controls the recurring interval from zero through 30 days.
Zero disables both the WebApp control and its server-side start operation;
existing audit evidence is retained. The separate one-shot Plugin Config
`Sound Test` checks the configured audio connection but does not create
operator feedback or change the recurring test schedule.

The separate Plugin Config Test Notification is a one-shot maintenance helper.
After normal plugin initialization it raises one clearly marked notification,
retains only the Signal K id returned by that raise call, and clears that exact
id after the configured lifetime. Only successful cleanup resets the request;
plugin shutdown cancels the timer and clears the owned id without consuming an
interrupted request.

The self-test uses a private failure-origin path distinct from the published
audio-system notification. This preserves the recursion guard on
`notifications.system.notificationEngine.audio` while allowing an explicit
operator `not heard` report to latch that visual warning.

The maintenance UI boundary was agreed on 2026-09-29. A compact round button
in the main action row shows the whole days remaining from the configured
interval to `0` since the last operationally passed audible test; `0` flashes
as a due indication. The
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
connected node. A chain ending at a debug node named exactly `Activate` becomes
one policy. Multiple `Activate` endpoints are allowed: independent complete
branches remain independent, while fan-out of the same complete branch is
deduplicated. Complementary assignments with the same state, path, and
conditions merge recursively, including separate `sound.file` and
`sound.count` branches. If same-scope branches assign different values to the
same action, validation fails closed instead of allowing Node-RED JSON order to
choose a winner. Legacy and canonical aliases may coexist only when their
semantic values agree. This wiring rule is independent of node grouping;
`payload.match.path` and `payload.match.conditions` stay attached to that chain.
Matching policies are composed property by property from general to specific.
A path-specific sound rule can therefore inherit visibility and history from a
general state rule, while a longer fully satisfied condition chain overrides
only the properties it explicitly defines. Sound activation is also a branch
property: `payload.sound.active: false` remains attached to that branch and
suppresses an inherited state sound without hiding or changing the Signal K
notification.

The Plugin Config schema reads the current embedded Node-RED workspace and
offers only active `tab` nodes by display name; the persisted value is the
stable tab ID, shown in a read-only field beneath the choice. Configuration and
rule extraction receive only nodes whose `z` equals that selected ID. A
missing, deleted, or disabled selection fails closed before backup recovery;
the plugin never falls back to a matching display label or scans other tabs.

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
policy means visible and no custom audio. Local history follows the resolved
table visibility by default; an explicit `history: true` or `history: false`
overrides that default without changing presentation.

This avoids an allow-list failure mode where a new notification is invisible.
It also keeps complex policy configuration out of the immediate active-alarm
view.

The local history is a notification audit trail, not Signal K's measurement
History API. Signal K remains authoritative for current notification state;
deleting this local history never changes Signal K notifications or provider
measurement data.

External task delivery is an independent side-effect boundary. Node-RED rules
declare intent with one connected `payload.execute` absolute path; protected
Signal K Plugin Config authorizes the exact path per file and supplies its
timeout and optional normal-state permission. The runner consumes only new
store transitions after startup reconstruction, persists accepted
occurrence/path keys before spawn for at-most-once restart behaviour, starts
the path directly without an extra shell, and bounds both concurrency and
captured output. OS start failures, exit codes and timeouts are observational
local audit/Diagnostics results. They never feed back into Signal K
notification state or create a competing alarm lifecycle.

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
`display: banner` is a fixed strip inside the Notification Centre and is
distinct from the full attention overlay. Acknowledging an active `emergency`
removes the attention overlay and returns the notification to its persistent
in-centre presentation without changing its authoritative state. Acknowledge
does not stop audio; playback continues until an independent permitted audio
control or the authoritative lifecycle ends it. A read-capable browser without
write authorization sees the applicable action disabled with a clear
permission explanation rather than having it silently removed.
The browser learns that capability through a non-mutating request behind the
same Signal K readwrite middleware as notification actions. A failed probe
changes only local button availability; it never weakens the server-side
capability check or infers permission from a readable notification.
Its Diagnostics renderer derives localized health sections and version-mismatch
guidance from the read-only server payload while preserving that unmodified
payload in a collapsed Advanced view. Rendering never feeds values back into
notification processing or configuration.
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
