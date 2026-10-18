# Raspberry Pi deployment and rollback

## Notification Engine 0.1.91 snapshot scheduling and AppStore category

Version `0.1.91` was packaged and deployed on 2026-10-18 from tarball SHA-256
`a8d22a3b5bd8882e7a9b090567b549e565a081371011784c98b7ffc2775af7b9`.
The complete previous installation is retained at
`/home/pi/.signalk/node_modules/signalk-notification-engine.backup-0.1.90-before-0.1.91-20261018`;
the directory replaced during installation is additionally retained at
`/home/pi/.signalk/node_modules/signalk-notification-engine.preinstall-0.1.90-before-0.1.91-20261018`.

The normal project-level `npm install` attempt stopped before replacement with
`ENOVERSIONS` because npm tried to resolve the unrelated unavailable
`aisfleet` dependency from the complete Signal K installation. The validated
Notification Engine package has no runtime dependencies. The exact verified
npm tarball was therefore extracted and only the plugin directory was
replaced; no other Signal K package or embedded Node-RED flow was changed.

The installed package includes `signalk-category-notifications`. Source and
installed hashes match for package metadata, the snapshot service, Diagnostics,
the structured Diagnostics view, the WebApp entry point, and both built-in
translation catalogs. The served page reports WebApp version `0.1.91`.

After the controlled `signalk.service` restart, configuration was `ready`, the
runtime deploy-event interface was available, and the first four snapshot
reconciliations completed successfully. Diagnostics reported maximum snapshot
concurrency `1`, no active or pending request, zero failures, timeouts, or
coalesced overlaps, and a 469 ms last successful duration. Android GPS was
fresh, subscribed deltas continued, History retained 500 events, and audio was
ready with zero active processes, pending retries, open breakers, or unresolved
failures. `signalk.service` was active and the separate `nodered.service`
remained inactive. No Notification Engine snapshot error appeared in the
focused restart journal; unrelated pre-existing serial-device, barograph, and
Sealagom authentication errors remain outside this plugin deployment.

All syntax checks, the complete 282-test suite, package dry run, and diff check
passed locally. The timeout/store-retention and coalesced-follow-up paths are
covered deterministically by unit tests; no live timeout was induced on the
productive Signal K server.

## Notification Engine 0.1.90 fixed-severity table ordering

Version `0.1.90` was packaged and deployed on 2026-10-16 from tarball SHA-256
`5a002598e18dd3c283923cee7b501971c68df4faf71a9ea28634f24c8b4ebdbd`.
The complete prior installation is retained at
`/home/pi/.signalk/node_modules/signalk-notification-engine.backup-0.1.89-before-0.1.90-20261016`;
the replaced directory is retained at
`/home/pi/.signalk/node_modules/signalk-notification-engine.replaced-0.1.89-20261016`.

The active-table comparator now keeps the fixed Signal K order `emergency`,
`alarm`, `warn`, `alert`, `normal`, `nominal` primary on every browser. A
browser-local column choice is only a secondary ordering within one state.
The complete 277-test suite includes regressions for an older `warn` preceding
a newer `normal` and for unknown states remaining visible after known states.

After the controlled restart, Signal K and embedded Node-RED were active while
the separate `nodered.service` remained inactive. Configuration was `ready`
with the unchanged productive rule revision, runtime deploy events were
available, Android GPS was fresh, History retained 500 events, Localization
was healthy, and installed source/WebApp hashes matched the checkout. The
live notification snapshot sorted its active GNSS `warn` before every
`normal` and `nominal` row using the installed comparator and the browser's
default updated-time selection. In the explicitly confirmed acoustic window,
restart reconstruction played that finite warning once successfully; the
stable state then had zero active audio processes, pending retries, open
circuits, or unresolved audio failures.

This is a local and Pi development deployment only. It has no public tag,
GitHub release, push, or npm publication. Before the first npm upload, the
repository, Pi, package version, commit, tag, GitHub artifact, and npm artifact
must be deliberately reconciled to one reviewed version as recorded in
`TODO.md`.

## Notification Engine 0.1.89 manager-cleanup validation

Version `0.1.89` was packaged and deployed on 2026-10-14 from tarball SHA-256
`ed51ac71b8c2f8ec2f56b6ca62a018c23e221ff7f0d7398d9d0557431c12114c`.
The previous `0.1.88` installation was preserved at
`/home/pi/.signalk/node_modules/signalk-notification-engine.backup-0.1.88-pre-0.1.89-20261014`
before replacement; the replaced directory was additionally retained at
`/home/pi/.signalk/node_modules/signalk-notification-engine.replaced-0.1.88-20261014`.

The first package-manager installation attempt stopped before restart with
`ENOVERSIONS` because npm tried to resolve the unrelated unavailable
`aisfleet` dependency from the complete Signal K installation. The inspected
Notification Engine package has no runtime dependencies. Its validated npm
tarball was therefore extracted directly and only the plugin directory was
replaced; no other Signal K package was changed.

After the controlled `signalk.service` restart, the service was active, the
installed plugin and served `app.js` both reported `0.1.89`, the selected
Rule Builder configuration was `ready`, runtime deploy events were available,
Android GPS was fresh, and History and Localization were healthy. Audio
returned to idle with no pending retry after one successful finite playback
of the acknowledged GNSS warning. Hashes of the principal source and WebApp
files matched the development checkout.

Signal K had removed the old Hoekens normal ID
`e077d93f-1f70-4efc-85a9-5c6496aadf93` from its Notification API manager.
That ID was absent from the `0.1.89` active endpoint while its existing local
Anchor History remained present; the engine created no synthetic cleanup
event. Hoekens published a new manager-owned `normal` ID during startup. That
new record correctly remains in the active projection and proves that the
filter is based on manager membership rather than a blanket ban on the
`normal` state.

The final read-only Tab 3 smoke test loaded every WebApp asset with cache key
`0.1.89`, reported the browser connected and configuration ready, and confirmed
that the old Hoekens ID was absent. The table History opened with 500 retained
events and Diagnostics opened with the current version and ready state. Both
windows were closed afterwards. The test invoked no notification action,
runtime test, audio playback, producer fault, Node-RED deploy, or restart.

## Notification Engine 0.1.88 release-candidate baseline

Version `0.1.88` was packaged, deployed, and verified on 2026-10-13. The
deployment archive SHA-256 is
`cb5362e49cd6a7e423ef33ebbc8a66d00e48ae8dc39bb112d346f872857d1f90`.
The complete replaced `0.1.87` installation is retained at
`/home/pi/.signalk/node_modules/signalk-notification-engine.backup-0.1.87-before-0.1.88`.

After full initialization, Signal K was active; embedded Node-RED reported
configuration `ready`, runtime deploy events available, and productive rule
revision
`34649048570fc10c56b951586d11a1ec9ff149e65410a22cfcafe623417d28d2`.
Android GPS was fresh from `android_udp.gps`; audio was ready with zero active
processes and pending retries; no `alarm` or `emergency` notification was
active. The installed package, Diagnostics, served WebApp metadata, and asset
cache keys all reported `0.1.88`.

The two live bilge paths were normal and classified as `ENVIRONMENT`; after a
forced Tab 3 reload both appeared as `UMWELT`. Source and installed SHA-256
values matched for package metadata, classifier, WebApp entry files, both
built-in translation catalogs, and the packaged user guide. All 270 tests,
syntax checks, package dry run, documentation-link checks, and diff checks
passed before deployment. The embedded Node-RED flow was not changed by this
deployment.

## Notification Engine 0.1.76 deterministic Activate endpoints

Version `0.1.76` was deployed and verified on 2026-10-12. The package at
`/home/pi/.signalk/plugin-packages/signalk-notification-engine-0.1.76.tgz` has
SHA-256
`954a433da1ce240d2c6d404d634a66596408d8513ce118c8ae88a44551ee78ab`.
Complete `0.1.75` backups are retained at
`/home/pi/.signalk/plugin-backups/notification-engine-0.1.75-before-0.1.76-20261012`
and
`/home/pi/.signalk/plugin-backups/notification-engine-0.1.75-replaced-by-0.1.76-20261012`.

