# TODO

## Arbeitsstand zum Feierabend – 2026-09-28

- [x] Source-Reparatur live abgenommen: Der aktuelle Snapshot und zwei neue
  History-Lebenszyklen für
  `notifications.propulsion.stbdEngine.exhaustTemperature` verwenden
  durchgehend `engineroomStbd.XX`; kein neues `Unknown source` und kein neues
  Überschreiben durch `self.notificationhandler`.
- [x] Version `0.1.10` auf dem Pi installiert: Die Notification-Spalte wird
  innerhalb der maßgeblichen Zustandsreihenfolge segmentweise nach dem
  punktgetrennten Signal-K-Pfad sortiert, sodass gemeinsame Pfadpräfixe als
  Gruppen zusammenbleiben.
- [x] Version `0.1.11` auf dem Pi installiert: Read-only Diagnostics-API und
  WebApp-Fenster erfassen Client-Poll, Server-Snapshot, Deltas, Node-RED-Status,
  Audio-Prozesse/-Ergebnis und History-Schreibstatus. Damit ist die notwendige
  Instrumentierung für den späteren Stale-/Reconnect-Test vorhanden.
- [ ] Tab-3-Stale-/Reconnect-Test weiterhin zurückgestellt. Tab 3 steht derzeit
  nicht zur Verfügung. Beim späteren Test muss die WebApp zuerst vollständig
  neu geladen werden; danach WLAN aus/an sowie Poll-, Timeout- und
  Watchdog-Zeitpunkte über Diagnostics vergleichen. Bis dahin keine weiteren
  Änderungen an den Stale-Timern vornehmen.
- [x] Version `0.1.12` auf dem Pi installiert: Passiver Audio-Watchdog prüft
  `aplay` und das konfigurierte ALSA-Playback-PCM beim Start und minütlich,
  ohne das Gerät zu öffnen oder einen Ton abzuspielen. Live: Watchdog `ready`,
  `/usr/bin/aplay`, `plughw:2,0`, PCM `02-00` playback-fähig, keine aktiven
  Audioprozesse und keine wartenden Retries. Die Prüfung bestätigt ausdrücklich
  nicht Verstärker, Lautsprecher, Lautstärke oder tatsächliche Hörbarkeit.
- [x] Abschlusszustand auf dem Pi: Signal K und `signalk-health.timer` aktiv,
  separater `nodered.service` inaktiv, Node-RED-Konfiguration `ready`, letzter
  beobachteter Snapshot 227 ms, Load Average `1.22 / 1.26 / 1.37`.
- [ ] **Hier weiterarbeiten:** Circuit-Breaker für fehlgeschlagene
  Audiowiedergabe festlegen und implementieren. Vor der Änderung ist die
  sicherheitsrelevante Regel mit dem Benutzer abzustimmen und anschließend hier
  zu dokumentieren. Offener Vorschlag: nach fünf aufeinanderfolgenden
  Wiedergabefehlern pro Notification-Lifecycle öffnen, während der sichtbare
  Alarm unverändert aktiv bleibt; danach höchstens ein Probeversuch alle fünf
  Minuten. Zustand, Fehleranzahl, nächster Versuch und Übergänge müssen in
  Diagnostics und lokaler History erscheinen. Noch nicht entschieden ist, ob
  dieser Schwellenwert und dieses Probeintervall übernommen werden.
- [ ] Nach dem Circuit-Breaker die eigene rekursionssichere visuelle
  Audio-Systemnotification und anschließend den bewusst ausgelösten hörbaren
  Bedienertest bearbeiten. Bestehende Audioquellen dürfen bis zur ausdrücklich
  getesteten Übergabe nicht abgeschaltet werden.

## Nächste Arbeitsschritte – vereinbart am 2026-09-28

