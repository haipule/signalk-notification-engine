# Node-RED configuration migration

The first migration targets the Node-RED instance embedded in Signal K. The
standalone `nodered.service` is not used.

## Ownership boundary

Signal K remains responsible for plugin lifecycle and server logging. The
plugin's `start()` and `stop()` methods continue to create and tear down the
bridge to Node-RED. Signal-K logging and its log-level configuration remain in
Signal K Plugin Config.

Node-RED becomes the owner of notification behaviour where it can represent
and execute that behaviour reliably. The plugin remains the safety boundary
for Signal K API calls and lifecycle state.

| Current Plugin Config area | First target | Reason |
| --- | --- | --- |
| `policies` | Node-RED | Flow conditions and presentation decisions |
| `classificationRules` | Removed | Categories are automatic display metadata; do not configure them in Node-RED. |
| `stateOrder`, `visibleStates` | Removed | Signal K state severity is fixed; rules control treatment and explicit visibility. |
| `stateColors`, `visualRules` | Node-RED | Visual presentation decisions |
| `soundsByState`, `soundPaletteFile` | Node-RED | Sound selection and timing |
| `historyRules` | Node-RED | Legacy history routing decisions |
| `testNotif` | Signal K | One-shot maintenance trigger and bounded owned test lifecycle |
| `audioPlayer`, `audioDevice`, `testTonePath`, `alarmSoundTest` | Signal K initially | Host/device boundary, safe execution, and local maintenance interval |
| `historyLimit`, `historyRetentionDays` | Signal K initially | Local persistence ownership |
| former `clearHistory*` fields | removed | Selected local occurrences are deleted in Notification Centre History |
| `shortcutInfo`, `shortcutHistory` | Signal K initially | WebApp input handling |
| plugin enabled/start/stop and logging | Signal K | Signal K lifecycle and logging authority |

The selected Rule Builder flow is authoritative only for connected treatment
rules. During the final compatibility stage, startup and each successful
deploy still read the legacy `Notification Engine config` node, but only an
explicit allowlist of its presentation, sound, and history treatment fields
can be applied. The complete object is never merged over Signal K Plugin
Config. Host audio, maintenance tests, persistence limits, browser controls,
critical-input diagnostics, flow selection, and exact external-task
authorization remain protected Plugin Config values.

Known obsolete or misplaced legacy-node fields (`classificationRules`,
`historyStates`, `stateOrder`, `visibleStates`, `testNotif`, and browser
shortcuts) are removed from the effective configuration before checksumming.
They cannot alter processing or cause a reload, while the source flow remains
untouched until the operator performs the documented final node removal.

Version `0.1.85` removes the node as a startup requirement. The explicitly
selected active tab and its connected rules are the mandatory deployed
configuration; absence of the legacy inject node contributes an empty
compatibility object. Exactly one old node is still accepted for the staged
live-parity proof, while duplicates are invalid. All selected-tab and rule
validation boundaries remain fail closed.

Starting with version `0.1.48`, a successful validated startup also removes
known obsolete Node-RED-owned duplicates from the persisted Signal K plugin
options. This one-time cleanup is deliberately allowlisted; unknown fields are
not silently discarded. The cleanup is not attempted when the embedded
Node-RED configuration is missing or invalid, and operational Signal K fields
remain byte-for-byte unchanged. This prevents pre-migration options from
causing strict Plugin Config saves to fail with `must NOT have additional
properties`.

## Startup contract

Signal K starts the plugin with only the required technical options. Before
notification processing begins, the plugin must obtain a valid deployed
configuration from internal Node-RED. If Node-RED is unavailable or the
configuration is invalid, plugin startup fails and Signal-K logging reports the
reason. The plugin must not silently fall back to stale or default behaviour.

## Deploy integration and updates

The internal Node-RED runtime exposes its event bus in the same Signal-K
process. A deploy emits `runtime-event` with `id: "runtime-deploy"` and a flow
revision. The Notification Engine listens to that event through the shared
Node-RED runtime and reloads the active flow configuration.

The Notification Engine must not modify files below Signal K's managed
`node_modules` directory at runtime. No patch of
`@signalk/signalk-node-red/index.js` is required. A Node-RED package update
may change the runtime event API; the engine must check that the expected event
interface exists and refuse startup with a Signal-K log error if it does not.

Node-RED flow files are stored separately in the embedded Signal K Node-RED
user directory. On the project Raspberry Pi the authoritative live file is
`/home/pi/.signalk/red/flows_openplotter.json`; the separate system service and
its user directory are outside this project. A compatible Node-RED package
update does not replace the deployed flow, which remains the source of the
configuration after Signal K restarts.

The Notification Engine also keeps the last valid selected Rule Builder flow
document in a sibling directory named
`notification-engine-backups/last-valid-flow.json`. A valid startup or deploy
updates this backup atomically. If a deploy removes or corrupts the
selected Rule Builder configuration, the embedded runtime restores that backup
through Node-RED's `setFlows` API, retaining the currently deployed
credentials. A flow without a valid engine configuration is therefore never
accepted silently as the new notification configuration.

## Change detection

The deploy event is only a reload trigger. The engine extracts the
Notification-Engine configuration from the active flow, normalizes it into a
stable representation, and calculates a checksum. A deploy with the same
checksum does not restart processing. A changed checksum is validated first
and then applied as one configuration update. The Node-RED revision is useful
for diagnostics but is not by itself evidence of a behavioural change.

## Historical first integration test

The first prototype replaced its `Policy snapshot` inject node with a temporary
Notification Engine compatibility block. Current shipped flows no longer
contain that node. The historical minimal payload was:

```json
{
  "schemaVersion": 1,
  "notificationEngine": {}
}
```

The adapter test covers valid startup configuration, identical deploy without
an update, a changed effective setting with exactly one update, and a malformed
or unsupported payload that is rejected without replacing the last valid
configuration. Legacy `stateOrder` and `visibleStates` fields are discarded.
The test uses an isolated prototype tab; existing Signal-K production flows
are not changed.
