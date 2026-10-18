# TODO

## Prioritized open work

This list is the authoritative execution order for the remaining work. Detailed
evidence and older completed work remain below for traceability.

### P0 — Complete before release preparation

1. [x] Accept the deployed structured Diagnostics view on Tab 3. Verify the
   Overview and Browser, Server/Node-RED, Critical Inputs, Audio, External
   Tasks, History, and Localization sections, then confirm that Advanced still
   exposes the unmodified raw diagnostics. Accepted by the operator on
   2026-10-10; the structured view looks correct on Tab 3.
2. [x] Verify the Rule Builder History branch with bounded synthetic
   notifications: connected `history: true`, explicit `history: false`, and
   the `visibleInTable` default. Confirm that alarm and emergency use the same
   resolution rules and are not hard-coded retention exceptions. Run this
   first, using dedicated test paths with sound explicitly disabled; do not
   touch real Hoekens, GPS, or bilge producers. Paused on 2026-10-10 before a
   valid deploy: the first import was rejected because its Node-RED 4 node
   definitions omitted required editor defaults. The corrected local fixture
   is `node-red/history-live-test.json`. No test notification was raised. The
   Pi flow was restored byte-for-byte to the pre-test SHA-256
   `5dd406112b94abe6f842382a5a4cdbf25e738dc3ef5b403ab0487cad16b5a004`;
   configuration remained ready and audio remained idle. Resume by importing
   the corrected fixture, checking for invalid nodes, and only then deploying.
   The resumed live test on 2026-10-11 proved the initial decisions: visible
   default `warn` and hidden `history: true` alert were recorded, while
   `history: false` suppressed the active alarm and emergency events. It also
   exposed isolated final `normal` entries after those state-specific rules no
   longer matched. The agreed correction is occurrence-scoped history: resolve
   once at the start of the local occurrence, retain the decision through its
   terminal transition and across exact restart correlation. Version 0.1.71
   implemented and unit-tested that correction. The clean 2026-10-11 live
   retest used four new `hist2-*` paths: the visible default `warn` and hidden
   explicit `history: true` alert each retained both `raised` and final
   `updated/normal` under one occurrence ID; explicit `history: false`
   suppressed the complete alarm and emergency occurrences, including their
   final `normal`. All rules had `sound.active: false`; no test audio ran. The
   temporary block was removed, and the productive flow returned byte-for-byte
   to SHA-256
   `5dd406112b94abe6f842382a5a4cdbf25e738dc3ef5b403ab0487cad16b5a004`
   with ready revision
   `ec3ce1f77236f59b930f84d0b249ff83927245bd42d28e9c0689388bcd922c9a`.
3. [x] Verify the three agreed presentation rules against the current code and
   add focused tests before the broader regression: `banner` is the fixed
   in-centre strip, ACK calms an active emergency overlay without stopping its
   audio, and missing browser write authorization leaves applicable actions
   visible but disabled with a clear explanation. Version 0.1.73 is deployed:
   the operator confirmed the real GNSS `warn` as an in-centre banner while it
   remained in the table, without an overlay, and confirmed that Acknowledge
   was available in the authenticated Tab 3 session. Focused tests prove that
   acknowledging an emergency removes its overlay without stopping or
   restarting audio. Separate action-availability tests distinguish Signal K
   source denial from missing browser write permission and retain an otherwise
   applicable action as visible but disabled. The non-mutating live readwrite
   probe returned 401 without credentials; the authorized Tab 3 action was
   enabled. All 238 tests passed.
4. [x] Run one bounded current-version regression for synthetic `warn`,
   `alarm`, `emergency`, and a Hoekens-compatible path. Verify table display,
   complete raised/update/action/final-normal history, Signal K-permitted
   actions, and audio. Audible cases require a confirmed safe acoustic window.
   Passed with deployed `0.1.73` on 2026-10-11/12 in an explicitly confirmed
   acoustic window. The operator confirmed expected visual and audible output
   for all four cases. `warn` recorded Acknowledge and final `normal`; `alarm`
   recorded Silence, Acknowledge, their authoritative status updates and final
   `normal`; `emergency` exposed no Silence, Acknowledge removed only the
   overlay while its siren continued, and the permitted German
   `Zurücksetzen` action stopped presentation and audio. A temporary exact-path
   rule applied the Hoekens `2bells.wav` loop semantics only to the isolated
   `runtimeTest.release-anchor` slot; Silence, Acknowledge and final `normal`
   all remained in one occurrence. The real anchor notification stayed
   `normal`. After removal, the productive flow returned byte-for-byte to
   SHA-256
   `5dd406112b94abe6f842382a5a4cdbf25e738dc3ef5b403ab0487cad16b5a004`
   and revision
   `ec3ce1f77236f59b930f84d0b249ff83927245bd42d28e9c0689388bcd922c9a`.
   The temporary access client and token file were removed; one approved
   Signal K restart reloaded security and ended with zero test slots, audio
   processes, retries, breakers or unresolved failures.
5. [x] Decide the three remaining presentation rules before changing code:
   Builder `display: banner` versus the rendered overlay, overlay behaviour for
   an acknowledged active emergency, and the explanation shown to a read-only
   browser when write authorization is unavailable. Decision on 2026-10-10:
   `banner` is a fixed strip inside the Notification Centre. Acknowledging an
   active emergency removes/calms the attention overlay but neither changes
   the Signal K state nor stops its independent audio. A readable but
   unauthorized action remains visible and disabled with a clear permission
   explanation.
6. [x] Replace the development prototype with a safe, importable Node-RED
   reference flow for publication, delivered as a separate tab named
   `Notification Engine - Release Flow` so importing it does not replace the
   operator's existing production tab. It must include one node for every
   supported Rule Builder option. Every node's Info/description must state its
   purpose, accepted value or range, a concrete example, and any important
   interaction or safety boundary. The flow-level description must explain the graphical
   message-flow concept and prominently state that an uninterrupted wire from
   the notification/state source through the selected option nodes to a node
   named exactly `Activate` is required for any effect. Importing the reference
   flow must not silently enable any rule, sound, or external-task action:
   display one clearly marked minimal Quick Start and otherwise disconnected,
   copyable examples, but leave every final wire to `Activate` disconnected by
   default. Include examples for general state defaults, path-specific
   overrides, conditions, table/banner/overlay presentation, history true and
   false, sound active/file/count/pause, ignore, and exact-path external task
   delivery. Keep protected authorization such as external-task grants in
   Plugin Config, not in the flow. Completed in `0.1.74`: the 45-object
   `Notification Engine - Release Flow` tab groups Instructions, Quick Start,
   Notification States, Match Scope, Display and History, Sound, and Control
   and External Delivery. Every instructional node has English Info text, and
   every final wire to `Activate` is disconnected. Automated extraction
   returns zero rules as shipped; connecting only the Quick Start final wire
   produces exactly one table-visible `alert` rule. The operator imported and
   deployed the complete inactive tab beside the existing production flow.
   Live configuration remained ready with the same ten rules and revision,
   zero release-flow rule references, zero runtime test notifications, and no
   audio process, retry, breaker, or unresolved failure.
7. [x] Verify and document multiple `Activate` endpoints. Multiple nodes named
   exactly `Activate` are supported when each terminates a deliberate complete
   branch. Add extractor coverage for separate endpoints and fan-out to more
   than one endpoint. Reject or otherwise make deterministic any parallel
   same-scope branches that assign conflicting values to the same action; do
   not publish a reference flow whose result depends on Node-RED array order.
   Completed in `0.1.76`: focused extractor tests cover independent endpoints,
   duplicate fan-out, recursive merging of complementary nested sound fields,
   reversed conflict order, and conflicting legacy/canonical sound aliases.
   Conflicts now fail closed with the exact action path instead of allowing
   serialized Node-RED order to choose a value. The deployed implementation
   accepted the live 240-node embedded flow as the same ten production rules
   and unchanged revision; Node-RED configuration and runtime deploy events
   remained ready after restart.
8. [x] Replace global Node-RED scanning and the legacy `Notification Engine
   config` inject node with one explicitly selected Rule Builder tab. Complete
   the migration in this order:

   1. [x] Add a Plugin Config selector that lists only active tabs from the
      embedded Signal K Node-RED instance by name, stores the stable tab ID,
      and shows the selected ID read-only. Completed and accepted live in
      `0.1.79`: the selector listed nine active embedded tabs and excluded the
      disabled `Audio Alarms` tab. The operator selected `Notification Engine
      Rule Builder`; Plugin Config persisted the single value
      `ruleBuilderFlow.id: tab-adjective-mapping` and displayed that ID in its
      own read-only field. Runtime configuration remained ready with the same
      ten rules and unchanged revision.
   2. [x] Restrict configuration and rule extraction to the selected tab ID.
      Fail closed when the selection is missing, absent, or later disabled;
      never fall back to a tab label and never scan other tabs for rules.
      Completed and proved live in `0.1.80` on 2026-10-12: the runtime used
      only persisted `ruleBuilderFlow.id: tab-adjective-mapping`, retained ten
      deployed rules, and reported configuration `ready` after restart. The
      selected active tab owned 50 nodes; source and installed runtime hashes
      matched. Unit tests cover missing, unknown, disabled, and same-label
      alternatives without backup or label fallback.
   3. [x] Remove configurable `stateOrder` and `visibleStates`. Use the fixed
      Signal K descending severity order `emergency`, `alarm`, `warn`,
      `alert`, `normal`, `nominal`, while keeping unknown states visible.
      Completed and proved live in `0.1.81` on 2026-10-12: obsolete values are
      discarded at both Node-RED validation and runtime adoption boundaries;
      the server and WebApp share the fixed order, and unknown state strings
      sort after known states without being filtered. After restart the live
      API reported the exact fixed order, configuration `ready`, ten rules,
      fresh Android GPS diagnostics, and ready idle audio. All 260 tests passed.
   4. [x] Pass all Rule Builder treatment fields through to their runtime
      consumers and test them: display, color/hex, flash, visibility, history,
      sound, ignore, and execute. Keep `acknowledgeRequired` as a display hint
      only; Signal K remains authoritative for action permission.
      Implementation deployed as `0.1.82` on 2026-10-12 with 265 passing
      tests. The live GNSS warning proved the selected `warn-6` branch reaches
      the API with `visible: true`, `history: true`, `color: orange`,
      `hex: #f57c00`, and its resolved sound configuration. The served WebApp
      uses cache version `0.1.82`; configuration remained ready with ten rules,
      fresh Android GPS, and ready idle audio. Previous bounded acceptance
      tests cover History, Ignore, Sound, and Execute. Still required before
      checking this item: one bounded visual runtime test proving rule-derived
      `display` and `flash` in the browser. Current production alarm/emergency
      branches also request looping sound, so do not trigger them without an
      explicitly approved acoustic test window or a temporary visual-only
      test branch.
      The first bounded visual test resolved `display: overlay` and
      `flash: true` correctly on the server but exposed a WebApp defect: the
      browser suppressed the overlay when the test producer omitted
      `method: visual`. The `0.1.83` fix and regression test remove that
      unrelated producer-method gate. Completed live on 2026-10-12: after a
      forced Tab 3 reload from stale WebApp `0.1.73` to `0.1.83`, the bounded
      visual-only `alert` displayed a yellow flashing overlay while the server
      reported `soundConfig.active: false`, `audioActionable: false`, and zero
      active or pending audio work. The operator confirmed the overlay and
      flash. The runtime test was cleared, all six temporary Node-RED 4 test
      nodes were removed and deployed, and the selected production tab
      returned to exactly ten rules with no temporary rule, configuration
      `ready`, revision `a1b66deefcb34cd50e93aa2068a751c770b4796c036d784c164aa08c3c2b14dc`,
      fresh Android GPS, and idle audio. All 266 tests, syntax checks, package
      dry run, and diff checks passed before deployment.
   5. [x] Keep host, maintenance, persistence, browser, and exact external-task
      authorization settings in Plugin Config. Remove obsolete classification,
      history-state, and Node-RED test-notification configuration copies.
      Completed and proved live in `0.1.84` on 2026-10-13. Runtime composition
      accepts only the temporary allowlist of legacy presentation, sound, and
      history treatment fields; contradictory Node-RED host, maintenance,
      persistence, browser, diagnostics, and external-task settings cannot
      override Signal K Plugin Config. Obsolete `classificationRules`,
      `historyStates`, `stateOrder`, `visibleStates`, `testNotif`, and browser
      shortcut copies are excluded from the effective configuration and
      checksum without mutating the live flow. After the protected deployment,
      configuration was `ready`, the deploy event interface was available,
      WebApp values remained `infoAutoCloseSeconds: 0`, `shortcutInfo: i`, and
      `shortcutHistory: h`, the fixed state order remained intact, and the
      exact ten production rule IDs were preserved with no temporary rule.
      Android GPS was fresh and audio was ready with zero active or pending
      work. All 268 tests, syntax checks, package dry run, and diff checks
      passed; installed `0.1.83` is retained as the rollback backup.
   6. [x] Migrate the current installation to tab ID
      `tab-adjective-mapping` and demonstrate source, deployed-rule, runtime,
      and WebApp parity while the legacy config node is still present. Only
      after that proof may the old config node be removed and deployed.
      Completed live in `0.1.85` on 2026-10-13. With the single legacy node
      still present, the selected tab remained `ready` with the same ten rule
      IDs, Plugin Config browser values, fixed state order, fresh Android GPS,
      and idle audio. A byte-identical pre-removal flow backup was saved as
      `/home/pi/.signalk/red/flows_openplotter.before-remove-notification-engine-config-0.1.85.json`.
      The operator then removed only `Notification Engine config` and deployed
      without restarting Signal K. Live inspection proved zero remaining
      legacy nodes, configuration `ready`, runtime deploy events available,
      the exact same ten production rule IDs, no temporary rule, fresh GPS,
      and ready audio with zero active or pending work. The expected effective
      checksum is now
      `34649048570fc10c56b951586d11a1ec9ff149e65410a22cfcafe623417d28d2`.
      Source and installed hashes matched for package metadata, both runtime
      boundary modules, and the WebApp entry files; the served page reported
      `0.1.85`. All 269 tests, syntax checks, package dry run, and diff checks
      passed before deployment. Installed `0.1.84` remains the rollback
      package backup.
   7. [x] Update the release flow and documentation so a new user selects the
      intended active flow directly and does not import or depend on a hidden
      configuration node or file.
      Completed and proved live in `0.1.86` on 2026-10-13. The packaged Release
      Flow and prototype each contain zero `Notification Engine config` nodes.
      The Release Flow tab documentation tells the operator to keep the
      imported tab active, select it by display name in Signal K Plugin Config,
      and verify the read-only stable ID; it explicitly states that no config
      inject node or hidden configuration file is required. An automated
      reference-flow test enforces those requirements. After deployment, the
      config-node-free productive flow remained `ready` with the unchanged
      checksum
      `34649048570fc10c56b951586d11a1ec9ff149e65410a22cfcafe623417d28d2`,
      all ten production rule IDs, no temporary rule, fresh Android GPS, and
      ready idle audio. The served WebApp reported `0.1.86`; all 270 tests,
      syntax checks, package dry run, and diff checks passed. Installed
      `0.1.85` remains the rollback package backup.
