# End-to-end safety validation

This matrix verifies the complete path from a producer through Signal K,
Notification Engine rules, presentation/audio, operator actions, and local
history. A case passes only when every listed observable result matches. Unit
tests alone do not satisfy these cases.

## Safety boundary

The live vessel was anchored during the initial run on 2026-09-26:
`navigation.anchor.state` was `on` and Hoeken's reported a configured anchor
position. Tests that raise/reshape/clear the real anchor, interrupt the live
GPS feed, or deliberately leave an active alarm across a restart are therefore
blocked until the operator confirms a safe test window. Simulated
notifications must use a clearly isolated test path and must not modify the
real anchor lifecycle.

## Result labels

- **PASS**: all expected observations were captured.
- **PARTIAL**: the safety reaction worked, but one or more secondary criteria
  failed or lack evidence.
- **FAIL**: an expected safety or audit result did not occur.
- **PENDING**: safe to perform later, but not yet executed.
- **BLOCKED**: must not be executed in the current vessel state.

## Live evidence captured on 2026-09-26

| Case | Expected result | Evidence | Result |
| --- | --- | --- | --- |
| Android UDP GPS stops while anchor watch is on | Hoeken's raises a warning after its configured timeout; the centre shows the warning; warning audio follows the path rule; history records the warning | Last GPS fix was 22:45:37Z. Hoeken's published `warn` with `No position data received for 10 seconds.` at 22:45:48Z. Notification Engine repeatedly invoked `/home/pi/.signalk/sounds/1bells.wav`. | PARTIAL |
| History for the GPS-loss warning | The warning and its subsequent resolution appear in the same local occurrence timeline | The initial run failed because the path-specific sound rule suppressed inherited history. After deployment of `0.1.5`, repeated live GPS-loss warnings on 2026-09-27/28 recorded alternating `warn` and final `normal` updates under the same occurrence IDs. The deployed rules still contain a general `warn` rule with `visibleInTable: true` and a separate anchor-path sound-only rule, confirming that history is now inherited correctly. | PASS after `0.1.5` retest |
| Android UDP GPS returns | Position becomes non-null, Hoeken's returns to `normal`, loop audio stops, and the occurrence records resolution | Position recovered from `android_udp.gps`; Hoeken's returned to `normal`; the audio process ended at 23:02:47Z. After deployment of `0.1.5`, later live warning/recovery cycles also retained the final `normal` event in the same local occurrence. | PASS |
| Signal K restarts while anchor watch is on and notification is normal | Service and health timer recover; anchor state and notification are reconstructed; no phantom notifications or invalid rules appear | After the Prio-0 deployment both services were active, anchor state remained `on`, anchor notification was `normal`, phantom count was zero, and 11 valid rules loaded. | PASS |
| Transient GPS loss during a controlled Signal K restart | Hoeken's warning and its audio must be distinguishable from the later simulated notification and must resolve when Android GPS returns | During the multi-device E2E setup, `1bells.wav` sounded before the simulated alarm existed. Signal K had been restarted, Android GPS was temporarily unavailable during startup, and Hoeken's returned `notifications.navigation.anchor` to `normal` at 00:44:27Z. The isolated E2E alarm was not published until 00:44:31Z and then used `alarm.wav`. This identifies the preceding bell as the real Hoeken's GPS-loss warning. Its raised event is absent from local history because of the known path-rule history defect. | PARTIAL: safety warning and recovery worked; history failed |
| Local occurrence continuity across restart | The same physical anchoring lifecycle remains correlated across a routine plugin/server restart | Before restart the anchor occurrence was `occurrence-1790305888174-ms0xjbo8rq`; after restart it became `occurrence-1790467178808-21k6yufj9h2`, with a new `raised` history event despite the anchor already being set. | FAIL |

## Remaining controlled tests

