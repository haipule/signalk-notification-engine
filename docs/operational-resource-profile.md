# Raspberry Pi operational resource profile

## Scope

This profile was captured read-only on 2026-10-04 after deployment of
Notification Engine `0.1.36`. No service, embedded Node-RED flow, cache, swap,
or user data was changed. The measurements separate observed evidence from
proposed remediation; they do not prove that one component alone causes the
total system load.

## CPU and process load

The Raspberry Pi has four Cortex-A72 cores. During the sample, load average was
between 6.2 and 6.9 and `vmstat` showed only 4 to 24 percent aggregate idle CPU.
Signal K's Node.js process used about 44 percent of one core over one ten-second
sample and about 52 percent over a later sample. Its resident memory was about
1.16 GiB.

Signal K was not the largest CPU consumer. During the system-wide ten-second
sample, Chromium's GPU process averaged about 72 percent of one core and one
renderer about 84 percent. Signal K averaged about 52 percent, InfluxDB about
29 percent, OpenCPN about 25 percent, and Xorg about 13 percent. These values
vary with rendering and database work, but demonstrate that the high load is a
system-wide aggregate rather than a Notification Engine-only failure.

## Embedded Node-RED and Engine Monitor

The active embedded flow contains inject node `engmon_sampling_tick_all`, named
`Sampling state ALL 1s`, with `repeat: "1"`. It calls exec node
`engmon_sampling_state_exec`, named `Refresh sampling state`, which starts
`/home/pi/.signalk/engine-monitor/scripts/engine-state.py sampling-all` as a new
Python process. Process samples observed the short-lived Python child on most
seconds. All Engine Monitor debug nodes were inactive, so the recurring work is
caused by the one-second exec design rather than an enabled debug node.

In five minutes the Signal K journal contained 284 `sampling-all` lines out of
311 total service lines and about 52 KiB of text. This is approximately 0.95
exec/log events per second and, if sustained, roughly 15 MiB of journal text
per day before journal retention and compression. The more important cost is
continually spawning and parsing a Python process inside the already busy
Signal K runtime.

Recommended follow-up: change the Engine Monitor flow in its own project and
safe deployment cycle. Keep sampling state in flow context and refresh it on
engine state transitions and deployment/startup, or use a materially slower
bounded refresh only if an external writer requires reconciliation. Measure
Signal K and total CPU before and after that one isolated change. Do not modify
the production flow merely to complete this diagnosis.

## Memory and swap

The host had 7.6 GiB RAM, about 3.4 GiB used, and about 4.3 GiB available.
The 200 MiB swap file was full, but repeated `vmstat` samples showed zero
swap-in and zero swap-out. Most attributed swapped pages belonged to long-lived
desktop processes, led by OpenCPN at about 75 MiB and Xorg at about 29 MiB.

Conclusion: full swap is currently historical cold-page occupancy, not evidence
of active memory thrashing or an out-of-memory condition. Do not run `swapoff`
under the current CPU load merely to make the percentage look lower. Reassess
only if swap I/O, memory pressure, or allocation failures appear.

## Filesystem and journal

The 58 GiB root filesystem used 45 GiB (81 percent) and retained 11 GiB free.
Inode use was only 26 percent. The system journal used about 368 MiB, so it does
not explain the filesystem level.

Largest measured groups included:

- `/var/cache/apt`: 8.46 GiB, including 698 cached packages dated from 2017 to
  2026;
- `/home/pi/charts`: 4.49 GiB of user/navigation data;
- `/home/pi/.npm/_cacache`: 2.53 GiB;
- `/home/pi/.cache`: 2.28 GiB, including Playwright 961 MiB and Go build cache
  601 MiB;
- `/home/pi/.signalk`: 1.24 GiB;
- `/home/pi/signalk-backups`: 1.17 GiB, mostly one 2026-08-15 backup;
- `/home/pi/.vscode-server`: 684 MiB.

Recommended cleanup order, each requiring explicit authorization: clear the
APT package cache first, then prune reproducible npm/Playwright/Go caches.
Review charts and Signal K backups as user data before deleting anything. Cache
cleanup alone can recover more than 10 GiB without touching charts or project
backups. A long-running Chromium instance also holds deleted package files open;
a planned browser restart can release those mappings, but it is not the main
45 GiB cause.

## Priority assessment

1. Replace the one-second Engine Monitor Python exec with cached/event-driven
   state handling, then repeat the same CPU and journal measurements.
2. Investigate the two long-running Chromium GPU/renderer processes separately;
   their combined CPU use exceeded Signal K in this sample.
3. Clear only reproducible package/build caches after approval, starting with
   `/var/cache/apt`.
4. Leave swap untouched while available RAM remains high and swap I/O stays at
   zero.

