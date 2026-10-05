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
- [x] Tab-3-Stale-/Reconnect-Test am 2026-09-28 bestanden. Nach vollständigem
  Reload und einem kontrollierten WLAN-Ausfall erschien die feste
  Offline-/Stale-Warnung rund zwei Sekunden nach der tatsächlichen Trennung;
  Einzel- und Globalaktionen waren gesperrt. Der fehlgeschlagene Poll meldete
  `Failed to fetch`. Nach dem Wiedereinschalten blieb die Ansicht stale, bis
  ein autoritativer Snapshot erfolgreich war, und synchronisierte danach ohne
  Doppelmeldungen. Vor dem Test wurde der unerwartet auf `0.1.6`
  zurückgefallene Pi-Stand mit Sicherung erneut auf `0.1.12` gebracht.
- [x] Version `0.1.12` auf dem Pi installiert: Passiver Audio-Watchdog prüft
  `aplay` und das konfigurierte ALSA-Playback-PCM beim Start und minütlich,
  ohne das Gerät zu öffnen oder einen Ton abzuspielen. Live: Watchdog `ready`,
  `/usr/bin/aplay`, `plughw:2,0`, PCM `02-00` playback-fähig, keine aktiven
  Audioprozesse und keine wartenden Retries. Die Prüfung bestätigt ausdrücklich
  nicht Verstärker, Lautsprecher, Lautstärke oder tatsächliche Hörbarkeit.
- [x] Abschlusszustand auf dem Pi: Signal K und `signalk-health.timer` aktiv,
  separater `nodered.service` inaktiv, Node-RED-Konfiguration `ready`, letzter
  beobachteter Snapshot 227 ms, Load Average `1.22 / 1.26 / 1.37`.
- [x] Version `0.1.14`: Die am 2026-09-28 verbindlich abgestimmte
  Circuit-Breaker-Regel ist implementiert und auf dem Pi live geprüft. Der
  Breaker wird pro Notification-Lifecycle nach fünf
  aufeinanderfolgenden technischen Wiedergabefehlern geöffnet. Der sichtbare
  Signal-K-Alarm und seine erlaubten Aktionen bleiben unverändert. Im offenen
  Zustand ist höchstens ein Probeversuch alle fünf Minuten erlaubt; zusätzlich
  darf ein Watchdog-Übergang von `unavailable` zu `ready` genau einen
  vorgezogenen Probeversuch auslösen. Global darf nur ein Probeprozess zur Zeit
  laufen. Ein erfolgreicher Player-Exit schließt den Breaker und setzt den
  Fehlerzähler zurück; ein fehlgeschlagener Probeversuch öffnet ihn erneut für
  fünf Minuten. Silence erzeugt weder Fehler noch Probes, Acknowledge verändert
  den Breaker nicht eigenständig, und das autoritative Lifecycle-Ende entfernt
  seinen Zustand. Reguläres Stoppen, Policy-Unterdrückung und Bedienaktionen
  zählen nicht als Wiedergabefehler. Zustand, Fehleranzahl, letzter Fehler,
  nächster Versuch, Probe-Status, unterdrückte Retries und alle echten
  Zustandsübergänge müssen in Diagnostics und lokaler History erscheinen. Der
  Zustand aktiver Lifecycles übersteht einen Plugin-Neustart. Im Live-Test
  öffneten die GNSS-Warnung und ein isolierter E2E-Alarm nach genau fünf
  technischen Fehlern mit `plughw:99,99`. Nach dem Neustart blieb nur der noch
  aktive GNSS-Lifecycle erhalten; der beendete E2E-Lifecycle wurde als
  `audio_circuit_closed_on_lifecycle_end` bereinigt. Ein fehlgeschlagener Probe
  öffnete für weitere fünf Minuten. Nach bytegenauer Wiederherstellung von
  `plughw:2,0` lief um 21:38:45 AST genau ein erfolgreicher Probe, schloss den
  Breaker und hinterließ `openCount: 0`, keinen Prozess und keinen Retry. Der
  vorgezogene Watchdog-Recovery-Probe ist durch Unit-Tests abgedeckt, wurde
  wegen der nur beim Pluginstart übernommenen Gerätekonfiguration aber nicht
  durch einen physischen Live-Geräteausfall ausgelöst.
