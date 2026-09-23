# TODO

## Priorisierte Historienoptimierung

- [x] Konfigurationsabhängigkeit erzwingen: Nur Zustände aus `Notification
  State Order and Visibility` dürfen in der lokalen Tabelle erscheinen oder
  lokale Visual-/Audio-Ausgaben auslösen. `Standard Sound by State` darf für
  nicht gelistete Zustände keinen Alarmton aktivieren; die Konfiguration muss
  diesen Zusammenhang ausdrücklich erklären.

- [ ] AudioDevice-Dokumentation vervollständigen: `default`, `plughw:0,0`,
  `plughw:1,0` und `plughw:2,0` erklären; Testton vor Notification-Tests
  abspielen und funktionierenden Ausgang dokumentieren.
- [ ] Mehrere UI-Designvarianten für die Alarmzentrale auswählen können, zum
  Beispiel `color`, `contrast` und `night`.

- [x] Stabile lokale `occurrenceId` für einen Alarm-Lebenszyklus einführen und
  wechselnde Signal-K-IDs über ID, `historyKey` und sichere Fallback-Regeln
  zusammenführen.
- [x] Relevante und irrelevante `updated`-Ereignisse unterscheiden.
- [x] Alarm-Lebenszyklus in der UI als Timeline mit Erkennung, Änderungen,
  Quittierung, Stummschaltung, Auflösung und Dauer darstellen.
- [x] Historie primär über `occurrenceId`, zusätzlich über Pfad, Quelle, Zustand
  und Zeitraum filterbar machen.
- [x] Bestätigte direkte Löschaktionen für gesamte, zeitlich begrenzte,
  pfadbezogene und nichtkritische Historie ergänzen.
- [x] Zeitbasierte Retention neben der Eintragsbegrenzung ergänzen.
- [x] Historienansicht mit „mehr laden“ und klarer Anzahl der ausgewählten
  Notification-Historie
  erweitern.
- [x] Persistenzfehler, Datenmigration und beschädigte Historien-Dateien
  sichtbar und beherrschbar machen.
- [x] Dokumentation zur Abgrenzung zwischen lokaler Notification-Historie und
  Signal-K History API bereinigen.

## 1. Configuration and rules

- [x] Sound-Wiedergabe je Status mit `once`, `repeat`, `loop`, Wiederholungszahl
  und Intervall konfigurieren; `Silence` beendet nur den zugehörigen Sound.

- `Visible Notification States` und `Notification Sort Order` wurden zu einer
  gemeinsamen Zustandsliste zusammengeführt.

- Historienaufzeichnung ist über `historyRules` nach Pfadpräfix und Quelle
  konfigurierbar; erste passende Regel gewinnt. Ohne Regel werden nur
  `alarm` und `emergency` aufgezeichnet.
- Schalter `clearHistoryOnStart` für eine ausdrücklich ausgelöste Bereinigung
  der lokalen Historie ist implementiert.
- Shortcuts validieren: Konfliktbehandlung ist implementiert; mögliche
  Konflikte mit weiteren Eingabefeldern noch prüfen.
- Die Plugin-Konfiguration bleibt die alleinige Stelle für Klassifikation,
  Policies und Sortierung; die App verlinkt dorthin.
- Link „Plugin konfigurieren“ in der App ist ergänzt.
- Tabellenansicht mit Auswahlrahmen, globalen Aktionen unterhalb der Tabelle
  und Einzelaktionen im Infofenster ist umgesetzt.
- Historie zeigt das Datum pro Tag nur beim ersten Eintrag.

- [ ] Node-RED-Node-Set bei der Plugin-Installation automatisch in einem
  update-sicheren Examples-/Local-Ordner der eingebetteten Node-RED-Instanz
  bereitstellen; nicht in verwaltete `node_modules`-Examples schreiben.
- [x] In der WebApp einen `Rules`-Button im Infofenster ergänzen, der für die
  ausgewählte Notification die zugehörige Regel in einem separaten Fenster
  anzeigt.
- [ ] Im Config-Flow die Sound-Eigenschaften `once`, `repeat` und `loop` als
  eigene Nodes unterstützen.
- [ ] Einen pseudo-terminalen `ACTIVATE`-Debug-Node als Regelabschluss
  verwenden; nur durchgängig vom Auslöser bis `ACTIVATE` verbundene Regeln
  werden beim Deploy rückwärts geprüft und aktiviert.

