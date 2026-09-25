# Changelog

- Make `visibleInTable` the default opt-in for local history, with explicit
  `history: true/false` overrides; remove forced emergency/alarm retention.

- Normalize Signal K notification sources from label, `$source`, type, and
  string representations so the centre does not incorrectly show `Unknown
  source`.

- Interpret Node-RED notification rules from `msg.payload` independent of the
  producing node type; preserve path/condition branches and prefer longer
  satisfied condition chains.
- Keep new notifications at the top of the centre by default and allow
  user-selected A–Z/Z–A sorting for table columns.
- Keep notification hierarchy authoritative, including INFO; status and state
  are not user-sortable and text sorting only applies within each hierarchy level.
- Reuse the existing Node-RED Rule Builder tab when opening it from the WebApp.
- Add declarative Signal K conditions to Node-RED notification rules.
- Prioritize path-specific rules and apply conditions to alarm and warn presentation.

- Keep unclassified `notifications.environment.*` notifications in `OTHER`
  instead of assuming they are weather; explicit path rules can still assign a
  category.

- Categories are now display-only metadata; Node-RED builder rules and
  presentation policies no longer assign or match them.

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