| Case | Required observations | Current status |
| --- | --- | --- |
| Simulated `warn` notification | Visibility, configured banner/table mode, sound selection, history, and capabilities for an isolated test path | PARTIAL after clean retest: both devices showed the orange warning only in the table and the operator confirmed one `warn.wav`, with no bell, banner, or overlay. Acknowledge and Clear succeeded; Signal K changed the same notification to `normal`. History contains raised, authoritative acknowledged update, and both action requests under one occurrence ID, but omits the final normal update. |
| Simulated `alarm` notification | Visibility, overlay mode, looping sound, history, and capabilities for an isolated test path | PARTIAL after clean retest: both devices showed a dark-red flashing overlay and the operator confirmed looping `alarm.wav`. Silence and Acknowledge succeeded and remained synchronized. The deployed rule says `display: banner`, however, and history omitted both the raised event and the final automatic normal transition. |
| Simulated `emergency` notification | Visibility, overlay mode, non-silenceable siren, history, and capabilities for an isolated test path | PARTIAL after clean retest: both devices showed the red flashing overlay, looping `sirene1.wav`, disabled Silence, and enabled Acknowledge/Clear. Acknowledge synchronized, removed the overlay, retained the active emergency in the table, and correctly did not stop the siren. Clear stopped the siren and returned Signal K to normal. History contains raise, ACK update, ACK request, and Clear request under one occurrence, but omits the final normal transition. |
| Simulated Hoeken's-path `warn` | Exact anchor path selects its path-specific sound and retains correct actions without the real producer running | PARTIAL: both devices showed the orange table warning, looping `1bells.wav`, and correct `ANCHOR` classification. Silence stopped only that loop and retained the warning. The raised and final normal events are absent from history; only the action request was retained. |
| Simulated Hoeken's-path `alarm` | Exact anchor path selects its path-specific alarm sound and retains correct actions without the real producer running | PARTIAL: both devices showed the dark-red flashing overlay, looping `2bells.wav`, and the separate real GNSS warning remained visible. Silence stopped only the bell loop; Clear returned the simulated anchor path to normal. History contains Silence and Clear requests but omits the raised and final normal events. |
| Silence one simulated looping notification | Only that occurrence stops; Signal K state remains active; history records an action request | PASS after authenticating the tablet: Silence from Tab 3 stopped the audio, left the authoritative state at `alarm`, changed the shared status to `silenced: true`, and recorded `action_requested: silence` at 00:44:55Z. The earlier unauthenticated attempt failed as expected for a read-only browser session. |
| Acknowledge one simulated notification | State remains active; acknowledged flag changes; audio behaviour matches the agreed policy; history records the request and authoritative update | PASS: Acknowledge from Tab 3 left the notification at `alarm`, retained `silenced: true`, changed the authoritative status to `acknowledged: true`, added `acknowledgedAt`, and recorded `action_requested: acknowledge` at 00:44:58Z. |
| Clear a clearable simulated notification | Clear is offered only when `canClear` is true and the notification moves to normal/removed through Signal K | PASS with `0.1.22` runtime slots on 2026-09-30. A live `alarm` in slot `clear-check` advertised `canClear: true`; direct DELETE while active returned 204 and removed its exact owned Signal K id. The slot registry was empty afterward, with zero audio processes, retries, breakers, or system failures. The earlier normal-then-delete matrix also proved idempotent cleanup: Signal K may remove a normal notification from its manager before DELETE, and the adapter treats only that exact owned-id `not found` result as already cleared. |
| Two simultaneous simulated alarms | Independent audio processes, deterministic priority, independent silence, and unambiguous UI | PASS for audio isolation and independent actions with `0.1.21` on 2026-09-29. Fixed slots A and B were raised as `alarm` without a Signal K restart. Diagnostics captured two simultaneous `aplay` processes for different occurrence ids (PIDs 2425857 and 2425859) on `plughw:2,0`; both completed with exit 0. Slot A accepted Silence and slot B independently accepted Acknowledge, with separate `action_requested` history entries. Both then reached `normal`, both DELETE requests returned 204, and final Diagnostics showed zero active processes, retries, breakers, or audio-system failures. The existing real GNSS `warn` remained separate. |
| Inactive sound branch | A connected `payload.sound.active: false` branch remains visible but suppresses its inherited state sound without changing the Signal K notification | PASS with `0.1.24` on 2026-09-30. A temporary valid runtime deploy added one exact-path rule for `notifications.system.notificationEngine.runtimeTest.inactive-sound`. The isolated `warn` slot resolved to inherited `warn.wav` with `soundConfig.active: false`, remained visible, and never produced an audio result for its occurrence. Processes, retries, breakers, and system failures remained zero. The slot ended through `normal` and exact DELETE; the authenticated registry was empty. The original 192-node flow was restored through a valid runtime deploy with its original file SHA-256 `8efc823ca9a87475fc9e609636419e97ebaeaeb9060d1d96b8153342b8393555` and original rule checksum `a33c3678c006e83cb763e1a76e39530b76a10609350f80bf7d7cfc7308c3e4fb`. The observed replay of the already-active real GNSS warning led to the `0.1.25` finite-playback fix documented below. |
| Unchanged finite sound after reevaluation | A completed `once` or finite `repeat` sound does not replay merely because the same active occurrence is reevaluated by snapshots, deltas, conditions, or an unchanged deploy | PASS with `0.1.25` on 2026-09-30. Startup reconstruction played the existing real GNSS `warn` occurrence once as PID 2537577 from 00:53:05.722Z to 00:53:06.717Z. Across subsequent snapshots and an increase from 10 to 43 received deltas, Diagnostics retained that exact completed result and started no further player. Final state had zero active processes, retries, open breakers, or unresolved audio failures. Lifecycle end, Silence, and an actually changed sound signature remain the intentional reset boundaries. |
| Canonical sound playback count | `payload.sound.count` uses `0` for loop, `1` for once, and `2` through `99` for the exact finite count; the previous mode fields remain readable during migration | PASS with `0.1.26` on 2026-09-30. The user-deployed 192-node embedded flow produced 10 valid rules and seven active sound rules with `count: 0`. The plugin loaded revision `ec3ce1f77236f59b930f84d0b249ff83927245bd42d28e9c0689388bcd922c9a`, and the deployed-rules view retained `count: 0` on every intended loop. Effective live state policies exposed canonical `count` values; the existing GNSS warning remained a finite `count: 1`. No real alarm was raised for this migration check. |
| Exact finite count and inter-play pause | `count: 3` starts exactly three complete players; `pauseSeconds: 2` delays each following start by two seconds after the previous completion; missing/zero remains backward-compatible | PASS with `0.1.28` on 2026-10-01. The isolated exact-path Runtime Slot resolved to `count: 3` and `pauseSeconds: 2`. PIDs 2663871, 2663875, and 2663891 completed successfully. End-to-next-start gaps were 2.067 and 2.003 seconds. Final state had zero processes, retries, open breakers, and unresolved failures. The slot ended through `normal` and DELETE 204, and the authenticated slot registry was empty. |
| Invalid sound pause deploy and runtime recovery | Values outside integer `0` through `5` reject the whole rule set, stop local processing, and a subsequent valid runtime deploy resumes without a Signal K restart | PARTIAL with `0.1.28` on 2026-10-01. `pauseSeconds: 6` produced `Rule warn-9: Sound pauseSeconds must be an integer from 0 to 5`, `configurationStatus: error`, `audio.ready: false`, and zero processes/retries. Restoring the user flow through the runtime API returned configuration/audio to ready with original revision `ec3ce1f...` and file SHA-256 `8f00ebf...`, without restarting Signal K. Defect: recovery replayed the unchanged active GNSS warning once as PID 2664202. |
| Alarm while every Alarm Centre WebApp is closed | Server-side alarm/audio starts without a browser; a later browser reconstructs the active state and can silence it; another later browser sees the shared silence state without restarting audio | PASS: looping `alarm.wav` and the authoritative alarm started while Tab 3 and CF-19 were closed. Tab 3 subsequently reconstructed and silenced it. CF-19 then opened with the same `silenced: true` state and did not restart audio; Clear from CF-19 returned the notification to normal. |
| One operator device loses the network | The disconnected WebApp clearly marks data stale/offline; server audio and a connected device continue; reconnection restores the current occurrence without duplication or replay | PASS with `0.1.12` on 2026-09-28. Tab 3 lost Wi-Fi at 21:02:17 AST; the fixed stale banner appeared and all individual/global actions were disabled at 21:02:19.055. The failed poll completed at 21:02:19.138 with `Failed to fetch`. Wi-Fi returned at 21:02:34; the stale lock remained until an authoritative snapshot succeeded at 21:02:45.936 and cleared at 21:02:46.130. The table then contained the same one warning and eight normal notifications without duplicates. Node-RED configuration, audio watchdog, and history remained healthy with no audio process or retry. Earlier failures through `0.1.8` are retained in the defect notes below. |
| Invalid embedded Node-RED deploy | Invalid rules are rejected; processing must not silently retain stale/default rules; restore returns exactly to the previous valid flow | PARTIAL after `0.1.5` retest on 2026-09-27: an authenticated embedded Node-RED runtime deploy changed `warn` to `invalid-test-state`. The Alarm Centre visibly reported `Notification processing disabled`, retained the existing warning for awareness, and disabled global Silence/Acknowledge actions. Only one validation error was logged over multiple WebApp poll cycles. The original flow was then restored byte-for-byte from backup (SHA-256 `5c537d598645e8cf146b71db7bdb6b7f3fb1cc290128fdc382666040cba6c816`); Signal K restarted healthy with nine rules, enabled actions, and no configuration error. Recovery through a second valid runtime deploy, rather than controlled file restore while stopped plus restart, remains to be demonstrated. |
| Missing ALSA device | Alarm remains visible, audio failure is explicit and bounded, and no false success is reported | PASS with `0.1.14` on 2026-09-28: with temporary device `plughw:99,99`, both the real GNSS warning and isolated E2E alarm remained visible while five technical failures opened independent lifecycle breakers. No parallel `aplay` process or retry storm remained. The original configuration was restored byte-for-byte (SHA-256 `d807723c6d7ac397add0fc760ce656ea23d46c07ec714665ee135b51133aaf7c`); Signal K, `signalk-health.timer`, Node-RED configuration, and `plughw:2,0` recovered healthy. |
| Audio circuit breaker | Five consecutive technical failures for one lifecycle open its local breaker without changing the Signal K alarm; normal retries stop, one probe is allowed after five minutes or once after watchdog recovery, and Diagnostics/history expose the transitions | PASS for the live fault, persistence, lifecycle cleanup, five-minute probe, and recovery path with `0.1.14` on 2026-09-28. Two simultaneous lifecycles opened after their fifth failures. Restart retained and re-associated the still-active GNSS lifecycle while removing the ended E2E lifecycle with `audio_circuit_closed_on_lifecycle_end`. A failed probe reopened the breaker for five minutes. After restoring `plughw:2,0`, exactly one probe started at 21:38:45 AST, exited successfully at 21:38:46, emitted `audio_circuit_recovered`, and left `openCount: 0`, zero processes, and zero retries. The watchdog-triggered early-probe branch is unit-tested; a physical live unavailable-to-ready transition was not induced. |
| Visual audio-system notification | A technical player failure raises one visible visual-only system alarm that cannot recurse or be silenced, acknowledged, or cleared; only successful playback from the same failed occurrence resolves its latch | PASS with `0.1.15` on 2026-09-28. Removing the configured `alarm.wav` for an isolated API-managed alarm raised `notifications.system.notificationEngine.audio` with `method: visual`, `audio: off`, and all three capabilities false. The general alarm sound rule still matched for display but produced no audio process for the system path. The original alarm remained authoritative. After the sound file was restored byte-for-byte, the scheduled probe for the same occurrence succeeded at 22:02:23 AST, returned the system notification to `normal`, cleared its persistent latch, and left no retry. The E2E alarm was then cleared through Signal K and the original configuration and sound hashes were verified. |
| Audible operator self-test | One bounded tone, technical player result, 15-second `Ton nicht gehört` window, persistent seven-day due indication, and audited Signal K user/device/file/result without claiming human hearing | PASS for positive and failure/recovery paths with `0.1.22` on 2026-09-30. With the loudspeaker powered off, Tab 3 technically played `/home/pi/.signalk/sounds/sirene1.wav` through `plughw:2,0` with exit 0; authenticated user `pi` reported `Ton nicht gehört` inside the feedback window. This initially exposed an over-broad recursion guard, fixed in `0.1.22` by giving the private self-test failure a distinct origin. The repeated negative test latched exactly one persistent visual audio-system alarm with no retry or breaker. After restoring loudspeaker power, the next test exited 0, the operator explicitly reported hearing it, and the full feedback window completed as `passed_no_counter_report` (the software deliberately does not claim human hearing). The exact self-test latch cleared to `normal`; final state was zero unresolved failures, processes, retries, and breakers, with healthy history persistence. |
| Audio process diagnostics | Diagnostics identify active and last playback by notification lifecycle and expose file, player, device, PID, start/end, duration, exit code, and signal without changing notification state | PASS with `0.1.18` on 2026-09-29. Startup reconstruction of the existing `notifications.navigation.gnss.headingUnavailable` warning produced one `warn.wav` playback for lifecycle `occurrence-1790650348688-g1tde1snzki`. Diagnostics captured `aplay`, `plughw:2,0`, PID 2290226, exact start/end, 1003 ms, exit code 0, and no signal. It then reported zero active processes and zero pending retries. |
| Legacy audio ownership | No enabled Node-RED/script audio path competes with Notification Engine for ALSA; rollback material remains recoverable | PASS for deployed-state inspection on 2026-09-29. The live embedded Node-RED tab `Audio Alarms` has `disabled: true`; its Anchor and Bilge exec nodes are therefore inactive. `/home/pi/.signalk/anchoralarm/audio-control.sh status` and the Bilge equivalent both reported `stopped`. The legacy tab/scripts were retained rather than deleted. |
| Real Hoeken's drag alarm | Correct `alarm` state, path-specific sound, display, actions, history, and resolution | BLOCKED while the vessel is anchored outside a declared test window |
| Raise and re-drop after ACK | New anchoring lifecycle is not born acknowledged even if Hoeken's reuses an ID | BLOCKED while the current anchor watch is operational |
| Deliberate Android UDP interruption | Timeout, warning, recovery, history, and source-age behaviour are reproducible | BLOCKED while Android GPS is the active anchor-watch position source |
| Restart with an active real alarm | Active alarm is reconstructed without losing status or producing duplicate audio/lifecycles | BLOCKED outside a controlled test window |
| Restart with an active API-managed test alarm | Determine whether the active notification and audio are reconstructed without duplication | INCONCLUSIVE for producer reconstruction: the in-memory test producer did not republish after restart, so the Signal K notification disappeared on both devices and its audio stopped. No duplicate or restarted sound occurred, and the managed services recovered normally. A persistent producer is required for the real reconstruction case. |

