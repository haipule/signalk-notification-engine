# Notification Engine user guide

## What the plugin does

Notification Engine provides one WebApp for active Signal K notifications and
a visual Rule Builder based on the Node-RED instance embedded in Signal K. It
controls local display, local audit History, server-side sound, and bounded
delivery to an explicitly authorized executable. The notification producer
and Signal K remain authoritative for every notification lifecycle.

## Install and enable

Install the package through Signal K, but leave Notification Engine disabled
until the Rule Builder flow below has at least one valid deployed branch. The
embedded Node-RED runtime must be available. The plugin fails closed if the
selected Rule Builder tab is missing, disabled, empty, or invalid.

For manual Raspberry Pi deployment and rollback, use
[Pi integration notes](pi-integration.md). Never deploy this project to a
separate `nodered.service` or to `/home/pi/.node-red`.

## Import and select the Rule Builder flow

1. Open the Node-RED editor embedded in Signal K.
2. Import `node-red/notification-engine-release-flow.json` as a new tab.
3. Confirm that no imported node has a red invalid-node triangle.
4. Leave the tab active, connect at least one intended complete branch to the
   supplied `Activate` node, and deploy. For a first installation, use the
   documented Quick Start branch.
5. In Notification Engine Plugin Config, enable the plugin, select the tab
   under **Rule Builder Flow**, verify the read-only stable ID shown below it,
   and save.

Only the selected stable ID is read. Renaming the tab is harmless, but
disabling or deleting it stops processing. The engine never scans other tabs
or falls back to a matching name.

## Build a rule

One rule is one uninterrupted message-flow branch:

```text
Notification state → optional match/condition → action(s) → Activate
```

`Activate` is a standard debug node named exactly `Activate`. Placing nodes on
the tab does nothing until the complete branch reaches `Activate` and the flow
is deployed. Branches do not implicitly share a payload; keep every property
needed by a rule on the same connected branch. An exact-path rule is more
specific than a state-only rule and overrides only the fields it sets.

Multiple `Activate` nodes are supported. Contradictory assignments for the
same scope reject the deploy instead of depending on Node-RED JSON order.

The reference flow documents state, path, condition, visibility, table/banner/
overlay presentation, color, flash, History, sound, Ignore, and Execute nodes.
Open each node's Info panel for its purpose and example. Keep Sound, Ignore,
and Execute examples disconnected until intentionally configured.

## Plugin Config ownership

Signal K Plugin Config is the protected location for host or privileged
settings:

- **Rule Builder Flow** — selected active embedded Node-RED tab
- **Audio Player** and **Audio Device** — WAV command and ALSA PCM
- **Sound Test File** and **Sound Test** — one technical playback after save
- **Alarm Sound Test** — `0` disables it; `1` to `30` sets the day interval
- **History Entries** and **History Retention** — local audit limits
- **Info Auto-Close**, **Info Shortcut**, and **History Shortcut**
- **Critical Input Diagnostics** — read-only path/source freshness checks
- **External Tasks** — concurrency and exact per-file authorization
- **Test Notification** — one bounded maintenance notification after save

Notification match, visibility, presentation, History admission, sound
treatment, Ignore, and execution requests belong in the selected Rule Builder.

## Notification Centre

The table shows all active notifications, including unknown states. Known
states sort in fixed descending order:

```text
emergency, alarm, warn, alert, normal, nominal
```

Select a row for its information window and individual permitted actions.
Global actions apply only to the exact records visible in the table.

- Acknowledge is available for any state when Signal K permits it.
- Emergency is never offered Silence by this plugin.
- Clear is available only when `status.canClear` is true.
- If the browser lacks write permission, an otherwise applicable action stays
  visible but disabled with an authorization explanation.

A banner is a fixed strip inside the centre; an overlay is the full attention
layer. Acknowledging an emergency removes its overlay but neither changes the
emergency state nor stops independent server-side audio.

## Audio and repetition

Audio plays on the Signal K host, not in each browser. Playback count is:

> **Important:** Other installed plugins, flows, alarm applications, or
> scripts may produce additional audio for the same alarm. This can cause
> duplicate, overlapping, or independently controlled sounds. The operator
> must check for and prevent these interactions and leave only the intended
> audio path active for an alarm.

- `0` — loop until its independent lifecycle or permitted Silence ends it
- `1` — play once
- `2` through `99` — play exactly that many times