- [x] Zuerst den Source-Verlust bei bestehenden Signal-K-Notifications
  reproduzieren und beheben. Für
  `notifications.propulsion.stbdEngine.exhaustTemperature` die Quelle durch
  Notification API, Datenmodell-Snapshot, Delta, Store-Merge und Historie
  verfolgen. Akzeptanzkriterium: Das Alarm Centre und neue History-Einträge
  zeigen dauerhaft die von Signal K gelieferte Quelle statt `Unknown source`.
  Analyse und Reparaturstand `0.1.9`: Der Live-Pfad liefert als Produzent
  `engineroomStbd.XX`, während die Notification-Projektion
  `self.notificationhandler` trägt. Alte History-Einträge zeigen ein Flattern
  zwischen beiden Quellen. Notification-Deltas lesen die Quelle nun sofort am
  zugrunde liegenden Datenpfad, und eine bekannte Produzentenquelle darf nicht
  mehr durch die Handler-Projektion überschrieben werden. 75 Tests sind grün
  und `0.1.9` ist auf dem Pi installiert. Offen bleibt die Live-Bestätigung im
  Alarm Centre sowie anhand eines neuen History-Eintrags bei der nächsten
  tatsächlichen Zustandsänderung. Live-Abnahme am 2026-09-28 bestanden: Der
  aktuelle Snapshot und zwei nach der Reparatur neu angelegte Lebenszyklen
  verwenden durchgehend `engineroomStbd.XX`; weder `Unknown source` noch
  `self.notificationhandler` trat in diesen neuen Einträgen auf.
- [x] Danach die Diagnostics-API und -Ansicht ergänzen: letzte Snapshot- und
  Delta-Zeitpunkte, Client-Poll-Start/-Ende, Request-Dauer, Timeout- oder
  Netzwerkfehler, Node-RED-Revision, Konfigurationsstatus, aktive
  Audio-Prozesse, letzter Audio-Exitcode und Historien-Schreibstatus. In
  Version `0.1.11` als read-only API und WebApp-Fenster umgesetzt und live auf
  dem Pi mit bereiter Node-RED-Konfiguration validiert.
- [ ] Tab-3-/WLAN-Tests vorläufig aussetzen. Keine weiteren Alarmtests oder
  Änderungen an den Stale-Timern durchführen, bis die Poll-, Timeout- und
  Watchdog-Zeitpunkte instrumentiert sind. Danach den Stale-/Reconnect-Test
  mit Tab 3 gezielt wiederholen. Die Instrumentierung ist seit `0.1.11`
  vorhanden; Tab 3 steht am 2026-09-28 nicht zur Verfügung, daher bleibt der
  praktische Retest zurückgestellt und blockiert die übrige Arbeit nicht.
- [ ] Nach der Diagnostics-Arbeit den passiven Audio-Watchdog und den noch
  fehlenden Circuit-Breaker-/Historienstatus vervollständigen.

## Sicherheitsreview 2026-09-26

### Prio 0 – Alarmkorrektheit vor neuen Funktionen

- [x] Snapshot-Rekonstruktion strikt typisieren. Nur Datenmodellwerte mit
  einem gültigen String-State als Notification übernehmen; verschachtelte
  Elternpfade wie `notifications.propulsion.stbdEngine` dürfen nicht als
  Phantom-Notification erscheinen.
- [x] Policy-Fallback korrigieren. Eine spezifische Regel mit nicht erfüllten
  Bedingungen darf eine allgemeinere passende Regel weder verstecken noch
  deren Audioausgabe abschalten; nur vollständig erfüllte Regeln sind
  Match-Kandidaten.
- [x] Match-Semantik vereinheitlichen. Mehrere innerhalb einer Regel gesetzte
  Kriterien (`state`, `path`, `pathPrefix`, `source`, `conditions`) werden mit
  UND verknüpft; Alternativen werden durch getrennte Flow-Zweige ausgedrückt.
- [x] Notification-States an einer gemeinsamen Grenze kanonisieren und
  validieren. Bekannte Zustände werden kleingeschrieben, unbekannte Zustände
  werden mit einer klaren Deploy-Fehlermeldung abgelehnt.
- [x] Regressionstests für Phantom-Elternpfade, Conditional-Fallback,
  Pfad-und-Quelle-Matches sowie State-Kanonisierung ergänzen.
- [x] Nach lokalen Checks und Paketprüfung auf den Raspberry Pi deployen und
  dort Node-RED-Konfiguration, aktive Notifications und Alarmdarstellung live
  verifizieren.

### Prio 1 – Audio zuverlässig und eindeutig machen