Before deployment, the new extractor parsed the actual 240-node embedded flow
as the expected ten rules without a same-scope conflict. After the approved
restart, the installed plugin retained those ten rules and revision
`ec3ce1f77236f59b930f84d0b249ff83927245bd42d28e9c0689388bcd922c9a`;
configuration was ready and runtime deploy events were available. Audio was
ready with zero processes, retries, or unresolved failures. History was
available at 500 entries, Android GPS was fresh, Signal K was active with zero
unexpected restarts, and external `nodered.service` remained inactive. The
independently persisted Alarm Sound Test retained its exact confirmed test id
and timestamp with seven days remaining across this second upgrade restart.

## Notification Engine 0.1.75 Alarm Sound Test persistence

Version `0.1.75` was deployed and verified on 2026-10-12. The package at
`/home/pi/.signalk/plugin-packages/signalk-notification-engine-0.1.75.tgz` has
SHA-256
`5cda8659c992467cb5a7fb85fc884a6f8cf87de444463974db9522a52521c7e5`.
Complete `0.1.74` backups are retained at
`/home/pi/.signalk/plugin-backups/notification-engine-0.1.74-before-0.1.75-20261012`
and
`/home/pi/.signalk/plugin-backups/notification-engine-0.1.74-replaced-by-0.1.75-20261012`.

The change separates the last terminal Alarm Sound Test result from the
bounded 500-entry audit History. Before deployment, the configured interval
was still seven days, but the previously in-memory `passed_heard` result had
already been evicted from History; restart therefore restored no test and the
WebApp correctly but misleadingly displayed zero days remaining. After
deployment, the operator ran the test, heard the tone, and explicitly selected
`Alarm heard`. Test `0f5b38dd-ade5-452e-89cd-610a1a21463a` completed as
`passed_heard` at `2026-10-12T01:33:52.281Z`. The plugin atomically stored the
same result in mode-0600 `audio-self-test.json` while retaining the ordinary
three audit events in History.

A separately approved Signal K restart proved restoration from the dedicated
file: the API and Diagnostics returned the exact same test id and `passedAt`,
the calculated button value remained seven days, and persistence reported no
error. Node-RED retained revision
`ec3ce1f77236f59b930f84d0b249ff83927245bd42d28e9c0689388bcd922c9a`
with runtime deploy events available. Audio was ready with zero processes,
retries, or unresolved failures; History remained available at 500 entries,
Android GPS was fresh, `signalk.service` was active with zero unexpected
restarts, and the separate `nodered.service` remained inactive.

## Notification Engine 0.1.74 baseline

Version `0.1.74` was deployed and verified on 2026-10-12. The prior complete
installation is retained at
`/home/pi/.signalk/plugin-backups/notification-engine-0.1.73-before-0.1.74-20261012`
and the replaced directory at
`/home/pi/.signalk/plugin-backups/notification-engine-0.1.73-replaced-by-0.1.74-20261012`.
The durable package is
`/home/pi/.signalk/plugin-packages/signalk-notification-engine-0.1.74.tgz`
with SHA-256
`dcc2a47b45d8633a2d0b8f7da9988eb795951554bb1c731f0d7846898fbd1c5a`.

All 243 tests, syntax checks, package dry-run, and package-content checks
passed. The package includes the grouped, fully inactive
`node-red/notification-engine-release-flow.json` reference tab. Source and
installed hashes matched for `package.json`, the reference flow, and the
versioned WebApp entry point. Both server Diagnostics and the WebApp report
`0.1.74`.

The operator imported and deployed the reference tab beside the existing
production tab. Its stored embedded Node-RED flow SHA-256 is
`3b3b187e4d98cb91b49e36ac884faa0b42425ae9ad1d61a3610bbf251a9fc395`.
The release tab contains one `Activate` node but zero wires reaching it.
Runtime extraction therefore retained exactly the same ten production rules
and revision
`ec3ce1f77236f59b930f84d0b249ff83927245bd42d28e9c0689388bcd922c9a`,
with zero reference-flow identifiers in the deployed-rules view. The exact
pre-import production flow remains recoverable at
`/home/pi/.signalk/red/flows_openplotter.before-release-anchor-test-20261012T0001Z.json`
with SHA-256
`5dd406112b94abe6f842382a5a4cdbf25e738dc3ef5b403ab0487cad16b5a004`.
The additional pre-deploy editor-state backup at
`/home/pi/.signalk/red/flows_openplotter.before-inactive-release-flow-20261012.json`
already contains the imported but inactive release tab and has the deployed
flow SHA-256 shown above.

The ordinary root-level `npm install` attempt failed before replacing the
plugin because the unrelated Signal K dependency `aisfleet` has no registry
versions. The running `0.1.73` installation remained intact. Deployment then
used the already verified package locally: extract into a temporary directory,
verify version and reference-flow content, retain the complete old directory,
move the staged package into the plugin path, and perform the separately
approved Signal K restart. This avoided changing the Signal K root dependency
tree or persistent plugin data.

After restart, mandatory Node-RED configuration and runtime deploy events were
ready. There were ten rules, zero runtime test notifications, and the real
anchor notification remained `normal`. Android GPS was fresh, History was
available, and audio ended ready with zero active processes, retries, open
breakers, or unresolved failures. The existing GNSS warning was republished as
a new occurrence and completed its configured one-shot `warn.wav` successfully
in 775 ms; playback then remained idle. Signal K and `signalk-health.timer`
were active, external `nodered.service` was inactive, and systemd reported zero
unexpected service restarts.

## Notification Engine 0.1.73 baseline

The current-version severity regression passed on 2026-10-11/12 in an
explicitly approved acoustic window. Plugin-owned bounded slots exercised
`warn`, `alarm`, and `emergency`. The operator confirmed their expected table,
banner/overlay, and audible presentation. History retained the complete
occurrence sequences: warn Acknowledge and final `normal`; alarm Silence,
Acknowledge, both authoritative updates, and final `normal`; emergency
Acknowledge while the independent siren continued, followed by permitted
Clear (`Zurücksetzen` in German) and audio termination. Emergency never
offered Silence.

A temporary exact-path Node-RED branch matched only
`notifications.system.notificationEngine.runtimeTest.release-anchor` and
selected the same looping `2bells.wav` treatment as the Hoekens alarm path.
Its alarm passed visual/audio observation, Silence, Acknowledge, and final
`normal` history under one occurrence. The real
`notifications.navigation.anchor` record remained `normal`. The temporary
branch was removed through a valid runtime deploy, returning the production
flow byte-for-byte to SHA-256
`5dd406112b94abe6f842382a5a4cdbf25e738dc3ef5b403ab0487cad16b5a004`
and ready revision
`ec3ce1f77236f59b930f84d0b249ff83927245bd42d28e9c0689388bcd922c9a`.

The temporary Signal K access client was removed from persistent security
configuration and its local token file was deleted. Because Signal K retained
the issued token in memory, a separately approved service restart was used to
reload security. After restart, the temporary client count and runtime-slot
count were both zero. Signal K and its health timer were active, external
`nodered.service` was inactive, Android GPS was fresh, History was available,
and audio was ready with zero active processes, pending retries, open
breakers, or unresolved failures. Startup republished the existing GNSS warn
as a new occurrence and completed its configured one-shot `warn.wav` playback
successfully; playback then remained idle.

Version `0.1.73` was deployed and verified on 2026-10-11. The brief 0.1.72
installation is retained at
`/home/pi/.signalk/plugin-backups/notification-engine-0.1.72-before-0.1.73-20261011T234000Z`;
the prior 0.1.71 installation remains at
`/home/pi/.signalk/plugin-backups/notification-engine-0.1.71-before-0.1.72-20261011T200000Z`.
The durable package is
`/home/pi/.signalk/plugin-packages/signalk-notification-engine-0.1.73.tgz` with
SHA-256
`8ae05508e5dc9e087b08847a80cf1f089700ff19adb6db7cbb2ed7a44ef0ccfe`.

All 238 tests, syntax checks, package checks, and diff checks passed. Source
and installed hashes matched for the package manifest, HTTP adapter, WebApp,
style sheet, action-availability helper, visual-presentation helper, and HTML
entry point. `/signalk`, notifications, rules, history, and Diagnostics
returned HTTP 200. The new non-mutating endpoint behind Signal K's readwrite
middleware returned the expected HTTP 401 without credentials. The installed
WebApp and all changed asset cache keys report 0.1.73.