`payload.sound.pauseSeconds` accepts only whole seconds from `0` through `5`
and applies between complete plays. Invalid values reject the rule.

Diagnostics can prove that the player and ALSA PCM exist, but not that the
amplifier, volume, cable, and speaker are audible.

### Sound Test

Plugin Config **Sound Test** plays the configured file once after saving. It
checks the technical route and does not complete the scheduled Alarm Sound
Test.

### Alarm Sound Test

The Notification Centre test opens an operator-feedback window after playback.
Choose **Alarm heard** or **Sound not heard**. Only **Alarm heard** records
confirmed human audibility; a successful player exit alone is not an audible
pass.

## Local History

History is a bounded local audit. An explicitly visible rule enables History
by default; `history: true` or `history: false` may override it. The decision
is retained for the complete local occurrence so an admitted occurrence keeps
its final normal/cleared transition.

Deleting History removes only local audit data. It never deletes, clears, or
changes a Signal K notification. Removing a rule affects future recording and
does not automatically purge earlier entries.

## External tasks

A rule requests one executable by setting only `payload.execute` to an
absolute path and reaching `Activate`. Plugin Config must contain the exact
same path with its per-file **Enabled** switch on; there is no global switch.

The engine starts the path directly, with no dynamic notification arguments or
additional shell. Shell scripts work through their shebang. An accepted path
is attempted at most once per occurrence, uses its configured timeout and the
global concurrency limit, and is never retried. Task results are local audit
and Diagnostics data only; they never change the notification lifecycle.

## Test Notification

**Run Test Notification Once** raises one clearly marked bounded Signal K test
after saving Plugin Config. The plugin clears only its returned owned ID and
then resets the switch. Signal K may retain the completed record as `normal`.
This administrative test is separate from Sound Test and Alarm Sound Test.

## Diagnostics

Diagnostics is read-only and separates browser, plugin, Node-RED, input,
persistence, external-task, and audio conditions. A healthy installation shows:

- matching browser and server versions
- Node-RED configuration `ready` and deploy events available
- the expected rule count and checksum
- audio backend/PCM ready with no unexpected active process
- expected critical inputs fresh and from the configured source
- no localization or persistence error

Raw paths, sources, IDs, producer messages, and diagnostics are intentionally
not translated.

## Language and custom translations

The WebApp ships English and German. The language button stores a choice per
browser; otherwise browser languages are used and English is the fallback.

Custom translations are declarative JSON files in the persistent
`translations` directory under the Signal K plugin data path:

```json
{
  "schemaVersion": 1,
  "locale": "nl",
  "name": "Nederlands",
  "messages": {
    "app.title": "Meldingscentrum"
  }
}
```

Unknown keys are ignored. Unsafe markup, wrong types, excessive size, and
incompatible placeholders are rejected. Missing strings fall back to English;
localization errors never stop notification processing.

## Upgrade

1. Record version, selected stable tab ID, rule checksum, and Diagnostics.
2. Back up the installed plugin and embedded Node-RED flow.
3. Install the package and restart `signalk.service` when required.
4. Wait for full Signal K, embedded Node-RED, and plugin initialization.
5. Verify version, configuration `ready`, rule IDs/checksum, critical inputs,
   audio idle state, and served WebApp version.
6. Reload long-running browser tabs if Diagnostics reports a version mismatch.

Package updates do not replace the separately stored embedded Node-RED flow.

## Troubleshooting

### Configuration is not ready

Confirm the selected stable tab exists, is active, contains a valid branch to
`Activate`, and has been deployed. No similarly named tab is used as fallback.

### Browser shows an old version

Reload the page without cache. Diagnostics reports browser/server mismatches.

### No sound

Check Audio Player and Audio Device, inspect Diagnostics, run Sound Test for
the technical route, then Alarm Sound Test for confirmed audibility.

### Action is disabled

Open the information window. Its reason distinguishes producer capability from
missing write permission for the current browser user.

### External task did not run

Confirm exact path equality, per-file enablement, a wire to `Activate`, and a
new occurrence. Inspect the external-task audit for the delivery result.

## Rollback

Restore the backed-up installed package and restart Signal K. Restore a backed-
up embedded flow through embedded Node-RED if a flow deploy caused the fault.
Do not enable the legacy `Audio Alarms` tab while Notification Engine audio is
active. Tested procedures are maintained in
[Pi integration notes](pi-integration.md).
