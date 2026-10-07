# Raspberry Pi deployment and rollback

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

Version `0.1.46` was deployed and verified on 2026-10-07. The installed files
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