9. [x] Rewrite the README as a short user entry point: purpose, requirements,
   installation, five-minute Quick Start, Signal K authority/safety boundary,
   and links to detailed documentation. Move the complete setup and operation
   material to `docs/user-guide.md`, including Plugin Config, importing and
   wiring the reference flow, the node catalog, deployed-rule verification,
   Notification Centre actions, audio tests, history, external tasks,
   Diagnostics, upgrades, troubleshooting, and rollback. Keep developer and
   architecture detail in their existing dedicated documents.
   Completed and proved live in `0.1.88` on 2026-10-13. The README is now a
   73-line entry point and the complete operator material is in the packaged
   `docs/user-guide.md`. The Quick Start preserves fail-closed startup by
   requiring one deliberately connected and deployed branch before the plugin
   is enabled and its active stable Rule Builder tab is selected. All 270
   tests, syntax checks, package dry run, link checks, and diff checks passed.
   The installed and served WebApp reports `0.1.88`; live configuration is
   `ready` with the unchanged productive rule checksum, runtime deploy events
   available, fresh Android GPS, and ready idle audio. Installed `0.1.87`
   remains the rollback package backup. The same live validation also proved
   the new automatic `notifications.environment.*` category as `ENVIRONMENT`,
   displayed as `UMWELT` for both bilge notifications on Tab 3.
10. [x] Reconcile the current safety matrix and release documentation with the
   results above. Do not describe the real-producer gaps below as passed.
   Completed on 2026-10-13 for installed `0.1.88`. The current audit now uses
   the 270-test/package baseline, selected-tab/config-node-free runtime,
   accepted external-task delivery, complete current History/severity
   regressions, physical bilge evidence, and live `ENVIRONMENT` classification.
   Older PARTIAL/FAIL tables are explicitly historical rather than current
   verdicts. Active Hoekens restart continuity and deliberate Android UDP loss
   remain open release decisions; neither is described as passed.

### P1 — Explicit release-risk decisions

1. [x] Decide whether active Hoekens alarm continuity across a full Signal K
   restart is a release blocker or a documented upstream limitation. If it is
   a blocker, fix/retest it in a new safe anchor window; otherwise record the
   accepted limitation precisely.
   Accepted on 2026-10-13 as a documented upstream limitation and not a first-
   release blocker. In the controlled real-alarm restart test, the continuing
   drag alarm returned visually and audibly with exactly one audio process and
   later returned to normal cleanly. Hoekens republished it with a new producer
   ID, so Notification Engine correctly treated it as a new occurrence and
   could not preserve one continuous local History timeline. The engine must
   not correlate unequal authoritative notifications heuristically. Informing
   the Hoekens maintainer remains a separate open action below.
2. [ ] Inform the Hoekens maintainer about the producer-ID change observed for
   one continuing drag alarm across a Signal K restart.
3. [x] Perform the real Android GPS loss/recovery test in a separate safe
   window, or explicitly accept it as an outstanding release limitation.
   Accepted on 2026-10-13 as a documented non-blocking limitation for the
   first release. A deliberate `android_udp.gps` interruption was not run on
   `0.1.88` because the live pre-check found
   `navigation.anchor.state: on`; disrupting the vessel's active position
   source would have intentionally triggered the real anchor safety path.
   Earlier real loss/recovery runs proved the Hoekens warning, audio stop, and
   final-normal History path after the relevant fixes, while current `0.1.88`
   Diagnostics prove fresh `android_udp.gps` source-age monitoring. This is
   supporting evidence, not a claim that the deliberate current-version fault
   injection passed.
4. [x] Perform the real bilge-producer test using an approved safe input method.
   The operator physically triggered the starboard bilge input on 2026-10-11
   and confirmed the expected visual and audible alarm behaviour. Persisted
   History independently records
   `notifications.environment.bilgeWater.stbd` from `engineroomStbd.XX` as
   `alarm` with message `Bilge water detected in starboard engine room` at
   12:39:16 UTC and its return to `normal`/`Watching` at 12:39:21 UTC under the
   same occurrence ID `occurrence-1791677618190-pr539q0jyud`. The current live
   projection is normal and audio diagnostics are idle and healthy.
5. [ ] Report the Signal K 2.33.0 stale `acknowledgedAt` inconsistency upstream;
   keep the raw authoritative fields unchanged locally.

### P2 — Publication infrastructure

1. [x] Create the GitHub repository under user `haipule`, add the remote, push
   the reviewed baseline, and require a successful independent CI run.
   Completed on 2026-10-14: the public repository is
   `https://github.com/haipule/signalk-notification-engine`, `origin` tracks its
   `master` branch, and push CI run `38656664535` passed syntax checks, the
   complete test suite, and `npm pack --dry-run` independently on Node.js 20,
   22, and 24 for release-candidate commit `4355eb4`.
2. [x] Create the first release tag and publication artifact only after P0 is
   complete and every P1 item is either passed or explicitly accepted and
   documented. GitHub release `v0.1.89` contains the reviewed artifact; npm
   publication is still outstanding.
3. [ ] Immediately before the first npm upload, reconcile the complete release
   state: choose the one version to publish, update package/WebApp/docs and the
   Pi to that version, rerun all checks and live health verification, create a
   matching commit/tag/GitHub release artifact, verify its SHA-256, and publish
   that exact artifact to npm. The local and Pi development line is `0.1.90`;
   do not upload the older `0.1.89` artifact or create another public release
   until this final synchronization has been completed deliberately.

### P3 — After the first release

- [ ] Implement the three robustness improvements identified by the
  notification-plugin comparison in this exact order. The supporting analysis,
  comparison references, and rejected scope expansions are documented in
  `docs/notification-plugin-comparison.md`.

  1. [x] **Serialize and time-box server-side notification snapshot
     reconciliation.** `SnapshotService` must permit at most one active
     `sync()` operation. If a polling interval expires while one is active,
     remember at most one pending refresh and run it after the active operation
     settles; do not build an unbounded queue. Add an AbortController-backed,
     Raspberry-Pi-tolerant deadline to the loopback Notification API request.
     Delta ingestion must remain independent and must not wait for a snapshot.
     Diagnostics must distinguish completed, failed, timed-out, coalesced and
     pending refreshes and expose maximum observed concurrency. Unit tests must
     prove that a slow request cannot overlap another request, exactly one
     pending refresh follows it, stop prevents later callbacks, and a later
     successful snapshot clears only the current technical error. This change
     must not infer a notification lifecycle transition, remove a non-normal
     notification, or relax manager-membership checks.
     Completed and deployed as `0.1.91` on 2026-10-18. Snapshot reconciliation
     now permits one active request and one coalesced follow-up, applies a
     fifteen-second AbortController deadline, leaves the previous store intact
     after a timeout, and keeps delta ingestion independent. Stop invalidates
     late results and callbacks. Diagnostics exposes active/pending state,
     success/failure/timeout/coalescing counters, maximum concurrency and
     last-success timing. The complete 282-test suite covers slow overlap,
     exactly one follow-up, stop, timeout retention and later recovery. Live
     after restart: four successful snapshots, maximum concurrency `1`, no
     active/pending request or errors, ready configuration, fresh Android GPS,
     healthy idle audio and 500 retained History events. No productive timeout
     was induced.

  2. [ ] **Add persistent, aggregated External Task diagnostics without
     retries.** Keep the existing exact per-file authorization, shell-free
     spawn, empty argument list, global concurrency bound, timeout, output
     limit, process-group termination and at-most-once key. Persist a bounded
     observational summary with per-executable and total counters for
     `accepted`, `denied`, `start_failed`, successful completion, non-zero
     completion and `timed_out`; include `lastSuccessAt`, `lastFailureAt`,
     `consecutiveFailures`, an `unresolvedSince` value and only the last N
     bounded results needed for diagnosis. Use atomic mode-`0600` storage,
     schema versioning, corruption/failure diagnostics and explicit retention
     limits. Never retry an arbitrary executable automatically, never create a
     second alarm lifecycle, never acknowledge/silence/clear/normalize the
     originating notification, and never persist unbounded output or secrets.
     Clarify how a later success for the same exact executable resolves its
     observational failure state without deleting the audit trail. Add
     restart, truncation, redaction, malformed-file, mixed-result and
     persistence-failure tests, and show the aggregated state in the existing
     External Tasks Diagnostics section.

  3. [ ] **Specify flood/backpressure semantics first, then implement a
     bounded notification-ingestion queue.** Before code changes, record the
     agreed identity key, ordering guarantees, capacity, overload policy and
     safe coalescing signature in `docs/architecture.md` and
     `docs/testing.md`. Use the bounded/coalescing queue in
     `signalk-alert-center` only as a design reference; do not copy its alert
     lifecycle or code. Coalescing is permitted only for still-pending updates
     that are semantically equivalent for lifecycle and side effects. At a
     minimum, differences in path/ID/source, state, message, method, status
     capabilities and acknowledgement/silence values, producer data relevant
     to occurrence identity, or explicit `null` removal must preserve ordered
     transitions. A sequence such as `alarm -> normal -> alarm` must never
     collapse to one update. Expose queue depth, capacity, received,
     processed, coalesced, rejected and high-water-mark counters. Define a
     fail-safe overload response that remains visible in Diagnostics and logs
     but does not clear, hide, acknowledge, silence or normalize a Signal K
     notification. Add deterministic burst/stress tests covering mixed paths,
     duplicate snapshots, out-of-order deltas, terminal transitions, action
     capability changes, History admission, audio signatures, external-task
     at-most-once behaviour and restart/stop cleanup. Do not implement this
     item until the specification and loss-safety tests have been reviewed.