- [x] Version `0.1.15`: Die rekursionssichere visuelle
  Audio-Systemnotification ist implementiert, auf dem Pi installiert und mit
  einem isolierten Fehler-/Recovery-Lifecycle live geprüft. Verbindliche
  Recovery-Regel:
  Nur ein erfolgreicher Player-Exit desselben zuvor fehlgeschlagenen
  Notification-Lifecycles darf dessen Fehlerlatche entfernen. Ein anderer Ton,
  passiver Watchdog-Erfolg, Lifecycle-Ende oder Neustart reicht nicht. Danach
  den bewusst ausgelösten hörbaren Bedienertest bearbeiten. Bestehende
  Audioquellen dürfen bis zur ausdrücklich getesteten Übergabe nicht
  abgeschaltet werden. Live war `notifications.system.notificationEngine.audio`
  als rein visuelle, nicht quittier-, stumm- oder löschbare Alarmmeldung auf
  Tab 3 sichtbar. Trotz allgemeiner Alarm-Soundregel blieb ihre lokale Policy
  `audio: off`; kein rekursiver Prozess entstand. Nach Wiederherstellung der
  fehlenden Datei schloss nur der erfolgreiche Probe desselben Occurrence den
  Fehler um 22:02:23 AST. Als Nächstes den bewusst ausgelösten hörbaren
  Bedienertest bearbeiten.

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
- [x] Tab-3-/WLAN-Retest mit der seit `0.1.11` vorhandenen Instrumentierung
  gezielt wiederholt. WLAN war von 21:02:17 bis 21:02:34 AST aus. Die Ansicht
  wurde um 21:02:19 stale, sperrte alle Aktionen und protokollierte den
  fehlgeschlagenen Poll; nach erfolgreichem Snapshot um 21:02:45.936 wurde die
  Sperre um 21:02:46.130 aufgehoben. Die Tabelle blieb bei einer Warnung und
  acht normalen Meldungen ohne Duplikate.
- [x] Passiven Audio-Watchdog sowie Circuit-Breaker-Diagnostics und
  Historienstatus vervollständigen; live mit `0.1.14` geprüft.

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
- [x] Bei einem Audiofehler eine eigene visuelle Systemnotification wie
  `notifications.system.notificationEngine.audio` veröffentlichen. Sie darf
  selbst keine Audioaktion auslösen, muss auf allen WebApps sichtbar bleiben
  und darf erst nach nachgewiesener Audio-Erholung auf `normal` wechseln;
  Alarm-Rekursionen sind ausdrücklich auszuschließen.
  In `0.1.15` implementiert, deployt und mit fehlender `alarm.wav` sowie
  erfolgreicher occurrence-spezifischer Erholung live nachgewiesen.
- [x] Fehlgeschlagene Loop-Wiedergabe mit Circuit Breaker und begrenztem
  exponentiellem Backoff versehen. Ein fehlendes Gerät darf weder fortlaufend
  neue `aplay`-Prozesse starten noch das Journal fluten; Retry-Zustand und
  nächster Versuch gehören in Diagnostics und Historie.
  Exponentieller Retry-Backoff bis maximal 60 Sekunden, persistenter
  Circuit-Breaker-Zustand, Diagnostics und Historieneinträge sind in `0.1.14`
  implementiert und live geprüft. Die verbindliche Semantik ist im Abschnitt
  oben und in `docs/architecture.md` dokumentiert.
- [x] Bewussten hörbaren Selbsttest für Inbetriebnahme und Wartung anbieten und
  dessen Bestätigung protokollieren. Dokumentieren, dass eine rein passive
  Softwareprüfung nur Gerät/Backend nachweist, nicht Endstufe, Lautsprecher,
  Lautstärke oder tatsächlich hörbaren Schall; vollständige automatische
  Ende-zu-Ende-Prüfung erfordert Hardware-Loopback oder ein Mikrofon. In
  Version `0.1.16` implementiert; der positive Live-Nachweis steht bis zum
  Deployment noch aus.
- [x] In der WebApp einen klar bezeichneten Button `Alarmton testen` ergänzen.
  Der Klick startet einen fest definierten, begrenzten Testton und protokolliert
  mindestens Zeitpunkt, auslösenden Signal-K-Benutzer, Gerät, Datei,
  Player-Exitcode und technischen Erfolg. Ohne ausdrückliche Gegenmeldung gilt
  der betriebliche Test als bestanden; die UI darf dies dennoch nur als
  `Test ausgelöst / technisch abgespielt` und nicht als nachweislich
  `vom Menschen gehört` bezeichnen. Nach erfolgreichem Player-Exit bleibt ein
  verbindliches 15-Sekunden-Fenster für eine Gegenmeldung offen.