- [x] Audio-Watchdog mit Startprüfung und periodischer passiver Prüfung bauen:
  konfiguriertes ALSA-Gerät, Geräteerreichbarkeit, Backend-Prozess und letzter
  erfolgreicher Exitcode müssen überwacht werden, ohne dabei regelmäßig einen
  hörbaren Ton auszulösen. Version `0.1.12` prüft Backend und ALSA-PCM beim
  Start sowie minütlich passiv; aktive Prozesse und letzter Exit stehen in
  Diagnostics. Verstärker, Lautsprecher und Hörbarkeit bleiben ausdrücklich
  außerhalb dieser passiven Prüfung.
- [ ] Bei einem Audiofehler eine eigene visuelle Systemnotification wie
  `notifications.system.notificationEngine.audio` veröffentlichen. Sie darf
  selbst keine Audioaktion auslösen, muss auf allen WebApps sichtbar bleiben
  und darf erst nach nachgewiesener Audio-Erholung auf `normal` wechseln;
  Alarm-Rekursionen sind ausdrücklich auszuschließen.
- [ ] Fehlgeschlagene Loop-Wiedergabe mit Circuit Breaker und begrenztem
  exponentiellem Backoff versehen. Ein fehlendes Gerät darf weder fortlaufend
  neue `aplay`-Prozesse starten noch das Journal fluten; Retry-Zustand und
  nächster Versuch gehören in Diagnostics und Historie.
  Exponentieller Retry-Backoff bis maximal 60 Sekunden ist implementiert;
  Circuit-Breaker-Zustand, Diagnostics und Historieneintrag fehlen noch.
- [ ] Bewussten hörbaren Selbsttest für Inbetriebnahme und Wartung anbieten und
  dessen Bestätigung protokollieren. Dokumentieren, dass eine rein passive
  Softwareprüfung nur Gerät/Backend nachweist, nicht Endstufe, Lautsprecher,
  Lautstärke oder tatsächlich hörbaren Schall; vollständige automatische
  Ende-zu-Ende-Prüfung erfordert Hardware-Loopback oder ein Mikrofon.
- [ ] In der WebApp einen klar bezeichneten Button `Alarmton testen` ergänzen.
  Der Klick startet einen fest definierten, begrenzten Testton und protokolliert
  mindestens Zeitpunkt, auslösenden Signal-K-Benutzer, Gerät, Datei,
  Player-Exitcode und technischen Erfolg. Ohne ausdrückliche Gegenmeldung gilt
  der betriebliche Test als bestanden; die UI darf dies dennoch nur als
  `Test ausgelöst / technisch abgespielt` und nicht als nachweislich
  `vom Menschen gehört` bezeichnen.
- [ ] Neben dem Testton einen sofort sichtbaren Button `Ton nicht gehört`
  anbieten. Dieser erzeugt die visuelle Audio-Systemnotification, markiert den
  letzten Alarmtest als fehlgeschlagen und hält den Fehler aktiv, bis ein
  späterer Test technisch erfolgreich war und der Bediener ihn nicht als
  unhörbar meldet.
- [x] `aplay`-Erfolg und -Fehler über Exitcode und Signal unterscheiden;
  normale Wiedergabeinformationen auf stderr nicht als „Unable to play“
  protokollieren.
- [ ] Audio-Diagnose um Start, Ende, Exitcode, Signal und betroffenen
  Notification-Lifecycle erweitern.
- [ ] Zuständigkeit für den Hoekens-Ankeralarmton eindeutig festlegen und die
  bestehende Audioquelle erst nach getesteter Übergabe abschalten; doppelte
  Wiedergabe und konkurrierenden ALSA-Zugriff ausschließen.
- [ ] Testmatrix für Loop, Silence, Acknowledge, Normal, Clear, fehlendes
  Audiogerät und gleichzeitige Alarme praktisch auf dem Pi ausführen.

### Prio 2 – End-to-End-Sicherheitsnachweis

- [x] Den nicht zum Projekt gehörenden `nodered.service` auf dem Pi prüfen und
  wieder stoppen. Der Dienst war bereits dauerhaft `disabled`, lief aber noch
  als alter manueller Startprozess seit 2026-09-16 auf Port 1880. Signal K,
  dessen Health-Timer und die eingebettete Node-RED-Instanz blieben aktiv;
  Flows unter `/home/pi/.node-red` bleiben für dieses Projekt tabu.
- [ ] Dokumentierte Pi-Testmatrix für Hoekens `warn`, `alarm`, `normal` und
  `null`, Android-UDP-Ausfall und -Wiederkehr, neue Ankervorgänge nach ACK,
  wechselnde und wiederverwendete IDs sowie Neustarts während aktiver Alarme
  erstellen und ausführen.