- Evaluate ntfy/Gotify, alternative UI themes, history export, update-safe
  Node-RED examples, system-wide desktop/kiosk alerts, additional audio
  backends, and SQLite only as separate post-release work. Browser audio is not
  a current safety channel and the Notification Centre remains display- and
  Signal-K-action-oriented; administrative test triggers stay in Plugin Config.
- [x] Remove the false disconnected-banner flash during Tab 3 pull-to-refresh.
  Full-frame Android recordings identified the final cause: authoritative
  polling waited for slow localization startup, allowing the freshness timer
  to expire before the first notification request existed. Version `0.1.64`
  starts Signal K polling independently of localization. The operator repeated
  the gesture successfully, and a 39.966-second control recording contained no
  red banner frame. A real failed refresh still locks actions after the
  unchanged fifteen-second freshness boundary.
- [x] Upgrade the live Signal K baseline from `2.32.0` to `2.33.0` before
  continuing restart-correlation diagnosis. The 2026-10-07 update retained
  HTTP/WebApp availability, embedded Node-RED revision and readiness, fresh
  `android_udp.gps`, the seven-day Alarm Sound Test interval, healthy ALSA
  diagnostics, and an inactive external `nodered.service`. The expected new
  GNSS producer ID replayed the finite warning once. Rollback data is stored at
  `/home/pi/.signalk/server-backups/signalk-server-2.32.0-before-2.33.0-20261008T012221Z`.
- [x] Verify Signal K `2.33.0` notification escalation semantics before
  deploying Notification Engine `0.1.50`: after acknowledge/silence at a lower
  level, a transition to a higher severity must reset those status fields; a
  de-escalation must not be misreported as the same reset rule. Confirm the
  Notification Engine keeps one authoritative lifecycle, visibly reflects the
  new status, and plays the higher-severity policy. Two isolated runtime slots
  passed on 2026-10-07: `acknowledged: true` and `silenced: true` each reset to
  false on `warn` to `alarm`, Signal K ID and local occurrence stayed stable,
  the alarm policy/loop started, and the operator confirmed both warn and alarm
  sounds audible. Both loops were silenced and both owned slots cleared.
- [ ] Report the Signal K `2.33.0` Notification API inconsistency upstream:
  `notifications.update()` resets `acknowledged` on a state change but leaves
  the old `acknowledgedAt` timestamp. Keep the raw external status visible for
  diagnosis; do not let Notification Engine reinterpret or repair Signal K's
  authoritative fields locally.

## Arbeitsstand zum Feierabend – 2026-09-28

- [x] Source-Reparatur live abgenommen: Der aktuelle Snapshot und zwei neue
  History-Lebenszyklen für
  `notifications.propulsion.stbdEngine.exhaustTemperature` verwenden
  durchgehend `engineroomStbd.XX`; kein neues `Unknown source` und kein neues
  Überschreiben durch `self.notificationhandler`.
- [x] Version `0.1.10` auf dem Pi installiert: Die Notification-Spalte wird
  innerhalb der maßgeblichen Zustandsreihenfolge segmentweise nach dem
  punktgetrennten Signal-K-Pfad sortiert, sodass gemeinsame Pfadpräfixe als
  Gruppen zusammenbleiben.
- [x] Version `0.1.11` auf dem Pi installiert: Read-only Diagnostics-API und
  WebApp-Fenster erfassen Client-Poll, Server-Snapshot, Deltas, Node-RED-Status,
  Audio-Prozesse/-Ergebnis und History-Schreibstatus. Damit ist die notwendige
  Instrumentierung für den späteren Stale-/Reconnect-Test vorhanden.
- [x] Tab-3-Stale-/Reconnect-Test am 2026-09-28 bestanden. Nach vollständigem
  Reload und einem kontrollierten WLAN-Ausfall erschien die feste
  Offline-/Stale-Warnung rund zwei Sekunden nach der tatsächlichen Trennung;
  Einzel- und Globalaktionen waren gesperrt. Der fehlgeschlagene Poll meldete
  `Failed to fetch`. Nach dem Wiedereinschalten blieb die Ansicht stale, bis
  ein autoritativer Snapshot erfolgreich war, und synchronisierte danach ohne
  Doppelmeldungen. Vor dem Test wurde der unerwartet auf `0.1.6`
  zurückgefallene Pi-Stand mit Sicherung erneut auf `0.1.12` gebracht.
- [x] Version `0.1.12` auf dem Pi installiert: Passiver Audio-Watchdog prüft
  `aplay` und das konfigurierte ALSA-Playback-PCM beim Start und minütlich,
  ohne das Gerät zu öffnen oder einen Ton abzuspielen. Live: Watchdog `ready`,
  `/usr/bin/aplay`, `plughw:2,0`, PCM `02-00` playback-fähig, keine aktiven
  Audioprozesse und keine wartenden Retries. Die Prüfung bestätigt ausdrücklich
  nicht Verstärker, Lautsprecher, Lautstärke oder tatsächliche Hörbarkeit.
- [x] Abschlusszustand auf dem Pi: Signal K und `signalk-health.timer` aktiv,
  separater `nodered.service` inaktiv, Node-RED-Konfiguration `ready`, letzter
  beobachteter Snapshot 227 ms, Load Average `1.22 / 1.26 / 1.37`.
- [x] Version `0.1.14`: Die am 2026-09-28 verbindlich abgestimmte
  Circuit-Breaker-Regel ist implementiert und auf dem Pi live geprüft. Der
  Breaker wird pro Notification-Lifecycle nach fünf
  aufeinanderfolgenden technischen Wiedergabefehlern geöffnet. Der sichtbare
  Signal-K-Alarm und seine erlaubten Aktionen bleiben unverändert. Im offenen
  Zustand ist höchstens ein Probeversuch alle fünf Minuten erlaubt; zusätzlich
  darf ein Watchdog-Übergang von `unavailable` zu `ready` genau einen
  vorgezogenen Probeversuch auslösen. Global darf nur ein Probeprozess zur Zeit
  laufen. Ein erfolgreicher Player-Exit schließt den Breaker und setzt den
  Fehlerzähler zurück; ein fehlgeschlagener Probeversuch öffnet ihn erneut für
  fünf Minuten. Silence erzeugt weder Fehler noch Probes, Acknowledge verändert
  den Breaker nicht eigenständig, und das autoritative Lifecycle-Ende entfernt
  seinen Zustand. Reguläres Stoppen, Policy-Unterdrückung und Bedienaktionen
  zählen nicht als Wiedergabefehler. Zustand, Fehleranzahl, letzter Fehler,
  nächster Versuch, Probe-Status, unterdrückte Retries und alle echten
  Zustandsübergänge müssen in Diagnostics und lokaler History erscheinen. Der
  Zustand aktiver Lifecycles übersteht einen Plugin-Neustart. Im Live-Test
  öffneten die GNSS-Warnung und ein isolierter E2E-Alarm nach genau fünf
  technischen Fehlern mit `plughw:99,99`. Nach dem Neustart blieb nur der noch
  aktive GNSS-Lifecycle erhalten; der beendete E2E-Lifecycle wurde als
  `audio_circuit_closed_on_lifecycle_end` bereinigt. Ein fehlgeschlagener Probe
  öffnete für weitere fünf Minuten. Nach bytegenauer Wiederherstellung von
  `plughw:2,0` lief um 21:38:45 AST genau ein erfolgreicher Probe, schloss den
  Breaker und hinterließ `openCount: 0`, keinen Prozess und keinen Retry. Der
  vorgezogene Watchdog-Recovery-Probe ist durch Unit-Tests abgedeckt, wurde
  wegen der nur beim Pluginstart übernommenen Gerätekonfiguration aber nicht
  durch einen physischen Live-Geräteausfall ausgelöst.
- [x] Version `0.1.15`: Die rekursionssichere visuelle
  Audio-Systemnotification ist implementiert, auf dem Pi installiert und mit
  einem isolierten Fehler-/Recovery-Lifecycle live geprüft. Verbindliche
  Recovery-Regel:
  Nur ein erfolgreicher Player-Exit desselben zuvor fehlgeschlagenen
  Notification-Lifecycles darf dessen Fehlerlatche entfernen. Ein anderer Ton,
  passiver Watchdog-Erfolg, Lifecycle-Ende oder Neustart reicht nicht. Danach
  den bewusst ausgelösten hörbaren Bedienertest bearbeiten. Bestehende
  Audioquellen dürfen bis zur ausdrücklich getesteten Übergabe nicht
  abgeschaltet werden. Live war `notifications.system.notificationEngine.audio`
  als rein visuelle, nicht quittier-, stumm- oder löschbare Alarmmeldung auf
  Tab 3 sichtbar. Trotz allgemeiner Alarm-Soundregel blieb ihre lokale Policy
  `audio: off`; kein rekursiver Prozess entstand. Nach Wiederherstellung der
  fehlenden Datei schloss nur der erfolgreiche Probe desselben Occurrence den
  Fehler um 22:02:23 AST. Als Nächstes den bewusst ausgelösten hörbaren
  Bedienertest bearbeiten.

## Nächste Arbeitsschritte – vereinbart am 2026-09-28

- [x] Zuerst den Source-Verlust bei bestehenden Signal-K-Notifications
  reproduzieren und beheben. Für
  `notifications.propulsion.stbdEngine.exhaustTemperature` die Quelle durch
  Notification API, Datenmodell-Snapshot, Delta, Store-Merge und Historie
  verfolgen. Akzeptanzkriterium: Das Alarm Centre und neue History-Einträge
  zeigen dauerhaft die von Signal K gelieferte Quelle statt `Unknown source`.
  Analyse und Reparaturstand `0.1.9`: Der Live-Pfad liefert als Produzent
  `engineroomStbd.XX`, während die Notification-Projektion
  `self.notificationhandler` trägt. Alte History-Einträge zeigen ein Flattern
  zwischen beiden Quellen. Notification-Deltas lesen die Quelle nun sofort am
  zugrunde liegenden Datenpfad, und eine bekannte Produzentenquelle darf nicht
  mehr durch die Handler-Projektion überschrieben werden. 75 Tests sind grün
  und `0.1.9` ist auf dem Pi installiert. Offen bleibt die Live-Bestätigung im
  Alarm Centre sowie anhand eines neuen History-Eintrags bei der nächsten
  tatsächlichen Zustandsänderung. Live-Abnahme am 2026-09-28 bestanden: Der
  aktuelle Snapshot und zwei nach der Reparatur neu angelegte Lebenszyklen
  verwenden durchgehend `engineroomStbd.XX`; weder `Unknown source` noch
  `self.notificationhandler` trat in diesen neuen Einträgen auf.
- [x] Danach die Diagnostics-API und -Ansicht ergänzen: letzte Snapshot- und
  Delta-Zeitpunkte, Client-Poll-Start/-Ende, Request-Dauer, Timeout- oder
  Netzwerkfehler, Node-RED-Revision, Konfigurationsstatus, aktive
  Audio-Prozesse, letzter Audio-Exitcode und Historien-Schreibstatus. In
  Version `0.1.11` als read-only API und WebApp-Fenster umgesetzt und live auf
  dem Pi mit bereiter Node-RED-Konfiguration validiert.
- [x] Tab-3-/WLAN-Retest mit der seit `0.1.11` vorhandenen Instrumentierung
  gezielt wiederholt. WLAN war von 21:02:17 bis 21:02:34 AST aus. Die Ansicht
  wurde um 21:02:19 stale, sperrte alle Aktionen und protokollierte den
  fehlgeschlagenen Poll; nach erfolgreichem Snapshot um 21:02:45.936 wurde die
  Sperre um 21:02:46.130 aufgehoben. Die Tabelle blieb bei einer Warnung und
  acht normalen Meldungen ohne Duplikate.
- [x] Passiven Audio-Watchdog sowie Circuit-Breaker-Diagnostics und
  Historienstatus vervollständigen; live mit `0.1.14` geprüft.

## Sicherheitsreview 2026-09-26

### Prio 0 – Alarmkorrektheit vor neuen Funktionen

- [x] Snapshot-Rekonstruktion strikt typisieren. Nur Datenmodellwerte mit
  einem gültigen String-State als Notification übernehmen; verschachtelte
  Elternpfade wie `notifications.propulsion.stbdEngine` dürfen nicht als
  Phantom-Notification erscheinen.