## 2. Presentation behaviour

- Tie-Breaker der Sortierung festlegen: Bei gleicher Zustandsstufe zuletzt
  aktualisierte Notifications zuerst.
- Darstellung der per-Notification-Historie weiter ausarbeiten: Zeitachse,
  Zustandswechsel, `firstSeenAt`, Auflösung und Umgang mit wechselnden IDs.
- Historienfenster auf Lesbarkeit bei vielen Einträgen prüfen; Gruppierung und
  Begrenzung der Darstellung festlegen.
- Für „Recent activity“ entscheiden: Vorschau behalten, ins Historienfenster
  verschieben oder aus der Hauptansicht entfernen.
- Integrationsphase für Info- und Historienfunktionen nach den Praxistests
  abschließend festlegen.

## 3. End-to-end validation

- [ ] Source-Verlust bei bestehenden Signal-K-Notifications reproduzieren und
  beheben. Beispiel: `notifications.propulsion.stbdEngine.exhaustTemperature`
  mit Notification-ID `2ff367b5-4465-456b-9402-3ca7d8948aed` wird im Signal-K-
  Datenmodell mit `$source: self.notificationhandler` geliefert, erscheint im
  Centre aber als `Unknown source`. Delta-, Snapshot-, API- und Merge-Pfad
  einzeln protokollieren; die Source darf bei wechselnder Notification-ID oder
  beim Zusammenführen von `app.notifications.list()` nicht verloren gehen.
  Akzeptanzkriterium: Das Centre zeigt für diesen Pfad dauerhaft
  `self.notificationhandler` und die Historie verwendet dieselbe Quelle.

- Live-Aktualisierung praktisch testen; die Ansicht sollte Zustandswechsel
  innerhalb des 5-Sekunden-Intervalls übernehmen.
- [ ] Erkennungsverzögerung vergleichen: Testalarm gegen echten Alarm; Delta-
  und Snapshot-Zeitstempel getrennt bewerten.
- Gezielt einen Hoekens-Ankeralarm auslösen und den Radius erhöhen.
- Prüfen, ob die Historie `raised` und anschließend `updated` auf `normal`
  oder `cleared` persistiert.
- Prüfen, ob wechselnde Notification-IDs die Lebenszyklus-Zuordnung
  erschweren.

### Upstream-Issue für Hoekens Anchor Alarm

- [ ] Issue vorbereiten/einreichen: Ein ACK darf nicht über mehrere
  Ankermanöver hinweg erhalten bleiben.
  Hoekens verwendet für `notifications.navigation.anchor` dieselbe
  Notification-ID und sendet beim Raise bei aktivem
  `enableNormalNotifications` nur `state: normal`; beim nächsten Drop wird
  dieselbe Notification wieder auf `alarm` gesetzt. Der von Signal K
  gespeicherte Status `acknowledged: true` bleibt dadurch erhalten. Ein neuer
  Ankeralarm erscheint dann bereits quittiert, obwohl ein neues Manöver
  begonnen hat. Das ist sicherheitsrelevant, weil ein neuer Drag-Alarm dadurch
  weniger auffällig sein kann.
- Erwartete Upstream-Lösung: Beim Raise die Notification entfernen (`null`)
  oder beim neuen Drop einen neuen Notification-Lifecycle/eine neue ID
  erzeugen und den ACK-Status zurücksetzen. Ein reiner Wechsel auf `normal`
  reicht nicht.
- Als Nachweis für das Issue dokumentieren: gleiche ID
  `e8cf94af-698a-4091-ad22-c8b17b5840d1` bei `alarm`, ACK und anschließendem
  `normal` nach Radiusänderung.
- Zwischenlösung: Vor jedem neuen Drop den vorherigen Anker vollständig
  raisen und prüfen, dass der Pfad nicht mehr aktiv ist. Falls die ID bestehen
  bleibt, `enableNormalNotifications` vor dem Raise vorübergehend deaktivieren,
  damit Hoekens `null` sendet; danach wieder aktivieren und erst dann neu
  droppen. Bis zur Upstream-Korrektur jeden neuen Alarm manuell auf
  `acknowledged: false` prüfen und den Sound über den Notification Manager
  testen.
- [x] Lifecycle-Sonderfälle in `lifecycle-rules.json` auslagern und beim
  Speichern der Plugin-Konfiguration neu einlesen; Handhabung dokumentieren.

## 4. Handoff