Embedded Node-RED was ready at revision
`ec3ce1f77236f59b930f84d0b249ff83927245bd42d28e9c0689388bcd922c9a`
with runtime deploy events available. The production flow remained
byte-identical with SHA-256
`5dd406112b94abe6f842382a5a4cdbf25e738dc3ef5b403ab0487cad16b5a004`.
Signal K and `signalk-health.timer` were active with zero service restarts;
external `nodered.service` remained inactive. Audio was ready with no active
process, retry, breaker, or unresolved failure. The full restart republished
the existing GNSS warning as a new occurrence and played `warn.wav` once in
747 ms inside the approved safe window; playback then remained idle.

After a full Tab 3 reload, the operator confirmed that the real GNSS `warn`
appeared as a banner strip inside the Notification Centre while remaining in
the table, without viewport overlay dimming. Its Signal K-permitted
Acknowledge action was enabled in the authenticated browser. Focused automated
coverage proves that emergency acknowledgement removes only its overlay and
does not stop or restart its audio, and that an otherwise applicable action is
retained visibly but disabled with an explicit explanation when the browser
lacks write authorization.

The same release-candidate evidence set includes a real physical starboard
bilge-input test performed earlier on 2026-10-11. The operator confirmed the
expected visual and audible alarm. Local History records
`notifications.environment.bilgeWater.stbd` from `engineroomStbd.XX` changing
to `alarm` at 12:39:16 UTC with `Bilge water detected in starboard engine
room`, then returning to `normal`/`Watching` at 12:39:21 UTC under the same
occurrence ID `occurrence-1791677618190-pr539q0jyud`. The current projection is
normal and final audio diagnostics are idle and healthy.

## Notification Engine 0.1.71 baseline

Version `0.1.71` was packaged, deployed, and technically verified on
2026-10-11. The complete prior 0.1.70 installation is retained at
`/home/pi/.signalk/plugin-backups/notification-engine-0.1.70-before-0.1.71-20261011T190000Z`.
The durable package is
`/home/pi/.signalk/plugin-packages/signalk-notification-engine-0.1.71.tgz` with
SHA-256
`32862e9752c300c6af1f19cee3ee3d8a2567e8390c9300e468badccd4d5e0324`.

All 227 tests, syntax checks, package checks, and diff checks passed. Source
and installed hashes matched for `package.json`, `lib/notification-store.js`,
and `public/index.html`. `/signalk`, notifications, deployed rules, history,
and Diagnostics returned HTTP 200; the unauthenticated WebApp request returned
the expected HTTP 401. The installed WebApp declares version 0.1.71. Embedded
Node-RED was ready at revision
`ec3ce1f77236f59b930f84d0b249ff83927245bd42d28e9c0689388bcd922c9a`
with runtime deploy events available, and its production flow remained
byte-identical with SHA-256
`5dd406112b94abe6f842382a5a4cdbf25e738dc3ef5b403ab0487cad16b5a004`.
Audio was ready with zero active processes, retries, open breakers, or
unresolved failures; history was healthy at its 500-entry bound. Signal K and
`signalk-health.timer` were active with zero service restarts, while the
separate `nodered.service` remained inactive.

The restart republished the existing GNSS warning with a new producer ID and
changed method/status fields, so strict restart correlation correctly did not
treat it as an exact match. It became a new local occurrence and produced one
finite `warn.wav` playback, which completed successfully in 1080 ms. This is
not evidence of a playback retry or loop. The 0.1.71 occurrence-scoped history
decision has unit coverage and passed its operator-guided live Rule Builder
acceptance check. Four new sound-disabled `hist2-*` paths began with no
retained events. The visible default `warn` and hidden explicit `history: true`
alert each retained `raised` and final `updated/normal` events under one
occurrence ID. Explicit `history: false` suppressed the complete alarm and
emergency occurrences, including their final `normal` transitions. The
temporary 20-node test block was removed; the live flow returned byte-for-byte
to the production hash and revision above. Final Diagnostics remained ready
with zero active audio processes, pending retries, open breakers, or unresolved
audio failures.

## Notification Engine 0.1.70 baseline

Version `0.1.70` was deployed and verified on 2026-10-10 after the controlled
0.1.69 Test Notification run. The immediately preceding 0.1.69 installation is
retained at
`/home/pi/.signalk/plugin-backups/notification-engine-0.1.69-before-0.1.70-20261011T002000Z`;
the earlier 0.1.68 installation is retained at
`/home/pi/.signalk/plugin-backups/notification-engine-0.1.68-before-0.1.69-20261011T001000Z`.
The durable package is
`/home/pi/.signalk/plugin-packages/signalk-notification-engine-0.1.70.tgz` with
SHA-256
`4b83c7c0535b0412ec642885e172956eca59fe3c3e9cc16be7fb9b572a52567c`.

All 224 tests, syntax checks, package checks, and diff checks passed. Signal K
and its health timer were active, the plugin and browser-embedded WebApp both
reported 0.1.70, the structured Diagnostics asset returned HTTP 200, and the
separate `nodered.service` remained inactive. Configuration was ready, the
one-shot test switch was false, no completed configuration test remained in
the active Notification Engine view, and no audio process was running.

The retained 0.1.68 test request was proved under 0.1.69. Node-RED's obsolete
`testNotif.enabled: false` no longer overrode Signal K Plugin Config. Signal K
raised `my_alertTest` at
`notifications.notification-config.testx1` as `alert` with id
`777488b5-2534-4137-a0a3-91eb20ec6afa`, retained it for exactly 60 seconds,
and accepted the exact-id clear. Signal K 2.33.0 retained the authoritative
record as `normal`; local History contains the `raised` and final `updated`
events, and the Plugin Config one-shot reset to false. Version 0.1.70 hides
only that completed maintenance record from the active centre while retaining
both Signal K's raw projection and the local audit trail.

The bounded external-task fixture also passed its first live wiring test. With
the Rule Builder `payload.execute` branch connected to `Activate`,
`/home/pi/scripts/SignalK/testscript_time.sh` created the expected Desktop
file. After disconnecting that wire and repeating the trigger, no file was
created. No second activation flag is involved. A subsequent read-only check
also found the completed Plugin Config Test Notification persisted with
`configuration.testNotif.enabled: false`. An already-open Signal K Plugin
Config form can continue showing its pre-save local checkbox value until the
form is closed and opened again; that stale form display is not a retained
server-side request.

## Notification Engine 0.1.68 baseline

Version `0.1.68` was deployed and verified on 2026-10-10. The complete prior
`0.1.67` plugin plus the preceding Signal K package manifests are retained at
`/home/pi/.signalk/plugin-backups/notification-engine-0.1.67-before-0.1.68-20261010T235729Z`.
The durable package is
`/home/pi/.signalk/plugin-packages/signalk-notification-engine-0.1.68.tgz` with
SHA-256
`4107860e5cd40a51269846feb9aaf10a727b5464859e1ed6637d2a30e25ac755`.

All 217 tests, syntax checks, package dry-run, and selected source/live hash
comparisons passed. Signal K and the WebApp returned HTTP 200; notifications,
rules, history, translations, and Diagnostics also returned HTTP 200. Embedded
Node-RED was ready at revision
`ec3ce1f77236f59b930f84d0b249ff83927245bd42d28e9c0689388bcd922c9a`
with runtime deploy events available. Android GPS was fresh, local history was
healthy at its configured 500-entry bound, and audio was ready with no active
process, open breaker, or unresolved system warning. The separate
`nodered.service` remained inactive.

Startup migration removed all four superseded `clearHistory*` fields from the
persisted Plugin Config. `playTestTone` and the one-shot Test Notification both
remained disabled, so deployment started neither a sound test nor a test
notification. The existing live GNSS warning was reconstructed with no
actionable audio and no playback process. A deliberate Test Notification
acceptance run remains separate from deployment.

## Notification Engine 0.1.67 baseline