- [x] Neben dem Testton einen sofort sichtbaren Button `Ton nicht gehört`
  anbieten. Dieser erzeugt die visuelle Audio-Systemnotification, markiert den
  letzten Alarmtest als fehlgeschlagen und hält den Fehler aktiv, bis ein
  späterer Test technisch erfolgreich war und der Bediener ihn nicht als
  unhörbar meldet. Der Fehler wird erst nach dem vollständigen
  15-Sekunden-Fenster ohne Gegenmeldung aufgehoben.
- [x] Wartungsintervall in der Haupt-Buttonzeile kompakt anzeigen: runder
  Zähler `7` bis `0`, bei Fälligkeit blinkend; Klick öffnet ein eigenes
  Prozessfenster. Der letzte abgeschlossene Test wird nach Neustart aus der
  lokalen Audit-History rekonstruiert. Entscheidung vom 2026-09-29; in
  Version `0.1.17` auf Tab 3 mit wiederhergestelltem Ergebnis und Zähler `7`
  live geprüft, ohne beim Öffnen einen weiteren Ton auszulösen. Der
  anschließende positive Test protokollierte Benutzer `pi`, Gerät
  `plughw:2,0`, `sirene1.wav`, Exitcode 0 und den Abschluss nach dem vollen
  15-Sekunden-Fenster; der Bediener bestätigte die Hörbarkeit.
- [x] `aplay`-Erfolg und -Fehler über Exitcode und Signal unterscheiden;
  normale Wiedergabeinformationen auf stderr nicht als „Unable to play“
  protokollieren.
- [x] Audio-Diagnose um Start, Ende, Dauer, Datei, Gerät, PID, Exitcode,
  Signal und betroffenen Notification-Lifecycle erweitern. In Version
  `0.1.18` als read-only aktive Prozessdetails und letztes Ergebnis umgesetzt,
  auf dem Pi deployt und mit der realen GNSS-Warnung live nachgewiesen:
  eindeutiger Lifecycle, `warn.wav`, `plughw:2,0`, PID, Start/Ende, 1003 ms und
  Exitcode 0; danach keine aktiven Prozesse oder Retries.
- [x] Zuständigkeit für den Hoekens-Ankeralarmton eindeutig festlegen und
  doppelte Wiedergabe bzw. konkurrierenden ALSA-Zugriff ausschließen. Der
  eingebettete Legacy-Tab `Audio Alarms` ist live mit `disabled: true`
  bestätigt; Anchor- und Bilge-Skript sind gestoppt. Damit ist die Notification
  Engine der einzige aktive regelbasierte Audiopfad. Tab und Skripte bleiben
  als deaktivierter, nicht automatisch aktivierbarer Rückfallpfad erhalten.
- [x] Testmatrix für Loop, Silence, Acknowledge, Normal, Clear, fehlendes
  Audiogerät und gleichzeitige Alarme praktisch auf dem Pi ausführen.
  Nächster sicherer Ablauf:
  - [x] Einen runtime-sicheren Auslöser für mindestens zwei getrennte
    simulierte Notification-Lifecycles bauen; er darf keinen Signal-K-Neustart
    benötigen und die laufende GPS-/Ankerüberwachung nicht unterbrechen.
  - [x] Damit zwei gleichzeitige simulierte Alarme prüfen: unabhängige
    Audioprozesse, deterministische Priorität, lifecycle-spezifisches Silence
    sowie keine gegenseitige Unterbrechung oder ALSA-Überlastung.
  - [x] Loop, Silence, Acknowledge, Normal und Clear vollständig gegen
    Signal-K-Zustand, Audioende, Retry-/Circuit-Breaker-Zustand und lokale
    Historie nachweisen.
    Live mit `0.1.21` am 2026-09-29: zwei getrennte Alarm-Slots erzeugten
    gleichzeitig zwei `aplay`-Prozesse (PIDs 2425857/2425859), beide Exit 0.
    Slot A akzeptierte Silence, Slot B unabhängig Acknowledge; die Historie
    enthält getrennte `action_requested`-Ereignisse. Beide wechselten auf
    `normal`, beide DELETEs lieferten 204. Danach: null Prozesse, Retries,
    offene Breaker, Audio-Systemfehler oder verbliebene Runtime-Slots.
  - [x] Den echten Selbsttest-Fehlerzweig `Ton nicht gehört` nur mit bewusst
    stummgeschaltetem Verstärker/Lautsprecher ausführen; danach Audio wieder
    einschalten und mit einem zweiten technisch erfolgreichen Test plus vollem
    15-Sekunden-Fenster die sichtbare Audio-Systemnotification auflösen.
    Live mit `0.1.22` am 2026-09-30: bei stromlosem Lautsprecher technisch
    erfolgreicher Player-Exit 0, authentifizierte Gegenmeldung durch `pi` und
    genau eine persistierte visuelle Audio-Systemnotification. Dabei wurde eine
    zu breite Rekursionssperre entdeckt und repariert. Nach Wiedereinschalten
    hörte der Operator den zweiten Ton; nach dem vollständigen Fenster war der
    Test `passed_no_counter_report`, die Warnung `normal` und es blieben null
    Fehler-Latches, Prozesse, Retries oder offene Breaker.
  - [ ] Echte Hoekens-Drag-/Re-Drop-/Aktiv-alarm-Neustarttests erst nach einer
    ausdrücklichen Bestätigung eines sicheren Ankertestfensters ausführen.

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
- [x] Erwartete Anzeige, Audioaktion, Historienereignisse und erlaubte Actions
  für jeden End-to-End-Fall festhalten.