- [x] Policy-Fallback korrigieren. Eine spezifische Regel mit nicht erfüllten
  Bedingungen darf eine allgemeinere passende Regel weder verstecken noch
  deren Audioausgabe abschalten; nur vollständig erfüllte Regeln sind
  Match-Kandidaten.
- [x] Match-Semantik vereinheitlichen. Mehrere innerhalb einer Regel gesetzte
  Kriterien (`state`, `path`, `pathPrefix`, `source`, `conditions`) werden mit
  UND verknüpft; Alternativen werden durch getrennte Flow-Zweige ausgedrückt.
- [x] Notification-States an einer gemeinsamen Grenze kanonisieren und
  validieren. Bekannte Zustände werden kleingeschrieben, unbekannte Zustände
  werden mit einer klaren Deploy-Fehlermeldung abgelehnt.
- [x] Regressionstests für Phantom-Elternpfade, Conditional-Fallback,
  Pfad-und-Quelle-Matches sowie State-Kanonisierung ergänzen.
- [x] Nach lokalen Checks und Paketprüfung auf den Raspberry Pi deployen und
  dort Node-RED-Konfiguration, aktive Notifications und Alarmdarstellung live
  verifizieren.

### Prio 1 – Audio zuverlässig und eindeutig machen

- [x] Audio-Watchdog mit Startprüfung und periodischer passiver Prüfung bauen:
  konfiguriertes ALSA-Gerät, Geräteerreichbarkeit, Backend-Prozess und letzter
  erfolgreicher Exitcode müssen überwacht werden, ohne dabei regelmäßig einen
  hörbaren Ton auszulösen. Version `0.1.12` prüft Backend und ALSA-PCM beim
  Start sowie minütlich passiv; aktive Prozesse und letzter Exit stehen in
  Diagnostics. Verstärker, Lautsprecher und Hörbarkeit bleiben ausdrücklich
  außerhalb dieser passiven Prüfung.
- [x] Bei einem Audiofehler eine eigene visuelle Systemnotification wie
  `notifications.system.notificationEngine.audio` veröffentlichen. Sie darf
  selbst keine Audioaktion auslösen, muss auf allen WebApps sichtbar bleiben
  und darf erst nach nachgewiesener Audio-Erholung auf `normal` wechseln;
  Alarm-Rekursionen sind ausdrücklich auszuschließen.
  In `0.1.15` implementiert, deployt und mit fehlender `alarm.wav` sowie
  erfolgreicher occurrence-spezifischer Erholung live nachgewiesen.
- [x] Fehlgeschlagene Loop-Wiedergabe mit Circuit Breaker und begrenztem
  exponentiellem Backoff versehen. Ein fehlendes Gerät darf weder fortlaufend
  neue `aplay`-Prozesse starten noch das Journal fluten; Retry-Zustand und
  nächster Versuch gehören in Diagnostics und Historie.
  Exponentieller Retry-Backoff bis maximal 60 Sekunden, persistenter
  Circuit-Breaker-Zustand, Diagnostics und Historieneinträge sind in `0.1.14`
  implementiert und live geprüft. Die verbindliche Semantik ist im Abschnitt
  oben und in `docs/architecture.md` dokumentiert.
- [x] Bewussten hörbaren Selbsttest für Inbetriebnahme und Wartung anbieten und
  dessen Bestätigung protokollieren. Dokumentieren, dass eine rein passive
  Softwareprüfung nur Gerät/Backend nachweist, nicht Endstufe, Lautsprecher,
  Lautstärke oder tatsächlich hörbaren Schall; vollständige automatische
  Ende-zu-Ende-Prüfung erfordert Hardware-Loopback oder ein Mikrofon. In
  Version `0.1.16` implementiert; der positive Live-Nachweis steht bis zum
  Deployment noch aus.
- [x] In der WebApp einen klar bezeichneten Button `Alarmton testen` ergänzen.
  Der Klick startet einen fest definierten, begrenzten Testton und protokolliert
  mindestens Zeitpunkt, auslösenden Signal-K-Benutzer, Gerät, Datei,
  Player-Exitcode und technischen Erfolg. Eine ausdrückliche positive Meldung
  wird als `vom Menschen gehört` protokolliert. Ohne Auswahl gilt der
  betriebliche Test nach dem Fenster als bestanden; die UI darf dies dennoch
  nur als `Test ausgelöst / technisch abgespielt` bezeichnen. Nach
  erfolgreichem Player-Exit bleibt ein verbindliches 15-Sekunden-Fenster für
  positive oder negative Rückmeldung offen.
- [x] Neben dem Testton einen sofort sichtbaren Button `Ton nicht gehört`
  anbieten. Dieser erzeugt die visuelle Audio-Systemnotification, markiert den
  letzten Alarmtest als fehlgeschlagen und hält den Fehler aktiv, bis ein
  späterer Test technisch erfolgreich war und der Bediener ihn nicht als
  unhörbar meldet. Der Fehler wird durch ausdrückliche positive Hörbestätigung
  sofort oder nach dem vollständigen 15-Sekunden-Fenster ohne Gegenmeldung
  aufgehoben.
- [x] Nach technisch erfolgreicher Wiedergabe zusätzlich `Alarm gehört`
  anbieten und die ausdrückliche positive Hörbestätigung mit Bediener und
  Zeitpunkt protokollieren. Keine Auswahl bleibt ein rein technischer Erfolg
  ohne behauptete menschliche Hörbarkeit. In Version `0.1.45` umgesetzt; der
  neue Bedienpfad ist nach dem Deployment noch manuell auf Tab 3 zu prüfen.
- [x] Make the `Alarm Sound Test` Plugin Config interval configurable as whole
  days from `0` through `30`, retaining `7` as the default. Zero hides the App
  button and blocks start requests server-side. Keep the separate one-shot
  connection check named `Sound Test`; it changes neither operator confirmation
  nor the recurring due date. Live values `1` and `0` passed on Tab 3 with
  `0.1.48`; zero also returned HTTP 409 for an authenticated direct start.
  Values `7` and `30` subsequently passed; the final deployed interval is `7`.
- [x] Complete live verification of exact restart correlation, which preserves active local occurrence and
  completed finite-playback identity
  across a plugin restart. Saving the zero-day Alarm Sound Test interval on
  2026-10-07 restarted the plugin, assigned the unchanged active GNSS warning
  a new local occurrence, and replayed `warn.wav` once even though
  `playTestTone` was false. Persisted correlation must suppress this false
  finite replay while allowing an interrupted loop for a still-active alarm to
  resume. Unit coverage passes for exact identity, changed ID/content,
  interrupted playback, loops, malformed persistence and atomic reload; the
  first Pi deployment and value `7` passed with `0.1.49` on 2026-10-07.
  A full Signal K restart changed the GNSS producer ID from `e11f…` to
  `df7a…`, so the finite warning replayed as the intentionally new lifecycle.
  An immediate check after a plugin-only restart appeared to retain GNSS ID
  `df7a…`, occurrence ID `occurrence-1791421090340-y268c33l42`, and the prior
  playback completion, and the operator confirmed no audible tone. However, a
  subsequent interval change to `30` exposed delayed asynchronous
  reconstruction: with the same GNSS producer ID, occurrence changed to
  `occurrence-1791421760785-rb3w6lw0vcr` and `warn.wav` completed at
  `2026-10-08T01:09:21.621Z`. Value `30` itself passed and the interval was
  restored to `7`. Version `0.1.50` added observational correlation diagnostics
  and passed the controlled retest on Signal K `2.33.0`: an unchanged Plugin
  Config save staged 15 records and matched all 15 exactly. GNSS retained ID
  `567159aa-b1ad-4feb-8fe8-2fd3f61617d0` and occurrence
  `occurrence-1791425139847-mjviiitnqxf`, reported no mismatched fields, and did
  not start a new player immediately or after the delayed reconstruction
  window. This closes the current exact-ID/no-replay test; the earlier failure
  remains documented rather than being reinterpreted without evidence.
- [x] Wartungsintervall in der Haupt-Buttonzeile kompakt anzeigen: runder
  Zähler `7` bis `0`, bei Fälligkeit blinkend; Klick öffnet ein eigenes
  Prozessfenster. Der letzte abgeschlossene Test wird nach Neustart aus der
  lokalen Audit-History rekonstruiert. Entscheidung vom 2026-09-29; in
  Version `0.1.17` auf Tab 3 mit wiederhergestelltem Ergebnis und Zähler `7`
  live geprüft, ohne beim Öffnen einen weiteren Ton auszulösen. Der
  anschließende positive Test protokollierte Benutzer `pi`, Gerät
  `plughw:2,0`, `sirene1.wav`, Exitcode 0 und den Abschluss nach dem vollen
  15-Sekunden-Fenster; der Bediener bestätigte die Hörbarkeit.
- [x] `aplay`-Erfolg und -Fehler über Exitcode und Signal unterscheiden;
  normale Wiedergabeinformationen auf stderr nicht als „Unable to play“
  protokollieren.
- [x] Audio-Diagnose um Start, Ende, Dauer, Datei, Gerät, PID, Exitcode,
  Signal und betroffenen Notification-Lifecycle erweitern. In Version
  `0.1.18` als read-only aktive Prozessdetails und letztes Ergebnis umgesetzt,
  auf dem Pi deployt und mit der realen GNSS-Warnung live nachgewiesen:
  eindeutiger Lifecycle, `warn.wav`, `plughw:2,0`, PID, Start/Ende, 1003 ms und
  Exitcode 0; danach keine aktiven Prozesse oder Retries.
- [x] Zuständigkeit für den Hoekens-Ankeralarmton eindeutig festlegen und
  doppelte Wiedergabe bzw. konkurrierenden ALSA-Zugriff ausschließen. Der
  eingebettete Legacy-Tab `Audio Alarms` ist live mit `disabled: true`
  bestätigt; Anchor- und Bilge-Skript sind gestoppt. Damit ist die Notification
  Engine der einzige aktive regelbasierte Audiopfad. Tab und Skripte bleiben
  als deaktivierter, nicht automatisch aktivierbarer Rückfallpfad erhalten.
- [x] Testmatrix für Loop, Silence, Acknowledge, Normal, Clear, fehlendes
  Audiogerät und gleichzeitige Alarme praktisch auf dem Pi ausführen.
  Nächster sicherer Ablauf:
  - [x] Einen runtime-sicheren Auslöser für mindestens zwei getrennte
    simulierte Notification-Lifecycles bauen; er darf keinen Signal-K-Neustart
    benötigen und die laufende GPS-/Ankerüberwachung nicht unterbrechen.
  - [x] Damit zwei gleichzeitige simulierte Alarme prüfen: unabhängige
    Audioprozesse, deterministische Priorität, lifecycle-spezifisches Silence
    sowie keine gegenseitige Unterbrechung oder ALSA-Überlastung.
  - [x] Loop, Silence, Acknowledge, Normal und Clear vollständig gegen
    Signal-K-Zustand, Audioende, Retry-/Circuit-Breaker-Zustand und lokale
    Historie nachweisen.
    Live mit `0.1.21` am 2026-09-29: zwei getrennte Alarm-Slots erzeugten
    gleichzeitig zwei `aplay`-Prozesse (PIDs 2425857/2425859), beide Exit 0.
    Slot A akzeptierte Silence, Slot B unabhängig Acknowledge; die Historie
    enthält getrennte `action_requested`-Ereignisse. Beide wechselten auf
    `normal`, beide DELETEs lieferten 204. Danach: null Prozesse, Retries,
    offene Breaker, Audio-Systemfehler oder verbliebene Runtime-Slots.
  - [x] Den echten Selbsttest-Fehlerzweig `Ton nicht gehört` nur mit bewusst
    stummgeschaltetem Verstärker/Lautsprecher ausführen; danach Audio wieder
    einschalten und mit einem zweiten technisch erfolgreichen Test plus vollem
    15-Sekunden-Fenster die sichtbare Audio-Systemnotification auflösen.
    Live mit `0.1.22` am 2026-09-30: bei stromlosem Lautsprecher technisch
    erfolgreicher Player-Exit 0, authentifizierte Gegenmeldung durch `pi` und
    genau eine persistierte visuelle Audio-Systemnotification. Dabei wurde eine
    zu breite Rekursionssperre entdeckt und repariert. Nach Wiedereinschalten
    hörte der Operator den zweiten Ton; nach dem vollständigen Fenster war der
    Test `passed_no_counter_report`, die Warnung `normal` und es blieben null
    Fehler-Latches, Prozesse, Retries oder offene Breaker.
  - [x] Echte Hoekens-Drag-/Re-Drop-/Aktiv-alarm-Neustarttests erst nach einer
    ausdrücklichen Bestätigung eines sicheren Ankertestfensters ausführen.
    Am 2026-10-07 im bestätigten Fenster durchgeführt. Drag, Acknowledge,
    Raise, Re-Drop und die lokale Lifecycle-Grenze bestanden. Der aktive
    Alarm kam nach dem Signal-K-Neustart visuell und akustisch korrekt zurück;
    die dabei wechselnde Producer-ID, neue lokale Occurrence und fehlende
    Anchor-History bleiben als eigener offener Neustartbefund unten erhalten.

