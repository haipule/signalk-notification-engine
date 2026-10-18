# Wettbewerbsanalyse und Architektur-Review

Stand: 17. Oktober 2026

Untersuchtes Projekt: `signalk-notification-engine` 0.1.90

Charakter: reine Quellcode- und Primärquellenanalyse; kein Deployment und keine Veränderung des Produktionscodes

## Kurzfassung

Die Notification Engine ist kein gewöhnliches Weiterleitungs-Plugin. Ihre stärksten Merkmale sind die konsequente Trennung zwischen Signal-K-Alarmhoheit und lokaler Darstellung, die aktuelle Capability-Prüfung vor `silence`, `acknowledge` und `clear`, die fail-closed gekoppelte Node-RED-Konfiguration, occurrence-bezogene Historie sowie die begrenzte, exakt autorisierte Ausführung externer Programme. Diese Kombination wurde in keinem der untersuchten Vergleichsprojekte vollständig gefunden.

Die wichtigsten belegten Lücken sind:

1. Es gibt keine begrenzte Ingestion-Queue oder andere Backpressure-Grenze vor Store, Audit und Regelverarbeitung. Eine Notification-Flut ist semantisch dedupliziert und die Speicherung ist begrenzt, kann aber weiterhin CPU, Logs und persistente Schreibvorgänge proportional zur Zahl echter Zustandsänderungen erzeugen.
2. Externe Tasks sind absichtlich *at most once* und ohne Retry. Fehler sind in History, Log und dem letzten Diagnostics-Ergebnis sichtbar, aber es fehlen persistente aggregierte Zustände, Zähler und eine eindeutig sichtbare operatorische Warnung für nicht zugestellte Aktionen.
3. Die periodische Snapshot-Reconciliation wird mit `setInterval` angestoßen, ohne überlappende Läufe zu serialisieren. Ein langsamer HTTP- oder Datenmodell-Leseweg kann daher parallele Reconciliation-Läufe erzeugen.
4. Für Netzwerkkanäle wie ntfy, MQTT oder Telegram fehlen Offline-Queue, Retry-/Backoff-Zustand und kanalbezogene Zustellnachweise. Diese Funktionen gehören nicht ungeprüft in die Engine; ein separates Relay oder Node-RED ist in der Regel die bessere Grenze.
5. Die Dokumentation nennt Node-RED 4.x und Node.js 20, aber keine explizite getestete Signal-K-Server-Matrix. Angesichts der noch jungen Notification API Release 2 und laufender Architekturvorschläge sollte diese Matrix ergänzt werden.

Der wichtigste externe Referenzpunkt ist das aktiv gepflegte `signalk-alert-center`: Es besitzt eine begrenzte Ingestion-Queue sowie SQLite-gestützte, retry-fähige Mehrkanalzustellung. Diese Mechanismen sind technisch stärker für Offline-Delivery, bringen aber eine zweite lokale Alert-Lifecycle- und Policy-Schicht mit. Das widerspricht dem Kernprinzip der Notification Engine, Signal K und den Producer als Autorität zu erhalten. Die sinnvolle Übernahme ist daher auf generische Robustheitsmuster beschränkt, nicht auf dessen Gesamtarchitektur.

## Umfang, Methode und Evidenzgrenzen

Untersucht wurden der aktuelle lokale Quellstand und die Tests sowie die am Stichtag erreichbaren GitHub-Repositories, npm-Metadaten und Signal-K-Primärquellen. Wartungsstatus bedeutet hier: letzter nachweisbarer Repository-Push bzw. letzte npm-Veröffentlichung; er ist keine Aussage über Supportqualität.

Wichtige Verifikationsgrenzen:

- `for codex.txt` endet vollständig nach den Arbeitsregeln und enthält keinen fehlenden Rest.
- Es wurde kein Pi-Livestand geprüft. Aussagen betreffen den lokalen Quellstand 0.1.90, nicht zwingend eine installierte Instanz.
- Fremde Pakete wurden weder installiert noch ausgeführt. Bei Vergleichsprojekten wurden öffentlich sichtbare Quelltexte und Paketmetadaten statisch geprüft.
- `signalk-threshold-notifier` besitzt am Stichtag einen Registry-Eintrag, aber keinen auswertbaren `latest`-Tag. Implementierung und Verfügbarkeit sind daher **unbekannt**.
- `signalk-notification-router` existiert auf GitHub und ist aktiv, war am Stichtag aber nicht unter diesem Namen in npm verfügbar.
- Die in Signal K Issue #2868 diskutierten „informational notifications“ sind ein Vorschlag, kein implementierter Standard.
- Lokaler Testlauf: `npm test` am 17. Oktober 2026: **277/277 Tests bestanden**. Es wurden keine Hardware-, Netzwerkunterbrechungs- oder Pi-E2E-Tests ausgeführt.

Abgleich mit `TODO.md`: ntfy/Gotify, Voice/TTS, Browser-Audio, History-Export und eine mögliche spätere SQLite-Migration sind dort bereits ausdrücklich als offene Post-Release- beziehungsweise Diskussionspunkte erfasst. Sie werden in diesem Bericht daher nicht als neu entdeckte Funktionen dargestellt. Für eine begrenzte Ingestion-Queue, die Serialisierung serverseitiger Snapshot-Läufe und aggregierte persistente External-Task-Ergebnisse wurde dagegen kein gleichwertiger offener Punkt gefunden.

## A. Marktübersicht