- [x] Ungültigen Node-RED-Deploy, fehlendes Audio-Gerät, geschlossene WebApp,
  Netzverlust und mehrere gleichzeitige Alarmprioritäten abdecken.
  Reparaturen für den ungültigen Deploy, Audio-Retry-Backoff und die sichtbare
  Offline-/Stale-Anzeige sind auf dem Pi implementiert und der normale
  Post-Deploy-Zustand ist geprüft; die zugehörigen Nachweise stehen vollständig
  in `docs/e2e-safety-matrix.md`.
- [x] Ungültigen Node-RED-Deploy mit der neuen Fail-closed-Sperre wiederholen:
  sichtbaren Konfigurationsfehler, gestoppte Verarbeitung, abgelehnte Actions,
  ausbleibenden Poll-Logspam und Erholung durch einen gültigen Deploy prüfen.
  Der Runtime-Fehlerfall ist am 2026-09-27 bestätigt: sichtbarer Fehler,
  deaktivierte Globalaktionen und nur ein Logeintrag über mehrere Poll-Zyklen.
  Der exakte gültige Flow wurde anschließend aus der Sicherung wiederhergestellt
  und Signal K gesund neu gestartet. Mit `0.1.32` ist zusätzlich die Erholung
  durch einen gültigen Runtime-Deploy ohne Signal-K-Neustart nachgewiesen:
  unveränderte abgeschlossene Sounds bleiben still, eine tatsächlich geänderte
  Soundregel spielt genau einmal und ein unterbrochener Loop läuft wieder an.
- [x] Fehlendes ALSA-Gerät erneut simulieren und nachweisen, dass der Alarm
  sichtbar bleibt, der Retry-Abstand exponentiell bis 60 Sekunden wächst und
  weder Prozess- noch Journal-Sturm entsteht.
- [x] Eine aktive, clear-fähige Runtime-Testnotification ohne Signal-K-Neustart
  direkt löschen. Live mit `0.1.22`: Slot `clear-check` wurde als `alarm`
  angelegt, DELETE lieferte 204, danach waren Slot-Registry, Audioprozesse,
  Retries, offene Breaker und Audio-Systemfehler leer.
- [x] Tab 3 bei aktiver Warnmeldung vom Netz trennen: deutliche
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
  Abschließender Retest am 2026-09-28 mit Version `0.1.12`: PASS. Der
  tatsächliche WLAN-Ausfall begann um 21:02:17 AST; um 21:02:19.055 zeigte die
  WebApp die feste Offline-/Stale-Warnung und deaktivierte Einzel- sowie
  Globalaktionen. Der Poll endete um 21:02:19.138 nach 194 ms mit `Failed to
  fetch`. Nach WLAN-Wiederkehr um 21:02:34 blieb die Sperre bis zum
  erfolgreichen Snapshot-Poll um 21:02:45.936 bestehen und verschwand um
  21:02:46.130. Danach waren eine Warnung und acht normale Meldungen ohne
  Duplikate sichtbar; Node-RED, Audio-Watchdog und History waren gesund, ohne
  Audioprozess oder Retry.
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