Version `0.1.67` was deployed and verified on 2026-10-10. The complete prior
`0.1.66` installation is retained at
`/home/pi/.signalk/plugin-backups/notification-engine-0.1.66-before-0.1.67-20261010T224804Z`,
and the prior package manifest is retained as
`signalk-package-before-notification-engine-0.1.67-20261010T224804Z.json`.
The durable package is
`/home/pi/.signalk/plugin-packages/signalk-notification-engine-0.1.67.tgz` with
SHA-256
`323d699c494ff30b500484a62b5b610507bb9ec8189264d6e689e6cef7f34ac5`.

All 213 unit tests and package checks passed. Source/live hashes matched for
the runtime, WebApp bulk-action code, and HTTP adapter. The package and Signal K
plugin descriptions now state that Node-RED nodes visually create and
represent notification rules. Signal K and its health timer were active with
zero restarts after readiness, while the separate `nodered.service` remained
inactive. Authenticated notifications, rules, history, translations, and
Diagnostics returned HTTP 200. Embedded Node-RED and runtime deploy events
were ready, Android GPS was fresh, local history was healthy, and audio ended
with zero active processes, retries, breakers, or unresolved failures.

The global-action live check used the current table rules and notifications.
The two hidden Bilge `normal` records were excluded from bulk acknowledge,
`Silence all` had no target, and only the visible GNSS warning qualified for
`Acknowledge all`. Signal K had republished that warning with a new ID and
`acknowledged: false` during the full restart, so the remaining button was
correct rather than the former hidden-record defect. No bulk action was
invoked. The restart produced one expected finite `warn.wav` playback for the
new GNSS occurrence; it completed successfully in 976 ms.

External-task configuration retained one enabled exact path, but the deployed
rules contained no connected `execute` action. Diagnostics remained at zero
active and zero attempted tasks with no last result; no external script ran.

## Notification Engine 0.1.66 baseline

Version `0.1.66` was deployed and verified on 2026-10-09. The complete prior
`0.1.65` installation is retained at
`/home/pi/.signalk/plugin-backups/notification-engine-0.1.65-before-0.1.66-20261010T011754Z`,
and the previous local package manifest is retained beside it as
`signalk-package-before-notification-engine-0.1.66-20261010T011754Z.json`.
The durable package is
`/home/pi/.signalk/plugin-packages/signalk-notification-engine-0.1.66.tgz` with
SHA-256
`975f25821f2068e8866982f283590bf65a2078a0b48b4a23ce10f95f4aacf971`.
Selected source/live hashes matched for the package manifest, runtime,
external-task runner, rule extractor, history service, notification store,
restart-state repository, and WebApp icon.

Signal K and `signalk-health.timer` returned active with zero service restarts;
the separate `nodered.service` remained inactive. `/signalk` and the WebApp
returned HTTP 200, and authenticated notifications, rules, history,
translations, and Diagnostics endpoints returned HTTP 200. Embedded Node-RED
was ready at revision
`ec3ce1f77236f59b930f84d0b249ff83927245bd42d28e9c0689388bcd922c9a`,
its runtime-deploy interface was available, Android GPS was fresh, local
history was healthy at its 500-entry bound, and audio ended with zero active
processes, retries, open breakers, or unresolved failures.

External-task Diagnostics reported zero configured or enabled paths, zero
active or attempted tasks, and no last result. The live deployed-rules output
contained no `execute` action because the prototype branch is not connected.
No external task acceptance run was performed while the test pause remained
in force; the existing `/home/pi/scripts/SignalK/testscript_time.sh` was not
started or modified.

The full Signal K restart republished all 15 staged notifications with new
producer IDs. The continuing GNSS warning also differed in `method` and
`status`, so strict restart correlation correctly classified it as a new local
occurrence and its configured finite `warn.wav` played once. This was ordinary
notification audio, not the Alarm Sound Test and not an external task. It
completed successfully in 795 ms and did not remain active. This full-server
restart behaviour is distinct from the exact plugin-only restart continuity
that passed with `0.1.50`.

## Signal K 2.33.0 baseline

The live server was upgraded from Signal K `2.32.0` to `2.33.0` on
2026-10-07 before continuing restart-correlation diagnosis. The prior global
server package, `settings.json`, local package manifest, and plugin
configuration data are retained under
`/home/pi/.signalk/server-backups/signalk-server-2.32.0-before-2.33.0-20261008T012221Z`;
the server archive SHA-256 is
`e1489efe1597252677f01ca2a9a529413da6633e8f5e49d38f273cb20670c866`.

Post-update checks passed for Signal K and WebApp HTTP 200, embedded Node-RED
ready at revision
`ec3ce1f77236f59b930f84d0b249ff83927245bd42d28e9c0689388bcd922c9a`,
fresh `navigation.position` from `android_udp.gps`, Notification Engine's
seven-day maintenance interval, native SerialPort and CANboat module loading,
and passive ALSA backend/device health. The separate `nodered.service` remained
inactive. A new GNSS producer ID was expected after the full server restart and
its finite warning completed once; no audio process remained active. A focused
2.33.0 escalation-status test is still required before deploying Notification
Engine `0.1.50`.

The focused escalation test subsequently passed with two bounded,
plugin-owned runtime slots. In separate runs, an acknowledged warn and a
silenced warn were updated to alarm. Signal K retained each notification ID,
Notification Engine retained each local occurrence, both status booleans reset
to false, and the alarm loop started under the configured alarm policy. The
operator confirmed both warn and alarm sounds were audible. Each loop was then
silenced and its exact owned test slot cleared; no player process or retry
remained. Signal K `2.33.0` did retain a stale `acknowledgedAt` timestamp after
resetting `acknowledged` to false through `notifications.update()`. This is an
upstream status inconsistency to report; Notification Engine continues to
preserve the authoritative raw status rather than repairing it locally.

## Current installation boundary

The boat Raspberry Pi is reached as `pi@192.168.100.10` (normally through the
SSH alias `raspi`). Notification Engine is installed at:

```text
/home/pi/.signalk/node_modules/signalk-notification-engine
```

Its WebApp and primary API are:

```text
http://192.168.100.10:3000/signalk-notification-engine/
/plugins/signalk-notification-engine/notifications
```

Persistent configuration and local audit data live below Signal K's
`plugin-config-data` directory. A package rollback must not overwrite that
data. Signal K and the notification producer remain authoritative throughout a
deployment.

The graphical rules come only from the Node-RED instance embedded in Signal K.
Its live flow file is `/home/pi/.signalk/red/flows_openplotter.json`. The
separate `nodered.service` and `/home/pi/.node-red` are outside this project and
must not be used or restarted.

## Preflight

Before packaging, run locally:

```sh
npm run check
npm test
npm pack --dry-run
```

Before replacing the installed package, inspect the active notification and
audio state. Do not restart during an active safety-critical alarm or an audio
process. Confirm that Diagnostics reports a ready Node-RED configuration and no
active playback, retry, or half-open probe that the restart would interrupt.
Real anchor, bilge, and GPS fault injection requires its own explicitly agreed
safe operating window; routine deployment does not authorize it.

## Recoverable deployment sequence

1. Build the exact local package with `npm pack` and record its version and
   checksum.
2. Copy the tarball to a temporary location on the Pi.
   Then retain the verified tarball under
   `/home/pi/.signalk/plugin-packages/` and point the exact
   `signalk-notification-engine` dependency in `/home/pi/.signalk/package.json`
   to that persistent file. A dependency that still points to an older `/tmp`
   tarball can silently reinstall the old version after a manual replacement.
3. Stop `signalk-health.timer` temporarily. Its one-minute check can otherwise
   restart Signal K again while the server is still initializing.
4. Create a timestamped copy of the complete installed plugin directory under
   `/home/pi/.signalk/plugin-backups/`. Record the backup path and a hash of the
   installed `package.json` before replacement.
5. Extract the tarball into a fresh staging directory and verify the staged
   package name and version. Replace only the installed plugin package files;
   do not alter `plugin-config-data` or either Node-RED directory.
6. Restart `signalk.service` once. Keep the health timer stopped while Signal K
   initializes; this installation can take longer than one minute to become
   HTTP-ready.
7. After port 3000 is listening, make one bounded request to `/signalk`, then
   verify the Notification Engine diagnostics/configuration endpoints.
8. Start `signalk-health.timer` again and confirm both the service and timer are
   active.

Deployment is complete only after all of these checks pass:

