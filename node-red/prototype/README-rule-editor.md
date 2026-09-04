# Visual rule editor prototype

Importiere `flows-rule-editor.json` in die interne Node-RED-Instanz.

Der Flow ist als kopierbares Muster aufgebaut: Ein Notification-Node wird per
Wire mit den gewünschten Eigenschaften verbunden. Nicht verbundene Nodes sind
zulässig und haben keine Wirkung. Der Assembler sammelt die Eigenschaften pro
`ruleId`; `Rule prüfen` validiert die erzeugten Regeln vor dem Deploy.

Die Reihenfolge der Notifications wird nicht konfiguriert. Sie folgt der
Signal-K-Hierarchie und damit der vom Signal-K-Datenmodell vorgegebenen
Priorität.

Alarm und Emergency werden immer historisiert. Für zusätzliche Zustände wird
der `History`-Node verbunden. Ein Testalarm bleibt als Konfigurationsoption
erhalten und ist standardmäßig deaktiviert.

Node-Farbgruppen für die spätere Editor-Oberfläche:

- Visible/UI: grün
- Color: blau
- Notification: gelb
- Sound: pink
- Validate/Deploy: grau oder violett
