# Notification Engine – Node-RED prototype

Importiere `flows.json` in Node-RED. Der Flow zeigt:

```text
Notification Input → Policy/Filter → Visual
                                ├→ Sound
                                └→ History
```

`Demo alarm` erzeugt eine Beispiel-Notification. `Notification input`
normalisiert sie. Der Filter verteilt `alarm` und `emergency` parallel auf
Visual-, Sound- und History-Adapter, die zunächst Debug-Nodes sind.

`Notification Engine config` enthält den versionierten Konfigurationsblock für
die Notification Engine. Der Adapter extrahiert diesen Block beim Start und
nach jedem Deploy; die App interpretiert nicht die Node-RED-Flow-Datei.

Für diesen Prototyp werden keine zusätzlichen Nodes benötigt.
