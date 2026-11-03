; Euchre v2.0.0 - standalone setup. Build: ISCC.exe EuchreSetup.iss
; (c) 2026 Ironite
#define GameName    "Euchre"
#define Bundle      "Euchre"
#define Exe         "Euchre.exe"
#define GameVersion "2.0.0"
#define AppGuid     "{{92B26360-E342-41BD-BB14-9210EC57BC05}"
#define Art         "euchre"
#define Tagline     "A Midwest kitchen-table card game. Play the computer folks, share one PC, or play friends online."
#define SaveWhat    "Euchre record and settings"
#include "GameSetup.iss"

; Let Euchre host online games without a firewall prompt.
[Run]
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall add rule name=""Euchre"" dir=in action=allow program=""{app}\Games\{#Bundle}\{#Exe}"" enable=yes"; Flags: runhidden; StatusMsg: "Letting Euchre host online games..."

[UninstallRun]
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""Euchre"""; Flags: runhidden; RunOnceId: "EuchreFirewall"
