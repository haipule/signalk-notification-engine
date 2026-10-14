# Benutzerhandbuch der Notification Engine

> Deutsche Übersetzung. Das englische [Benutzerhandbuch](user-guide.md) ist die
> verbindliche Projektdokumentation.

## Funktion des Plugins

Notification Engine stellt eine WebApp für aktive Signal-K-Benachrichtigungen
und einen visuellen Rule Builder auf Grundlage der in Signal K eingebetteten
Node-RED-Instanz bereit. Es steuert die lokale Darstellung, den lokalen
Audit-Verlauf, serverseitigen Sound und die begrenzte Übergabe an eine
ausdrücklich autorisierte ausführbare Datei. Der Erzeuger der Benachrichtigung
und Signal K bleiben für jeden Benachrichtigungs-Lebenszyklus maßgeblich.

## Installation und Aktivierung

Das Paket über Signal K installieren, Notification Engine jedoch deaktiviert
lassen, bis der unten beschriebene Rule-Builder-Flow mindestens einen gültigen,
deployten Zweig enthält. Die eingebettete Node-RED-Laufzeit muss verfügbar
sein. Das Plugin beendet die Verarbeitung sicher, wenn der ausgewählte
Rule-Builder-Tab fehlt, deaktiviert, leer oder ungültig ist.

Für manuelles Raspberry-Pi-Deployment und Wiederherstellung gelten die
[Pi-Integrationshinweise](pi-integration.md). Dieses Projekt niemals in einen
separaten `nodered.service` oder nach `/home/pi/.node-red` deployen.

## Rule-Builder-Flow importieren und auswählen

1. Den in Signal K eingebetteten Node-RED-Editor öffnen.
2. `node-red/notification-engine-release-flow.json` als neuen Tab importieren.
3. Prüfen, dass kein importierter Node ein rotes Dreieck für einen ungültigen
   Node zeigt.
4. Den Tab aktiv lassen, mindestens einen beabsichtigten vollständigen Zweig
   mit dem mitgelieferten `Activate`-Node verbinden und deployen. Bei einer
   Erstinstallation den dokumentierten Quick-Start-Zweig verwenden.
5. In der Plugin-Konfiguration der Notification Engine das Plugin aktivieren,
   den Tab unter **Rule Builder Flow** auswählen, die darunter angezeigte
   schreibgeschützte stabile ID prüfen und speichern.

Es wird ausschließlich die ausgewählte stabile ID gelesen. Das Umbenennen des
Tabs ist unschädlich; seine Deaktivierung oder Löschung stoppt jedoch die
Verarbeitung. Die Engine durchsucht niemals andere Tabs und weicht nicht auf
einen gleichnamigen Tab aus.

## Eine Regel erstellen

Eine Regel besteht aus einem ununterbrochenen Message-Flow-Zweig:

```text
Notification state → optional match/condition → action(s) → Activate
```

`Activate` ist ein gewöhnlicher Debug-Node, der exakt `Activate` heißt. Nodes
auf dem Tab bewirken nichts, solange der vollständige Zweig `Activate` nicht
erreicht und der Flow nicht deployt wurde. Zweige teilen sich nicht
automatisch ein Payload-Objekt. Deshalb müssen alle von einer Regel benötigten
Eigenschaften im selben verbundenen Zweig liegen. Eine Regel mit exaktem Pfad
ist spezifischer als eine reine Zustandsregel und überschreibt nur die von ihr
gesetzten Felder.

Mehrere `Activate`-Nodes werden unterstützt. Widersprüchliche Zuweisungen für
denselben Geltungsbereich führen zur Ablehnung des Deployments, statt von der
Reihenfolge im Node-RED-JSON abzuhängen.

Der Referenz-Flow dokumentiert Nodes für Zustand, Pfad, Bedingung, Sichtbarkeit,
Darstellung als Tabelle/Banner/Overlay, Farbe, Blinken, Verlauf, Sound,
Ignorieren und Ausführen. Im Info-Bereich jedes Nodes stehen Zweck und Beispiel.
Sound-, Ignore- und Execute-Beispiele bleiben unverbunden, bis sie bewusst
konfiguriert werden.