- [x] Namen, Routen und Datenpfade von `signalk-notification-manager` auf
  `signalk-notification-engine` vereinheitlichen und die dokumentierte Version
  aktualisieren. Historische Phase-1-Bezeichnungen sind ausdrücklich als
  solche gekennzeichnet.
- [x] Ausschließlich die eingebettete Signal-K-Node-RED-Instanz und deren
  gültigen Flow-Pfad dokumentieren; die separate Instanz bleibt nur als
  ausdrücklich verbotene Abgrenzung in den Sicherheitsregeln erwähnt.
- [x] Changelog konsolidieren sowie generierte Paketarchive und `work/` über
  `.gitignore` aus der Versionsverwaltung ausschließen. Das zuvor getrackte
  Paket `0.1.3` bleibt lokal erhalten, wird aber aus Git entfernt.
- [ ] Git-Remote, Release-Tags und unabhängige CI-Prüfungen einrichten, bevor
  das Paket öffentlich veröffentlicht wird.
- [x] Establish English as the canonical project language before release:
  source code, identifiers, comments, API fields, persisted event codes,
  server logs, diagnostics, configuration descriptions and every built-in UI
  string must be English. Replace the remaining German audio-self-test strings
  in the backend and WebApp, and add a regression check that prevents new
  untranslated built-in literals from being introduced accidentally. Completed
  in `0.1.33` and included in the deployed `0.1.34` package.
- [x] Add a small WebApp localization layer without changing the canonical API
  data. Use stable translation keys with a complete English fallback catalog;
  select the initial locale from an explicit per-browser preference and then
  `navigator.languages`, falling back to English. Provide a visible language
  selector, persist its value locally on that browser, update `html[lang]`, and
  format dates, times, durations and numbers with `Intl`. Translate only
  Notification Engine labels and known state/category/event descriptions;
  preserve Signal K paths, IDs, sources, raw diagnostics and producer-supplied
  notification messages verbatim. Version `0.1.34` ships complete English and
  German catalogs with 135 keys each, safe persistent custom-locale overrides,
  English fallback, browser-language detection and a per-browser language
  button. Live on Tab 3, `DE` rendered `Alarmzentrale`, changed without reload
  to `EN` / `Alarm Centre` / `Alarm sound test`, and changed back to German
  with `de` persisted locally and no undefined text.

### Post-release integrations

- [ ] After the first public release, evaluate ntfy and Gotify as optional
  native system-notification outputs. Keep Raspberry Pi audio as the primary
  channel and the WebApp as an optical client. Start with an isolated Tab 3
  proof covering foreground, closed browser, screen off, Doze/battery
  optimization, reboot, Wi-Fi loss/recovery, notification-channel sound and
  Do Not Disturb. Any later integration may publish presentation events only;
  it must not acknowledge, silence, clear or otherwise own a Signal K alarm
  lifecycle.

## Abgeschlossene Historienoptimierung

- [x] Konfigurationsabhängigkeit erzwingen: Nur Zustände aus `Notification
  State Order and Visibility` dürfen in der lokalen Tabelle erscheinen oder
  lokale Visual-/Audio-Ausgaben auslösen. `Standard Sound by State` darf für
  nicht gelistete Zustände keinen Alarmton aktivieren; die Konfiguration muss
  diesen Zusammenhang ausdrücklich erklären.

- [x] AudioDevice-Dokumentation vervollständigen: `default`, `plughw:0,0`,
  `plughw:1,0` und `plughw:2,0` erklären; Testton vor Notification-Tests
  abspielen und funktionierenden Ausgang dokumentieren. Live-Inventur am
  2026-10-04: Karten 0/1 sind HDMI, Karte 2 ist `bcm2835 Headphones`; das
  konfigurierte `plughw:2,0` ist passiv bereit und wurde im früheren physischen
  Lautsprecher-Aus-/Ein-Test technisch und hörbar bestätigt.
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
- [x] Version `0.1.26`: Soundsteuerung kontrolliert von
  `sound.mode`/`sound.repeatCount` auf `payload.sound.count` umgestellt.
  Verbindliche Semantik: `0` = Loop, `1` = einmal, `2` bis `99` = exakte
  Anzahl. Der vom Benutzer deployte 192-Node-Flow lieferte sieben gültige
  aktive Soundregeln mit `count: 0`; die serverseitige Regelansicht und die
  effektiven Policies verwenden ausschließlich `count`. Alte Felder bleiben
  vorübergehend über einen konfliktprüfenden Migrationsadapter lesbar.