### Prio 2 – End-to-End-Sicherheitsnachweis

- [x] Den nicht zum Projekt gehörenden `nodered.service` auf dem Pi prüfen und
  wieder stoppen. Der Dienst war bereits dauerhaft `disabled`, lief aber noch
  als alter manueller Startprozess seit 2026-09-16 auf Port 1880. Signal K,
  dessen Health-Timer und die eingebettete Node-RED-Instanz blieben aktiv;
  Flows unter `/home/pi/.node-red` bleiben für dieses Projekt tabu.
- [ ] Verbleibende Pi-Testmatrix abschließen: Hoekens-History und Kontinuität
  beim aktiven Alarm über einen vollständigen Signal-K-Neustart sowie reale
  Android-UDP-Ausfall/-Wiederkehr. Die reale Bilge-Produzentenprüfung ist am
  2026-10-11 bestanden. Die normalen
  Hoekens-Zustände `warn`, `alarm`, `normal` und `null`, neue Ankervorgänge nach
  ACK sowie wiederverwendete IDs wurden bereits real geprüft.
  The `0.1.64` release audit now separates historical failures from current
  evidence. Complete or explicitly accept the following real-producer gaps
  before publishing npm artifacts or claiming complete production coverage;
  repository and CI preparation may proceed without implying release:
  - [x] Repeat the bounded current-version regression for simulated `warn`,
    `alarm`, `emergency`, and Hoekens-path notifications. Verify complete
    raised/update/action/final-normal history, current display mode, sound,
    and permitted actions. These runtime slots do not require a Signal K
    restart, but audible output still requires an approved acoustic window.
    Passed with deployed `0.1.73` on 2026-10-11/12; see prioritized P0 item 4
    and `docs/e2e-safety-matrix.md` for the complete acceptance evidence.
  - [x] Verify the Rule Builder `History: enabled` branch with a bounded test
    notification. Prove that an explicitly connected `payload.history: true`
    branch is retained, while `history: false` overrides table visibility.
    Alarm and emergency states must not receive hard-coded retention; they use
    the same resolved visibility/history policy as every other notification.
    Passed with `0.1.71`; see prioritized P0 item 2 and the current audit in
    `docs/e2e-safety-matrix.md`.
  - [x] Complete the live acceptance test for the implemented Rule Builder
    `Execute: file` branch. Version `0.1.66` uses only a connected absolute
    `payload.execute` path; no redundant activation flag exists. Signal K
    Plugin Config authorizes the exact path with a per-file switch, timeout and
    optional normal-state permission. The runner provides direct no-shell
    delivery, at-most-once restart persistence, concurrency limits, bounded
    output, local audit and Diagnostics without changing notification state or
    creating another alarm. Test only the harmless executable Pi fixture
    `/home/pi/scripts/SignalK/testscript_time.sh` in a separate approved
    window. Live acceptance passed on 2026-10-10: with the `payload.execute`
    branch connected through `Activate`, the configured script created the
    expected Desktop file. After the wire to `Activate` was removed and the
    test was repeated, no file was created. This proves that the message-flow
    wiring remains the activation signal and that a disconnected execute node
    is inert.
  - [x] Resolve the release presentation decisions exposed by the historical
    matrix: builder `display: banner` versus rendered overlay; whether an
    acknowledged active emergency may lose its overlay; and how a read-only
    browser communicates unavailable write authorization before a click.
    Recorded on 2026-10-10: `banner` is the fixed in-centre strip; ACK calms an
    active emergency overlay without changing its state or audio; missing write
    authorization leaves the action visible but disabled with an explanation.
  - [x] Deploy and verify the implemented restriction of global action
    visibility and execution to notifications actually visible in the current
    notification table. Live inspection
    on 2026-10-09 found `Acknowledge all` visible with no apparent table
    target because the WebApp evaluated all 15 known records. The hidden
    `normal` records `notifications.environment.bilgeWater.port` and
    `notifications.environment.bilgeWater.stbd` both reported
    `canAcknowledge: true` and `acknowledged: false`. Fix both boundaries:
    show the global control only when at least one table-visible record is an
    eligible target, and constrain the submitted bulk action to those exact
    visible IDs so hidden or resolved records cannot be changed accidentally.
    Version `0.1.67` calculates both controls from current table rows, submits
    only their exact eligible IDs, and rechecks Signal K permissions
    server-side. The later local exclusion of `normal` and `nominal` was
    incorrect: version `0.1.69` follows `canAcknowledge` for every visible
    state while retaining the exact visible-ID boundary. `Silence all` retains
    its additional unfinished-audio requirement. Version `0.1.67` was deployed
    with `0.1.67` on 2026-10-10: the two hidden Bilge `normal` records were not
    included, `Silence all` had no target, and the sole ACK target was the
    visible GNSS warning republished by Signal K with a new ID and
    `acknowledged: false` during the controlled restart. No bulk action was
    invoked.
  - [x] Deploy and verify the Signal K 2.33.0 manager-cleanup correction.
    Direct Tab 3 and server inspection on 2026-10-14 proved that the retained
    `normal` Hoekens record `e077d93f-1f70-4efc-85a9-5c6496aadf93` still
    advertised `canAcknowledge: true` in the data model after Signal K had
    removed its ID from `app.notifications.list()`; the resulting acknowledge
    request correctly failed with HTTP 409 `Alarm not found!`. Version 0.1.89
    tracks current manager membership separately, requires it for every action,
    and excludes only manager-removed `normal` residues from the active view.
    It retains already recorded lifecycle History without creating a synthetic
    cleanup event; non-normal records remain visible fail-safe and `nominal`
    is not subject to this cleanup rule. All source tests, syntax checks, and
    the package dry run passed. Version `0.1.89` was deployed on 2026-10-14
    from package SHA-256
    `ed51ac71b8c2f8ec2f56b6ca62a018c23e221ff7f0d7398d9d0557431c12114c`.
    Signal K returned active with configuration `ready`, fresh Android GPS,
    healthy History/Localization, and idle audio after one successful finite
    replay of the acknowledged GNSS warning. The old Hoekens ID was absent
    from the active endpoint but remained in existing local History; no
    synthetic cleanup event appeared. Hoekens published a new, currently
    manager-owned `normal` ID after restart, which correctly remains visible.
  - [x] Verify the installed Hoekens release containing the Raise fix without
    upgrading merely because the upstream pull request was merged. Installed
    version `2.13.1` was identified and its required behaviour was proved live:
    Raise emitted `null`, and a later new drag reset the inherited ACK. The npm
    package does not provide commit provenance, so this acceptance result is
    behavioural rather than an unsupported claim about its exact Git SHA.
  - [x] Obtain an explicit safe anchor-test window. Record that the vessel is
    secure or ashore, no real watch depends on the test alarm, GPS is stable,
    audible output is permitted, and one controlled Signal K restart is safe.
    The operator confirmed the window on 2026-10-07 after disabling the anchor
    watch; fresh Android GPS, clean audio diagnostics, and the inactive anchor
    state were verified before Hoekens was re-enabled for the controlled test.
  - [x] With the identified Hoekens build, verify Raise -> notification `null`,
    a fresh Drop/Watching lifecycle -> `normal`, Drag -> `alarm`, ACK, another
    Raise, then another Drop/Drag with `acknowledged: false`. Record reused or
    changed notification ids, permitted actions, audio, history transitions,
    and absence of phantom notifications. Passed with Hoekens `2.13.1` on
    2026-10-07: the real drag alarm was visible and audible, accepted ACK,
    Raise emitted `null`, and the subsequent Drop/Drag started with
    `acknowledged: false`. Version `0.1.47` then passed the corrected local
    Raise/Re-Drop occurrence boundary with one reused technical ID and distinct
    local occurrences. The separate full-server-restart/history defect remains
    open in the next item.
  - [ ] During a controlled active test alarm, restart Signal K once and verify
    authoritative snapshot reconstruction, correct playback deduplication,
    no false new lifecycle or automatic clear/normal transition, healthy
    services, and successful WebApp recovery.
    Executed on 2026-10-07 with a real Hoekens drag alarm. Visual and audible
    presentation recovered and exactly one anchor audio process remained, but
    Hoekens issued a new producer id and Notification Engine issued a new local
    occurrence id for the continuing alarm. Anchor history was also absent.
    Keep this item open until restart continuity and history are fixed and
    retested. The original position and 50 m circle were restored afterward.
  - [ ] Inform the Hoekens Anchor Alarm maintainer that version `2.13.1`
    assigned a new notification id to the same continuing drag alarm after a
    Signal K restart (`88045cb2-52e3-4d65-ba4f-8d78a86fc5ae` before restart,
    `ea3e98ab-fa3e-4018-80e2-8d3d190d6dce` afterward). Include the controlled
    test conditions and explain that downstream clients cannot use the
    producer id alone to preserve lifecycle continuity across a restart.
  - [ ] In a separate safe window, disconnect and restore the real Android GPS
    producer. Record producer-delta, notification, snapshot, stale-diagnostics,
    and recovery timestamps separately so detection latency can be compared
    without inferring it from browser polling.
  - [ ] Using only an approved safe input/simulation method at the real bilge
    producer, verify alarm presentation, audio, history, permitted actions,
    producer-authoritative return to normal, and absence of a phantom alarm.
  - [x] Perform the final release smoke test on Tab 3: active view, History,
    Diagnostics, English/German selection, permitted individual/global
    actions, audible self-test, network loss/recovery, valid Node-RED status,
    and zero unexpected processes, retries, breakers, or persistence errors.
    Passed with `0.1.47` on 2026-10-07. The current page recovered from WLAN
    loss without reload, restored only permitted actions, and the audible test
    was explicitly confirmed as heard. A stale `?v=0.1.34` tab had to be
    replaced with a fresh current page before the final checks. Extended with
    `0.1.64` on 2026-10-08: pull-to-refresh no longer produced the false
    disconnected banner; operator observation and a 39.966-second full-frame
    recording both passed with healthy final diagnostics.
  - [x] Record every current result in `docs/e2e-safety-matrix.md`. The
    `0.1.64` audit retains historical PARTIAL/FAIL evidence, identifies later
    complete retests, and states Android UDP, real bilge, and active-Hoekens
    restart continuity as explicit release decisions rather than simulated
    passes.
- [x] Erwartete Anzeige, Audioaktion, Historienereignisse und erlaubte Actions
  für jeden End-to-End-Fall festhalten.
- [x] Ungültigen Node-RED-Deploy, fehlendes Audio-Gerät, geschlossene WebApp,
  Netzverlust und mehrere gleichzeitige Alarmprioritäten abdecken.
  Reparaturen für den ungültigen Deploy, Audio-Retry-Backoff und die sichtbare
  Offline-/Stale-Anzeige sind auf dem Pi implementiert und der normale
  Post-Deploy-Zustand ist geprüft; die zugehörigen Nachweise stehen vollständig
  in `docs/e2e-safety-matrix.md`.
- [x] Ungültigen Node-RED-Deploy mit der neuen Fail-closed-Sperre wiederholen:
  sichtbaren Konfigurationsfehler, gestoppte Verarbeitung, abgelehnte Actions,
  ausbleibenden Poll-Logspam und Erholung durch einen gültigen Deploy prüfen.
  Der Runtime-Fehlerfall ist am 2026-09-27 bestätigt: sichtbarer Fehler,
  deaktivierte Globalaktionen und nur ein Logeintrag über mehrere Poll-Zyklen.
  Der exakte gültige Flow wurde anschließend aus der Sicherung wiederhergestellt
  und Signal K gesund neu gestartet. Mit `0.1.32` ist zusätzlich die Erholung
  durch einen gültigen Runtime-Deploy ohne Signal-K-Neustart nachgewiesen:
  unveränderte abgeschlossene Sounds bleiben still, eine tatsächlich geänderte
  Soundregel spielt genau einmal und ein unterbrochener Loop läuft wieder an.