## Zuständigkeit der Plugin-Konfiguration

Die Signal-K-Plugin-Konfiguration ist der geschützte Ort für hostbezogene oder
privilegierte Einstellungen:

- **Rule Builder Flow** — ausgewählter aktiver Tab des eingebetteten Node-RED
- **Audio Player** und **Audio Device** — WAV-Befehl und ALSA-PCM
- **Sound Test File** und **Sound Test** — einmalige technische Wiedergabe nach
  dem Speichern
- **Alarm Sound Test** — `0` deaktiviert ihn; `1` bis `30` legt das Intervall
  in Tagen fest
- **History Entries** und **History Retention** — Grenzen des lokalen Audits
- **Info Auto-Close**, **Info Shortcut** und **History Shortcut**
- **Critical Input Diagnostics** — schreibgeschützte Prüfung von Aktualität und
  Quelle eines Pfades
- **External Tasks** — Parallelitätsgrenze und exakte Autorisierung je Datei
- **Test Notification** — einmalige begrenzte Wartungsbenachrichtigung nach dem
  Speichern

Benachrichtigungs-Match, Sichtbarkeit, Darstellung, Aufnahme in den Verlauf,
Soundbehandlung, Ignorieren und Ausführungsanforderungen gehören in den
ausgewählten Rule Builder.

## Benachrichtigungszentrale

Die Tabelle zeigt alle aktiven Benachrichtigungen einschließlich unbekannter
Zustände. Signal K kann einen Wert im Zustand `normal` im Datenmodell behalten,
nachdem seine ID aus dem aktiven Notification-API-Manager entfernt wurde.
Dieser Restdatensatz wird nicht mehr als aktiv angezeigt. Das Cleanup erzeugt
keinen künstlichen Verlaufseintrag; die bereits aufgezeichneten Ereignisse des
Vorkommnisses bleiben über den zentralen Verlauf-Button der Tabelle erreichbar.
`nominal` gehört nicht zu Signal Ks Cleanup für den Zustand `normal`. Bekannte
Zustände werden in dieser festen absteigenden Reihenfolge sortiert:

```text
emergency, alarm, warn, alert, normal, nominal
```

Eine Zeile auswählen, um ihr Informationsfenster und die einzeln zulässigen
Aktionen zu öffnen. Globale Aktionen gelten ausschließlich für genau die in
der Tabelle sichtbaren Datensätze.

- Quittieren ist in jedem Zustand verfügbar, wenn Signal K es erlaubt.
- Eine Lebenszyklusaktion setzt zusätzlich voraus, dass die Benachrichtigungs-
  ID weiterhin im aktuellen Signal-K-Notification-API-Manager vorhanden ist.
  Im Datenmodell verbliebene Berechtigungsflags allein aktivieren keine Aktion.
- Für `emergency` bietet dieses Plugin niemals Stummschalten an.
- Zurücksetzen ist nur verfügbar, wenn `status.canClear` den Wert `true` hat.
- Fehlt dem Browser die Schreibberechtigung, bleibt eine ansonsten anwendbare
  Aktion sichtbar, wird aber deaktiviert und mit einem Berechtigungshinweis
  versehen.

Ein Banner ist eine feste Leiste innerhalb der Zentrale; ein Overlay ist die
vollständige Aufmerksamkeitsebene. Durch das Quittieren eines `emergency`
verschwindet dessen Overlay. Der Zustand `emergency` und das unabhängige
serverseitige Audio werden dadurch nicht geändert.

## Audio und Wiederholung

Audio wird auf dem Signal-K-Host wiedergegeben, nicht in jedem Browser. Die
Anzahl der Wiedergaben ist:

> **Wichtig:** Parallel installierte Plugins, Flows, Alarmprogramme oder
> Skripte können denselben Alarm zusätzlich akustisch ausgeben. Dadurch sind
> doppelte, überlagerte oder nicht gemeinsam stummschaltbare Töne möglich. Der
> Betreiber muss solche Wechselwirkungen prüfen und vermeiden und darf für
> einen Alarm nur den vorgesehenen Audioausgabeweg aktiv lassen.