- [x] Version `0.1.28`: Optionales `payload.sound.pauseSeconds` als ganze Zahl
  von `0` bis `5` umgesetzt. Die Pause liegt ausschließlich zwischen zwei
  vollständig beendeten Wiedergaben; fehlend oder `0` bedeutet keine
  zusätzliche Pause. Andere Werte und Datentypen machen den Node-RED-Deploy
  ungültig. Der isolierte Live-Test mit `count: 3` und `pauseSeconds: 2`
  startete exakt die PIDs 2663871, 2663875 und 2663891. Zwischen dem Ende eines
  Players und dem nächsten Start lagen 2.067 beziehungsweise 2.003 Sekunden;
  danach waren Prozesse, Retries, Breaker und Audio-Systemfehler leer.
- [x] `Silence` während einer Wiederholungspause live geprüft. Ein isolierter
  Runtime-Slot mit `count: 3` und `pauseSeconds: 5` spielte genau einmal
  (PID 3016128) und wurde 2.58 Sekunden nach Player-Ende stummgeschaltet.
  Beide noch geplanten Wiedergaben entfielen; Signal K blieb autoritativ auf
  `warn` und meldete ausschließlich `silenced: true`. Der Testslot wurde über
  `normal` und DELETE beendet und der Benutzer-Flow bytegenau wiederhergestellt.
- [x] Endliche Basisfälle live geprüft: `count: 1` erzeugte genau einen
  erfolgreichen Playerprozess und keinen späteren Replay; der erste
  `count: 3`-Versuch unter `0.1.26` deckte auf, dass nur ein Prozess startete.
  Die nicht-reentrante Wiederholungsplanung in `0.1.27`/`0.1.28` ist durch den
  anschließenden exakten Drei-Prozess-Test nachgewiesen.
- [x] Version `0.1.32`: Unerwünschten Replay einer bereits aktiven endlichen
  Notification nach Wiederaufnahme aus einem ungültigen Node-RED-Deploy
  verhindert. Ursache war derselbe Ton mit absolutem Pfad vor der Störung und
  relativem Pfad nach Recovery; die Signatur verwendet nun immer den für den
  Player aufgelösten absoluten Pfad. Im isolierten Live-Test blieb der letzte
  Player nach gültig -> ungültig (`pauseSeconds: 6`) -> gültig unverändert PID
  3020272. Auch die bestehende GNSS-Warnung spielte nicht erneut. Der Flow ist
  bytegenau wiederhergestellt; Testslots, Prozesse und Retries sind leer.
  Die beiden Gegenfälle sind ebenfalls live bestanden: Dieselbe Occurrence
  wechselte nach Recovery kontrolliert von `warn.wav` (PID 3021641) auf
  `alert.wav` (PID 3021751) und spielte genau einmal. Ein `count: 0`-Loop wurde
  im Fail-closed-Zustand gestoppt, seine nicht abgeschlossene Signatur entfernt
  und nach gültiger Recovery wieder gestartet (unter anderem PID 3022143).
  Anschließendes Silence setzte nur `silenced: true` und hinterließ null
  Prozesse, Retries, Breaker oder Audio-Systemfehler.
- [x] Version `0.1.25`: Unveränderte aktive Notifications werden nach einer
  abgeschlossenen `once`- oder endlichen `repeat`-Wiedergabe nicht bei jeder
  erneuten Snapshot-, Delta- oder Bedingungsauswertung abgespielt. Die
  abgeschlossene Sound-Signatur bleibt bis zum Lifecycle-Ende, `Silence` oder
  einer geänderten Soundkonfiguration erhalten. Live blieb der Startton des
  realen GNSS-Warn-Occurrence trotz 43 Deltas und mehrerer Snapshots exakt bei
  PID 2537577; danach liefen weder ein Audioprozess noch ein Retry.
- [x] Einen pseudo-terminalen `ACTIVATE`-Debug-Node als Regelabschluss
  verwenden; nur durchgängig vom Auslöser bis `ACTIVATE` verbundene Regeln
  werden beim Deploy rückwärts geprüft und aktiviert.
- [x] Version `0.1.29`: Falsche kurzzeitige `Not connected`-Anzeige bei
  langsamen, aber erfolgreichen Pi-Antworten entschärft. Polling bleibt bei
  fünf Sekunden; Request-Deadline und Stale-Grenze betragen nun zwölf
  beziehungsweise fünfzehn Sekunden. Tab 3 lud die neue Grenze und blieb über
  mehrere echte Poll-Zyklen ohne Verbindungsbanner; native Browser-Offline-
  Ereignisse sperren Aktionen weiterhin sofort.

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

