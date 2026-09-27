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
| History for the GPS-loss warning | The warning and its subsequent resolution appear in the same local occurrence timeline | No `warn` event for the anchor path exists in the persisted engine history. Only later `normal` updates were found. The path-specific warn rule supplies sound but no explicit history action, and currently prevents the general visible warn rule from supplying the expected history default. | FAIL |
| Android UDP GPS returns | Position becomes non-null, Hoeken's returns to `normal`, loop audio stops, and the occurrence records resolution | Position recovered from `android_udp.gps`; Hoeken's returned to `normal`; the audio process ended at 23:02:47Z. The same pre-restart occurrence ID remained active until the later service restart. | PASS for state/audio; FAIL for complete history |
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
| Clear a clearable simulated notification | Clear is offered only when `canClear` is true and the notification moves to normal/removed through Signal K | PENDING |
| Two simultaneous simulated alarms | Independent audio processes, deterministic priority, independent silence, and unambiguous UI | PARTIAL: the real GNSS `warn` remained separately visible while simulated anchor/general `alarm` overlays and audio were active, so cross-severity display priority is demonstrated. Two independently audible simulated occurrences and independent Silence remain untested because the current one-shot injector supports only one test notification and requires a server restart, which removes the previous in-memory test producer. |
| Alarm while every Alarm Centre WebApp is closed | Server-side alarm/audio starts without a browser; a later browser reconstructs the active state and can silence it; another later browser sees the shared silence state without restarting audio | PASS: looping `alarm.wav` and the authoritative alarm started while Tab 3 and CF-19 were closed. Tab 3 subsequently reconstructed and silenced it. CF-19 then opened with the same `silenced: true` state and did not restart audio; Clear from CF-19 returned the notification to normal. |
| One operator device loses the network | The disconnected WebApp clearly marks data stale/offline; server audio and a connected device continue; reconnection restores the current occurrence without duplication or replay | PARTIAL: CF-19 and Pi audio continued normally, but disconnected Tab 3 retained the last alarm display without any offline or stale indication. After Wi-Fi returned, Tab 3 reconnected automatically, retained the same single alarm, did not replay audio, and successfully issued Silence. The test later returned to normal on its configured timeout. |
| Invalid embedded Node-RED deploy | Invalid rules are rejected; processing must not silently retain stale/default rules; restore returns exactly to the previous valid flow | FAIL: deploying `invalid-test-state` was correctly rejected with the allowed-state list, but the engine stayed active on the previous rule revision and retried validation on every WebApp poll, producing repeated log errors. Restoring `alert` yielded a flow byte-for-byte identical to the pre-test backup (SHA-256 `5c537d598645e8cf146b71db7bdb6b7f3fb1cc290128fdc382666040cba6c816`), nine valid rules, no further validation errors, and healthy managed services. |
| Missing ALSA device | Alarm remains visible, audio failure is explicit and bounded, and no false success is reported | FAIL: with temporary device `plughw:99,99`, the operator confirmed the alarm remained visible and ALSA failures were explicit. The looping policy immediately respawned failed `aplay` attempts and flooded the journal instead of applying a bounded retry/backoff. The saved `plughw:2,0` configuration was restored immediately; no audio process remained and both managed services recovered. |
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
    from a frozen one while connectivity is lost.

Local repairs now cover defects 1, 3, 5, 11, 12, and 13: policies inherit
properties from general to specific rules, recorded occurrences retain their
final normal transition, audio errors use exit status with bounded exponential
retry, invalid configuration enters a visible fail-closed latch, and a failed
WebApp poll marks the view stale while disabling actions. These entries remain
open until the repaired package is deployed and the affected live cases are
rerun.

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