- `0` — Wiederholung, bis der unabhängige Lebenszyklus oder das erlaubte
  Stummschalten sie beendet
- `1` — einmalige Wiedergabe
- `2` bis `99` — exakt so viele Wiedergaben

`payload.sound.pauseSeconds` akzeptiert ausschließlich ganze Sekunden von `0`
bis `5` und gilt zwischen vollständigen Wiedergaben. Ungültige Werte führen
zur Ablehnung der Regel.

Diagnostics kann nachweisen, dass Player und ALSA-PCM vorhanden sind, nicht
jedoch, dass Verstärker, Lautstärke, Kabel und Lautsprecher tatsächlich hörbar
sind.

### Sound Test

**Sound Test** in der Plugin-Konfiguration spielt die konfigurierte Datei nach
dem Speichern einmal ab. Er prüft den technischen Wiedergabeweg und schließt
den geplanten Alarm Sound Test nicht ab.

### Alarm Sound Test

Der Test in der Benachrichtigungszentrale öffnet nach der Wiedergabe ein
Fenster für die Rückmeldung des Bedieners. **Alarm heard** oder **Sound not
heard** auswählen. Nur **Alarm heard** dokumentiert die bestätigte menschliche
Hörbarkeit; ein erfolgreicher Player-Prozess allein gilt nicht als Hörnachweis.

## Lokaler Verlauf

Der Verlauf ist ein begrenztes lokales Audit. Eine ausdrücklich sichtbare
Regel aktiviert den Verlauf standardmäßig; `history: true` oder
`history: false` kann dies überschreiben. Die Entscheidung bleibt für das
gesamte lokale Vorkommnis erhalten, sodass ein aufgenommenes Vorkommnis auch
seinen abschließenden Übergang zu `normal` oder `cleared` behält.

Das Löschen des Verlaufs entfernt ausschließlich lokale Audit-Daten. Es löscht,
setzt oder verändert niemals eine Signal-K-Benachrichtigung. Das Entfernen
einer Regel beeinflusst zukünftige Aufzeichnungen und löscht ältere Einträge
nicht automatisch.

## Externe Aufgaben

Eine Regel fordert eine ausführbare Datei an, indem sie ausschließlich
`payload.execute` auf einen absoluten Pfad setzt und `Activate` erreicht. Die
Plugin-Konfiguration muss exakt denselben Pfad enthalten und dessen
dateibezogener Schalter **Enabled** muss aktiviert sein. Einen globalen Schalter
gibt es nicht.

Die Engine startet den Pfad direkt, ohne dynamische Benachrichtigungsargumente
und ohne zusätzliche Shell. Shell-Skripte funktionieren über ihren Shebang.
Ein akzeptierter Pfad wird höchstens einmal pro Vorkommnis gestartet, verwendet
sein konfiguriertes Timeout und die globale Parallelitätsgrenze und wird nicht
wiederholt. Aufgabenergebnisse erscheinen ausschließlich im lokalen Audit und
in Diagnostics; sie ändern niemals den Benachrichtigungs-Lebenszyklus.

## Test Notification

**Run Test Notification Once** erzeugt nach dem Speichern der
Plugin-Konfiguration einmalig eine eindeutig gekennzeichnete, begrenzte
Signal-K-Testbenachrichtigung. Das Plugin setzt ausschließlich seine eigene
zurückgegebene ID zurück und deaktiviert anschließend den Schalter. Signal K
kann den abgeschlossenen Datensatz als `normal` behalten. Dieser administrative
Test ist von Sound Test und Alarm Sound Test getrennt.

## Diagnostics

Diagnostics ist schreibgeschützt und trennt Zustände von Browser, Plugin,
Node-RED, Eingängen, Persistenz, externen Aufgaben und Audio. Eine gesunde
Installation zeigt:

- übereinstimmende Browser- und Serverversionen
- Node-RED-Konfiguration `ready` und verfügbare Deploy-Ereignisse
- erwartete Regelanzahl und Prüfsumme
- bereites Audio-Backend/PCM ohne unerwarteten aktiven Prozess
- aktuelle erwartete kritische Eingänge aus der konfigurierten Quelle
- keinen Lokalisierungs- oder Persistenzfehler

Rohpfade, Quellen, IDs, Meldungen der Erzeuger und Diagnosedaten werden bewusst
nicht übersetzt.

## Sprache und eigene Übersetzungen

Die WebApp enthält Englisch und Deutsch. Der Sprachbutton speichert die Auswahl
je Browser. Ohne ausdrückliche Auswahl werden die Browsersprachen verwendet;
Englisch ist die Rückfallebene.

Eigene Übersetzungen sind deklarative JSON-Dateien im dauerhaften Verzeichnis
`translations` unterhalb des Signal-K-Plugin-Datenpfades:

```json
{
  "schemaVersion": 1,
  "locale": "nl",
  "name": "Nederlands",
  "messages": {
    "app.title": "Meldingscentrum"
  }
}
```

Unbekannte Schlüssel werden ignoriert. Unsicheres Markup, falsche Typen,
übermäßige Größe und inkompatible Platzhalter werden abgelehnt. Fehlende Texte
fallen auf Englisch zurück; Lokalisierungsfehler stoppen niemals die
Benachrichtigungsverarbeitung.

## Aktualisierung

1. Version, ausgewählte stabile Tab-ID, Regel-Prüfsumme und Diagnostics
   festhalten.
2. Installiertes Plugin und eingebetteten Node-RED-Flow sichern.
3. Paket installieren und `signalk.service` neu starten, wenn erforderlich.
4. Die vollständige Initialisierung von Signal K, eingebettetem Node-RED und
   Plugin abwarten.
5. Version, Konfigurationsstatus `ready`, Regel-IDs/Prüfsumme, kritische
   Eingänge, Audio-Ruhezustand und ausgelieferte WebApp-Version prüfen.
6. Lange geöffnete Browser-Tabs neu laden, wenn Diagnostics eine
   Versionsabweichung meldet.

Paketaktualisierungen ersetzen den separat gespeicherten eingebetteten
Node-RED-Flow nicht.

## Fehlersuche

### Konfiguration ist nicht bereit

Prüfen, ob der ausgewählte stabile Tab vorhanden und aktiv ist, einen gültigen
Zweig zu `Activate` enthält und deployt wurde. Ein ähnlich benannter Tab wird
nicht als Ersatz verwendet.

### Browser zeigt eine alte Version

Die Seite ohne Cache neu laden. Diagnostics zeigt Abweichungen zwischen
Browser- und Serverversion an.

### Kein Sound

Audio Player und Audio Device prüfen, Diagnostics ansehen, anschließend Sound
Test für den technischen Wiedergabeweg und Alarm Sound Test für die bestätigte
Hörbarkeit ausführen.

### Aktion ist deaktiviert

Das Informationsfenster öffnen. Die dort angezeigte Begründung unterscheidet
zwischen der Fähigkeit des Erzeugers und einer fehlenden Schreibberechtigung
des aktuellen Browser-Benutzers.

### Externe Aufgabe wurde nicht ausgeführt

Exakte Übereinstimmung des Pfades, dateibezogene Aktivierung, einen Wire zu
`Activate` und ein neues Vorkommnis prüfen. Das Audit der externen Aufgaben
enthält das Übergabeergebnis.

## Wiederherstellung

Das gesicherte installierte Paket wiederherstellen und Signal K neu starten.
Wenn ein Flow-Deployment den Fehler verursacht hat, einen gesicherten
eingebetteten Flow über das eingebettete Node-RED wiederherstellen. Den alten
Tab `Audio Alarms` nicht aktivieren, solange Notification-Engine-Audio aktiv
ist. Erprobte Abläufe stehen in den
[Pi-Integrationshinweisen](pi-integration.md).
