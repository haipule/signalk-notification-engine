# Changelog

- Add declarative Signal K conditions to Node-RED notification rules.
- Prioritize path-specific rules and apply conditions to alarm and warn presentation.

- Keep unclassified `notifications.environment.*` notifications in `OTHER`
  instead of assuming they are weather; explicit path rules can still assign a
  category.

## Unreleased

- Version 0.1.4: keep unclassified `notifications.environment.*`
  notifications in `OTHER` instead of assuming they are weather.

- Add configurable color and sound palettes for notification presentation.
- Add state-based standard sound mapping and specific sound overrides.
# Unreleased

- Simplify the main action bar and rename the active notification section to
  Selected notifications.
- Start a new local notification lifecycle after configured producer-specific
  end markers such as Hoekens `normal`/`Off`.
# Unreleased

- Keep table visibility controlled by Notification Engine Rule Builder, with emergency and alarm always visible; mark acknowledged states green.
- Update the Node-RED administration link.
- Back up the last valid internal Node-RED notification flow and recover it
  automatically when a deploy removes or corrupts the Notification Engine
  configuration.