- [x] Fehlendes ALSA-Gerät erneut simulieren und nachweisen, dass der Alarm
  sichtbar bleibt, der Retry-Abstand exponentiell bis 60 Sekunden wächst und
  weder Prozess- noch Journal-Sturm entsteht.
- [x] Eine aktive, clear-fähige Runtime-Testnotification ohne Signal-K-Neustart
  direkt löschen. Live mit `0.1.22`: Slot `clear-check` wurde als `alarm`
  angelegt, DELETE lieferte 204, danach waren Slot-Registry, Audioprozesse,
  Retries, offene Breaker und Audio-Systemfehler leer.
- [x] Tab 3 bei aktiver Warnmeldung vom Netz trennen: deutliche
  Offline-/Stale-Anzeige, deaktivierte Einzel- und Globalaktionen sowie saubere
  automatische Synchronisierung nach Wiederverbindung prüfen.
  Retest am 2026-09-27 fehlgeschlagen: Nach Abschalten des WLANs blieb der
  letzte Alarm ohne Offline-/Stale-Hinweis sichtbar und die Buttons wirkten
  weiterhin verfügbar. Nach Wiederverbindung erschien kein Doppelalarm; der
  Testalarm war inzwischen planmäßig abgelaufen. Der WebApp-Poll verwendet
  derzeit kein eigenes Fetch-Timeout und kann bei einem Verbindungsabbruch
  unbegrenzt ausstehend bleiben, statt den Offline-Zustand zu setzen.
  Die lokale Reparatur in `0.1.6` ergänzt ein Sechs-Sekunden-Timeout,
  sofortige `online`-/`offline`-Behandlung und serialisierte Polls; der
  erste Tab-3-Retest nach Deployment war nicht aussagekräftig, weil die vor
  dem Deployment geöffnete Seite weiterlief. Zusätzlich trugen die Skripte
  noch den alten Cache-Schlüssel `0.1.18`. Der Schlüssel ist nun auf `0.1.7`
  gesetzt. Der Offline-Hinweis liegt nun fest über allen Alarm-Overlays, die
  Aktionssperre ist optisch deutlicher, und ein unabhängiger Wächter markiert
  die Ansicht spätestens acht Sekunden nach dem letzten erfolgreichen Abruf
  als stale. Vor dem abschließenden Retest muss Tab 3 die WebApp neu laden.
  Ein erster Versuch mit dem Acht-Sekunden-Wächter meldete bei eingeschaltetem
  WLAN fälschlich stale, weil der langsame Client Poll- und Wächter-Timer
  zusammen ausführte. Version `0.1.7` unterdrückt diese Altersmeldung, solange
  bereits ein durch den Sechs-Sekunden-Timeout begrenzter Abruf läuft.
  Der Folgetest meldete bei aktivem Alarm weiterhin stale: Der gemeinsame
  `Promise.all`-Abruf koppelte die aktuelle Notification-Ansicht unnötig an die
  langsamere lokale History. Version `0.1.8` behandelt nur den autoritativen
  Notification-Snapshot als Verbindungssignal; History aktualisiert unabhängig.
  Der Live-Retest mit `0.1.8` ist dennoch fehlgeschlagen: Tab 3 zeigte die
  Stale-Warnung weiterhin bei eingeschaltetem und funktionierendem WLAN. Die
  Beobachtung deutet darauf hin, dass Poll-Intervall, Request-Timeout und/oder
  Stale-Wächter weiterhin gegeneinander laufen. Diese Timer-Interaktion muss
  vor einem weiteren Alarmtest instrumentiert und eindeutig diagnostiziert
  werden; der Stale-Fix ist nicht abgenommen.
  Abschließender Retest am 2026-09-28 mit Version `0.1.12`: PASS. Der
  tatsächliche WLAN-Ausfall begann um 21:02:17 AST; um 21:02:19.055 zeigte die
  WebApp die feste Offline-/Stale-Warnung und deaktivierte Einzel- sowie
  Globalaktionen. Der Poll endete um 21:02:19.138 nach 194 ms mit `Failed to
  fetch`. Nach WLAN-Wiederkehr um 21:02:34 blieb die Sperre bis zum
  erfolgreichen Snapshot-Poll um 21:02:45.936 bestehen und verschwand um
  21:02:46.130. Danach waren eine Warnung und acht normale Meldungen ohne
  Duplikate sichtbar; Node-RED, Audio-Watchdog und History waren gesund, ohne
  Audioprozess oder Retry.
- [x] History-Reparatur live bestätigen: allgemeine `visibleInTable`-/History-
  Regeln werden von einer spezifischen Soundregel geerbt und derselbe
  Occurrence-Verlauf enthält nach Auflösung den finalen Zustand `normal`.
- [x] Den globalen Verlauf auf alle nach den aktuellen Tabellenregeln sichtbaren
  Ereignisse umstellen und jeweils den vollständigen lokalen Occurrence-Verlauf
  einschließlich `normal` anzeigen. Mit `0.1.57` live bestätigt: Die Hoekens-
  Warnung `No position data received for 15 seconds.` von 07:13:44 und ihre
  Auflösung um 07:19:42 sind sichtbar. In der Gesamtansicht ist Löschen nicht
  verfügbar; nach Auswahl bleibt es auf genau eine lokale `occurrenceId`
  begrenzt und verändert Signal K nicht.

### Prio 3 – Betriebsdiagnose

- [x] Diagnostics-Ansicht/API für letzte Snapshot- und Delta-Zeitpunkte,
  Node-RED-Revision und Flow-Pfad, Konfigurationsstatus, aktive
  Audio-Prozesse, letzten Audio-Exitcode sowie Historien-Schreibstatus bauen.
  Version `0.1.11` ergänzt zusätzlich Poll-Start/-Ende, Dauer und letzten
  Netzwerkfehler des jeweiligen WebApp-Clients.
- [x] Replace the development-oriented Diagnostics JSON wall with a structured
  operator view suitable for Tab 3. Start with an Overview that shows overall
  health, installed server plugin version, WebApp version loaded by the current
  browser, whether both versions match, connection state, and configuration
  readiness. Separate the remaining information into Browser, Server/Node-RED,
  Critical Inputs, Audio, External Tasks, History, and Localization sections
  with readable labels and explicit Healthy/Warning/Error states. Keep the
  complete unmodified diagnostics JSON available only in a collapsible
  Advanced section for technical investigation. A version mismatch must show
  a clear `Reload required` indication; localization remains presentation-only
  and must not alter diagnostic values or notification processing.
  Version `0.1.69` implements this structure and retains the untouched payload
  under Advanced; Tab 3 live acceptance passed on 2026-10-10 as recorded in
  prioritized P0 item 1.
- [x] Verify the repaired Plugin Config `Test Notification` one-shot live.
  Version `0.1.69` makes Signal K Plugin Config authoritative over the obsolete
  Node-RED `testNotif.enabled: false` value. The failed 0.1.68 attempt remained
  stored as enabled but produced no Signal K notification, History event, or
  sound. On deployment it must remain visible for 60 seconds, clear only its
  returned id, and reset the one-shot switch afterward.
  Server-side acceptance passed with 0.1.69 on 2026-10-10: `my_alertTest`
  remained `alert` for exactly 60 seconds, its returned id was cleared, History
  retained raised/final-normal events, and the switch reset to false. Signal K
  2.33.0 retained the cleared raw record as `normal`; 0.1.70 therefore hides
  only the completed maintenance record from the active centre. A later Pi
  check confirmed that `configuration.testNotif.enabled` was persisted as
  `false` after completion. Signal K's already-open Plugin Config form does not
  reactively replace its local form value; closing and reopening that form is
  required to display the cleared checkbox. The administrative trigger remains
  in Signal K Plugin Config; it must not be moved into the display-oriented
  Notification Centre.
- [x] Zustand und Alter kritischer Eingangsquellen sichtbar machen. Version
  `0.1.36` zeigt in Diagnostics für konfigurierbare Pfad-/Quellenpaare den
  Zustand, den Produzenten-Zeitstempel, das Alter und die erwartete sowie
  beobachtete Quelle; Standard ist `navigation.position` von `android_udp.gps`
  mit 15 Sekunden Toleranz.
- [x] Hohe Signal-K-CPU-Last, volle Swap-Nutzung, 81 Prozent
  Dateisystembelegung und sekündliches Node-RED-/Engine-Monitor-Logging
  getrennt profilieren und bewerten. Der read-only Nachweis und die priorisierte
  Bewertung stehen in `docs/operational-resource-profile.md`: CPU ist eine
  systemweite Summenlast, der 1-Sekunden-Python-Exec ist vermeidbare Zusatzlast,
  der volle Swap zeigt aktuell keine I/O-Aktivität, und der 8,46-GiB-APT-Cache
  ist der erste sichere Platten-Bereinigungskandidat nach Freigabe.

### Prio 4 – Komponentengrenzen nach der Stabilisierung

- [x] Den rund 1.000 Zeilen großen Einstiegspunkt entlang klarer Start-/Stop-
  und Fehlergrenzen in Plugin-Runtime, Snapshot-Service, Audio-Controller,
  Configuration-Service, History-Service und HTTP-Routen zerlegen.
  `0.1.37` beginnt die verhaltensneutrale Zerlegung mit einem separat
  getesteten Configuration-Service. `0.1.38` trennt zusätzlich die
  readonly/readwrite HTTP-Routen als getesteten Transportadapter ab. `0.1.39`
  isoliert Snapshot-Rekonstruktion, Producer-Quellen, Delta-Abonnement und
  periodischen Abgleich in einem read-only Snapshot-Service. `0.1.40` kapselt
  lokale Audit-Policy, Persistenz, Retention und Löschoperationen in einem
  History-Service; `0.1.41` verschiebt die Signal-K-Datenpfadauflösung korrekt
  auf den Plugin-Startzeitpunkt. `0.1.42` isoliert lokale Playback-Policy,
  Wiederholung, Retry/Probe, Silence-Rollback, Deduplizierung und Watchdog im
  Audio-Controller. `0.1.43` schließt die Runtime-Grenze für Lifecycle-Token,
  zwingende Initialkonfiguration, Deploy-Reload, fail-closed Suspend und
  kontrollierte Recovery; der Einstiegspunkt ist auf 722 Zeilen reduziert.

### Prio 5 – Dokumentation und Release-Basis

- [x] Namen, Routen und Datenpfade von `signalk-notification-manager` auf
  `signalk-notification-engine` vereinheitlichen und die dokumentierte Version
  aktualisieren. Historische Phase-1-Bezeichnungen sind ausdrücklich als
  solche gekennzeichnet.
- [x] Ausschließlich die eingebettete Signal-K-Node-RED-Instanz und deren
  gültigen Flow-Pfad dokumentieren; die separate Instanz bleibt nur als
  ausdrücklich verbotene Abgrenzung in den Sicherheitsregeln erwähnt.
- [x] Changelog konsolidieren sowie generierte Paketarchive und `work/` über
  `.gitignore` aus der Versionsverwaltung ausschließen. Das zuvor getrackte
  Paket `0.1.3` bleibt lokal erhalten, wird aber aus Git entfernt.
- [ ] Git-Remote, Release-Tags und unabhängige CI-Prüfungen einrichten, bevor
  das Paket öffentlich veröffentlicht wird. `0.1.44` bereitet Repository-
  Metadaten, MIT-Lizenz und GitHub Actions für Node.js 20, 22 und 24 lokal vor;
  Repository-Erstellung, erster Push, erfolgreicher Remote-CI-Lauf und
  Release-Tag bleiben bis zur ausdrücklichen Veröffentlichung offen.
- [x] Establish English as the canonical project language before release:
  source code, identifiers, comments, API fields, persisted event codes,
  server logs, diagnostics, configuration descriptions and every built-in UI
  string must be English. Replace the remaining German audio-self-test strings
  in the backend and WebApp, and add a regression check that prevents new
  untranslated built-in literals from being introduced accidentally. Completed
  in `0.1.33` and included in the deployed `0.1.34` package.