- [ ] Erwartete Anzeige, Audioaktion, Historienereignisse und erlaubte Actions
  für jeden End-to-End-Fall festhalten.
- [ ] Ungültigen Node-RED-Deploy, fehlendes Audio-Gerät, geschlossene WebApp,
  Netzverlust und mehrere gleichzeitige Alarmprioritäten abdecken.
  Reparaturen für den ungültigen Deploy, Audio-Retry-Backoff und die sichtbare
  Offline-/Stale-Anzeige sind auf dem Pi implementiert und der normale
  Post-Deploy-Zustand ist geprüft; die betroffenen Fehler- und Mehrgerätefälle
  müssen erneut ausgeführt werden.
- [ ] Ungültigen Node-RED-Deploy mit der neuen Fail-closed-Sperre wiederholen:
  sichtbaren Konfigurationsfehler, gestoppte Verarbeitung, abgelehnte Actions,
  ausbleibenden Poll-Logspam und Erholung durch einen gültigen Deploy prüfen.
  Der Runtime-Fehlerfall ist am 2026-09-27 bestätigt: sichtbarer Fehler,
  deaktivierte Globalaktionen und nur ein Logeintrag über mehrere Poll-Zyklen.
  Der exakte gültige Flow wurde anschließend aus der Sicherung wiederhergestellt
  und Signal K gesund neu gestartet; die Erholung durch einen gültigen
  Runtime-Deploy im Editor bleibt noch separat nachzuweisen.
- [x] Fehlendes ALSA-Gerät erneut simulieren und nachweisen, dass der Alarm
  sichtbar bleibt, der Retry-Abstand exponentiell bis 60 Sekunden wächst und
  weder Prozess- noch Journal-Sturm entsteht.
- [ ] Tab 3 bei aktivem kontrolliertem Testalarm vom Netz trennen: deutliche
  Offline-/Stale-Anzeige, deaktivierte Einzel- und Globalaktionen sowie saubere
  automatische Synchronisierung nach Wiederverbindung prüfen.
  Retest am 2026-09-27 fehlgeschlagen: Nach Abschalten des WLANs blieb der
  letzte Alarm ohne Offline-/Stale-Hinweis sichtbar und die Buttons wirkten
  weiterhin verfügbar. Nach Wiederverbindung erschien kein Doppelalarm; der
  Testalarm war inzwischen planmäßig abgelaufen. Der WebApp-Poll verwendet
  derzeit kein eigenes Fetch-Timeout und kann bei einem Verbindungsabbruch
  unbegrenzt ausstehend bleiben, statt den Offline-Zustand zu setzen.
  Die lokale Reparatur in `0.1.6` ergänzt ein Sechs-Sekunden-Timeout,
  sofortige `online`-/`offline`-Behandlung und serialisierte Polls; der
  erste Tab-3-Retest nach Deployment war nicht aussagekräftig, weil die vor
  dem Deployment geöffnete Seite weiterlief. Zusätzlich trugen die Skripte
  noch den alten Cache-Schlüssel `0.1.18`. Der Schlüssel ist nun auf `0.1.7`
  gesetzt. Der Offline-Hinweis liegt nun fest über allen Alarm-Overlays, die
  Aktionssperre ist optisch deutlicher, und ein unabhängiger Wächter markiert
  die Ansicht spätestens acht Sekunden nach dem letzten erfolgreichen Abruf
  als stale. Vor dem abschließenden Retest muss Tab 3 die WebApp neu laden.
  Ein erster Versuch mit dem Acht-Sekunden-Wächter meldete bei eingeschaltetem
  WLAN fälschlich stale, weil der langsame Client Poll- und Wächter-Timer
  zusammen ausführte. Version `0.1.7` unterdrückt diese Altersmeldung, solange
  bereits ein durch den Sechs-Sekunden-Timeout begrenzter Abruf läuft.
  Der Folgetest meldete bei aktivem Alarm weiterhin stale: Der gemeinsame
  `Promise.all`-Abruf koppelte die aktuelle Notification-Ansicht unnötig an die
  langsamere lokale History. Version `0.1.8` behandelt nur den autoritativen
  Notification-Snapshot als Verbindungssignal; History aktualisiert unabhängig.
  Der Live-Retest mit `0.1.8` ist dennoch fehlgeschlagen: Tab 3 zeigte die
  Stale-Warnung weiterhin bei eingeschaltetem und funktionierendem WLAN. Die
  Beobachtung deutet darauf hin, dass Poll-Intervall, Request-Timeout und/oder
  Stale-Wächter weiterhin gegeneinander laufen. Diese Timer-Interaktion muss
  vor einem weiteren Alarmtest instrumentiert und eindeutig diagnostiziert
  werden; der Stale-Fix ist nicht abgenommen.
