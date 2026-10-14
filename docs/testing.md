# Testing strategy

## Unit tests

- Translation-catalog tests require identical complete built-in English and
  German key sets, English fallback for missing custom entries, safe locale
  normalization, and rejection of HTML-bearing custom values. Localization
  failure must remain independent from notification and Node-RED readiness.

- Store: snapshot reconstruction, delta upsert, normal/cleared state, duplicate
  input, restart recovery, fail-closed Notification API manager membership,
  and rejection of phantom parent notifications when a nested notification
  path contains a child named `state`.
- Source boundary: normalize Signal K `label`, `$source`, `type`, and string
  representations from both deltas and snapshots.
- Classifier: path before source before structured data before optional text
  fallback; unknown notifications remain `OTHER`.
- Actions: current managed-ID membership plus `canSilence`, `canAcknowledge`,
  `canClear`, emergency behaviour, and disabled Notification API mode. A
  retained normal data-model record with stale true capabilities but no
  manager entry must leave the active table and expose no lifecycle action;
  no synthetic cleanup event is added to local History. Non-normal records
  remain visible fail-safe during a manager-view gap.
- Policy: deterministic property inheritance from general state rules to
  specific path rules, safe default policy, all configured base match fields
  combined with AND, unsatisfied specific conditions falling back to a matching
  general rule, and longer satisfied condition chains overriding shorter chains.
  Visual `display`, `color`/`hex`, and `flash` fields must reach the matching
  WebApp notification without leaking across unrelated branches. Unknown
  states remain table-visible by default; explicit visibility false and ignore
  remain local presentation decisions only. Explicit banner and overlay rules
  must also render when the producer omits `method: visual`; producer methods
  do not veto the local presentation policy.
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
  unknown states, activation at one or more `Activate` endpoints, and
  preservation of an explicit
  `payload.sound.active: false` through policy normalization. The inactive
  branch must suppress, rather than fall back to, an inherited state sound.
  Separate endpoints produce independent rules; fan-out of one complete branch
  deduplicates; complementary same-scope action leaves merge recursively; and
  conflicting same-scope leaves are rejected in either serialized branch
  order. Conflicting legacy/canonical sound aliases are rejected as well.
  An explicitly empty or whitespace-only sound path must reject an active
  rule, while the same empty path remains valid only with
  `payload.sound.active: false`.
- Rule Builder flow selection: normalize the current embedded flow document,
  list only active `tab` nodes, preserve their stable IDs independently from
  display labels, and omit disabled tabs and ordinary nodes from the Plugin
  Config choices. Scope config and rules to the exact selected ID, ignore even
  same-named tabs, and fail closed for missing or disabled selection without
  restoring that protected choice from a backup. Schema failure remains
  visible rather than silently inventing or selecting a tab.
- State presentation: enforce the fixed Signal K order `emergency`, `alarm`,
  `warn`, `alert`, `normal`, `nominal`, discard obsolete `stateOrder` and
  `visibleStates` config fields, and retain unknown foreign states after the
  known states instead of filtering them out.
- Configuration ownership: inject contradictory host, maintenance,
  persistence, browser, diagnostics, and external-task values through the
  legacy Node-RED config object and prove the Signal K Plugin Config values
  remain authoritative. Obsolete classification, history-state, test
  notification, shortcut, and state-order copies must be absent from the
  effective Node-RED configuration and its checksum.
- Legacy-node removal: accept a valid selected active Rule Builder tab with no
  `Notification Engine config` inject node, retain temporary compatibility
  with exactly one such node, and reject duplicates. Missing, disabled, or
  invalid selected tabs and invalid rule graphs must continue to fail closed.
- WebApp table sorting: newest-first default, column A–Z/Z–A toggles, persisted
  sort selection, and segment-wise Signal K path grouping for the Notification
  column within each authoritative state hierarchy level.
- WebApp table history: include a complete retained occurrence when any event
  in it qualifies under the current table rules, include its later return to
  `normal`, exclude occurrences with no qualifying event, keep fallback path
  identities separated by producer, and sort globally by event time with the
  newest first.
- WebApp connectivity: abort an unreachable poll at its deadline, clear the
  deadline after success, and coalesce overlapping interval/reconnect refreshes
  into one serialized follow-up request.
- WebApp transient polling: a single failed or navigation-aborted request does
  not replace a still-fresh authoritative view with the red stale banner;
  a native offline event is provisionally confirmed after two seconds but must
  not lock the view before the normal fifteen-second freshness deadline. A
  sustained browser-offline state locks actions once that deadline expires.
  The offline deadline must not paint a warning while an authoritative refresh
  is in progress; a failed refresh applies the stale decision itself.
  Signal K polling must start without waiting for localization requests; delay
  or failure in the presentation catalog must not create a connectivity alarm.
  After `beforeunload` or `pagehide`, the outgoing page must not paint a
  disconnect from its aborted final poll.
- WebApp global actions: show Silence only for unfinished local audio with
  current Signal K silence permission, never for emergency or completed finite
  playback; show Acknowledge only for an unacknowledged permitted target.
- Playback recovery registry: a fail-closed configuration suspension retains
  completed finite signatures, discards interrupted loops and pending repeats,
  and still permits an actually changed sound signature.
- Exact restart correlation: an unchanged authoritative ID, path, source,
  state, content, creation time and status reuse the local occurrence and its
  completed finite playback signature. A changed ID or any changed compared
  field creates a new occurrence; interrupted finite playback and loops resume.
  Malformed persisted restart state must fail empty without changing Signal K.
  Read-only diagnostics must distinguish an exact match, the names of differing
  authoritative fields, and a later removal without logging field values or
  changing the correlation outcome.
