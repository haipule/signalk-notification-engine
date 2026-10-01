Dieses Dokument ist der historische Phase-1-Auftrag. Der daraus entstandene
aktuelle Projekt- und Paketname ist `signalk-notification-engine`.

Du arbeitest im lokalen Git-Repository:

`~/projects/notification-engine`

## Projektziel

Entwickle einen **Signal K Notification Manager** als Signal-K-Server-Plugin mit zugehöriger WebApp.

Das System soll vorhandene Signal-K-Notifications zentral erfassen, klassifizieren, darstellen und bedienbar machen.

Langfristiges Ziel ist ein zentrales Alarm- und Notification-Center für ein Fahrtensegelboot.

Es soll insbesondere:

* alle relevanten Signal-K-Notifications erkennen,
* aktive Notifications verwalten,
* Notifications nach Quelle und Funktion kategorisieren,
* Severity/Priorität berücksichtigen,
* Meldungstexte anzeigen,
* akustische Alarmierung zentral steuern,
* Silence und Acknowledge ermöglichen,
* Clear nur dort anbieten, wo Signal K bzw. die erzeugende Notification dies erlaubt,
* unterschiedliche Sounds bzw. Soundprofile unterstützen,
* Wiederholungen und Eskalationen ermöglichen,
* später Aktionen außerhalb des Plugins auslösen können,
* eine übersichtliche Weboberfläche bereitstellen,
* bestehende Signal-K-Mechanismen verwenden statt einen inkompatiblen eigenen Alarmstandard einzuführen.

Das Projekt soll zunächst bewusst klein und robust beginnen.

---

# 1. WICHTIG: ZUERST ANALYSE, DANN IMPLEMENTIERUNG

Beginne NICHT sofort mit umfangreichem Code.

Untersuche zuerst den aktuellen Signal-K-Notification-Mechanismus und dokumentiere, welche offiziellen APIs und Datenstrukturen für dieses Projekt verwendet werden sollen.

Insbesondere prüfen:

1. Signal K Server Notification API
2. `app.notifications`
3. verfügbare Methoden wie:

   * list
   * silence
   * silenceAll
   * acknowledge
   * acknowledgeAll
   * clear
   * raise
   * update
4. Notification-Datenmodell
5. Bedeutung von:

   * state
   * message
   * method
   * id
   * status
   * createdAt
   * position
   * data
6. Statusfelder wie:

   * silenced
   * acknowledged
   * canSilence
   * canAcknowledge
   * canClear
7. Unterschied zwischen:

   * Notification aktiv
   * Notification silenced
   * Notification acknowledged
   * Notification cleared / state normal
8. Verhalten klassischer `notifications.*` Delta-Nachrichten gegenüber Notifications, die über die neuere Notification API erzeugt werden.

Besonders wichtig:

Eine Notification darf NICHT einfach gelöscht oder auf `normal` gesetzt werden, wenn das erzeugende Plugin bzw. Signal K dies nicht erlaubt.

`canClear`, `canSilence` und `canAcknowledge` müssen respektiert werden.

Dokumentiere diese Analyse zunächst in:

`docs/notification-api-analysis.md`

---

# 2. BESTEHENDE SIGNAL-K-WELT BERÜCKSICHTIGEN

Das Plugin läuft später auf einem Raspberry Pi 4 mit OpenPlotter und Signal K.

Aktuell verwendete Umgebung:

* Raspberry Pi 4
* OpenPlotter
* Signal K Server 2.30.x
* Node.js 24.x

Es existieren bereits verschiedene Signal-K-Plugins, die Notifications erzeugen oder bearbeiten können.

Beispiele:

* hoekens-anchor-alarm
* signalk-alarm-silencer
* collision-detector
* noaa-storms
* eigene bzw. lokale Signal-K-Plugins

Der Notification Manager darf vorhandene Plugins nicht unnötig ersetzen.

Er soll eine zentrale Management-Schicht darüber bilden.

---

# 3. ANKER-ALARM ALS ERSTER REALER TESTFALL

Ein wichtiger erster Testfall ist der vorhandene Anchor Alarm.

Aktuell existiert auf dem Raspberry Pi außerdem ein separates Audio-Script:

`/home/pi/.signalk/anchoralarm/audio-control.sh`

Dieses Script kann WAV-Dateien über ALSA abspielen und stoppen.