- installed `package.json` reports the intended version;
- source package and installed files have the expected hashes;
- `signalk.service` and `signalk-health.timer` are active;
- `/signalk` and the Notification Engine WebApp/API respond;
- Diagnostics reports Node-RED configuration ready and audio ready, with no
  unexpected process, retry, circuit-breaker, or failure state;
- the embedded Node-RED runtime/deploy interface is compatible and the
  deployed-rules view matches the intended live flow;
- `nodered.service` remains inactive.

## Recoverable rollback

If startup or the live health/configuration checks fail:

1. Stop `signalk-health.timer` so it cannot race the recovery.
2. Move the failed installed plugin directory to a timestamped quarantine
   location; do not erase it.
3. Copy the recorded backup directory back to
   `/home/pi/.signalk/node_modules/signalk-notification-engine`.
4. Confirm the restored package version and ownership, restart
   `signalk.service` once, and repeat the bounded readiness and diagnostics
   checks.
5. Start and verify `signalk-health.timer` only after Signal K is healthy.

Keep the failed package, backup path, hashes, diagnostics result, and relevant
Signal K journal window until the cause is understood. A rollback restores
plugin code; it must not silently replace Node-RED rules or local audit data.

## Service-monitoring chain

The separate **Services to Signal K** plugin remains responsible for service
checks and creation of service-failure notifications. Notification Engine then
observes and presents those notifications. This monitoring relationship does
not transfer ownership of service state to Notification Engine.

## Latest verified deployment

Version `0.1.48` was deployed and verified on 2026-10-07 after an explicitly
approved controlled restart. Package SHA-256 is
`95149362922a163baae3752b4fc4e4d8b05538070e167c50179088fcf4968e29`,
and the durable dependency is
`file:plugin-packages/signalk-notification-engine-0.1.48.tgz`. The complete
0.1.47 plugin, Signal K package manifest, and pre-migration plugin options are
retained under
`/home/pi/.signalk/plugin-backups/notification-engine-0.1.47-before-0.1.48-20261007T2038-04`.

Version `0.1.49` was deployed on 2026-10-07 from package SHA-256
`170f6eee2aaf7a7c91843205b14f9dfb7f4e97a9aceffdf63b00079348b31590`.
The previous plugin and configuration are retained in
`/home/pi/.signalk/plugin-backups/notification-engine-0.1.48-before-0.1.49-20261008T005600Z`.
Signal K became active, the embedded Node-RED configuration reported ready at
revision `ec3ce1f77236f59b930f84d0b249ff83927245bd42d28e9c0689388bcd922c9a`,
restart-state persistence reported no write error, and the Alarm Sound Test
API reported the restored seven-day interval enabled. The full Signal K
restart changed the active GNSS warning producer ID (`e11f…` to `df7a…`), so
the finite warning replayed as a new lifecycle, as required by exact-ID
variant 1. An immediate check after an authenticated plugin-only restart
appeared to retain GNSS ID `df7af341-8cad-4873-8674-706a0c02c052`, occurrence
ID `occurrence-1791421090340-y268c33l42`, and the prior playback result, and the
operator heard no tone. A later interval change to `30` disproved that early
conclusion after asynchronous reconstruction settled: the GNSS producer ID was
still unchanged, but occurrence became
`occurrence-1791421760785-rb3w6lw0vcr` and `warn.wav` completed at
`2026-10-08T01:09:21.621Z`. The value-30 boundary passed and the interval was
restored to seven, but exact-ID finite no-replay remains a failed live test.

Version `0.1.50` was deployed on 2026-10-07 under an explicitly approved
Signal K restart window from package SHA-256
`939f5593a388682ba645e5bc9c5ea3c2331fccae25dd3a4da77bed65e3aaf9ba`.
The previous 0.1.49 package and configuration are retained under
`/home/pi/.signalk/plugin-backups/notification-engine-0.1.49-before-0.1.50-20261008T020246Z`.
Signal K performed a second automatic start during initialization and then
settled active. HTTP `/signalk`, the WebApp, and Diagnostics returned 200;
embedded Node-RED reported `ready` at revision
`ec3ce1f77236f59b930f84d0b249ff83927245bd42d28e9c0689388bcd922c9a`,
Android GPS was fresh, audio was ready, and the external `nodered.service`
remained inactive. The full server restart assigned new producer IDs and
correctly played the new GNSS warning lifecycle once.

An authenticated unchanged Plugin Config save then restarted only the plugin.
The 0.1.50 diagnostics staged 15 prior records and reported 15 exact matches.
In particular, GNSS retained producer ID
`567159aa-b1ad-4feb-8fe8-2fd3f61617d0` and occurrence
`occurrence-1791425139847-mjviiitnqxf`, with an empty `mismatchedFields` list.
The prior completed playback remained the last audio result; no process or
retry started either immediately or after the delayed reconstruction window.
This passes exact-ID finite no-replay on the Signal K 2.33.0 baseline. It does
not establish why the earlier 0.1.49 run failed, so that contrary observation
is retained above without assigning an unproved cause.

Version `0.1.57` was deployed and verified on 2026-10-08 under the approved
restart window from package SHA-256
`7d89e79f27daa976332484991f80284cac45890258794da7089459cd8bf7fd6e`.
The durable dependency is
`file:plugin-packages/signalk-notification-engine-0.1.57.tgz`; the immediately
preceding 0.1.56 installation and package manifest are retained under
`/home/pi/.signalk/plugin-backups/notification-engine-0.1.56-before-0.1.57-20261008T185400Z`
and
`/home/pi/.signalk/plugin-backups/signalk-package-before-notification-engine-0.1.57-20261008T185400Z.json`.
Signal K and its health timer settled active, the separate `nodered.service`
remained inactive, embedded Node-RED reported `ready` at revision
`ec3ce1f77236f59b930f84d0b249ff83927245bd42d28e9c0689388bcd922c9a`,
Android GPS was fresh, and audio settled with no active process, retry, open
circuit, or unresolved failure. The served WebApp loaded versioned 0.1.57 CSS
and JavaScript and rendered the German title `Benachrichtigungszentrale`.

The combined table-history view was then verified in the live WebApp. It
contained 494 grouped retained events and included both the Hoekens warning
`No position data received for 15 seconds.` at 07:13:44 local time and its
authoritative return to `normal` at 07:19:42. The combined view's local-history
delete button had both `hidden: true` and computed `display: none`; deletion
therefore remains available only after selecting one occurrence and never
changes Signal K state.

Version `0.1.58` was deployed on 2026-10-08 under an explicitly confirmed
restart window from package SHA-256
`c8a237c18a792337beb414aa84dbbe0342fec247cedaf1c1b9a89e9995df639c`.
The durable dependency is
`file:plugin-packages/signalk-notification-engine-0.1.58.tgz`; the complete
0.1.57 installation and package manifest are retained under
`/home/pi/.signalk/plugin-backups/notification-engine-0.1.57-before-0.1.58-20261008T191453Z`
and
`/home/pi/.signalk/plugin-backups/signalk-package-before-notification-engine-0.1.58-20261008T191453Z.json`.
Signal K and its health timer settled active, embedded Node-RED reported
`ready` with its unchanged verified revision, Android GPS was fresh, audio had
no active process or retry, and the separate `nodered.service` remained
inactive.

The live WebApp loaded the 0.1.58 global-action helper. Its DOM order placed
the Node-RED builder link immediately before the selected-notifications `h2`,
and the obsolete manual Refresh element was absent. With no unfinished audio,
global Silence had `hidden: true` and computed `display: none`. Global
Acknowledge remained visible because the current GNSS warning was still
Signal K-permitted and unacknowledged. The positive Silence-visible path is
unit-tested for running, repeat-waiting, and permission states; a fresh audible
runtime notification was deliberately not raised without a separate acoustic
test confirmation.