- [x] Add a small WebApp localization layer without changing the canonical API
  data. Use stable translation keys with a complete English fallback catalog;
  select the initial locale from an explicit per-browser preference and then
  `navigator.languages`, falling back to English. Provide a visible language
  selector, persist its value locally on that browser, update `html[lang]`, and
  format dates, times, durations and numbers with `Intl`. Translate only
  Notification Engine labels and known state/category/event descriptions;
  preserve Signal K paths, IDs, sources, raw diagnostics and producer-supplied
  notification messages verbatim. Version `0.1.34` ships complete English and
  German catalogs with 135 keys each, safe persistent custom-locale overrides,
  English fallback, browser-language detection and a per-browser language
  button. Live on Tab 3, `DE` rendered `Alarmzentrale`, changed without reload
  to `EN` / `Alarm Centre` / `Alarm sound test`, and changed back to German
  with `de` persisted locally and no undefined text.

### Post-release integrations

- [ ] After the first public release, evaluate ntfy and Gotify as optional
  native system-notification outputs. Keep Raspberry Pi audio as the primary
  channel and the WebApp as an optical client. Start with an isolated Tab 3
  proof covering foreground, closed browser, screen off, Doze/battery
  optimization, reboot, Wi-Fi loss/recovery, notification-channel sound and
  Do Not Disturb. Any later integration may publish presentation events only;
  it must not acknowledge, silence, clear or otherwise own a Signal K alarm
  lifecycle.

## Abgeschlossene Historienoptimierung

- [x] Konfigurationsabhängigkeit erzwingen: Nur Zustände aus `Notification
  State Order and Visibility` dürfen in der lokalen Tabelle erscheinen oder
  lokale Visual-/Audio-Ausgaben auslösen. `Standard Sound by State` darf für
  nicht gelistete Zustände keinen Alarmton aktivieren; die Konfiguration muss
  diesen Zusammenhang ausdrücklich erklären.

- [x] AudioDevice-Dokumentation vervollständigen: `default`, `plughw:0,0`,
  `plughw:1,0` und `plughw:2,0` erklären; Testton vor Notification-Tests
  abspielen und funktionierenden Ausgang dokumentieren. Live-Inventur am
  2026-10-04: Karten 0/1 sind HDMI, Karte 2 ist `bcm2835 Headphones`; das
  konfigurierte `plughw:2,0` ist passiv bereit und wurde im früheren physischen
  Lautsprecher-Aus-/Ein-Test technisch und hörbar bestätigt.
- [ ] Mehrere UI-Designvarianten für die Benachrichtigungszentrale auswählen können, zum
  Beispiel `color`, `contrast` und `night`.

- [x] Stabile lokale `occurrenceId` für einen Alarm-Lebenszyklus einführen und
  wechselnde Signal-K-IDs über ID, `historyKey` und sichere Fallback-Regeln
  zusammenführen.
- [x] Relevante und irrelevante `updated`-Ereignisse unterscheiden.
- [x] Alarm-Lebenszyklus in der UI als Timeline mit Erkennung, Änderungen,
  Quittierung, Stummschaltung, Auflösung und Dauer darstellen.
- [x] Historie primär über `occurrenceId`, zusätzlich über Pfad, Quelle, Zustand
  und Zeitraum filterbar machen.
- [x] Bestätigte direkte Löschaktionen für gesamte, zeitlich begrenzte,
  pfadbezogene und nichtkritische Historie ergänzen.
- [x] Zeitbasierte Retention neben der Eintragsbegrenzung ergänzen.
- [x] Historienansicht mit „mehr laden“ und klarer Anzahl der ausgewählten
  Notification-Historie
  erweitern.
- [x] Persistenzfehler, Datenmigration und beschädigte Historien-Dateien
  sichtbar und beherrschbar machen.
- [x] Dokumentation zur Abgrenzung zwischen lokaler Notification-Historie und
  Signal-K History API bereinigen.

## 1. Configuration and rules

- [x] Sound-Wiedergabe je Status mit `once`, `repeat`, `loop`, Wiederholungszahl
  und Intervall konfigurieren; `Silence` beendet nur den zugehörigen Sound.

- `Visible Notification States` und `Notification Sort Order` wurden zu einer
  gemeinsamen Zustandsliste zusammengeführt.

- Historienaufzeichnung wird aus der aufgelösten Tabellen-Sichtbarkeit und den
  deployten Node-RED-Regeln abgeleitet. Jede tatsächlich tabellensichtbare
  Meldung wird standardmäßig aufgezeichnet; `history: true` oder
  `history: false` überschreibt dieses Verhalten ausdrücklich. Spezifische
  Regeln erben nicht überschriebene Eigenschaften von allgemeineren Regeln.
- Die vier früheren `clearHistory*`-Einmalfelder wurden aus der Plugin Config
  entfernt. Manuelles Löschen bleibt auf die ausgewählte lokale Occurrence in
  der History-Ansicht beschränkt und ändert keine Signal-K-Benachrichtigung.
- Shortcuts validieren: Konfliktbehandlung ist implementiert; mögliche
  Konflikte mit weiteren Eingabefeldern noch prüfen.
- Kategorien werden ausschließlich automatisch klassifiziert. Node-RED bleibt
  die grafische Quelle für Anzeige-, History- und Audio-Regeln; geschützte
  Laufzeiteinstellungen und Sortierung bleiben in der Plugin-Konfiguration.
- Link „Plugin konfigurieren“ in der App ist ergänzt.
- Tabellenansicht mit Auswahlrahmen, globalen Aktionen unterhalb der Tabelle
  und Einzelaktionen im Infofenster ist umgesetzt.
- Historie zeigt das Datum pro Tag nur beim ersten Eintrag.

- [ ] Node-RED-Node-Set bei der Plugin-Installation automatisch in einem
  update-sicheren Examples-/Local-Ordner der eingebetteten Node-RED-Instanz
  bereitstellen; nicht in verwaltete `node_modules`-Examples schreiben.
- [x] In der WebApp einen `Rules`-Button im Infofenster ergänzen, der für die
  ausgewählte Notification die zugehörige Regel in einem separaten Fenster
  anzeigt.
- [x] Version `0.1.26`: Soundsteuerung kontrolliert von
  `sound.mode`/`sound.repeatCount` auf `payload.sound.count` umgestellt.
  Verbindliche Semantik: `0` = Loop, `1` = einmal, `2` bis `99` = exakte
  Anzahl. Der vom Benutzer deployte 192-Node-Flow lieferte sieben gültige
  aktive Soundregeln mit `count: 0`; die serverseitige Regelansicht und die
  effektiven Policies verwenden ausschließlich `count`. Alte Felder bleiben
  vorübergehend über einen konfliktprüfenden Migrationsadapter lesbar.
- [x] Version `0.1.28`: Optionales `payload.sound.pauseSeconds` als ganze Zahl
  von `0` bis `5` umgesetzt. Die Pause liegt ausschließlich zwischen zwei
  vollständig beendeten Wiedergaben; fehlend oder `0` bedeutet keine
  zusätzliche Pause. Andere Werte und Datentypen machen den Node-RED-Deploy
  ungültig. Der isolierte Live-Test mit `count: 3` und `pauseSeconds: 2`
  startete exakt die PIDs 2663871, 2663875 und 2663891. Zwischen dem Ende eines
  Players und dem nächsten Start lagen 2.067 beziehungsweise 2.003 Sekunden;
  danach waren Prozesse, Retries, Breaker und Audio-Systemfehler leer.
- [x] `Silence` während einer Wiederholungspause live geprüft. Ein isolierter
  Runtime-Slot mit `count: 3` und `pauseSeconds: 5` spielte genau einmal
  (PID 3016128) und wurde 2.58 Sekunden nach Player-Ende stummgeschaltet.
  Beide noch geplanten Wiedergaben entfielen; Signal K blieb autoritativ auf
  `warn` und meldete ausschließlich `silenced: true`. Der Testslot wurde über
  `normal` und DELETE beendet und der Benutzer-Flow bytegenau wiederhergestellt.
- [x] Endliche Basisfälle live geprüft: `count: 1` erzeugte genau einen
  erfolgreichen Playerprozess und keinen späteren Replay; der erste
  `count: 3`-Versuch unter `0.1.26` deckte auf, dass nur ein Prozess startete.
  Die nicht-reentrante Wiederholungsplanung in `0.1.27`/`0.1.28` ist durch den
  anschließenden exakten Drei-Prozess-Test nachgewiesen.
- [x] Version `0.1.32`: Unerwünschten Replay einer bereits aktiven endlichen
  Notification nach Wiederaufnahme aus einem ungültigen Node-RED-Deploy
  verhindert. Ursache war derselbe Ton mit absolutem Pfad vor der Störung und
  relativem Pfad nach Recovery; die Signatur verwendet nun immer den für den
  Player aufgelösten absoluten Pfad. Im isolierten Live-Test blieb der letzte
  Player nach gültig -> ungültig (`pauseSeconds: 6`) -> gültig unverändert PID
  3020272. Auch die bestehende GNSS-Warnung spielte nicht erneut. Der Flow ist
  bytegenau wiederhergestellt; Testslots, Prozesse und Retries sind leer.
  Die beiden Gegenfälle sind ebenfalls live bestanden: Dieselbe Occurrence
  wechselte nach Recovery kontrolliert von `warn.wav` (PID 3021641) auf
  `alert.wav` (PID 3021751) und spielte genau einmal. Ein `count: 0`-Loop wurde
  im Fail-closed-Zustand gestoppt, seine nicht abgeschlossene Signatur entfernt
  und nach gültiger Recovery wieder gestartet (unter anderem PID 3022143).
  Anschließendes Silence setzte nur `silenced: true` und hinterließ null
  Prozesse, Retries, Breaker oder Audio-Systemfehler.
- [x] Version `0.1.25`: Unveränderte aktive Notifications werden nach einer
  abgeschlossenen `once`- oder endlichen `repeat`-Wiedergabe nicht bei jeder
  erneuten Snapshot-, Delta- oder Bedingungsauswertung abgespielt. Die
  abgeschlossene Sound-Signatur bleibt bis zum Lifecycle-Ende, `Silence` oder
  einer geänderten Soundkonfiguration erhalten. Live blieb der Startton des
  realen GNSS-Warn-Occurrence trotz 43 Deltas und mehrerer Snapshots exakt bei
  PID 2537577; danach liefen weder ein Audioprozess noch ein Retry.
- [x] Einen pseudo-terminalen `ACTIVATE`-Debug-Node als Regelabschluss
  verwenden; nur durchgängig vom Auslöser bis `ACTIVATE` verbundene Regeln
  werden beim Deploy rückwärts geprüft und aktiviert.
- [x] Version `0.1.29`: Falsche kurzzeitige `Not connected`-Anzeige bei
  langsamen, aber erfolgreichen Pi-Antworten entschärft. Polling bleibt bei
  fünf Sekunden; Request-Deadline und Stale-Grenze betragen nun zwölf
  beziehungsweise fünfzehn Sekunden. Tab 3 lud die neue Grenze und blieb über
  mehrere echte Poll-Zyklen ohne Verbindungsbanner; native Browser-Offline-
  Ereignisse sperren Aktionen weiterhin sofort.

## 2. Presentation behaviour

- Tie-Breaker der Sortierung festlegen: Bei gleicher Zustandsstufe zuletzt
  aktualisierte Notifications zuerst.
- Darstellung der per-Notification-Historie weiter ausarbeiten: Zeitachse,
  Zustandswechsel, `firstSeenAt`, Auflösung und Umgang mit wechselnden IDs.
- Historienfenster auf Lesbarkeit bei vielen Einträgen prüfen; Gruppierung und
  Begrenzung der Darstellung festlegen.
- Für „Recent activity“ entscheiden: Vorschau behalten, ins Historienfenster
  verschieben oder aus der Hauptansicht entfernen.
- Integrationsphase für Info- und Historienfunktionen nach den Praxistests
  abschließend festlegen.

## 3. End-to-end validation

- [x] Source-Verlust bei bestehenden Signal-K-Notifications reproduzieren und
  beheben. Beispiel: `notifications.propulsion.stbdEngine.exhaustTemperature`
  mit Notification-ID `2ff367b5-4465-456b-9402-3ca7d8948aed` wird im Signal-K-
  Datenmodell mit `$source: self.notificationhandler` geliefert, erscheint im
  Centre aber als `Unknown source`. Delta-, Snapshot-, API- und Merge-Pfad
  einzeln protokollieren; die Source darf bei wechselnder Notification-ID oder
  beim Zusammenführen von `app.notifications.list()` nicht verloren gehen.
  Akzeptanzkriterium: Das Centre zeigt für diesen Pfad dauerhaft
  `self.notificationhandler` und die Historie verwendet dieselbe Quelle.
  In `0.1.9` repariert, mit Snapshot-/Delta-Regressionstests abgesichert und
  live mit den wiederhergestellten Engine-Monitor-Quellen bestätigt.

