'use strict'

const fs = require('node:fs')
const path = require('node:path')

const TAB_ID = 'notification-engine-release-flow'
const OUTPUT = path.join(__dirname, '..', 'node-red', 'notification-engine-release-flow.json')

function inject(id, name, state, x, y, info, wires = []) {
  return {
    id,
    type: 'inject',
    z: TAB_ID,
    name,
    props: [{ p: 'payload' }],
    repeat: '',
    crontab: '',
    once: false,
    onceDelay: 0.1,
    topic: '',
    payload: JSON.stringify({ state }),
    payloadType: 'json',
    x,
    y,
    wires: [wires],
    info
  }
}

function change(id, name, rules, x, y, info, wires = []) {
  return {
    id,
    type: 'change',
    z: TAB_ID,
    name,
    rules,
    action: '',
    property: '',
    from: '',
    to: '',
    reg: false,
    x,
    y,
    wires: [wires],
    info
  }
}

function set(property, value, type = 'str') {
  return { t: 'set', p: property, pt: 'msg', to: String(value), tot: type }
}

function note(id, name, x, y, info) {
  return { id, type: 'comment', z: TAB_ID, name, info, x, y, wires: [] }
}

function group(id, name, nodes, x, y, w, h, fill) {
  return {
    id,
    type: 'group',
    z: TAB_ID,
    name,
    style: {
      stroke: fill,
      fill,
      'fill-opacity': 0.18,
      label: true,
      'label-position': 'n',
      color: '#202020'
    },
    nodes,
    x,
    y,
    w,
    h
  }
}

