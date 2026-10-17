# Signal K Notification Engine

> Deutsche Übersetzung. Die englische [README](README.md) ist die verbindliche
> Projektdokumentation.

Notification Engine ist ein Signal-K-Server-Plugin mit zugehöriger WebApp. Es
bündelt aktive Benachrichtigungen in einer Zentrale und wendet lokal erstellte
Regeln für Darstellung, Verlauf, Audio und begrenzte externe Aufgaben an. Die
Regeln werden mit gewöhnlichen Nodes in der in Signal K eingebetteten
Node-RED-Instanz visuell aufgebaut.

Signal K und das Plugin, das eine Benachrichtigung ausgelöst hat, bleiben
maßgeblich. Die Engine erfindet keinen zweiten Alarm-Lebenszyklus und bietet
Stummschalten, Quittieren oder Zurücksetzen nur an, wenn die aktuelle
Signal-K-Benachrichtigung die jeweilige Aktion erlaubt.

## Voraussetzungen

- Signal K Server mit aktiviertem eingebettetem Node-RED-Plugin
- Node-RED 4.x für den mitgelieferten Referenz-Flow
- `aplay` und ein funktionierendes ALSA-Wiedergabegerät, wenn serverseitiges
  Audio verwendet wird
- ein Signal-K-Benutzer mit Schreibberechtigung für Benachrichtigungsaktionen
  und Tests

Die derzeit getestete Entwicklungsversion ist `0.1.90`.

## Schnellstart in fünf Minuten

1. `signalk-notification-engine` in Signal K installieren. Das Plugin zunächst
   deaktiviert lassen, bis der unten beschriebene Rule-Builder-Flow deployt ist.
2. Den in Signal K eingebetteten Node-RED-Editor öffnen.
3. [`node-red/notification-engine-release-flow.json`](node-red/notification-engine-release-flow.json)
   importieren.
4. Den importierten Tab aktiv lassen. Den letzten Wire von **Quick Start: show
   in table** mit dem mitgelieferten Debug-Node verbinden, der exakt `Activate`
   heißt, und anschließend deployen.
5. In der Signal-K-Plugin-Konfiguration Notification Engine öffnen, das Plugin
   aktivieren und den Tab unter **Rule Builder Flow** auswählen. Die darunter
   angezeigte stabile ID prüfen und speichern.
6. Die Notification-Engine-WebApp öffnen und in Diagnostics prüfen, ob die
   Konfiguration `ready` meldet und die erzeugte Quick-Start-Regel aufgeführt
   ist.

Jede aktive Regel benötigt einen ununterbrochenen Wire von einem
Benachrichtigungszustands-Node über die Match- und Action-Nodes bis zu
`Activate`. Allein durch den Import des Referenz-Flows werden weder eine Regel
noch ein Sound oder eine externe Aufgabe aktiviert.

## Sicherheitsgrenze

- Unbekannte Benachrichtigungen bleiben standardmäßig sichtbar.
- `emergency` kann durch dieses Plugin niemals lokal stummgeschaltet werden.
- Lokale Audiounterdrückung ändert niemals den Signal-K-Zustand einer
  Benachrichtigung.
- Quittieren, Stummschalten und Zurücksetzen erfordern sowohl die aktuelle
  Mitgliedschaft im Signal-K-Notification-API-Manager als auch die jeweilige
  aktuelle Berechtigung.
- Ein `normal`-Datensatz verschwindet aus der aktiven Tabelle, sobald Signal K
  seine ID aus diesem Manager entfernt. Sein vorhandener lokaler Verlauf bleibt
  ohne künstlichen Cleanup-Eintrag erhalten.
- Das Löschen des Verlaufs entfernt nur den lokalen Audit-Eintrag der Engine.
- Externe Aufgaben quittieren, stummschalten, löschen oder normalisieren
  niemals eine Benachrichtigung.
- **Wichtig:** Parallel installierte Plugins, Flows, Alarmprogramme oder
  Skripte können denselben Alarm zusätzlich akustisch ausgeben. Dadurch sind
  doppelte, überlagerte oder nicht gemeinsam stummschaltbare Töne möglich. Der
  Betreiber muss solche Wechselwirkungen prüfen und vermeiden und darf für
  einen Alarm nur den vorgesehenen Audioausgabeweg aktiv lassen.

## Dokumentation

- [Benutzerhandbuch](docs/user-guide.de.md) — Konfiguration, Regelerstellung,
  Bedienung, Audiotests, Verlauf, Diagnostics, Aktualisierung, Fehlersuche und
  Wiederherstellung
- [Englisches Benutzerhandbuch](docs/user-guide.md)
- [Architektur](docs/architecture.md)
- [Analyse der Notification-API-Autorität](docs/notification-api-analysis.md)
- [Teststrategie](docs/testing.md)
- [End-to-End-Sicherheitsmatrix](docs/e2e-safety-matrix.md)
- [Raspberry-Pi-Integration und Wiederherstellungsnachweise](docs/pi-integration.md)

## Entwicklung

Dieses Projekt wurde von seinem Maintainer mit Unterstützung von OpenAI Codex
konzipiert und entwickelt.

KI-unterstützte Beiträge werden vom Maintainer geprüft und validiert. Er bleibt
für Funktionalität, Sicherheit und Wartung des Projekts verantwortlich.

## Entwicklungsprüfungen

```sh
npm run check
npm test
npm pack --dry-run
```

Für Arbeiten am Repository gilt außerdem [`AGENTS.md`](AGENTS.md), insbesondere
für Signal-K-Autorität, Deployment, Sicherungen, Node-RED und Live-Tests.