- Live-Aktualisierung praktisch testen; die Ansicht sollte Zustandswechsel
  innerhalb des 5-Sekunden-Intervalls übernehmen.
- [ ] Erkennungsverzögerung vergleichen: Testalarm gegen echten Alarm; Delta-
  und Snapshot-Zeitstempel getrennt bewerten.
- Gezielt einen Hoekens-Ankeralarm auslösen und den Radius erhöhen.
- Prüfen, ob die Historie `raised` und anschließend `updated` auf `normal`
  oder `cleared` persistiert.
- Prüfen, ob wechselnde Notification-IDs die Lebenszyklus-Zuordnung
  erschweren.

### Upstream-Fix für Hoekens Anchor Alarm

- [x] Pull Request #44 eingereicht und am 2026-09-29 von `hoeken` gemergt:
  https://github.com/hoeken/hoekens-anchor-alarm/pull/44. Ein ACK darf nicht
  über mehrere Ankermanöver hinweg erhalten bleiben.
  Hoekens verwendet für `notifications.navigation.anchor` dieselbe
  Notification-ID und sendet beim Raise bei aktivem
  `enableNormalNotifications` nur `state: normal`; beim nächsten Drop wird
  dieselbe Notification wieder auf `alarm` gesetzt. Der von Signal K
  gespeicherte Status `acknowledged: true` bleibt dadurch erhalten. Ein neuer
  Ankeralarm erscheint dann bereits quittiert, obwohl ein neues Manöver
  begonnen hat. Das ist sicherheitsrelevant, weil ein neuer Drag-Alarm dadurch
  weniger auffällig sein kann.
- Umgesetzte Upstream-Lösung: Beim Raise wird die Notification entfernt
  (`null`) und der ACK-Status dadurch zurückgesetzt. Ein anschließendes
  Watching-`normal` gehört zu einem frischen Notification-Lifecycle. Ein
  reiner Wechsel auf `normal` hätte nicht gereicht.
- Als Nachweis für das Issue dokumentieren: gleiche ID
  `e8cf94af-698a-4091-ad22-c8b17b5840d1` bei `alarm`, ACK und anschließendem
  `normal` nach Radiusänderung.
- [x] Verify the installed Hoekens release containing the upstream Raise fix
  in an explicitly approved live anchor-test window. Version `2.13.1` was
  tested on 2026-10-07: Raise caused Hoekens to emit `null`, but this Signal K
  notification handler retained the same technical ID as an empty `normal`
  notification. After acknowledging the first controlled drag alarm, Raise
  temporarily retained `acknowledged: true`; the next controlled drag alarm
  correctly reset it to `false`. The safety-relevant inherited-ACK defect is
  therefore fixed for a new alarm.
- [x] Replace the obsolete Hoekens `normal`/`Off` local lifecycle boundary.
  Version `2.13.1` no longer exposes `Off`, while Signal K retains the same
  technical ID, so Notification Engine kept the same local `occurrenceId`
  across Raise and re-drop. Use the authoritative
  `navigation.anchor.state = off` transition to close only the local Hoekens
  occurrence. Version `0.1.47` implements and unit-tests that local-only
  boundary, including the value removal emitted by Hoekens 2.13.1 and repeated
  snapshots while inactive. The controlled live raise/re-drop regression
  passed on 2026-10-07 with one reused technical notification ID and distinct
  local occurrence IDs. Do not treat
  an empty `normal` notification as the boundary because the same value also
  represents normal watching when normal notifications are disabled.
- The packaged custom lifecycle-rules file is now empty. The generic rule
  mechanism remains available for other producer-specific cases.
- [x] Lifecycle-Sonderfälle in `lifecycle-rules.json` auslagern und beim
  Speichern der Plugin-Konfiguration neu einlesen; Handhabung dokumentieren.

## 4. Handoff

- [x] Sicheren Laufzeit-Testauslöser für mindestens zwei voneinander isolierte
  simulierte Notification-Lebenszyklen implementieren. Er verwendet nur den
  festen Namespace `notifications.system.notificationEngine.runtimeTest.*`,
  läuft nach spätestens 600 Sekunden ab und kann keine fremde ID ändern oder
  löschen.
- [x] Auf dem Pi zwei gleichzeitige Slots live durch Alarmton, unabhängiges
  Silence, Acknowledge, `normal` und Clear führen; ALSA-Prozesszahl und Historie
  als Nachweis festhalten.
  Nachweis siehe `docs/e2e-safety-matrix.md`; dabei wurde außerdem der nach
  `normal` erwartbare Signal-K-Fall `Alarm not found` als ausschließlich für
  die eigene registrierte ID idempotente Bereinigung repariert und in
  `0.1.21` erneut live geprüft.
- [x] Den echten Gegenpfad `Ton nicht gehört` nur bei absichtlich physisch
  stummgeschaltetem Ausgang auslösen, anschließend Audio wiederherstellen und
  den erfolgreichen Recovery-Test dokumentieren.
  Erfolgreich mit `0.1.22` nach physischem Aus-/Einschalten des Lautsprechers;
  vollständiger Nachweis in `docs/e2e-safety-matrix.md`.
- Hinweis zum Handoff: Die noch offenen realen Bilge- und
  Android-GPS-Unterbrechungstests sind ausschließlich in der
  Prio-2-Testmatrix geführt und benötigen jeweils ein ausdrücklich bestätigtes
  sicheres Betriebsfenster. Die simulierten Runtime-Slots ersetzen diese
  Produzenten-Tests nicht. Die realen Hoekens-Tests sind bereits durchgeführt;
  nur ihr Neustart-/History-Befund bleibt dort offen.

- Dokumentation der neuen Einstellungen vervollständigen.
- Aktuellen Stand auf dem Raspberry Pi installieren und testen.
- Danach den getesteten Entwicklungsstand committen.
- Veröffentlichungshinweis: Öffentliches Git-Repository, npm-Paket,
  Appstore-Metadaten und Installationsdokumentation werden ausschließlich über
  den offenen Punkt „Git-Remote, Release-Tags und unabhängige CI-Prüfungen“ in
  Prio 5 verfolgt; hier wird dafür kein zweiter Aufgabenstatus geführt.

## 6. UI-Aktionen und Piktogramme

- [x] Den roten Verbindungsbalken gegen kurz abgebrochene Polls beim Browser-
  Neuladen entprellen. Version `0.1.59` behält einen noch frischen Snapshot bei
  einem einzelnen Fehler; echtes Browser-Offline sperrt weiterhin sofort und
  die unveränderte 15-Sekunden-Grenze sperrt bei ausbleibendem Erfolg. Pi und
  cache-busted WebApp sind gesund; der abschließende Wischtest erfolgt auf
  Tab 3 durch den Bediener.
- [x] Den Node-RED-Builder links neben „Ausgewählte Benachrichtigungen“
  platzieren, den redundanten manuellen Refresh entfernen und globale Aktionen
  nur bei einem aktuellen Ziel zeigen. Mit `0.1.58` live bestätigt: kein
  unfertiges Audio blendet `Silence all` aus; die noch quittierbare GNSS-Warnung
  hält `Acknowledge all` sichtbar. Der positive hörbare Silence-Gegenfall
  benötigt noch ein ausdrücklich bestätigtes akustisches Runtime-Testfenster.
- [x] Im History-Fenster den Lösch-Button nach erfolgreichem Löschen der
  Historie ausblenden.
- [x] Buttons im Infofenster und für „Delete this history“ deutlich auffälliger
  gestalten.
- [x] Passende, verständliche Piktogramme und sichtbare Beschriftungen für
  `Silence`, `Acknowledge`, `Clear` und „Delete this history“ umsetzen und auf
  Tab 3 prüfen. Live mit `0.1.23` geprüft: Einzelaktionen jeweils 76 × 60 CSS-
  Pixel, History-Löschung 101 × 54 CSS-Pixel, ohne Überdeckung oder ausgelöste
  Notification-/Löschaktion.

## 7. Audio und Historienexport

- [x] Soundstatus mit `Active` steuerbar machen. `0.1.24` erhält ein verbundenes
  `payload.sound.active: false` bis in die Policy und verhindert den Rückfall
  auf den geerbten Zustandssound; isolierter Runtime-Slot live bestanden.
- [x] Eine konfigurierte, aber nicht vorhandene Sounddatei beeinflusst den
  autoritativen Alarm nicht und erzeugt begrenzte Audiofehler-, Circuit-
  Breaker-, Systemnotification- und Historiennachweise; live seit `0.1.15`.
- [x] Einen ausdrücklich leeren Soundpfad bei aktivem Sound als ungültige
  Node-RED-Konfiguration ablehnen. Bewusstes Abschalten erfolgt ausschließlich
  mit `payload.sound.active: false`; dadurch gibt es keinen stillen,
  unbeabsichtigten Fallback.
- [ ] Eine Möglichkeit schaffen, die lokale Historie zu speichern bzw. zu
  exportieren.

## 8. Systemweite Alarmanzeige

- [ ] `emergency` muss unabhängig vom aktuell sichtbaren Bildschirm erscheinen,
  auch über Vollbildanwendungen wie Filmwiedergabe oder OpenCPN hinweg.
- [ ] Prüfen und entscheiden, ob `alarm` ebenfalls systemweit angezeigt wird.
- [ ] Für die systemweite Anzeige eine geeignete Raspberry-Pi-/Desktop- oder
  Kiosk-Integration konzipieren; das Browser-Overlay des Plugins allein reicht
  dafür nicht aus.

## 9. Policy-Match-Logik

- [x] Mehrere Kriterien innerhalb einer Regel (`state`, `path`, `pathPrefix`,
  `source`, `conditions`) werden mit UND verknüpft. Alternativen werden als
  getrennte Flow-Zweige modelliert. Kategorien sind reine Anzeigemetadaten und
  weder Match-Kriterium noch zweite Policy-Sprache.

## 5. Weiteres Alarmhandling

- Voice-Ausgabe für ausgewählte Alarmzustände und Quellen konzipieren.
- Regeln für Wiederholung, Stummschaltung, Quittierung und Sprachpriorität
  definieren.
- Bestehendes Anchor-Audio und spätere Voice-Ausgabe sauber über einen
  gemeinsamen Alarm- bzw. Audio-Dienst integrieren.
- Verhalten bei gleichzeitigem `emergency`, `alarm` und `warn` festlegen.

## 10. Diskussionspunkte: Audio und Historie

- [ ] Audio-Backend abstrahieren, damit neben Linux/ALSA (`aplay`) auch
  PulseAudio/PipeWire, macOS, Windows und Container-Umgebungen unterstützt
  werden können.
- [ ] Entscheiden, ob Browser-Audio als zusätzlicher Ausgabekanal angeboten
  werden soll: Audioereignisse per WebSocket oder SSE an die WebApp senden und
  dort über Web Audio API oder `HTMLAudioElement` abspielen.
- [ ] Für Browser-Audio Einschränkungen bewerten: erforderliche Benutzeraktion
  wegen Autoplay-Regeln, geschlossene oder schlafende Tabs, Lautstärke,
  mehrere Browser und Eignung als sicherheitskritischer Alarmkanal.
- [ ] Festlegen, ob der Raspberry Pi-Audioausgang Primärkanal bleibt und
  Browser-Audio nur optional pro Gerät oder Policy aktiviert wird.
- [ ] Prüfen, wie bestehende externe Audioquellen wie Hoekens-/Node-RED-
  Skripte in einen gemeinsamen Audio-Dienst integriert oder klar getrennt
  werden.
- [ ] SQLite als mögliche Ablösung der JSON-Historie evaluieren; insbesondere
  Ressourcenverbrauch auf dem Pi, native npm-Abhängigkeiten, Transaktionen,
  parallele Browserzugriffe, Retention und Abfragen.
- [ ] Datenbankschema für Alarm-Lebenszyklen und Ereignisse entwerfen und
  Migration der bestehenden `notification-history.json` ohne Datenverlust
  planen.