const flow = [
  {
    id: TAB_ID,
    type: 'tab',
    label: 'Notification Engine - Release Flow',
    disabled: false,
    info: [
      '# Notification Engine release reference flow',
      '',
      'This tab is a safe, copyable catalog for authoring Notification Engine rules in the Node-RED instance embedded in Signal K.',
      '',
      '**No rule in this imported tab is active by default.** A rule exists only when one uninterrupted wire starts at a notification-state node, passes through the desired match/action nodes, and ends at a debug node named exactly `Activate`.',
      '',
      'The Quick Start example deliberately stops one wire short of Activate. Connect that final wire only when you want the example to affect live notifications. Sound and Execute examples are also disconnected and must never be enabled merely to inspect this tab.',
      '',
      'Signal K and the notification producer remain authoritative. Rules control local presentation, history, audio, and bounded task delivery; they do not create a competing notification lifecycle.'
    ].join('\n')
  },

  note('ne-note-quick', '1. QUICK START', 140, 40,
    'The example below makes `alert` notifications visible in the table. It intentionally stops before Activate. Connect `Quick Start: show in table` to the supplied Activate node to enable it, then verify the generated rule in Notification Engine before relying on it.'),
  inject('ne-quick-alert', 'Quick Start: alert', 'alert', 150, 145,
    'Purpose: begin a rule matching Signal K notifications in state `alert`.\n\nExample: connect this node through `Quick Start: show in table` and finally to `Activate`.\n\nSafety: the node has no effect unless the complete wire reaches a node named exactly `Activate`.', ['ne-quick-table']),
  change('ne-quick-table', 'Quick Start: show in table', [set('payload.visibleInTable', true, 'bool')], 470, 145,
    'Purpose: show matching notifications in the active notification table.\n\nAccepted value: boolean. This example sets `true`.\n\nHistory interaction: visible notifications inherit local history recording unless a later connected History node explicitly overrides it.\n\nThe final wire to Activate is intentionally missing.', []),
  {
    id: 'ne-activate',
    type: 'debug',
    z: TAB_ID,
    name: 'Activate',
    active: false,
    tosidebar: true,
    console: false,
    tostatus: true,
    complete: 'payload',
    targetType: 'msg',
    statusVal: 'payload',
    statusType: 'auto',
    x: 780,
    y: 145,
    wires: [],
    info: 'Purpose: terminate and activate one complete rule branch. The name must remain exactly `Activate`.\n\nA rule is ignored unless an uninterrupted wire reaches this node. Keep the final wire disconnected while inspecting or copying examples.'
  },

  note('ne-note-states', '2. STATES', 370, 40,
    'Choose exactly one state source for each rule branch. These are match sources, not buttons that raise real notifications. Supported canonical states are emergency, alarm, warn, alert, nominal, and normal.'),
  inject('ne-state-emergency', 'State: emergency', 'emergency', 150, 240, 'Purpose: start an `emergency` rule. Example: connect to Overlay, a siren Sound File, Sound Loop, and Activate. Safety: emergency is always treated as non-silenceable by Notification Engine even if stale source data says otherwise.'),
  inject('ne-state-alarm', 'State: alarm', 'alarm', 150, 290, 'Purpose: start an `alarm` rule. Example: connect to Banner, Show in table, History enabled, and Activate. Signal K capability flags still control Silence, Acknowledge, and Clear.'),
  inject('ne-state-warn', 'State: warn', 'warn', 150, 340, 'Purpose: start a `warn` rule. Example: connect to Show in table and Activate for a general warning policy, or add an exact Path before the actions for a specific override.'),
  inject('ne-state-alert', 'State: alert', 'alert', 150, 390, 'Purpose: start an `alert` rule. Example: connect through Show in table to Activate. The state value is canonical machine data and is never localized.'),
  inject('ne-state-nominal', 'State: nominal', 'nominal', 150, 440, 'Purpose: start a `nominal` rule. Example: use it only when producers publish `nominal`. Acknowledge remains available whenever Signal K reports `canAcknowledge: true`; state alone does not ban it.'),
  inject('ne-state-normal', 'State: normal', 'normal', 150, 490, 'Purpose: start a `normal` rule. Example: use a path-specific normal rule only for an explicitly intended recovery action. Normal-state external execution additionally requires per-file permission in Plugin Config.'),

  note('ne-note-match', '3. MATCH SCOPE', 610, 40,
    'Add match nodes immediately after a state source. An exact path is more specific than a wildcard path, and a matching path-specific rule overrides corresponding general-state values. Conditions are ANDed and read current Signal K values.'),
  change('ne-match-exact', 'Match: exact notification path', [set('payload.match.path', 'notifications.navigation.anchor')], 500, 240,
    'Purpose: restrict the branch to one exact Signal K notification path.\n\nAccepted value: one non-empty string. Example: `notifications.navigation.anchor`.\n\nSpecificity: an exact path takes priority over wildcard and state-only defaults for properties it supplies.', []),
  change('ne-match-wildcard', 'Match: wildcard notification path', [set('payload.match.path', 'notifications.propulsion.*')], 500, 290,
    'Purpose: restrict the branch to a notification path family.\n\nAccepted value: a string using `*` as the wildcard. Example: `notifications.propulsion.*`.\n\nUse an exact path for a single producer path.', []),
  change('ne-condition-string', 'Condition: engine is started', [set('payload.match.conditions', 'propulsion.stbdEngine.state ==="started"')], 500, 340,
    'Purpose: apply the rule only while another Signal K value matches.\n\nAccepted operators: `===`, `!==`, `==`, `!=`, `>`, `>=`, `<`, `<=`. Example: `propulsion.stbdEngine.state ==="started"`.\n\nMultiple connected condition nodes form one AND condition set on the same branch.', []),
  change('ne-condition-number', 'Condition: voltage below 12', [set('payload.match.conditions', 'electrical.batteries.house.voltage < 12')], 500, 390,
    'Purpose: demonstrate a numeric condition. Example: `electrical.batteries.house.voltage < 12`.\n\nThe path is a Signal K data path, not a notification path. Missing or non-matching data makes the condition false.', []),

  note('ne-note-display', '4. DISPLAY / HISTORY', 860, 40,
    'These nodes affect Notification Engine presentation and local audit retention only. They never change the authoritative Signal K notification state.'),
  change('ne-visible-true', 'Table: visible', [set('payload.visibleInTable', true, 'bool')], 800, 240,
    'Purpose: show matching notifications in the active table. Accepted value: boolean; this node sets `true`. Visible notifications record local history by default unless History disabled is connected on the same rule.', []),
  change('ne-visible-false', 'Table: hidden', [set('payload.visibleInTable', false, 'bool')], 800, 290,
    'Purpose: hide matching notifications from the table. Accepted value: boolean; this node sets `false`. Safety: hiding does not clear, normalize, acknowledge, or silence Signal K. Use sparingly because hidden active alarms reduce operator visibility.', []),
  change('ne-display-banner', 'Display: banner', [set('payload.display', 'banner')], 800, 340,
    'Purpose: render a fixed strip inside the Notification Centre. Accepted value: `banner`. It is not the full attention overlay and may be used together with table visibility.', []),
  change('ne-display-overlay', 'Display: overlay', [set('payload.display', 'overlay')], 800, 390,
    'Purpose: render the full attention overlay. Accepted value: `overlay`. For emergency, Acknowledge calms/removes this overlay but does not change the emergency state or stop independent audio.', []),
  change('ne-color-red', 'Marker color: red', [set('payload.color', 'red'), set('payload.hex', '#d32f2f')], 800, 440,
    'Purpose: set readable presentation marker colors. Example values: name `red`, hex `#d32f2f`. The color is display metadata only; it does not assign a category or severity.', []),
  change('ne-flash-true', 'Flash: enabled', [set('payload.flash', true, 'bool')], 800, 490,
    'Purpose: enable flashing presentation for the matching rule. Accepted value: boolean; this node sets `true`. Flash is visual only and never changes Signal K state.', []),
  change('ne-flash-false', 'Flash: disabled', [set('payload.flash', false, 'bool')], 800, 540,
    'Purpose: explicitly disable inherited flashing for a more specific branch. Accepted value: boolean; this node sets `false`.', []),
  change('ne-history-true', 'History: enabled', [set('payload.history', true, 'bool')], 800, 590,
    'Purpose: record the complete local occurrence history even when the notification is hidden. Accepted value: boolean; this node sets `true`. History is a local audit trail and never owns the Signal K lifecycle.', []),
  change('ne-history-false', 'History: disabled', [set('payload.history', false, 'bool')], 800, 640,
    'Purpose: suppress new local history for the complete matching occurrence. Accepted value: boolean; this node sets `false`. Existing audit entries are not deleted retroactively.', []),

  note('ne-note-sound', '5. SOUND', 1110, 40,
    'Sound is server-side on the Raspberry Pi. Connect Sound active, a file, a count, and optionally a pause on one uninterrupted branch. Importing this tab never enables sound because no example reaches Activate.'),
  change('ne-sound-active', 'Sound: active', [set('payload.sound.active', true, 'bool')], 1100, 240,
    'Purpose: explicitly enable sound on this rule. Accepted value: boolean; this node sets `true`. A valid sound file must also resolve from this branch or an inherited general rule.', []),
  change('ne-sound-inactive', 'Sound: inactive', [set('payload.sound.active', false, 'bool')], 1100, 290,
    'Purpose: explicitly suppress inherited sound for a more specific rule without changing Signal K state. Accepted value: boolean; this node sets `false`. This is the supported silent-policy mechanism.', []),
  change('ne-sound-file', 'Sound file: alarm.wav', [set('payload.soundFile', '/home/pi/.signalk/sounds/alarm.wav')], 1100, 340,
    'Purpose: select the WAV file played by the Pi audio backend. Accepted value: one non-empty path string. Example: `/home/pi/.signalk/sounds/alarm.wav`. Confirm the file and audio device through Plugin Config before operational use.', []),
  change('ne-sound-once', 'Sound count: once', [set('payload.sound.count', 1, 'num')], 1100, 390,
    'Purpose: play the configured sound exactly once per local occurrence/signature. Accepted integer: `1`. Browser refreshes and unchanged deploys must not replay a completed finite sound.', []),
  change('ne-sound-loop', 'Sound count: loop', [set('payload.sound.count', 0, 'num')], 1100, 440,
    'Purpose: loop the configured sound while the occurrence remains eligible. Accepted integer: `0`. Ensure the source permits an independent stop action or has a reliable authoritative recovery path.', []),
  change('ne-sound-repeat', 'Sound count: repeat 3', [set('payload.sound.count', 3, 'num')], 1100, 490,
    'Purpose: play the configured sound a finite number of times. Accepted integers: `2` through `99`; this example uses `3`. Use `1` for once and `0` for loop.', []),
  change('ne-sound-pause', 'Sound pause: 3 seconds', [set('payload.sound.pauseSeconds', 3, 'num')], 1100, 540,
    'Purpose: wait between completed finite playbacks. Accepted integers: `0` through `5`; this example uses `3`. The pause has no effect before the first playback and is meaningful only with a finite count greater than one.', []),

  note('ne-note-control', '6. CONTROL / EXECUTE', 1380, 40,
    'Ignore and Execute are intentionally disconnected. Execute is only a bounded delivery request; Plugin Config must separately authorize the exact path.'),
  change('ne-ignore', 'Ignore locally', [set('payload.ignore', true, 'bool')], 1400, 240,
    'Purpose: suppress Notification Engine visibility and audio for the matching rule. Accepted value: boolean; this node sets `true`. Safety: the foreign Signal K notification is preserved unchanged and remains owned by its producer.', []),
  change('ne-execute', 'Execute: exact file', [set('payload.execute', '/home/pi/scripts/notification-example.sh')], 1400, 290,
    'Purpose: request one bounded external task delivery for a new live occurrence. Accepted value: one exact absolute executable path; no shell and no notification-derived arguments are added.\n\nAuthorization: the identical path must exist as an enabled per-file entry in Signal K Plugin Config. Wiring to Activate is the only flow-side activation signal. There is no `execute_task` flag.\n\nSafety: execution never changes, clears, acknowledges, silences, or normalizes the originating notification.', [])
]