| Projekt | Zweck und belegte Funktionen | Verfügbarkeit / Wartungsstand | Verhältnis zur Engine |
|---|---|---|---|
| **signalk-notification-engine 0.1.90** | Zentrale aktive Ansicht, API-konforme Aktionen, Node-RED-Regeln, lokale JSON-Historie, ALSA-Audio, Diagnostics, exakt autorisierte externe Tasks | Lokaler Stand; npm-Veröffentlichung im Rahmen dieser Analyse nicht behauptet | Referenz |
| [signalk-notification-player](https://github.com/davidsanner/signalk-notification-player) 3.0.0 | Audio, TTS, Queue, Browser-Audio, Vor-/Nach-Kommandos, Zonenlog und WebApp; aktuelle README nennt Notification API2 | npm 3.0.0 vom 14.10.2026; Repository-Push 14.10.2026 | Stärkster direkter Audio-/TTS-Konkurrent; breitere Audioausgabe, schwächere dokumentierte Autoritätsgrenze |
| [signalk-notifications](https://github.com/itemir/signalk-notifications) 1.1.1 | SQLite-Log, 15-Minuten-Aggregation, Pushover, Suppression | npm 1.1.1 vom 04.09.2023; letzter Code-Push 2023 | Historisches Logging/Relay; kein moderner Lifecycle-Manager |
| [signalk-alert-center](https://github.com/arodus/signalk-alert-center) 0.4.1 | SQLite-Historie, bounded ingestion, Policies, Retry/Backoff, Connectivity-Management, ntfy/PagerDuty/Discord/Telegram/Pushover, Wyoming Audio/TTS | npm 0.4.1 und Push vom 16.10.2026 | Funktionsreichster Konkurrent; technisch stärker bei Delivery, aber mit eigener Alert-Occurrence- und Aktionsschicht |
| [signalk-alarm-silencer](https://github.com/sbender9/signalk-alarm-silencer) 1.8.2 | Silence/Clear für Signal-K-Notifications sowie spezielle NMEA/Raymarine-Acknowledge-Pfade | npm 1.8.2 vom 13.06.2025; Push 15.07.2025 | Spezialadapter für Geräte-/NMEA-Semantik; kein Ersatz für zentrale Darstellung/History |
| [signalk-ntfy](https://github.com/Enand-lab/signalk-ntfy) 0.0.7 | Weiterleitung ausgewählter Zustände an ntfy, mehrere Server, optionaler Command-Rückkanal | npm 0.0.7 und Push vom 18.07.2026 | Zweckmäßiger dedizierter Kanal; sollte getrennt bleiben |
| [signalk-notification-router](https://github.com/sailingnaturali/signalk-notification-router) | MQTT QoS 1/retained, Telegram-Hard-Lane, Webhook-Soft-Lane, Coalescing, kanalbezogene Failure-Notifications und Loop-Guard | GitHub-Push 11.09.2026; **kein npm-Paket gefunden** | Gute Referenz für Kanaltrennung, Loop-Vermeidung und Delivery-Health; kein Lifecycle-Centre |
| [signalk-fcm-notify](https://github.com/fymmot/signalk-fcm-notify) 0.1.0 | FCM HTTP v1, Event-Mapping, zustandsabhängige Priorität und TTL | npm 0.1.0 vom 09.07.2026; Push 28.07.2026 | Mobil-Push-Spezialist; keine lokale Alarmverwaltung |
| [@meri-imperiumi/signalk-audio-notifications](https://github.com/meri-imperiumi/signalk-audio-notifications) 1.0.3 | Einfaches Audio + TTS für `alarm`/`emergency` mit `sound`-Methode; zusätzlich `navigation.state` | npm 1.0.3 vom 16.06.2026; Push 28.09.2026 | Kleine TTS-Ergänzung; weniger robust und weniger konfigurierbar als die Engine |
| [signalk-push-notifications](https://github.com/sbender9/signalk-push-notifications) 2.6.0 | Lokale/Remote-Pushes für WilhelmSK, kritische iOS-Benachrichtigungen und Wiederholung | npm 2.6.0 vom 11.05.2026; Push 07.06.2026 | Client-spezifischer Ausgabekanal, nicht zentrale Policy-Engine |
| [signalk-pushover-notification-relay](https://github.com/KvotheBloodless/signalk-pushover-notification-relay) 1.0.0 | Zustandswechsel-basierte Pushover-Weiterleitung, Pfad-/Level-/Soundfilter | npm 1.0.0 vom 23.06.2022; letzter Push 2022 | Einfaches, älteres Relay; keine persistente Zustellgarantie |
| `signalk-simple-notifications` 1.3.0 | Erzeugt Notifications anhand einfacher Schwellwerte | npm 1.3.0 vom 03.03.2020; Repository aus aktueller Paketmetadaten-Ausgabe nicht verifiziert | Producer, kein Konkurrent; übergibt Lifecycle-Autorität an Signal K |
| `signalk-threshold-notifier` | Beabsichtigter Threshold-Producer | Registry-Eintrag vorhanden, aber kein `latest`-Tag; **Verfügbarkeit und Quellstand unbekannt** | Nicht belastbar bewertbar |
| [@signalk/node-red-contrib-signalk](https://github.com/SignalK/node-red-contrib-signalk) 1.4.0 | Node-RED-Nodes zum Empfangen und Senden von Notification-Deltas | npm 1.4.0 vom 30.05.2026; offizielles Signal-K-Repository | Producer-/Automationsbaustein; komplementär zum Engine Rule Builder |

Zusätzlich gefunden wurde `signalk-alert-center`, dessen GitHub-Repository erst aus den npm-Metadaten des nur als npm-Link genannten Vergleichsprojekts eindeutig hervorging. Weitere generische Webhook-/MQTT-Werkzeuge wurden nicht aufgenommen, wenn sie keine spezifische Signal-K-Notification-Integration belegen.

## B. Funktionsmatrix

Legende: ✓ belegt, ◐ teilweise/eingeschränkt, — nicht gefunden, ? unbekannt.

| Projekt | Snapshot + Delta | Zustandsdedup | SK API-Aktionen | Persistente History | Audio/TTS | Push/Netz | Retry/Offline | Regeln/Filter | Delivery-Diagnose |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Notification Engine | ✓ | ✓ occurrence-/signaturbezogen | ✓ capability- und managergebunden | ✓ atomare JSON-Datei | ✓ / — | externe Tasks ◐ | Audio ✓; Tasks — | ✓ Node-RED | ✓, Tasks nur letzter Zustand + Audit |
| notification-player | ✓ | ✓ `previousNotificationStates`, Queue | ✓ laut aktueller API2-Integration | ✓ JSON-Log | ✓ / ✓ | Slack ◐ | Audio-Failsafe ◐ | ✓ Pfad/Zustand | ◐ |
| notifications | — | ✓ 15-Minuten-Aggregation | — | ✓ SQLite | — | Pushover ✓ | — | Suppression ◐ | Log ◐ |
| alert-center | ✓ | ✓ bounded/coalesced | eigene lokale Ack/Silence-Schicht ◐ | ✓ SQLite | Wyoming ✓ / ✓ | 5 Dienste ✓ | ✓ persistent + Backoff | ✓ | ✓ persistent, aggregiert |
| alarm-silencer | Delta | — | Spezial-Silence/Clear/Ack ✓ | — | — | NMEA/Raymarine | — | Gerätespezifisch | Log ◐ |
| ntfy | Delta | ? | — | — | — | ntfy ✓ | ? | Zustandsfilter | Log ◐ |
| notification-router | Delta | ✓ edge-trigger | — | — | — | MQTT/Telegram/Webhook ✓ | MQTT-Queue ◐ | Severity/Lanes/Coalesce | ✓ kanalbezogen |
| fcm-notify | Delta | Mapping ◐ | — | — | — | FCM ✓ | FCM/TTL ◐ | Event-/State-Mapping | Log ◐ |
| audio-notifications | Delta | `navigation.state` nur ◐ | — | — | ✓ / ✓ | — | — | State + method | Fehlerlog ◐ |
| push-notifications | Delta | ✓ `last_states` | — | — | Push-Sound ◐ | WilhelmSK ✓ | Wiederholung ◐ | Pfad/critical | Log ◐ |
| pushover relay | Delta | ✓ `last_states` | — | — | — | Pushover ✓ | Pushover-Serverfunktion, lokal — | Pfad/Level/Sound | Log ◐ |
| simple notifications | Producer | n/a | erzeugt Deltas | — | — | — | — | Thresholds | ? |
| threshold notifier | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| node-red-contrib-signalk | Delta | Flow-abhängig | sendet Deltas, keine Manageraktionen im geprüften Node | Flow-abhängig | Flow-abhängig | Flow-abhängig | Flow-abhängig | ✓ Node-RED | Flow-abhängig |

## C. Architekturanalyse

### C.1 Notification Engine: tatsächlich implementierte Verarbeitung

Die Engine rekonstruiert eine lokale, nicht autoritative Sicht aus vier Quellen: Notification-REST-Projektion, `app.notifications.list()`, `getSelfPath('notifications')` und dem vollständigen Datenmodell. Die Snapshot-Quellen werden zusammengeführt und alle fünf Sekunden mit Live-Deltas abgeglichen ([`lib/snapshot-service.js` Zeilen 26–67, 84–118](../lib/snapshot-service.js)). `app.notifications.list()` wird separat zur Aktionsberechtigung benutzt; ein im Datenmodell sichtbarer Datensatz reicht nicht als Beweis, dass die Manager-ID noch adressierbar ist (Zeilen 70–81).

Der Store verarbeitet nur `notifications.*`, entfernt einen Record bei einem expliziten `null`-Delta und vergleicht nur autoritative Felder, damit unveränderte Polls keine Audit-Ereignisse erzeugen ([`lib/notification-store.js` Zeilen 85–109, 192–287, 382–401](../lib/notification-store.js)). Eine lokale `occurrenceId` bleibt über ID-Wechsel und exakt korrelierte Restarts stabil. Änderungen von State, Message, Method oder Status erzeugen dagegen eine Transition. History-Zulassung wird beim Auftreten gelatcht und über die gesamte Occurrence erhalten.

Die aktive WebApp-Projektion entfernt nur ein nicht mehr managergebundenes `normal`; nicht-normale Records bleiben bei einer Manager-Lücke fail-safe sichtbar ([`lib/active-notification-view.js` Zeilen 3–18](../lib/active-notification-view.js)). `nominal` ist bewusst nicht in diese Sonderregel einbezogen.

### C.2 Aktionen und Signal-K-Autorität

`NotificationActions.allowed()` verlangt gleichzeitig:

- einen aktuellen Status,
- `actionManaged === true`,
- die passende `can*`-Capability,
- einen noch nicht erreichten Zielstatus,
- bei Silence zusätzlich `state !== 'emergency'`.

Die Aktion ruft anschließend ausschließlich `app.notifications.silence|acknowledge|clear(id)` auf ([`lib/actions.js` Zeilen 22–55](../lib/actions.js)). Das ist strenger und nachvollziehbarer als ältere Relays, die Notification-Deltas selbst umschreiben. Acknowledge ist korrekt state-unabhängig; Clear ist für `normal` und `nominal` lokal gesperrt.

Die aktuelle Signal-K-Plugin-Schnittstelle exponiert `list`, `raise`, `update`, `clear`, `silence`, `silenceAll`, `acknowledge` und `acknowledgeAll` direkt aus der serverseitigen Notification API ([Signal-K `src/interfaces/plugins.ts`](https://github.com/SignalK/signalk-server/blob/master/src/interfaces/plugins.ts)). Die Engine benutzt diese Schnittstelle und erfindet keinen eigenen Alarmzustand.

### C.3 Node-RED-Regelsystem

Der Rule Builder ist keine allgemeine Flow-Ausführung innerhalb der Engine. Der Extractor verfolgt nur mit `Activate` verbundene Zweige, liest deren deklarative `msg.payload`-Zuweisungen und verwirft das obsolete `execute_task`. Konflikte gleich spezifischer Zuweisungen werden fail-closed abgelehnt ([`lib/flow-rules.js` Zeilen 9–168, 239–363](../lib/flow-rules.js)). Pfad-spezifische Regeln gewinnen durch definierte Spezifität, während komplementäre Aktionen vererbt werden.

Nur der in Plugin Config ausgewählte stabile Tab wird verarbeitet. Fehlender, gelöschter oder deaktivierter Tab sowie ungültige Regeln suspendieren die Notification-Verarbeitung. Laufende Deploys werden über das interne `runtime-event`/`runtime-deploy`-Interface beobachtet ([`lib/node-red-runtime.js` Zeilen 93–104, 133–180](../lib/node-red-runtime.js); [`lib/plugin-runtime.js` Zeilen 34–72](../lib/plugin-runtime.js)).

Das offizielle `@signalk/node-red-contrib-signalk` arbeitet anders: `signalk-notification` subskribiert einen Pfad und reicht das erste Notification-Value als `msg.payload` weiter; `signalk-send-notification` baut ein Notification-Delta aus Flow-Daten und ruft `handleMessage` auf ([Empfangsnode](https://github.com/SignalK/node-red-contrib-signalk/blob/main/src/signalk-notification.ts#L29-L58), [Sendenode](https://github.com/SignalK/node-red-contrib-signalk/blob/main/src/signalk-send-notification.ts#L32-L77)). Diese Nodes sind für Automatisierung und Producer geeignet, ersetzen aber die Engine-Autoritätsprüfungen nicht.

### C.4 Audio

Die Engine dedupliziert Audio über `occurrenceId` plus exakte Sound-Signatur. Sie unterstützt einen Durchlauf, endliche Wiederholung und Loop; erfolgreiche endliche Wiedergabe wird restart-sicher unterdrückt, unterbrochene oder endlose Wiedergabe dagegen wieder aufgenommen. Technische Fehler führen zu exponentiell begrenzten Retries, Circuit Breaker und passiver ALSA-Watchdog-Prüfung ([`lib/audio-controller.js` Zeilen 39–85, 119–200, 218–229](../lib/audio-controller.js)). Der Prozess wird ohne Shell gestartet ([`lib/audio-player.js` Zeilen 18–61](../lib/audio-player.js)).

`signalk-notification-player` ist funktional breiter: der aktuelle Quelltext führt `alertQueue`, `previousNotificationStates`, Audio/TTS, Vor-/Nach-Kommandos, Remote-Browser-Audio und ein persistentes Log. Die Engine ist dagegen bei der Trennung von Signal-K-State und lokaler Audiozuständigkeit, bei Circuit-Breaker-Diagnose und exakt korrelierter Restart-Deduplizierung klarer. `@meri-imperiumi/signalk-audio-notifications` prüft nur State und `method.includes('sound')`, spielt eine feste Datei und spricht anschließend den Producer-Text; eine vergleichbare Queue-/Circuit-/Occurrence-Logik ist im 102-zeiligen `index.js` nicht belegt ([Quelle](https://github.com/meri-imperiumi/signalk-audio-notifications/blob/master/index.js#L14-L95)).

### C.5 Historie und Persistenz

Die lokale Historie ist ein Audit, kein Alarm-Store. Sie schreibt seriell, begrenzt die Zahl der Einträge, verwendet Mode `0600` und ersetzt die Datei atomar ([`lib/history-repository.js` Zeilen 6–18, 25–55, 88–97](../lib/history-repository.js)). Restart-State für Occurrence-Korrelation, abgeschlossene Audio-Signaturen und akzeptierte externe Task-Versuche liegt in einer getrennten atomaren Datei ([`lib/restart-state-repository.js` Zeilen 6–67](../lib/restart-state-repository.js)).

`signalk-notifications` bietet SQLite und gruppiert gleiche `type`/`priority` innerhalb von 15 Minuten, interpoliert SQL-Abfragen aber im sichtbaren Quelltext direkt und besitzt nur einfache Callback-Fehlerbehandlung ([`index.js` Zeilen 37–50, 89–130](https://github.com/itemir/signalk-notifications/blob/main/index.js#L37-L130)). Als Datenbankreferenz ist es daher weniger geeignet als `signalk-alert-center`.

`signalk-alert-center` nutzt `node:sqlite`, Transaktionen, eigene Occurrence-/Delivery-Tabellen und persistente Delivery Attempts. Das ist bei langer Historie, Filtern und Ausgabewarteschlangen überlegen, aber es modelliert zusätzlich `acknowledged_at`, `silenced_at` und eigene Delivery-Lifecycles. Für die Notification Engine wäre eine Übernahme dieser vollständigen Alert-Schicht ein Autoritätsrisiko.

### C.6 Externe Tasks und Zustellung

Die Engine akzeptiert nur einen absoluten, exakt freigeschalteten Pfad, startet ohne Shell und ohne dynamische Argumente, begrenzt Laufzeit, parallele Prozesse und Output, beendet die Prozessgruppe bei Timeout und auditierte accepted/denied/start-failed/completed/timed-out ([`lib/external-task-runner.js` Zeilen 63–76, 108–201, 204–221](../lib/external-task-runner.js)). Die Annahme wird vor `spawn` persistiert; nach Crash oder Startfehler wird nicht wiederholt. Das ist eine bewusste *at-most-once*-Entscheidung und schützt vor doppelten realen Effekten.

Demgegenüber besitzt `signalk-alert-center` persistente Delivery-Einträge, Claims, Request-Timeouts, retryable/terminal Failure-Klassen, Backoff und Attempt-Historie ([`src/delivery/scheduler.ts`](https://github.com/arodus/signalk-alert-center/blob/main/src/delivery/scheduler.ts), [`src/storage/db.ts`](https://github.com/arodus/signalk-alert-center/blob/main/src/storage/db.ts)). Das eignet sich für idempotente Netzwerkzustellung, nicht automatisch für beliebige ausführbare Programme.

`signalk-notification-router` trennt MQTT, Telegram und Webhook in unabhängige Lanes. Es sendet `alarm`/`emergency` unmittelbar, coalesced weichere Meldungen, benutzt MQTT QoS 1 und retained Messages und erzeugt nach wiederholtem Kanalfehler eine visual-only eigene Notification. Eigene Delivery-Fehler werden von Telegram/Webhook ausgeschlossen, damit keine Rückkopplung entsteht ([`index.js` Lane-/Loop-Kommentare und State-Edge-Logik](https://github.com/sailingnaturali/signalk-notification-router/blob/main/index.js#L238-L344), [MQTT und Delta-Verarbeitung](https://github.com/sailingnaturali/signalk-notification-router/blob/main/index.js#L451-L519)). Das ist die beste konkrete Referenz für eine getrennte Zustellkomponente.

### C.7 Fehler, Duplikate und widersprüchliche Updates

Bestätigt vorhanden:

- unveränderte Snapshots erzeugen kein neues Audit;
- Polling und Deltas werden zusammengeführt;
- `null` entfernt explizit nach Pfad;
- Producer-Source wird gegenüber dem generischen Notification Handler bevorzugt;
- ein eindeutiger Pfad/Source-Fortsetzer kann einen geänderten Producer-ID-Wert derselben Occurrence zuordnen;
- exakte Restart-Korrelation verhindert Wiederholung endlicher Audioausgabe und akzeptierter Tasks;
- ein neuer Wert nach explizitem Lifecycle-Ende erhält eine neue Occurrence;
- Node-RED-Konflikte werden nicht durch zufällige JSON-Reihenfolge entschieden.

Nicht belegt beziehungsweise offen:

- Es existiert keine Sequenznummer- oder Timestamp-basierte Zurückweisung eines verspätet eintreffenden, aber inhaltlich abweichenden Deltas. Die Engine übernimmt die Reihenfolge, in der Signal K die Deltas zustellt.
- `replaceSnapshot()` entfernt allgemein keine Records, die im Snapshot fehlen; die Bereinigung erfolgt nur durch `null`-Delta und die spezielle aktive `normal`-Manager-Regel. Das ist für nicht-normale Alarme absichtlich fail-safe, kann aber einen Producer-Absturz als dauerhaft sichtbaren Alarm hinterlassen. Eine pauschale TTL wäre gefährlich und wird nicht empfohlen.
- Mehrere echte, schnell wechselnde Zustände werden vollständig verarbeitet; es gibt keine vorgelagerte Lastgrenze.

## D. Schwachstellen der Notification Engine

### D1 – Hoch: keine definierte Backpressure bei Notification-Fluten

Jedes relevante Delta läuft synchron durch Store, Klassifikation, Regeln, Audio-/Task-Konsumenten und gegebenenfalls History-Persistenz. `historyLimit`, `MAX_ATTEMPTS` und Output-Limits begrenzen Speichergröße, nicht die Eingangsarbeit. Ein fehlerhafter Producer kann so Log-, CPU- und Schreiblast erzeugen. `signalk-alert-center` zeigt ein besseres Muster: eine feste Queue coalesced nur semantisch äquivalente pending Updates und verwirft bei voller Queue kontrolliert mit Zählern ([`ingestion-queue.ts` Zeilen 21–77](https://github.com/arodus/signalk-alert-center/blob/main/src/signalk/ingestion-queue.ts#L21-L77)).

Wichtig: State-, Severity- oder Message-Wechsel dürfen nicht blind zusammengefasst werden. Sicherheitsrelevante Transitionen müssen ihre Reihenfolge behalten.

### D2 – Mittel: überlappende Snapshot-Reconciliation ist nicht ausgeschlossen

`startPolling()` startet alle fünf Sekunden `void this.sync()` über `setInterval` ([`lib/snapshot-service.js` Zeilen 114–124](../lib/snapshot-service.js)). Anders als die WebApp-Polling-Hilfe ist dieser Lauf nicht serialisiert. Bei einem langsamen oder hängenden Fetch kann ein zweiter Lauf starten; Reihenfolge und Diagnosezeitpunkt der Abschlüsse sind dann nicht deterministisch.

### D3 – Mittel: externe Task-Fehler sind auditierbar, aber operatorisch zu schwach aggregiert

Die Engine erfasst alle geforderten Ergebnisarten und zeigt `lastResult`, aktive Tasks und Gesamtzahl angenommener Versuche. Sie zeigt jedoch keine persistenten Ergebniszähler, keine Liste der letzten N Task-Ergebnisse und keinen expliziten „unresolved delivery failure“-Zustand. Ein älterer Fehler kann vom nächsten Erfolg als `lastResult` verdrängt werden, während History-Auswertung manuell bleibt.

Eine automatische Wiederholung ist für beliebige Scripts **nicht** die richtige Lösung: deren Effekte sind nicht zwingend idempotent, und die bestehende at-most-once-Grenze ist sicherheitsrelevant.

### D4 – Mittel: keine robuste Netzkanal-Zustellung

ntfy, MQTT, Telegram, FCM und Pushover sind nicht nativ implementiert. Ein externes Script kann sie anstoßen, besitzt aber keine engine-eigene Offline-Queue oder Delivery-Acknowledgement-Semantik. `signalk-alert-center` ist hier funktional überlegen; `signalk-notification-router` ist schlanker und trennt die Fehlerdomänen besser.

Diese Lücke ist nur dann eine Engine-Schwäche, wenn die Engine selbst als zuverlässiger Netzwerk-Dispatcher verstanden wird. Nach ihrer derzeitigen Architektur sollte sie das nicht werden.

### D5 – Mittel: keine explizite Signal-K-Kompatibilitätsmatrix

Signal K 2.28 führte Notification API Release 2 ein; der aktuelle Server ist am Stichtag 2.33.0. Release 2.31 ergänzte unter anderem `acknowledgedAt`, und 2.33 änderte das Reset-Verhalten bei State-Wechseln ([Signal-K Releases](https://github.com/SignalK/signalk-server/releases)). Die Engine verarbeitet zusätzliche Statusfelder strukturell, dokumentiert aber nicht, gegen welche Serverversionen Startup, Manager-Mitgliedschaft und Aktionen getestet wurden.

### D6 – Niedrig bis mittel: kein generischer Loop-Guard für Side Effects

Die Engine verhindert ihre eigene Audio-Rückkopplung gezielt und externe Tasks werden pro Occurrence/Pfad nur einmal versucht. Ein externes Programm kann aber eine neue Notification erzeugen, die erneut dieselbe Regel trifft. Wegen neuer Occurrence ist das kein Duplikat. Das lässt sich nicht allgemein verbieten, ohne legitime Automatisierung zu blockieren. Erforderlich sind daher klare Origin-/Prefix-Konventionen und Loop-Guards in den jeweiligen Relays, nicht eine pauschale Engine-Sperre.

### D7 – Niedrig: JSON-Historie skaliert nur begrenzt

Die aktuelle, atomare und begrenzte JSON-Datei ist für 500 Einträge angemessen. Sie ist jedoch kein effizientes Modell für lange Aufbewahrung, komplexe Abfragen oder persistente Delivery-Attempts. Der Umstieg auf SQLite ist erst bei konkretem Volumenbedarf gerechtfertigt; aktuell wäre er unnötige Komplexität.

### Nicht als Schwäche bewertet

- Kein TTS im Kern: TTS behandelt untrusted Producer-Text, benötigt zusätzliche Backends und Sprach-/Queue-Policy. `notification-player` oder ein eigener Audio-Service ist dafür geeigneter.
- Kein eingebautes Telegram/ntfy/MQTT: Credentials, Retry und Internetzustand bilden eine eigene Security- und Failure-Domain.
- Kein automatisches Clear stale gebliebener Alarme: Signal K beziehungsweise der Producer ist autoritativ; eine TTL würde sicherheitskritische Alarme fälschlich beseitigen.
- Kein Retry beliebiger externer Tasks: at-most-once ist für unbekannte Side Effects die sicherere Semantik.

## E. Verbesserungsvorschläge

### E1. Begrenzte Ingestion-Queue mit sicherer Coalescing-Regel

- **Beschreibung:** Feste Queue vor der Store-Verarbeitung; nur vollständig äquivalente pending Updates derselben Identität coalescen. State-, Message-, Status- oder Method-Wechsel nie verwerfen. High-water mark, coalesced und rejected zählen und diagnostizieren.
- **Nutzen:** Begrenzte Speicher- und Ereignislast bei Producer-Fehlern; sichtbare Überlast statt unkontrollierter Arbeit.
- **Referenz:** `signalk-alert-center` `BoundedIngestionQueue`.
- **Aufwand:** hoch.
- **Risiken:** Ein falscher Schlüssel oder zu aggressives Coalescing kann sicherheitsrelevante Transitionen verlieren. Reihenfolge von Signal-K-Manager- und Delta-Sicht muss erhalten bleiben.
- **Empfehlung:** **umsetzen**, aber erst nach formaler Semantik und Stress-/Transitionstests.

### E2. Snapshot-Läufe serialisieren und Timeout diagnostizieren

- **Beschreibung:** Nur einen `sync()`-Lauf gleichzeitig erlauben; genau einen pending Lauf nachziehen. Lokalen REST-Fetch mit Abort-Timeout versehen und overlap-/timeout-Zähler ausgeben.
- **Nutzen:** Deterministische Reconciliation und klarere Diagnose bei blockierter Signal-K-API.
- **Referenz:** Bereits vorhandene serialisierte Browser-Polling-Logik im eigenen Projekt; keine Fremdfunktion erforderlich.
- **Aufwand:** gering.
- **Risiken:** Zu kurzer Timeout erzeugt Fehlalarme auf langsamer Hardware; Polling darf die Delta-Verarbeitung nicht sperren.
- **Empfehlung:** **umsetzen**.

### E3. Persistente aggregierte Task-Diagnostics ohne automatischen Retry

- **Beschreibung:** Ergebniszähler nach `accepted`, `denied`, `start_failed`, `completed` mit Exit 0/non-zero und `timed_out`; letzte N begrenzte Ergebnisse und „unresolved since“-Information persistent diagnostizieren. Keine zweite Alarm-Lifecycle-Schicht erzeugen.
- **Nutzen:** Fehlgeschlagene externe Aktionen werden nicht vom nächsten Resultat verdeckt; Wartung wird nachvollziehbar.
- **Referenz:** Delivery-Status/Attempt-Historie von `signalk-alert-center`, reduziert auf Beobachtung.
- **Aufwand:** mittel.
- **Risiken:** Pfade und Output können sensible Daten enthalten; Limits, Redaction und Dateimodus 0600 beibehalten. Ein UI-Status darf nicht als Signal-K-Alarm ausgegeben werden.
- **Empfehlung:** **umsetzen**.

### E4. Dedizierte Delivery-Plugin-Schnittstelle statt native Kanäle im Kern

- **Beschreibung:** Eine schmale, dokumentierte Übergabe an separates Relay definieren, etwa stabiler lokaler Webhook oder MQTT-Envelope mit occurrence/event/state/path/source/message. Das Relay besitzt Credentials, Offline-Queue und Retry.
- **Nutzen:** Zuverlässige Push-Kanäle ohne Aufblähung der Engine und ohne Vermischung der Autoritätsgrenzen.
- **Referenz:** Lane-Trennung von `signalk-notification-router`; persistente Delivery von `signalk-alert-center`.
- **Aufwand:** mittel bis hoch, abhängig vom gewählten Vertrag.
- **Risiken:** Doppelte Zustellung, Datenschutz, Secrets und Rückkopplung. Vertrag muss Version, idempotency key und Origin enthalten.
- **Empfehlung:** **optional**; nur bei konkret bestätigtem zuverlässigem Remote-Alarmbedarf.

### E5. ntfy, MQTT und Telegram nicht direkt in die Engine einbauen

- **Beschreibung:** Kanäle als separate Plugins oder Node-RED-Flows betreiben. Für kritische Zustellung ein spezialisiertes Relay mit persistenter Queue bevorzugen; Node-RED nur, wenn best-effort genügt.
- **Nutzen:** Kleine Engine, getrennte Credentials und unabhängig aktualisierbare Failure-Domains.
- **Referenz:** `signalk-ntfy`, `signalk-notification-router`, `signalk-alert-center`.
- **Aufwand:** gering in der Engine; mittel operativ.
- **Risiken:** Mehr Komponenten; End-to-End-Health muss separat sichtbar sein.
- **Empfehlung:** **nicht im Engine-Kern umsetzen**.

### E6. TTS als optionalen externen Audio-Dienst behandeln

- **Beschreibung:** Keinen TTS-Interpreter in den Engine-Prozess aufnehmen. Falls benötigt, einen explizit freigegebenen Dienst mit Queue, Sprachwahl, Textlängenlimit und unverändertem Producer-Text anbinden.
- **Nutzen:** TTS ohne neue native Abhängigkeiten und ohne Vermischung mit Signal-K-State.
- **Referenz:** `signalk-notification-player` und `@meri-imperiumi/signalk-audio-notifications`.
- **Aufwand:** mittel.
- **Risiken:** Producer-Text ist untrusted; Aussprache kann irreführend sein; konkurrierende Audioausgaben müssen koordiniert werden.
- **Empfehlung:** **optional**, außerhalb des Kerns.

### E7. Origin- und Loop-Konvention dokumentieren

- **Beschreibung:** Für eigene technische Notifications und Delivery-Relays stabile Origin-/Pfadpräfixe und eine Regel dokumentieren: eigener Delivery-Fehler darf nie wieder durch denselben fehlerhaften Kanal geroutet werden.
- **Nutzen:** Verhindert rekursive Notification-/Delivery-Schleifen, ohne legitime Producer zu blockieren.
- **Referenz:** `signalk-notification-router` schließt sein eigenes Prefix aus Telegram/Webhook aus und hält Failure-Notifications visual-only.
- **Aufwand:** gering.
- **Risiken:** Nur wirksam, wenn alle Relays den Vertrag einhalten; MQTT darf bewusst separat bleiben.
- **Empfehlung:** **umsetzen** als Architekturvertrag und Tests für eigene Adapter.

### E8. Signal-K-Kompatibilitätsmatrix und Contract-Tests

- **Beschreibung:** README/Testing um getestete Signal-K-Versionen, Notification-API-Featureannahmen, Node-Version und Node-RED-Runtime erweitern. Contract-Tests gegen mindestens älteste unterstützte und aktuelle Signal-K-Version vorsehen.
- **Nutzen:** Frühe Erkennung von Änderungen an Manager-Mitgliedschaft, Capabilities, Reset-/Cleanup-Verhalten und Plugin-API.
- **Referenz:** Signal-K Releases 2.28–2.33 und offizielle Plugin-Schnittstelle.
- **Aufwand:** mittel.
- **Risiken:** CI mit vollständigem Server ist langsamer; Versionen müssen aktiv gepflegt werden.
- **Empfehlung:** **umsetzen**.

### E9. Keine pauschale TTL für nicht-normale Notifications

- **Beschreibung:** Stale-Erkennung nur diagnostisch auf Producer-/Input-Ebene anbieten; niemals einen Alarm aufgrund lokaler Zeitüberschreitung clearen oder aus der fail-safe Ansicht entfernen.
- **Nutzen:** Sichtbare Hinweise auf ausgefallene Producer ohne Autoritätsverletzung.
- **Referenz:** Signal-K-Diskussion zur Staleness unterscheidet Event-Pfade von Streaming-Daten; Notifications sollen nicht durch generische Daten-TTL verschwinden.
- **Aufwand:** mittel.
- **Risiken:** Falsch konfigurierte Freshness-Schwellen erzeugen unnötige Warnungen.
- **Empfehlung:** **optional diagnostisch**, **nicht** als Lifecycle-Automatik.

### E10. SQLite nur bei nachgewiesenem Abfragebedarf

- **Beschreibung:** Die JSON-Historie beibehalten, bis Retention, Volumen oder Reporting die Grenze messbar überschreiten. Dann Migration mit Backup, Schema-Version und Rollback entwickeln.
- **Nutzen:** Vermeidet vorzeitige Komplexität; hält später eine belastbare Query-/Delivery-Basis offen.
- **Referenz:** `signalk-alert-center` als moderne SQLite-Referenz; `signalk-notifications` als Warnung vor unzureichender Query-/Fehlerdisziplin.
- **Aufwand:** aktuell keiner; spätere Migration hoch.
- **Risiken:** Zu spätes Handeln bei stark wachsendem Audit; durch bestehende Begrenzung derzeit kontrolliert.
- **Empfehlung:** **derzeit nicht umsetzen**.

## F. Priorisierte Roadmap

| Prio | Maßnahme | Nutzen | Risiko | Aufwand | Entscheidungspunkt |
|---:|---|---|---|---|---|
| 1 | Snapshot-Synchronisierung serialisieren und timeboxen | hoch | niedrig | gering | Direkter Robustheitsgewinn ohne Architekturänderung |
| 2 | Persistente aggregierte External-Task-Diagnostics | hoch | niedrig–mittel | mittel | Beobachtung verbessern, at-most-once beibehalten |
| 3 | Kompatibilitätsmatrix + Signal-K-Contract-Tests | hoch | niedrig | mittel | Vor nächster breiter Veröffentlichung |
| 4 | Ingestion-/Flood-Modell spezifizieren und Lasttests bauen | hoch | mittel | mittel | Erst Beweislast und Verlustregeln definieren |
| 5 | Sichere bounded Ingestion Queue implementieren | hoch | hoch | hoch | Nur nach Prio 4 und mit Transition-Erhaltung |
| 6 | Origin-/Loop-Vertrag für Side-Effect-Adapter | mittel | niedrig | gering | Vor erstem offiziellen Remote-Relay |
| 7 | Entscheidung „best effort“ vs. „durable delivery“ dokumentieren | mittel | niedrig | gering | Architekturentscheidung, kein Codezwang |
| 8 | Bei Bedarf separates ntfy/MQTT/Telegram-Relay definieren | mittel | mittel | mittel–hoch | Nicht in den Engine-Kern aufnehmen |
| 9 | TTS nur nach konkretem Bedienbedarf extern anbinden | niedrig–mittel | mittel | mittel | Audio-Koordination zuerst klären |
| 10 | SQLite-Migration erst anhand realer Metriken neu bewerten | derzeit niedrig | mittel | hoch | Kein aktueller Implementierungsauftrag |

## Kompatibilität und Zukunftssicherheit

### Implementierter Standard

- Signal-K-Server 2.33.0 exponiert weiterhin die Notification-Manager-Methoden über die Plugin-API.
- Notification API Release 2 ist seit Server 2.28.0 veröffentlicht.
- `canSilence`, `canAcknowledge` und `canClear` sowie Manager-ID sind die richtige Autoritätsgrundlage für Aktionen.
- Die Engine bleibt kompatibel mit zusätzlichen Statusfeldern, weil sie Status als Objekt kopiert und nur die benötigten Capability-Felder interpretiert.
- Der aktuelle Server kann Core-Notification-Management deaktivieren. Die Engine muss dann wie vorgesehen fail-closed keine Aktionen anbieten; die genaue Start-/Diagnosewirkung sollte in Contract-Tests belegt werden.

### Diskutierte, nicht implementierte Änderung

Signal K Issue [#2868](https://github.com/SignalK/signalk-server/issues/2868) schlägt „informational notifications“ mit `notificationState: active|cleared|dismissed`, ohne Alarm-`state`, `method` oder `status`, vor. Der Vorschlag trennt ausdrücklich Information von Alarm und kennt kein Acknowledge/Silence. Solange er nicht implementiert und veröffentlicht ist, darf die Engine daraus keine Laufzeitannahmen ableiten.

Falls diese Architektur später Standard wird, sollte die Engine zwei Typen explizit unterscheiden:

1. Alarm-Notifications mit Signal-K-Manager und Capability-Aktionen.
2. Informational Notifications mit eigener Darstellung, aber ohne erfundene Alarmaktionen.

Die heutige Regel „unknown sichtbar halten“ ist ein guter Fail-safe-Ausgangspunkt, ersetzt aber keine bewusste Typunterstützung.

## G. Gesamtbewertung

### Was die Notification Engine besser kann

- Sie respektiert die Signal-K-Autoritätsgrenze konsequenter als ältere Plugins, die Notification-Werte lokal auf `normal` setzen oder `method` verändern.
- Sie prüft nicht nur Capability-Felder, sondern auch aktuelle Manager-Mitgliedschaft.
- Sie trennt `acknowledged`, `silenced`, lokalen Audiozustand und Alarm-State korrekt.
- Sie hat eine ungewöhnlich starke, fail-closed Node-RED-Grenze mit stabiler Tab-ID und deterministischer Branch-Semantik.
- Occurrence-bezogene History-, Audio- und External-Task-Deduplizierung sind präziser als einfache `lastState[path]`-Maps.
- Externe Programme werden ohne Shell, ohne Notification-Argumente, mit exaktem Allowlisting, Timeout, Output-Limit und Prozessgruppenstopp ausgeführt.
- Diagnostics, Audio-Circuit-Breaker und Restart-Korrelation sind für einen frühen 0.1.x-Stand außergewöhnlich umfassend.

### Wo andere technisch überlegen sind

- `signalk-alert-center` ist bei persistenter Mehrkanalzustellung, Offline-/Retry-Zuständen, langer querybarer Historie und Ingestion-Backpressure überlegen.
- `signalk-notification-player` bietet TTS, Remote-Browser-Audio und eine reifere Audio-Featurebreite.
- `signalk-notification-router` trennt Netzwerkkanäle, Failure Domains und Loop-Guards klar und unterstützt MQTT QoS 1.
- Spezialisierte Plugins integrieren ihre Zielplattform tiefer: WilhelmSK Critical Push, FCM-Priorität/TTL, ntfy-Kommandos oder NMEA/Raymarine-Silence.

### Zu erhaltende Alleinstellungsmerkmale

1. Signal K und Producer bleiben alleinige Lifecycle-Autorität.
2. Capability plus aktuelle Manager-Mitgliedschaft bleibt zwingend.
3. Node-RED formuliert Behandlung, nicht eine konkurrierende Alarmwelt.
4. Unbekannte und nicht-normale Alarme bleiben fail-safe sichtbar.
5. Externe Side Effects bleiben begrenzt und ändern nie den Ursprungsalarm.
6. History bleibt Audit und darf keine Notification löschen.
7. Zusätzliche Netzwerkkanäle werden modular getrennt statt in einen monolithischen Kern aufgenommen.

Die unverblümte Bewertung: Die Engine braucht derzeit nicht mehr Kanäle, sondern härtere Lastgrenzen, deterministischere Reconciliation und bessere Delivery-Diagnose. Wer ntfy, Telegram, MQTT, TTS und persistente Retries direkt einbaut, würde ihr stärkstes Merkmal – eine kleine, nachvollziehbare Autoritäts- und Sicherheitsgrenze – zugunsten eines schwer wartbaren Alert-Monolithen aufgeben.

## Primärquellen

- Lokaler Quellstand und Tests: `index.js`, `lib/`, `public/`, `test/`, `docs/notification-api-analysis.md`, `docs/architecture.md`.
- [Signal-K Plugin API exposure](https://github.com/SignalK/signalk-server/blob/master/src/interfaces/plugins.ts)
- [Signal-K REST API overview](https://github.com/SignalK/signalk-server/blob/master/docs/develop/rest-api/README.md)
- [Signal-K Server Releases](https://github.com/SignalK/signalk-server/releases)
- [Signal-K informational notifications proposal #2868](https://github.com/SignalK/signalk-server/issues/2868)
- Die in Tabelle A verlinkten GitHub-Repositories sowie die zugehörigen npm-Paketseiten/Registry-Metadaten, abgerufen am 17. Oktober 2026.