- [x] Source-Verlust bei bestehenden Signal-K-Notifications reproduzieren und
  beheben. Beispiel: `notifications.propulsion.stbdEngine.exhaustTemperature`
  mit Notification-ID `2ff367b5-4465-456b-9402-3ca7d8948aed` wird im Signal-K-
  Datenmodell mit `$source: self.notificationhandler` geliefert, erscheint im
  Centre aber als `Unknown source`. Delta-, Snapshot-, API- und Merge-Pfad
  einzeln protokollieren; die Source darf bei wechselnder Notification-ID oder
  beim Zusammenführen von `app.notifications.list()` nicht verloren gehen.
  Akzeptanzkriterium: Das Centre zeigt für diesen Pfad dauerhaft
  `self.notificationhandler` und die Historie verwendet dieselbe Quelle.
  In `0.1.9` repariert, mit Snapshot-/Delta-Regressionstests abgesichert und
  live mit den wiederhergestellten Engine-Monitor-Quellen bestätigt.

- Live-Aktualisierung praktisch testen; die Ansicht sollte Zustandswechsel
  innerhalb des 5-Sekunden-Intervalls übernehmen.
- [ ] Erkennungsverzögerung vergleichen: Testalarm gegen echten Alarm; Delta-
  und Snapshot-Zeitstempel getrennt bewerten.
- Gezielt einen Hoekens-Ankeralarm auslösen und den Radius erhöhen.
- Prüfen, ob die Historie `raised` und anschließend `updated` auf `normal`
  oder `cleared` persistiert.
- Prüfen, ob wechselnde Notification-IDs die Lebenszyklus-Zuordnung
  erschweren.

### Upstream-Fix für Hoekens Anchor Alarm

- [x] Pull Request #44 eingereicht und am 2026-09-29 von `hoeken` gemergt:
  https://github.com/hoeken/hoekens-anchor-alarm/pull/44. Ein ACK darf nicht
  über mehrere Ankermanöver hinweg erhalten bleiben.
  Hoekens verwendet für `notifications.navigation.anchor` dieselbe
  Notification-ID und sendet beim Raise bei aktivem
  `enableNormalNotifications` nur `state: normal`; beim nächsten Drop wird
  dieselbe Notification wieder auf `alarm` gesetzt. Der von Signal K
  gespeicherte Status `acknowledged: true` bleibt dadurch erhalten. Ein neuer
  Ankeralarm erscheint dann bereits quittiert, obwohl ein neues Manöver
  begonnen hat. Das ist sicherheitsrelevant, weil ein neuer Drag-Alarm dadurch
  weniger auffällig sein kann.
- Umgesetzte Upstream-Lösung: Beim Raise wird die Notification entfernt
  (`null`) und der ACK-Status dadurch zurückgesetzt. Ein anschließendes
  Watching-`normal` gehört zu einem frischen Notification-Lifecycle. Ein
  reiner Wechsel auf `normal` hätte nicht gereicht.
- Als Nachweis für das Issue dokumentieren: gleiche ID
  `e8cf94af-698a-4091-ad22-c8b17b5840d1` bei `alarm`, ACK und anschließendem
  `normal` nach Radiusänderung.
- [ ] Den auf dem Pi installierten Hoekens-Stand erst auf einen Release oder
  anderweitig eindeutig identifizierten Build aktualisieren, der Merge-Commit
  `75c05cc0d34718c1bd3fbf4cfbeb969103d278af` enthält. Der Merge allein ändert
  die installierte Plugin-Version nicht. Danach in einem ausdrücklich
  bestätigten sicheren Ankertestfenster Raise -> `null`, anschließend frisches
  Watching-`normal`, neuen Drop und `acknowledged: false` live nachweisen.
- Bis zu diesem Live-Nachweis gilt die bisherige Zwischenlösung: Vor jedem
  neuen Drop den vorherigen Anker vollständig raisen und prüfen, dass der Pfad
  nicht mehr aktiv ist. Falls die ID bestehen bleibt,
  `enableNormalNotifications` vor dem Raise vorübergehend deaktivieren, damit
  Hoekens `null` sendet; danach wieder aktivieren und erst dann neu droppen.
  Bis zum Live-Nachweis jeden neuen Alarm manuell auf
  `acknowledged: false` prüfen und den Sound über den Notification Manager
  testen.
