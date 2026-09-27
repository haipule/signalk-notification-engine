# Testing strategy

## Unit tests

- Store: snapshot reconstruction, delta upsert, normal/cleared state, duplicate
  input, restart recovery, and rejection of phantom parent notifications when
  a nested notification path contains a child named `state`.
- Source boundary: normalize Signal K `label`, `$source`, `type`, and string
  representations from both deltas and snapshots.
- Classifier: path before source before structured data before optional text
  fallback; unknown notifications remain `OTHER`.
- Actions: `canSilence`, `canAcknowledge`, `canClear`, emergency behaviour, and
  disabled Notification API mode.
- Policy: deterministic property inheritance from general state rules to
  specific path rules, safe default policy, all configured base match fields
  combined with AND, unsatisfied specific conditions falling back to a matching
  general rule, and longer satisfied condition chains overriding shorter chains.
- History: once an occurrence has entered the audit trail, retain its final
  authoritative normal/cleared transition even when that terminal state is not
  independently configured for history.
- Audio backend: use process exit code and signal as the result; ordinary
  player diagnostics on stderr are not failures when the process exits zero.
- Node-RED rule extraction: payload-state sources independent of node type,
  path/condition branch isolation, canonical supported states, rejection of
  unknown states, and activation at `Activate`.
- WebApp table sorting: newest-first default, column A–Z/Z–A toggles, and
  persisted sort selection.

## Integration tests

Use a fake Signal K application object to simulate `app.notifications` and
notification deltas. Cover an API-managed alarm and a classic producer delta,
where clear must be unavailable.

The first real-device test is the anchor alarm on the Raspberry Pi. Confirm
that its alarm appears, status/actions are accurate, and the manager does not
interfere with the existing `audio-control.sh`.

The controlled live test matrix and captured evidence are maintained in
[End-to-end safety validation](e2e-safety-matrix.md). Do not execute cases
marked blocked while the vessel depends on the live anchor watch or Android
GPS source.

## Manual WebApp checks

- Active alarms are legible from a distance and ordered by severity.
- The UI clearly distinguishes active, silenced, and acknowledged.
- Lifecycle-rule tests cover a producer that ends an alarm with a normal
  `Off` notification and then raises again with the same technical ID.
- Unsupported operations cannot be triggered.
- A reload reconstructs the current state without stale phantom alarms.
- Disconnect a client for more than one polling interval: the last table may
  remain visible only when a prominent stale/offline banner is shown and all
  notification actions are disabled. Reconnect and verify automatic recovery.
- Deploy an invalid embedded Node-RED configuration: audio, subscriptions,
  snapshot polling, and write actions stop; one visible latched error remains
  without poll-driven log spam. A later valid deploy resumes processing.