- [x] History-Reparatur live bestätigen: allgemeine `visibleInTable`-/History-
  Regeln werden von einer spezifischen Soundregel geerbt und derselbe
  Occurrence-Verlauf enthält nach Auflösung den finalen Zustand `normal`.

### Prio 3 – Betriebsdiagnose

- [x] Diagnostics-Ansicht/API für letzte Snapshot- und Delta-Zeitpunkte,
  Node-RED-Revision und Flow-Pfad, Konfigurationsstatus, aktive
  Audio-Prozesse, letzten Audio-Exitcode sowie Historien-Schreibstatus bauen.
  Version `0.1.11` ergänzt zusätzlich Poll-Start/-Ende, Dauer und letzten
  Netzwerkfehler des jeweiligen WebApp-Clients.
- [ ] Zustand und Alter kritischer Eingangsquellen wie `android_udp.gps`
  sichtbar machen.
- [ ] Hohe Signal-K-CPU-Last, volle Swap-Nutzung, 81 Prozent
  Dateisystembelegung und sekündliches Node-RED-/Engine-Monitor-Logging
  getrennt profilieren und bewerten.

### Prio 4 – Komponentengrenzen nach der Stabilisierung

- [ ] Den rund 1.000 Zeilen großen Einstiegspunkt entlang klarer Start-/Stop-
  und Fehlergrenzen in Plugin-Runtime, Snapshot-Service, Audio-Controller,
  Configuration-Service, History-Service und HTTP-Routen zerlegen.

### Prio 5 – Dokumentation und Release-Basis

- [ ] Namen, Routen und Datenpfade von `signalk-notification-manager` auf
  `signalk-notification-engine` vereinheitlichen und die dokumentierte Version
  aktualisieren.
- [ ] Ausschließlich die eingebettete Signal-K-Node-RED-Instanz und deren
  gültigen Flow-Pfad dokumentieren; die separate `/home/pi/.node-red`-Instanz
  aus den Arbeitsanweisungen entfernen.
- [ ] Changelog konsolidieren sowie Paketarchive und `work/` bewusst ignorieren
  oder als Entwicklungsabhängigkeiten dokumentieren.
- [ ] Git-Remote, Release-Tags und unabhängige CI-Prüfungen einrichten, bevor
  das Paket öffentlich veröffentlicht wird.

## Abgeschlossene Historienoptimierung

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

- Historienaufzeichnung wird aus den deployten Node-RED-Regeln abgeleitet.
  `visibleInTable: true` aktiviert sie standardmäßig; `history: true` oder
  `history: false` überschreibt dieses Verhalten ausdrücklich. Spezifische
  Regeln erben nicht überschriebene Eigenschaften von allgemeineren Regeln.
- Schalter `clearHistoryOnStart` für eine ausdrücklich ausgelöste Bereinigung
  der lokalen Historie ist implementiert.
- Shortcuts validieren: Konfliktbehandlung ist implementiert; mögliche
  Konflikte mit weiteren Eingabefeldern noch prüfen.
- Kategorien werden ausschließlich automatisch klassifiziert. Node-RED bleibt
  die grafische Quelle für Anzeige-, History- und Audio-Regeln; geschützte
  Laufzeiteinstellungen und Sortierung bleiben in der Plugin-Konfiguration.
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
- [x] Einen pseudo-terminalen `ACTIVATE`-Debug-Node als Regelabschluss
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

- [x] Mehrere Kriterien innerhalb einer Regel (`state`, `path`, `pathPrefix`,
  `source`, `conditions`) werden mit UND verknüpft. Alternativen werden als
  getrennte Flow-Zweige modelliert. Kategorien sind reine Anzeigemetadaten und
  weder Match-Kriterium noch zweite Policy-Sprache.

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