- Plugin-option migration: remove only the allowlisted fields whose authority
  moved to embedded Node-RED, preserve operational and unknown fields, and
  apply the complete validated Node-RED configuration on initial startup as
  well as on later runtime deploys.
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
  opening a feedback window, keep explicit `Alarm heard` and `Sound not heard`
  choices available for 15 seconds after technical success, audit positive
  human confirmation, latch explicit inaudible feedback, and pass without
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
- Plugin Config test notification: no reset before the configured visible
  lifetime, exact returned-id cleanup, reset only after successful cleanup,
  and shutdown cleanup without consuming an interrupted one-shot request.

## Integration tests

HTTP adapter tests verify readonly/readwrite access separation, the complete
route inventory, literal global-action precedence, and fail-closed 503
responses when notification processing is unavailable. Domain behaviour stays
covered by the notification, action, runtime-test, audio, and history tests;
route tests use injected fakes and do not acquire Signal K authority.
The readwrite authorization probe is tested as a non-mutating endpoint.
WebApp presentation tests keep banner layout distinct from the viewport-fixed
overlay, remove emergency attention after acknowledgement, preserve audio
through that acknowledgement update, and distinguish source denial from a
read-only browser for action availability.

Snapshot-service tests cover merging all supported Signal K views, retaining
the official API projection when an optional in-process view fails, filtering
the disabled manager-owned test notification, subscribing to notification and
mirrored producer paths, preserving the original producer source, and owning
exactly one periodic reconciliation timer.

History-service tests cover policy-over-rule precedence, path/source matching,
age retention, local-only query deletion, and the absence of the four removed
configuration-driven cleanup paths.

Notification-store history tests cover occurrence-scoped decisions in both
directions: an initially retained occurrence keeps its terminal normal event,
an initially suppressed occurrence never creates a terminal-only fragment, a
new occurrence re-evaluates policy, and exact restart correlation preserves the
latched decision.

Audio-controller tests verify that the plugin-owned audio failure notification
stays visual-only, normal lifecycle transitions stop playback and end the
circuit, a completed finite signature is not replayed by a refresh, and a
rejected optimistic Silence rolls back locally without changing notification
state.

Plugin-runtime tests verify mandatory initial Node-RED loading, lifecycle-token
invalidation, deploy unsubscription, latched fail-closed suspension, suppression
of poll-driven retries, and recovery only after a forced deploy refresh.

Reference-flow tests parse the shipped Node-RED JSON, require unique node ids,
complete English Info text, exact one-group ownership for every instructional
node, and zero extracted rules in the as-shipped state. A focused mutation
connects only the documented Quick Start final wire and must produce exactly
one table-visible `alert` rule. The catalog must include every supported
builder field while excluding obsolete `execute_task` and category-assignment
properties.

Global-action tests verify that controls are derived only from records in the
current table, only exact eligible visible IDs are submitted, and resolved
`normal` or `nominal` records remain acknowledgeable when their current Signal
K status explicitly permits it and the ID is still managed. Silence retains its
additional unfinished-audio requirement. HTTP route tests verify that the
submitted ID boundary reaches the runtime action adapter unchanged.

Diagnostics-view tests cover healthy structured sections, browser/server
version agreement, reload-required mismatch, disconnected state, invalid
Node-RED configuration, stale critical inputs, and preservation of untouched
raw diagnostic data in the Advanced model.

External-task tests cover exact per-file grants, disabled entries, explicit
normal-state permission, Builder branch specificity, once-per-occurrence
restart persistence, concurrency, bounded output, OS start failures and process
group termination at timeout. Tests assert that startup reconstruction and an
update already matching the same execute rule do not start a task, and that no
task result changes the originating Signal K notification. Test fixtures mock
process creation; real scripts are run only in a separately approved live
window.

The first live Pi acceptance used the harmless executable fixture
`/home/pi/scripts/SignalK/testscript_time.sh`. A connected
`payload.execute` branch reaching `Activate` created the expected Desktop test
file. Repeating the trigger after disconnecting the wire to `Activate` created
no file. The live result therefore confirms that Rule Builder wiring is the
activation signal; merely retaining a configured execute node is not enough to
start a task.

Local lifecycle-boundary tests verify that anchor `off` and a removed state
value leave the
producer-owned notification unchanged, repeated `off` and snapshot refreshes
are idempotent, unrelated notifications are untouched, and the first
authoritative update after anchor `on` receives a new local occurrence ID.
The local end event must stop playback and circuit state without imitating a
Signal K clear or normal transition.

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
  `Alarm heard` and `Sound not heard` feedback buttons are immediately visible
  for 15 seconds. Positive feedback records human audibility, negative feedback
  latches the audio-system warning, and no selection yields only
  `technically played - no counter-report`. Confirm audit fields for actor,
  device, file, exit code, signal, feedback, and outcome.
- Configure the Alarm Sound Test interval at `0`, `1`, `7`, and `30` days.
  Zero must hide the WebApp button and make the start endpoint reject the
  request; positive values must calculate from the retained last successful
  test without resetting it. The separate Plugin Config `Sound Test` must not
  update that audit result or its due date. After a terminal result, fill or
  prune the bounded History and restart the plugin; `audio-self-test.json`
  must still restore the same terminal result and due date.
- The UI clearly distinguishes active, silenced, and acknowledged.
- A `display: banner` rule renders as a fixed strip inside the Notification
  Centre rather than as the full attention overlay.
- Acknowledging an active `emergency` removes/calms the attention overlay but
  leaves the authoritative state and independent audio unchanged.
- A read-capable browser without write authorization sees applicable actions
  disabled with a clear permission explanation.
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