Das neue Projekt soll NICHT sofort voraussetzen, dass dieses Script entfernt wird.

Entwirf die Audioarchitektur so, dass zunächst optional ein externes Audio-Backend verwendet werden könnte.

Später kann die Audiofunktion vollständig in das Plugin integriert werden.

Der Notification Manager soll jedoch langfristig die zentrale Instanz für Notification-Sound werden.

---

# 4. ARCHITEKTUR

Zielstruktur ungefähr:

```text
signalk-notification-engine/
├── AGENTS.md
├── README.md
├── package.json
├── index.js
├── lib/
│   ├── notification-store.js
│   ├── classifier.js
│   ├── rules.js
│   ├── audio.js
│   └── actions.js
├── public/
│   ├── index.html
│   ├── app.js
│   └── style.css
├── docs/
│   ├── notification-api-analysis.md
│   ├── architecture.md
│   └── testing.md
└── test/
```

Das ist ein Vorschlag, kein Zwang.

Ändere die Struktur, wenn die Signal-K-Plugin-Architektur eine bessere Lösung nahelegt.

Begründe wesentliche Änderungen.

---

# 5. NOTIFICATION STORE

Entwickle ein internes Modell für aktive Notifications.

Der Store soll mindestens erfassen können:

* Signal-K-Path
* Notification-ID
* Quelle
* state
* message
* method
* createdAt
* letzter Update-Zeitpunkt
* silenced
* acknowledged
* canSilence
* canAcknowledge
* canClear
* Kategorie
* Priorität
* zusätzliche `data`

Wichtig:

Der Store ist NICHT die Wahrheit über den Alarmzustand.

Signal K bzw. das erzeugende Plugin bleibt authoritative source.

Der Store ist eine lokale Sicht auf die Notifications.

Nach einem Neustart muss der Manager den aktuellen Zustand wieder aus Signal K rekonstruieren können, soweit die API dies ermöglicht.

---

# 6. KATEGORISIERUNG

Implementiere die Klassifizierung getrennt von der Notification-Erfassung.

Erste Kategorien:

* ANCHOR
* NAVIGATION
* COLLISION
* WEATHER
* ELECTRICAL
* PROPULSION
* SYSTEM
* SECURITY
* OTHER

Die Klassifizierung soll bevorzugt anhand strukturierter Informationen erfolgen.

Priorität:

1. Notification Path
2. Source
3. strukturierte `data`
4. erst danach Textanalyse

Keine fragile reine Keyword-Lösung als Hauptmechanismus.

Beispiele:

`notifications.navigation.*`
→ NAVIGATION

`notifications.environment.*`
→ WEATHER

`notifications.electrical.*`
→ ELECTRICAL

`notifications.propulsion.*`
→ PROPULSION

Anchor-Alarm-Notifications
→ ANCHOR

Collision Detector
→ COLLISION

Unbekannte Notifications:
→ OTHER

Die automatische Grundklassifizierung wird im Plugin festgelegt. Unbekannte
Notifications bleiben `OTHER`. Benutzerüberschreibungen müssen später in der
persistenten Signal-K-Plugin-Konfiguration möglich werden; die WebApp zeigt
das Ergebnis nur an und verlinkt zur Konfiguration.

---

# 7. PRIORITÄTEN

Signal-K-Severity bzw. `state` nicht ersetzen.

Das Plugin darf intern zusätzliche Prioritäten für Darstellung und Audio verwenden.

Beispiel:

* normal
* nominal
* alert
* warn
* alarm
* emergency

Prüfe zuerst die tatsächlich gültigen Signal-K-Werte.

Keine frei erfundenen Severity-Werte in das Signal-K-Datenmodell schreiben.

---

# 8. SILENCE, ACKNOWLEDGE UND CLEAR

Diese drei Aktionen müssen strikt getrennt behandelt werden.

## Silence

Bedeutung:

Alarm bleibt fachlich aktiv, aber akustische Ausgabe wird unterdrückt.

Nur anbieten, wenn zulässig.

## Acknowledge

Bedeutung:

Bediener bestätigt, dass er die Meldung wahrgenommen hat.

Der zugrunde liegende Alarm kann weiterhin bestehen.

## Clear

Nur verwenden, wenn die Notification dies unterstützt.