- Dokumentation der neuen Einstellungen vervollständigen.
- Aktuellen Stand auf dem Raspberry Pi installieren und testen.
- Danach den getesteten Entwicklungsstand committen.
- [ ] Nach erreichter Entwicklungsreife das Plugin in ein öffentliches Git-
  Repository überführen und als npm-Paket veröffentlichen; anschließend die
  Appstore-Metadaten und die Installationsdokumentation aktualisieren.

## 6. UI-Aktionen und Piktogramme

- [ ] Im History-Fenster den Lösch-Button nach erfolgreichem Löschen der
  Historie ausblenden.
- [ ] Buttons im Infofenster und für „Delete this history“ deutlich auffälliger
  gestalten.
- [ ] Passende, verständliche Piktogramme für `Silence`, `Acknowledge`,
  `Clear` und „Delete this history“ auswählen und auf Touch-Bedienung prüfen.

## 7. Audio und Historienexport

- [ ] Soundstatus je Zustand mit `Active` steuerbar machen; leerer oder
  fehlender Soundpfad darf den Alarm nicht beeinflussen und soll als
  Audiofehler im Server-Log sowie zusätzlich in der lokalen Historie erscheinen.
- [ ] Eine Möglichkeit schaffen, die lokale Historie zu speichern bzw. zu
  exportieren.

## 8. Systemweite Alarmanzeige

- [ ] `emergency` muss unabhängig vom aktuell sichtbaren Bildschirm erscheinen,
  auch über Vollbildanwendungen wie Filmwiedergabe oder OpenCPN hinweg.
- [ ] Prüfen und entscheiden, ob `alarm` ebenfalls systemweit angezeigt wird.
- [ ] Für die systemweite Anzeige eine geeignete Raspberry-Pi-/Desktop- oder
  Kiosk-Integration konzipieren; das Browser-Overlay des Plugins allein reicht
  dafür nicht aus.

## 9. Policy-Match-Logik

- [ ] Prüfen und dokumentieren, ob mehrere gesetzte Policy-Bedingungen künftig
  zusätzlich über UND verknüpft werden sollen. Aktuell genügt ein Match von
  `category`, `pathPrefix` oder `source`; nur eine vollständig leere Bedingung
  ist nicht zulässig.

## 5. Weiteres Alarmhandling

- Voice-Ausgabe für ausgewählte Alarmzustände und Quellen konzipieren.
- Regeln für Wiederholung, Stummschaltung, Quittierung und Sprachpriorität
  definieren.
- Bestehendes Anchor-Audio und spätere Voice-Ausgabe sauber über einen
  gemeinsamen Alarm- bzw. Audio-Dienst integrieren.
- Verhalten bei gleichzeitigem `emergency`, `alarm` und `warn` festlegen.

## 10. Diskussionspunkte: Audio und Historie

- [ ] Audio-Backend abstrahieren, damit neben Linux/ALSA (`aplay`) auch
  PulseAudio/PipeWire, macOS, Windows und Container-Umgebungen unterstützt
  werden können.
- [ ] Entscheiden, ob Browser-Audio als zusätzlicher Ausgabekanal angeboten
  werden soll: Audioereignisse per WebSocket oder SSE an die WebApp senden und
  dort über Web Audio API oder `HTMLAudioElement` abspielen.
- [ ] Für Browser-Audio Einschränkungen bewerten: erforderliche Benutzeraktion
  wegen Autoplay-Regeln, geschlossene oder schlafende Tabs, Lautstärke,
  mehrere Browser und Eignung als sicherheitskritischer Alarmkanal.
- [ ] Festlegen, ob der Raspberry Pi-Audioausgang Primärkanal bleibt und
  Browser-Audio nur optional pro Gerät oder Policy aktiviert wird.
- [ ] Prüfen, wie bestehende externe Audioquellen wie Hoekens-/Node-RED-
  Skripte in einen gemeinsamen Audio-Dienst integriert oder klar getrennt
  werden.
- [ ] SQLite als mögliche Ablösung der JSON-Historie evaluieren; insbesondere
  Ressourcenverbrauch auf dem Pi, native npm-Abhängigkeiten, Transaktionen,
  parallele Browserzugriffe, Retention und Abfragen.
- [ ] Datenbankschema für Alarm-Lebenszyklen und Ereignisse entwerfen und
  Migration der bestehenden `notification-history.json` ohne Datenverlust
  planen.
