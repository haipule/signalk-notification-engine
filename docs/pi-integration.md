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

Version `0.1.29` was deployed and verified through 2026-10-04. Version `0.1.28`
is retained at
`/home/pi/.signalk/plugin-backups/signalk-notification-engine-0.1.28-20261002T011444Z.tgz`
and as the recoverable live directory ending in
`signalk-notification-engine-0.1.28-live-20261002T011444Z`. The user-edited
192-node flow containing the disconnected builder example for
`payload.sound.pauseSeconds: 3` is retained at
`/home/pi/.signalk/red/notification-engine-backups/pause-seconds-user-flow-20261002T005405Z.json`
with SHA-256
`8f00ebf0d1c78858d3f52b425fc39110f6d04725848fac67f8292e740cbe65b5`.

The isolated `count: 3`, `pauseSeconds: 2` live test started and successfully
completed exactly three players. The measured end-to-next-start gaps were
approximately two seconds. An invalid `pauseSeconds: 6` deploy correctly
disabled processing and reported its validation error; the saved valid flow
recovered through a second runtime deploy without restarting Signal K. That
recovery replayed the unchanged active GNSS warning once and remains an open
defect.

The `0.1.29` WebApp uses a twelve-second request deadline and a fifteen-second
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