Ein Alarm darf nicht durch den Notification Manager „weggeklickt“ werden, wenn seine Ursache weiterhin besteht.

Die UI muss diesen Unterschied deutlich zeigen.

---

# 9. AUDIO

Audio zunächst modular entwickeln.

Vorgesehene Schnittstelle ungefähr:

```js
play(notification)
stop(notification)
silence(notification)
stopAll()
```

Keine enge Kopplung zwischen Notification Store und ALSA.

Spätere Backends könnten sein:

* ALSA lokal
* vorhandenes `audio-control.sh`
* WebAudio im Browser
* Netzwerklautsprecher
* externe Notification-Dienste

Erste Version darf ein Mock-Audio-Backend verwenden.

Audio darf den Signal-K-Server nicht blockieren.

Keine synchronen Endlosschleifen.

---

# 10. SPÄTERE RULE ENGINE

Noch NICHT vollständig implementieren.

Architektur aber vorbereiten.

Später sollen Regeln beispielsweise ermöglichen:

```text
IF category == ANCHOR
AND state == alarm
THEN sound = anchor-alarm.wav
repeat = untilAcknowledged
```

oder:

```text
IF category == NAVIGATION
AND source indicates GNSS stale
THEN sound = navigation-warning.wav
repeatInterval = 30s
```

oder:

```text
IF category == ELECTRICAL
AND state == alarm
THEN sound
AND trigger external action
```

Aktionen könnten später sein:

* Node-RED
* HTTP webhook
* Signal-K-Pfad
* GPIO
* MQTT
* externe Nachricht
* Sprachansage

Diese Erweiterungen NICHT jetzt komplett implementieren.

Nur saubere Erweiterungspunkte vorsehen.

---

# 11. WEBAPP

Eine einfache, funktionale WebApp vorsehen.

Keine UI-Framework-Abhängigkeit einführen, solange sie nicht wirklich notwendig ist.

Die Hauptansicht soll aktive Notifications anzeigen.

Pro Notification mindestens:

* Kategorie
* Severity/state
* Text
* Quelle
* Zeitpunkt
* Silence-Status
* Acknowledge-Status

Bedienelemente abhängig von den Fähigkeiten:

* SILENCE
* ACKNOWLEDGE
* CLEAR

Buttons dürfen nur aktiv sein, wenn die jeweilige Operation zulässig ist.

Zusätzlich später:

* Silence All
* Acknowledge All
* Filter nach Kategorie
* Filter nach Severity
* History
* Audio-Test

Mobile Darstellung berücksichtigen.

Die WebApp soll auch auf einem Tablet oder Smartphone an Bord sinnvoll bedienbar sein.

Große Touch-Ziele.

---

# 12. VERSION 0.1 – BEWUSST KLEIN

Der erste tatsächlich funktionsfähige Meilenstein soll nur:

1. Signal-K-Notifications erfassen
2. aktiven Zustand intern darstellen
3. kategorisieren
4. über WebApp anzeigen
5. Silence anbieten
6. Acknowledge anbieten
7. Clear nur anbieten, wenn `canClear === true`
8. Änderungen live in der WebApp aktualisieren

Noch NICHT erforderlich:

* komplexe Rule Engine
* MQTT
* Telegram/Discord
* GPIO
* Sprachsynthese
* Alarmhistorie in Datenbank
* umfangreiche Benutzerverwaltung
* komplizierte Audio-Eskalationen

Keep version 0.1 simple.

---

# 13. TESTS

Tests sind Pflicht.

Mindestens testen:

### Classifier

Bekannte Paths ergeben erwartete Kategorien.

### Notification Store

* neue Notification
* Update bestehender Notification
* Acknowledge
* Silence
* Rückkehr zu normal
* unbekannte Felder
* fehlende optionale Felder

### Capability handling

Wenn:

```js
canClear === false
```

darf die Anwendung keinen Clear-Vorgang anfordern.

Analog für Silence und Acknowledge.

### Robustheit

Eine fehlerhafte oder ungewöhnliche Notification darf den Signal-K-Server nicht zum Absturz bringen.

---

# 14. LOGGING

Logging sparsam und aussagekräftig.

Beispiel:

```text
notification-manager: started
notification-manager: discovered 4 active notifications
notification-manager: ANCHOR alarm received
notification-manager: notification acknowledged id=...
```

Kein permanentes Log-Spamming bei jedem unveränderten Delta.