Version `0.1.59` was deployed on 2026-10-08 within the same confirmed restart
window from package SHA-256
`57c5adfc16493967faa17fbb24a31e76ee6c63aa1381bd16029d59a7f41831b4`.
The durable dependency is
`file:plugin-packages/signalk-notification-engine-0.1.59.tgz`; the previous
0.1.58 installation and package manifest are retained under
`/home/pi/.signalk/plugin-backups/notification-engine-0.1.58-before-0.1.59-20261008T230141Z`
and
`/home/pi/.signalk/plugin-backups/signalk-package-before-notification-engine-0.1.59-20261008T230141Z.json`.
Signal K and its health timer settled active, embedded Node-RED was ready,
Android GPS was fresh, audio was idle and healthy, and `nodered.service`
remained inactive. The Pi served the versioned 0.1.59 WebApp assets; a browser
cache-busted load showed no stale banner. Unit coverage confirms that a failed
or navigation-aborted poll retains a still-fresh snapshot but becomes stale at
the unchanged fifteen-second deadline. The physical Tab 3 pull-to-refresh
observation remains an operator check because browser chrome gestures cannot
be reproduced by the WebApp test harness.

Versions `0.1.60` through `0.1.64` were deployed during the same confirmed
restart window to diagnose and remove the physical Tab 3 pull-to-refresh
disconnect flash. Full-frame Android recordings showed that the remaining red
banner was not a server outage: slow localization startup delayed the first
authoritative notification poll until after the fifteen-second freshness
boundary. Version `0.1.64` starts Signal K polling independently and stores its
authoritative result while localization finishes in parallel. The operator
confirmed the gesture no longer showed the banner, and the 39.966-second
control recording contained zero red-banner regions. The final package
SHA-256 is
`65ffe3d50a965dd1675cf84a51d182dc0d18b1229db5f9fa2c92e4fba43791dc`;
the durable dependency is
`file:plugin-packages/signalk-notification-engine-0.1.64.tgz`. The immediately
previous installation and package manifest are retained under
`/home/pi/.signalk/plugin-backups/notification-engine-0.1.63-before-0.1.64-20261009T001500Z`
and
`/home/pi/.signalk/plugin-backups/signalk-package-before-notification-engine-0.1.64-20261009T001500Z.json`.
Final diagnostics reported embedded Node-RED `ready`, fresh Android GPS,
healthy idle audio with no retries, open breakers, or unresolved failures, and
healthy bounded history. Signal K and `signalk-health.timer` were active and
the separate `nodered.service` remained inactive.

After the mandatory embedded Node-RED configuration reached `ready`, the
one-time migration removed the known Node-RED-owned legacy duplicates from
Signal K Plugin Config. Operational fields including `audioPlayer`,
`audioDevice`, history limits, shortcuts, maintenance-test file, and
administrative history controls remained. The formerly blocked Plugin Config
save then accepted `alarmSoundTest.intervalDays: 1`; API and Tab 3 both showed
one remaining day without starting the maintenance test. A second save with
zero hid the Tab 3 button, exposed `enabled: false`, and an authenticated
direct start returned HTTP 409 with the expected disabled message.

That second save restarted the plugin and replayed the already-active GNSS
warning's finite `warn.wav` once under a new local occurrence. It was not the
maintenance test (`playTestTone` remained false and the retained self-test did
not change). Version `0.1.49` subsequently added exact restart correlation and
restored the configured interval to seven, but the delayed live result above
exposed an unresolved startup reconstruction race. The final live state had Node-RED
revision `ec3ce1f77236f59b930f84d0b249ff83927245bd42d28e9c0689388bcd922c9a`
ready, fresh Android GPS, HTTP 200 for Signal K and the WebApp, healthy audio
and history persistence, zero processes/retries/open breakers/failures, active
`signalk-health.timer`, and inactive external `nodered.service`. Source/live
hashes for `index.js`, `package.json`, `lib/plugin-runtime.js`, and
`lib/plugin-options-migration.js` matched.

Version `0.1.47` was previously deployed and verified on 2026-10-07 while the anchor watch
was explicitly disabled. Hoekens 2.13.1 represented the inactive
`navigation.anchor.state` by removing the value: the leaf first contained only
metadata and returned HTTP 404 after the controlled Signal K restart. The
implementation therefore accepts both explicit `off` and a removed value as
the local anchor-occurrence boundary. At startup there was no retained anchor
notification. A later controlled raise/re-drop test completed the live proof:
Hoekens reused one technical ID, the first local occurrence ended on Raise,
and the next Drop received a different local occurrence ID. A final Raise
restored anchor state `off` with healthy services and no audio work remaining.

The installed source hashes match the packaged local source. Signal K and
`signalk-health.timer` are active, `NRestarts=0`, `/signalk` and Diagnostics
return HTTP 200, Node-RED configuration is ready, GPS is fresh, history is
available, and audio reports zero processes, retries, open circuits, and
unresolved failures. The durable package reference is
`file:plugin-packages/signalk-notification-engine-0.1.47.tgz`; package SHA-256
is `063ebb7fe920518f95fbcc0b596fe9c3621fa4686deb8df38ca2d465f3762fc3`.
The complete previous plugin, manifest, and persistent lifecycle-rules file
are retained respectively at:

- `/home/pi/.signalk/plugin-backups/signalk-notification-engine-0.1.46-before-0.1.47-20261007T2322Z`
- `/home/pi/.signalk/plugin-backups/signalk-server-package-before-notification-engine-0.1.47-20261007T2322Z.json`
- `/home/pi/.signalk/plugin-backups/lifecycle-rules-before-0.1.47-20261007T2322Z.json`

The final local-audio-end refinement also retained the preceding installed
0.1.47 build at
`/home/pi/.signalk/plugin-backups/signalk-notification-engine-0.1.47-before-local-audio-end-20261007T2327Z`.

The first replacement attempt was automatically rolled back because the
root-owned persistent lifecycle-rules file rejected a write by `pi`. Service,
manifest, plugin version, and rule contents were verified at the 0.1.46
baseline before retrying with the required scoped privilege.

Before the lifecycle regression, Hoekens was present but disabled after its
update. Its HTTP route remained callable and threw on
`plugin.configuration.allowZoneOutsideVessel` because `plugin.start()` had not
initialized the configuration. Enabling the plugin through Signal K Plugin
Config restored the normal `off` state and allowed the controlled test; no
Hoekens source patch was applied.

Version `0.1.46` was previously deployed and verified on 2026-10-07. The installed files
had been silently returned to `0.1.26` after the preceding manual deployment
because `/home/pi/.signalk/package.json` still referenced the old
`file:../../../tmp/signalk-notification-engine-0.1.26.tgz`; the running process
remained `0.1.45` only until restart. The dependency now points to the durable
`file:plugin-packages/signalk-notification-engine-0.1.46.tgz`. The previous
on-disk `0.1.26` package is retained at
`/home/pi/.signalk/plugin-backups/signalk-notification-engine-0.1.26-live-20261007T2246Z`,
the pre-change Signal K package manifest at
`/home/pi/.signalk/plugin-backups/signalk-server-package-before-notification-engine-0.1.46-20261007T2246Z.json`,
and the earlier complete `0.1.45` source at its recorded backup path. Package
SHA-256 is
`1d99a3aa935c50d1f7f28234644040dfab30800cb9cc9c6c79c6cf02ab57a457`.
The Alarm Sound Test API reported the backward-compatible default interval of
seven days and enabled state while retaining the previous audit result. All
read-only Plugin endpoints returned HTTP 200; mandatory Node-RED configuration,
runtime deploy events, Android GPS, audio, and persistence were healthy, with
zero active audio processes, retries, open breakers, or unresolved failures.
Signal K and its health timer were active with zero restarts, external
`nodered.service` remained inactive, and source/live hashes matched. Live UI
checks for a changed interval and the zero-day hidden state remain pending; no
Alarm Sound Test or Plugin Config Sound Test was triggered during deployment.

Version `0.1.45` was deployed and verified on 2026-10-07. The complete prior
`0.1.44` installation is retained at
`/home/pi/.signalk/plugin-backups/signalk-notification-engine-0.1.44-live-20261007`
and at the sibling replaced path. Package SHA-256 is
`062c727d67631bb7cf41d029cd35503411855b31a18b4d43eaa2522cc6aa2740`.
This version adds explicit positive human confirmation to the bounded alarm
sound test. `/signalk`, notifications, rules, history, translations, and
diagnostics returned HTTP 200; the WebApp returned the expected HTTP 401
without an authenticated browser session. Mandatory Node-RED configuration and
runtime deploy events were ready; Android GPS was fresh; audio had zero active
processes, retries, open breakers, or unresolved failures; and source/live
hashes matched for the changed runtime and WebApp files. Signal K and its
health timer were active with zero restarts, external `nodered.service`
remained inactive, and the checked journal contained no Notification Engine
error. The new `Alarm heard` interaction remains a manual Tab 3 check; no
self-test tone was triggered during deployment.