- Die Hoekens-Regel in `lifecycle-rules.json` (`normal`/`Off`) bis zum
  erfolgreichen Upgrade- und Regressionstest als Abwärtskompatibilität
  behalten. Erst danach prüfen, ob sie aus Default-Konfiguration und
  Dokumentation entfernt werden kann; ein vorzeitiges Entfernen würde ältere
  installierte Hoekens-Versionen wieder falsch korrelieren.
- [x] Lifecycle-Sonderfälle in `lifecycle-rules.json` auslagern und beim
  Speichern der Plugin-Konfiguration neu einlesen; Handhabung dokumentieren.

## 4. Handoff

- [x] Sicheren Laufzeit-Testauslöser für mindestens zwei voneinander isolierte
  simulierte Notification-Lebenszyklen implementieren. Er verwendet nur den
  festen Namespace `notifications.system.notificationEngine.runtimeTest.*`,
  läuft nach spätestens 600 Sekunden ab und kann keine fremde ID ändern oder
  löschen.
- [x] Auf dem Pi zwei gleichzeitige Slots live durch Alarmton, unabhängiges
  Silence, Acknowledge, `normal` und Clear führen; ALSA-Prozesszahl und Historie
  als Nachweis festhalten.
  Nachweis siehe `docs/e2e-safety-matrix.md`; dabei wurde außerdem der nach
  `normal` erwartbare Signal-K-Fall `Alarm not found` als ausschließlich für
  die eigene registrierte ID idempotente Bereinigung repariert und in
  `0.1.21` erneut live geprüft.
- [x] Den echten Gegenpfad `Ton nicht gehört` nur bei absichtlich physisch
  stummgeschaltetem Ausgang auslösen, anschließend Audio wiederherstellen und
  den erfolgreichen Recovery-Test dokumentieren.
  Erfolgreich mit `0.1.22` nach physischem Aus-/Einschalten des Lautsprechers;
  vollständiger Nachweis in `docs/e2e-safety-matrix.md`.
- [ ] Reale Hoekens-, Bilge- und GPS-Tests bleiben bis zu einem ausdrücklich
  bestätigten sicheren Betriebsfenster blockiert; die simulierten Runtime-Slots
  sind kein Ersatz für diesen späteren Produzenten-Test.

- Dokumentation der neuen Einstellungen vervollständigen.
- Aktuellen Stand auf dem Raspberry Pi installieren und testen.
- Danach den getesteten Entwicklungsstand committen.
- [ ] Nach erreichter Entwicklungsreife das Plugin in ein öffentliches Git-
  Repository überführen und als npm-Paket veröffentlichen; anschließend die
  Appstore-Metadaten und die Installationsdokumentation aktualisieren.

## 6. UI-Aktionen und Piktogramme

- [x] Im History-Fenster den Lösch-Button nach erfolgreichem Löschen der
  Historie ausblenden.
- [x] Buttons im Infofenster und für „Delete this history“ deutlich auffälliger
  gestalten.
- [x] Passende, verständliche Piktogramme und sichtbare Beschriftungen für
  `Silence`, `Acknowledge`, `Clear` und „Delete this history“ umsetzen und auf
  Tab 3 prüfen. Live mit `0.1.23` geprüft: Einzelaktionen jeweils 76 × 60 CSS-
  Pixel, History-Löschung 101 × 54 CSS-Pixel, ohne Überdeckung oder ausgelöste
  Notification-/Löschaktion.

## 7. Audio und Historienexport

- [x] Soundstatus mit `Active` steuerbar machen. `0.1.24` erhält ein verbundenes
  `payload.sound.active: false` bis in die Policy und verhindert den Rückfall
  auf den geerbten Zustandssound; isolierter Runtime-Slot live bestanden.
- [x] Eine konfigurierte, aber nicht vorhandene Sounddatei beeinflusst den
  autoritativen Alarm nicht und erzeugt begrenzte Audiofehler-, Circuit-
  Breaker-, Systemnotification- und Historiennachweise; live seit `0.1.15`.
- [x] Einen ausdrücklich leeren Soundpfad bei aktivem Sound als ungültige
  Node-RED-Konfiguration ablehnen. Bewusstes Abschalten erfolgt ausschließlich
  mit `payload.sound.active: false`; dadurch gibt es keinen stillen,
  unbeabsichtigten Fallback.
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