Debug-Logging optional.

---

# 15. SICHERHEIT / FAIL-SAFE

Dieses Plugin verwaltet Alarme auf einem Boot.

Daher:

**Ein Fehler im Notification Manager darf niemals die ursprüngliche Notification zerstören oder unterdrücken.**

Wenn der Manager abstürzt:

* Signal K muss weiterlaufen.
* erzeugende Plugins müssen weiterlaufen.
* Notifications müssen weiterhin im Signal-K-Datenmodell vorhanden sein.
* der Manager darf keine dauerhafte globale Silence-Konfiguration hinterlassen, sofern dies nicht ausdrücklich vom Benutzer ausgelöst wurde.

Bei Unsicherheit:

fail visible, not silent.

---

# 16. CODING STYLE

Bevorzuge:

* kleine Module
* klar definierte Verantwortlichkeiten
* verständlichen JavaScript-Code
* möglichst wenige Dependencies
* keine unnötigen Frameworks
* keine globale mutable state, wenn vermeidbar
* defensive Verarbeitung externer Daten

Node-Version und Signal-K-Kompatibilität in `package.json` dokumentieren.

---

# 17. GIT

Das Repository ist bereits lokal initialisiert.

Arbeite in kleinen nachvollziehbaren Schritten.

Vor größeren Änderungen:

```bash
git status
```

Nach einem abgeschlossenen logischen Schritt:

* Tests ausführen
* Änderungen prüfen
* sinnvoll committen

Keine Secrets committen.

Keine lokalen Signal-K-Konfigurationen committen.

---

# 18. DOKUMENTATION

README muss später mindestens enthalten:

* Zweck
* Architektur
* Installation
* Signal-K-Konfiguration
* WebApp
* unterstützte Notification-Aktionen
* bekannte Einschränkungen
* Entwicklung/Test
* Roadmap

Zusätzlich:

`docs/architecture.md`

mit Datenfluss:

```text
Signal K
   ↓
Notification API / subscription
   ↓
Notification Store
   ↓
Classifier
   ↓
Policy / Rules
   ├── Web UI
   ├── Audio
   └── Actions
```

---

# 19. AGENTS.md

Erstelle eine `AGENTS.md`, damit spätere Codex-Sessions die wesentlichen Projektregeln kennen.

Sie soll insbesondere festhalten:

* Projektziel
* Signal K ist authoritative source
* bestehende Notifications niemals eigenmächtig löschen
* Capability Flags respektieren
* keine breaking changes ohne Begründung
* Tests vor Commit
* keine Secrets
* kleine nachvollziehbare Commits
* Version 0.1 bewusst klein halten
* Dokumentation bei Architekturänderungen aktualisieren

---

# 20. DEIN ERSTER ARBEITSSCHRITT

Führe jetzt zunächst nur Phase 1 durch:

1. Repository untersuchen.
2. Aktuelle offizielle Signal-K-Dokumentation bzw. verfügbare API-Definitionen untersuchen.
3. Notification API und Notification-Datenmodell verifizieren.
4. Prüfen, welche Mechanismen ein Signal-K-Plugin zum Beobachten aller Notifications verwenden sollte.
5. Prüfen, wie eine WebApp zuverlässig Live-Updates erhält.
6. Unterschiede zwischen klassischem `notifications.*` Delta und Notification API dokumentieren.
7. Risiken und offene Fragen identifizieren.
8. `docs/notification-api-analysis.md` erstellen.
9. `docs/architecture.md` als ersten Architekturentwurf erstellen.
10. `AGENTS.md` erstellen.
11. Einen konkreten Implementierungsplan für Version 0.1 erstellen.

**Noch keine umfangreiche Implementierung der Version 0.1 beginnen.**

Am Ende berichte:

* was du über die Signal-K-API verifiziert hast,
* welche Architektur du empfiehlst,
* welche Annahmen aus diesem Auftrag falsch oder veraltet waren,
* welche offenen technischen Fragen bestehen,
* welche Dateien du angelegt/geändert hast,
* welche Tests in Phase 2 benötigt werden,
* und welchen nächsten Implementierungsschritt du empfiehlst.

Wenn aktuelle Signal-K-APIs von den oben genannten Annahmen abweichen, folge der aktuellen offiziellen API und dokumentiere die Abweichung ausdrücklich.