Version `0.1.44` was deployed and verified on 2026-10-05. The complete prior
`0.1.43` installation is retained at
`/home/pi/.signalk/plugin-backups/signalk-notification-engine-0.1.43-live-20261005T230954Z`
and at the sibling replaced path. Package SHA-256 is
`231f758c166ae2ae3b5b18c266a5ce8c841b5387853193d658051ef3ffb19d3d`.
This release-preparation package adds the MIT license and public GitHub package
metadata without changing runtime behaviour. Configuration/runtime events,
audio, 500-entry history, and Android GPS were healthy; Signal K and its health
timer were active with zero restarts; external `nodered.service` remained
inactive; and source/live hashes for `package.json` and `LICENSE` matched.

Version `0.1.43` was deployed and verified on 2026-10-05. The complete prior
`0.1.42` installation is retained at
`/home/pi/.signalk/plugin-backups/signalk-notification-engine-0.1.42-live-20261005T223832Z`
and at the sibling replaced path. Package SHA-256 is
`7d4de376f4b3544dc431acaddfc3426636cfe60107bdc1436c4917c9d3121930`.
Notifications, rules, history, translations, and diagnostics returned HTTP
200. Mandatory Node-RED configuration and runtime deploy events were ready;
audio had zero processes, retries, open breakers, or unresolved failures;
History restored 500 entries without error; and Android GPS was fresh. Signal
K and its health timer were active with zero restarts, external
`nodered.service` remained inactive, the journal contained no Notification
Engine error line, and source/live hashes for `package.json`, `index.js`, and
`lib/plugin-runtime.js` matched. This completes the staged component-boundary
refactor recorded in Prio 4.

Version `0.1.42` was deployed and verified on 2026-10-05. The complete prior
`0.1.41` installation is retained at
`/home/pi/.signalk/plugin-backups/signalk-notification-engine-0.1.41-live-20261005T223136Z`
and at the sibling replaced path. Package SHA-256 is
`fe92259a8838fa1b947ace14995489b9e2c759faa3d80b097f817a792771275c`.
The extracted audio controller reconstructed one active warning and completed
its configured finite playback successfully, then reported zero processes,
retries, open breakers, or unresolved failures. Configuration/runtime events,
GPS, and the 500-entry history were healthy. Signal K and its health timer were
active with zero restarts, external `nodered.service` remained inactive, and
source/live hashes for `package.json`, `index.js`, and
`lib/audio-controller.js` matched.

Version `0.1.41` was deployed and verified on 2026-10-05. The complete prior
`0.1.40` installation is retained at
`/home/pi/.signalk/plugin-backups/signalk-notification-engine-0.1.40-live-20261005T221458Z`
and at the sibling `0.1.40-replaced` path with the same timestamp. The package
SHA-256 is
`2c1975c66d8701e505153ad3d2c8d133e07509abca8436d8276f288da62b2ba4`.
Live verification of `0.1.40` detected that Signal K did not yet expose the
plugin data directory during early plugin construction: diagnostics reported
history unavailable and the API contained only nine in-memory startup events.
The existing history file was neither deleted nor overwritten. `0.1.41`
resolves the directory when the service is configured at plugin start; after
restart both Diagnostics and the History API restored all 500 retained events,
with persistence available and no last error. Configuration and runtime deploy
events were ready; Android GPS was fresh; and audio had zero processes,
retries, open breakers, or unresolved failures. Signal K and
`signalk-health.timer` were active with zero service restarts, external
`nodered.service` remained inactive, the deployment journal contained no
Notification Engine error line, and source/live hashes for `package.json`,
`index.js`, and `lib/history-service.js` matched.

Version `0.1.39` was deployed and verified on 2026-10-05. The complete prior
`0.1.38` installation is retained at
`/home/pi/.signalk/plugin-backups/signalk-notification-engine-0.1.38-live-20261005T220405Z`
and at the sibling `0.1.38-replaced` path with the same timestamp. The package
SHA-256 is
`93e940c706b863fca19e690f509f144a722bf0a82005172e28e8ac327af25ffc`.
The snapshot boundary now owns read-only reconstruction, producer-source
enrichment, delta subscription, and periodic reconciliation. Two consecutive
live snapshots completed without error, the second in 141 ms; the delta count
advanced from 19 to 22 during observation; and 15 active records retained
their producer identities, including `engineroomStbd.XX`,
`hoekens-anchor-alarm`, `gnssOffsetCorrector`, `noaa-storms`, and
`engineroomPort.XX`. The WebApp, notifications, rules, and diagnostics returned
HTTP 200; Node-RED configuration and runtime deploy events were ready; Android
GPS was fresh; and audio had zero processes, retries, open breakers, or
unresolved failures. Signal K and `signalk-health.timer` were active with zero
service restarts, external `nodered.service` remained inactive, the deployment
journal contained no Notification Engine error line, and source/live hashes
for `package.json`, `index.js`, and `lib/snapshot-service.js` matched.

Version `0.1.38` was deployed and verified on 2026-10-05. The complete prior
`0.1.37` installation is retained at
`/home/pi/.signalk/plugin-backups/signalk-notification-engine-0.1.37-live-20261005T215335Z`
and at the sibling `0.1.37-replaced` path with the same timestamp. The package
SHA-256 is
`155bddbe8c274f9f609d0ac465899c35893ea1a89c47eb0dda5a45f7bf489372`.
The second component-boundary refactor moved readonly/readwrite route
registration and HTTP response formatting into the HTTP adapter without
changing domain ownership. `/signalk`, the WebApp, notifications, rules,
history, translations, and diagnostics returned HTTP 200. Node-RED
configuration and runtime deploy events were ready with revision
`ec3ce1f77236f59b930f84d0b249ff83927245bd42d28e9c0689388bcd922c9a`;
Android GPS input diagnostics were fresh; audio was ready with zero processes,
retries, open breakers, or unresolved failures; and history persistence was
healthy. Signal K and `signalk-health.timer` were active with zero service
restarts, external `nodered.service` remained inactive, the deployment journal
contained no Notification Engine error line, and source/live hashes for
`package.json`, `index.js`, and `lib/http-routes.js` matched.

Version `0.1.37` was deployed and verified on 2026-10-05. The complete prior
`0.1.36` installation is retained at
`/home/pi/.signalk/plugin-backups/signalk-notification-engine-0.1.36-live-20261005T214120Z`
and at the sibling `0.1.36-replaced` path with the same timestamp. The package
SHA-256 is
`d8f3a9d2035b4f0888d2821752b87a63a9830daff16c3fb9f3c940a1299d090a`.
The first component-boundary refactor moved declarative normalization into the
configuration service. `/signalk`, the WebApp and notifications API returned
HTTP 200; Node-RED configuration and runtime deploy events were ready; Android
GPS input diagnostics were fresh; and audio was ready with zero processes,
retries, open breakers, or unresolved failures. Signal K and its health timer
were active with zero service restarts, external `nodered.service` remained
inactive, and source/live hashes for `package.json`, `index.js`, and the new
configuration service matched.

Version `0.1.36` was deployed and verified on 2026-10-04. The complete prior
`0.1.35` installation is retained at
`/home/pi/.signalk/plugin-backups/signalk-notification-engine-0.1.35-live-20261005T024414Z`
and at the sibling `0.1.35-replaced` path with the same timestamp. The package
SHA-256 is
`90c9314b4547a13a3377b9cf76807df6d856853874d2651b859ae4f77c6ab029`.
Live Diagnostics reported the default critical input `Android GPS` as `fresh`:
`navigation.position` was produced by the expected `android_udp.gps` source,
had a valid producer timestamp, a 387 ms age, and a present value. This
read-only check used the existing local Signal K leaf and did not alter the
embedded flow, subscribe to all paths, create a notification, or affect alarm
processing. Signal K endpoints returned HTTP 200; Node-RED configuration,
runtime deploy events, audio, and history were ready with no active processes,
retries, open breakers, or unresolved failures. Startup reconstruction played
the still-active GNSS warning once successfully and returned to idle.

