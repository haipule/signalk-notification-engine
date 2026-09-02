# Testing strategy

## Unit tests

- Store: snapshot reconstruction, delta upsert, normal/cleared state, duplicate
  input, and restart recovery.
- Classifier: path before source before structured data before optional text
  fallback; unknown notifications remain `OTHER`.
- Actions: `canSilence`, `canAcknowledge`, `canClear`, emergency behaviour, and
  disabled Notification API mode.
- Policy: deterministic precedence and safe default policy.

## Integration tests

Use a fake Signal K application object to simulate `app.notifications` and
notification deltas. Cover an API-managed alarm and a classic producer delta,
where clear must be unavailable.

The first real-device test is the anchor alarm on the Raspberry Pi. Confirm
that its alarm appears, status/actions are accurate, and the manager does not
interfere with the existing `audio-control.sh`.

## Manual WebApp checks

- Active alarms are legible from a distance and ordered by severity.
- The UI clearly distinguishes active, silenced, and acknowledged.
- Lifecycle-rule tests cover a producer that ends an alarm with a normal
  `Off` notification and then raises again with the same technical ID.
- Unsupported operations cannot be triggered.
- A reload reconstructs the current state without stale phantom alarms.