## Defects discovered by this matrix

1. A path-specific sound-only rule can suppress the history behaviour expected
   from the matching general visible-state rule. The GPS-loss warning was not
   persisted even though it was visible and audible.
2. Local `occurrenceId` continuity does not survive a plugin/server restart.
   A still-set anchor was recorded as a newly raised local occurrence.
3. Audio success/failure evidence is unreliable because normal `aplay` stderr
   output is currently logged as `Unable to play`; this remains a Prio-1 item.
4. A visible-table rule for a non-critical state currently suppresses its
   configured banner. The simulated warning was orange and visible in the
   table, but its configured banner did not appear.
5. The same rule-resolution problem as in the real GPS-loss warning also
   affects a simulated alarm: the path-specific sound rule wins as a complete
   policy and prevents the general visible alarm rule from supplying inherited
   history behaviour.
6. A read-only browser session can display an alarm and enabled-looking action
   controls even though its write request is unauthorized. The action error
   explains that Signal K sign-in is required only after the click. Action
   availability should communicate authorization before an operator depends
   on it.
7. Restarting Signal K to arm a simulated test notification temporarily removes
   the live Android position from Hoeken's view and can therefore raise a real
   GPS-loss warning while anchor watch is active. Further simulated tests must
   not use a server restart in this operating state; the test injection needs a
   runtime-safe trigger or a separately agreed maintenance window.
   Resolved for simulated tests in `0.1.21`: authenticated bounded runtime slots
   now raise only fixed plugin-owned paths without restarting Signal K. This
   does not unblock real Hoekens/GPS producer tests.