const groups = [
  group('ne-group-instructions', 'Instructions - open each comment for details',
    ['ne-note-quick', 'ne-note-states', 'ne-note-match', 'ne-note-display', 'ne-note-sound', 'ne-note-control'], 20, 15, 1510, 65, '#eeeeee'),
  group('ne-group-quick', 'Quick Start - connect the final wire deliberately',
    ['ne-quick-alert', 'ne-quick-table', 'ne-activate'], 20, 95, 850, 100, '#90caf9'),
  group('ne-group-states', 'Notification States',
    ['ne-state-emergency', 'ne-state-alarm', 'ne-state-warn', 'ne-state-alert', 'ne-state-nominal', 'ne-state-normal'], 20, 205, 260, 320, '#fff59d'),
  group('ne-group-match', 'Match Scope',
    ['ne-match-exact', 'ne-match-wildcard', 'ne-condition-string', 'ne-condition-number'], 300, 205, 400, 220, '#b3e5fc'),
  group('ne-group-display', 'Display and History',
    ['ne-visible-true', 'ne-visible-false', 'ne-display-banner', 'ne-display-overlay', 'ne-color-red', 'ne-flash-true', 'ne-flash-false', 'ne-history-true', 'ne-history-false'], 710, 205, 300, 470, '#c8e6c9'),
  group('ne-group-sound', 'Sound - disconnected by default',
    ['ne-sound-active', 'ne-sound-inactive', 'ne-sound-file', 'ne-sound-once', 'ne-sound-loop', 'ne-sound-repeat', 'ne-sound-pause'], 1020, 205, 290, 370, '#f8bbd0'),
  group('ne-group-control', 'Control and External Delivery',
    ['ne-ignore', 'ne-execute'], 1320, 205, 300, 130, '#e0e0e0')
]

for (const definition of groups) {
  for (const nodeId of definition.nodes) {
    const node = flow.find(candidate => candidate.id === nodeId)
    if (!node) throw new Error(`Unknown group member: ${nodeId}`)
    node.g = definition.id
  }
}
flow.push(...groups)

fs.writeFileSync(OUTPUT, `${JSON.stringify(flow, null, 2)}\n`)
console.log(`Wrote ${flow.length} nodes to ${OUTPUT}`)
