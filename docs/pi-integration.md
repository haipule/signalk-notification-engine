# Raspberry Pi integration status

## Installed test build

The initial build is installed on the boat Raspberry Pi as local npm package
`signalk-notification-manager@0.1.0` and is enabled with an empty policy list.

- WebApp: `http://192.168.100.10:3000/signalk-notification-manager/`
- API: `/plugins/signalk-notification-manager/notifications`
- Persistent local history:
  `/home/pi/.signalk/plugin-config-data/signalk-notification-manager/notification-history.json`

The manager successfully received and classified the existing anchor alarm and
the GNSS heading warning. `normal` and `nominal` values remain available in the
Signal K data model but are intentionally absent from the active alarm view.

## Health service during deployment

`signalk-health.timer` calls a health script once per minute. That script
restarts Signal K when `http://localhost:3000/signalk` is unavailable. Signal K
can take roughly half a minute to become HTTP-ready after a restart, so the
timer can otherwise interrupt a plugin deployment.

Deployment procedure for this Pi:

1. Stop `signalk-health.timer` temporarily.
2. Install the local package and restart `signalk.service`.
3. Wait until `http://127.0.0.1:3000/signalk` responds successfully.
4. Restart `signalk-health.timer` and verify its next scheduled run.

At the end of the initial integration test, Signal K was active, port 3000
responded with HTTP 200, and the health timer was active again.

## Service-monitoring chain

The separate **Services to Signal K** plugin remains responsible for service
checks and creation of service-failure notifications. Its notifications are
then handled by this manager. On the Pi, warnings are enabled for
`signalk-health.timer`, `opencpn.service`, `influxdb.service`, and
`NetworkManager.service`; Grafana monitoring currently has notifications off.