8. A second, unmanaged Signal K process had remained alive since 2026-09-22
   under PID 3283051. It did not own port 3000, but its embedded runtime kept
   respawning `1bells.wav`, so killing only the `aplay` child could not stop the
   sound. The orphan process and its parent were terminated on 2026-09-26;
   the managed `signalk.service`, port 3000, and health timer remained healthy.
9. The deployed general alarm rule says `display: banner`, while the clean live
   alarm test produced an overlay on both devices. The effective presentation
   does not therefore match the documented builder output.
10. Acknowledging an emergency removes its overlay even though the emergency
    remains active and its non-silenceable siren continues. The table retains
    the notification, but whether removing the highest-severity overlay on ACK
    is acceptable needs an explicit safety decision.
11. Clear and automatic expiry return test notifications authoritatively to
    `normal`, but no final normal event is retained when the new state has no
    history-enabled display rule. The local occurrence timeline is therefore
    incomplete even where the raised event was retained.
12. An invalid runtime Node-RED deploy is rejected, but the running engine
    retains the previous rules instead of entering the required explicit
    configuration-failed state. Polling then revalidates the same bad flow and
    logs the same error repeatedly. Invalid configuration therefore needs a
    latched visible health state, stopped notification processing, and bounded
    revalidation triggered by a new deploy rather than every WebApp poll.