Version `0.1.35` was deployed and verified on 2026-10-04. The complete prior
`0.1.34` installation is retained at
`/home/pi/.signalk/plugin-backups/signalk-notification-engine-0.1.34-live-20261005T023221Z`
and at the sibling `0.1.34-replaced` path with the same timestamp. The package
SHA-256 is
`ea1c961a8bfecefc84f82e90e86e18f7afd40ece510f576f5b38e525ca7cf46a`.
The installed validator rejected an active whitespace-only sound path and
accepted the same explicit empty path with `sound.active: false`; this used
synthetic in-process rules and did not alter the real embedded flow. `/signalk`,
the WebApp, notifications API, and deployed-rules endpoint returned HTTP 200.
Diagnostics reported ready Node-RED configuration and runtime-deploy support,
ready audio with zero active processes, retries, open breakers, or unresolved
failures, and healthy history. Signal K and `signalk-health.timer` were active,
the external `nodered.service` remained inactive, and source/live hashes for
`package.json` and `lib/flow-rules.js` matched. Startup reconstruction played
the still-active GNSS warning once successfully and returned to idle.

Version `0.1.34` was deployed and verified on 2026-10-04. The complete prior
`0.1.32` installation is retained at
`/home/pi/.signalk/plugin-backups/signalk-notification-engine-0.1.32-live-20261004T221515-0400`
and at the sibling `0.1.32-replaced` path with the same timestamp. The package
SHA-256 is
`c8062a13abc615c75d8c1348f4cc9b90dc89d9dbd6308888b5f6b307d0ead141`.
Both read-only translation endpoints returned complete English and German
catalogs with 135 keys and no validation errors. Tab 3 loaded the `0.1.34`
assets, selected German from its browser preferences, switched live to English
and back through the language button, persisted `de` locally, and showed no
undefined text. Signal K and `signalk-health.timer` were active; the embedded
Node-RED configuration and runtime-deploy interface were ready; audio was ready
with zero active processes, retries, open breakers, or unresolved failures;
history was healthy; and the separate `nodered.service` remained inactive.
Source/live hashes for the API, WebApp localization code and both catalogs
matched exactly.

Version `0.1.32` was deployed and verified on 2026-10-04. Version `0.1.31`
is retained at
`/home/pi/.signalk/plugin-backups/signalk-notification-engine-0.1.31-20261004T233830Z.tgz`
and as the recoverable live directory ending in
`signalk-notification-engine-0.1.31-live-20261004T233830Z`. The user-edited
192-node flow containing the disconnected builder example for
`payload.sound.pauseSeconds: 3` is retained at
`/home/pi/.signalk/red/notification-engine-backups/pause-seconds-user-flow-20261002T005405Z.json`
with SHA-256
`8f00ebf0d1c78858d3f52b425fc39110f6d04725848fac67f8292e740cbe65b5`.

The isolated `count: 3`, `pauseSeconds: 2` live test started and successfully
completed exactly three players. The measured end-to-next-start gaps were
approximately two seconds. An invalid `pauseSeconds: 6` deploy correctly
disabled processing and reported its validation error. The earlier recovery
replay was traced to equivalent absolute and relative spellings of one sound
file. Version `0.1.32` canonicalizes the playback signature to the player's
resolved absolute path. In the final live regression, the Runtime Slot played
once as PID 3020272, invalid configuration failed closed, and valid recovery
left that PID and the existing GNSS completion unchanged with no replay.
The complementary live cases also passed: a real signature change from
`warn.wav` to `alert.wav` played once for the same occurrence (PIDs 3021641
and 3021751), and an interrupted `count: 0` loop resumed after valid recovery
(active PID 3022143) before authenticated Silence stopped it without changing
the authoritative `warn` state.

The live ALSA inventory on 2026-10-04 contains `vc4-hdmi-0` as card 0,
`vc4-hdmi-1` as card 1, and `bcm2835 Headphones` as card 2, all on device 0.
Notification Engine is configured for `plughw:2,0`, equivalent to
`plughw:CARD=Headphones,DEV=0`; its passive watchdog reports the PCM ready.
The earlier physical loudspeaker-off/on test and audible recovery used this
same device. Card indices are installation-specific and must be rechecked with
`aplay -l` after hardware or operating-system changes.

The WebApp uses a twelve-second request deadline and a fifteen-second
stale threshold after live samples showed a healthy response could take 8.551
seconds. Tab 3 loaded the new threshold and remained connected over multiple
poll cycles. A separate exact-path runtime test proved that Silence during a
five-second pause after the first of three requested plays cancels both pending
plays without changing the authoritative `warn` state. The original flow was
restored byte-for-byte. Final state was configuration/audio ready with no test
rules, runtime slots, processes, retries, open breakers, or unresolved
failures. Signal K and the health timer were active with zero service restarts;
external `nodered.service` remained inactive. Source/live hashes for the
changed plugin files matched.

### Previous 0.1.26 sound-count deployment

Version `0.1.26` was deployed and verified on 2026-09-30. Version `0.1.25` is
retained at
`/home/pi/.signalk/plugin-backups/signalk-notification-engine-0.1.25-20261001T011500Z.tgz`.
The user-deployed embedded flow is independently retained at
`/home/pi/.signalk/red/notification-engine-backups/sound-count-user-deploy-20261001T011500Z.json`
with SHA-256
`6d20b48025dce1e91d97c475dcaa04fbec46771ed6ca232324e717a6c17f33a2`.
The plugin loaded all 10 rules from revision
`ec3ce1f77236f59b930f84d0b249ff83927245bd42d28e9c0689388bcd922c9a`;
the seven active sound rules retained canonical `count: 0` loops. Effective
live policies exposed only canonical counts, including `count: 1` for the
existing GNSS warning. The one startup playback completed successfully and
did not replay while deltas advanced. Final state was zero audio processes,
retries, open breakers, and unresolved failures; Signal K and its health timer
were active with zero service restarts, while external `nodered.service`
remained inactive. Source/live hashes for all changed runtime files matched.

### Previous 0.1.25 finite-playback verification

Version `0.1.25` was deployed and verified on 2026-09-30. Version `0.1.24` is
retained at
`/home/pi/.signalk/plugin-backups/signalk-notification-engine-0.1.24-20261001T005132Z`.
Startup reconstruction played the existing real GNSS warning once. Its
completed result remained PID 2537577 while Diagnostics advanced through
multiple snapshots and from 10 to 43 received deltas, proving that unchanged
finite playback was not restarted. Final state was zero active audio
processes, retries, open breakers, or unresolved audio failures. Source/live
hashes for `package.json`, `index.js`, and `lib/audio-playback-registry.js`
matched; Node-RED configuration and runtime deploy events were ready, and
Signal K plus `signalk-health.timer` were active with zero service restarts.

### Previous 0.1.24 inactive-sound verification

Version `0.1.24` was deployed and verified on 2026-09-30. Version `0.1.23` is
retained at
`/home/pi/.signalk/plugin-backups/signalk-notification-engine-0.1.23-20261001T003716Z`.
The isolated `sound.active: false` Runtime-Slot test passed, the temporary
Node-RED test branch was removed through a valid runtime deploy, and the
original 192-node flow returned byte-for-byte with configuration ready.

### Previous 0.1.23 UI verification

Version `0.1.23` was deployed and verified on 2026-09-30. The previous
`0.1.22` installation is retained at
`/home/pi/.signalk/plugin-backups/signalk-notification-engine-0.1.22-20260930T234547Z`.
After the single controlled restart, the WebApp and `/signalk` returned HTTP
200, Node-RED configuration and its runtime-deploy interface were ready, audio
reported no active processes, retries, open breakers, or unresolved failures,
and the source/live hashes of the changed package and WebApp files matched.
`signalk.service` and `signalk-health.timer` were active again, while the
external `nodered.service` remained inactive.

The same deployed WebApp was then inspected live in Chrome on Tab 3 at
`192.168.100.18`. It loaded the `0.1.23` cache keys with no health banner. The
visible Silence, Acknowledge, and Clear controls measured 76 × 60 CSS pixels;
the labelled local-history Delete control measured 101 × 54 CSS pixels. The
detail and history windows were visually checked without invoking a
notification action or deleting an audit entry.