13. A disconnected WebApp leaves the last rendered alarm state unchanged and
    provides no visible offline age or stale-data warning. Reconnection works
    without duplication, but operators cannot distinguish a current display
    from a frozen one while connectivity is lost. The attempted repair still
    failed live on 2026-09-27 because polling has no explicit request timeout;
    a request to the unreachable private host can remain pending instead of
    entering the existing error handler.
14. The controlled network-loss test alarm was visible and audible but left no
    matching event in the local JSON history. Its general alarm rule and the
    startup/restart timing must be traced before history completeness can be
    claimed for test-produced alarms.

Local repairs cover defects 1, 3, 5, 11, 12, and 13: policies inherit
properties from general to specific rules, recorded occurrences retain their
final normal transition, audio errors use exit status with bounded exponential
retry, invalid configuration enters a visible fail-closed latch, and a failed
WebApp poll is intended to mark the view stale while disabling actions. The
history inheritance and final-normal repair is confirmed live, but the
client-disconnect repair failed its controlled rerun and needs an explicit
request timeout before it can be accepted.

The repaired `0.1.5` package was deployed on 2026-09-26 with a recoverable
backup of the prior installation. The post-restart baseline passed: Signal K
and its health timer were active with zero service restarts, the plugin API
reported `configurationStatus: ready` and nine rules, Android UDP supplied a
current position, Hoeken's remained `on` with a `normal` notification, and no
audio process remained. Fault-injection and client-disconnect retests are still
required before changing the affected matrix rows to PASS.

## Display-filter change during the run

After the audible tests, the operator removed the `nominal` and `normal`
display rules so the active table is intended to show only `warn` and above.
The deployed rule set then contained nine rules for `warn`, `alert`, `alarm`,
and `emergency`, with no `nominal` or `normal` rule. The configuration API's
`stateOrder` still contained `nominal` and `normal`; this is recorded as a
configuration-consistency question rather than silently changing a separate
global setting. Table visibility is governed by the deployed display rules.

These defects must be corrected and the affected cases rerun before Prio 2 can
be marked complete.
