# Euchre

A Midwest kitchen-table Euchre game by Ironite, written in Go with
[Ebitengine](https://ebitengine.org). Partner up against the computer folks,
share one computer with up to three friends, or play together online. It ships
on its own and inside the Ironite Launcher.

## How to play

- Four players in two teams; partners sit across the table. The deck is the 9s through Aces.
- Order up the turned card or pass; if everyone passes, name another suit or pass. With *stick the dealer* the dealer has to name one.
- The Jack of trump is the right bower, the other Jack of the same colour the left bower, then A, K, Q, 10, 9 of trump.
- Follow suit if you can. Makers score 1 for 3–4 tricks, 2 for a march, 4 for a lone march; euchred makers give the other team 2.
- F2 starts a new game, M toggles music, F11 toggles full screen.

### Ways to play

- **Deal 'Em** – you and a computer partner against two computer folks. Each game seats three of the ten folks at random, with names that fit their faces.
- **Play Together → Same Computer** – 2 to 4 people take turns at one PC. A "pass the computer" screen comes up before each person's turn, hands turn face down in between, and you choose who partners with Player 1.
- **Play Together → Online** – one player hosts, friends join by IP address (TCP port 47018). The host runs the table and sends each guest only what they can see; the host can switch friends between teams in the lobby. A guest who leaves is replaced by a computer player.

Saves and settings are kept in `%APPDATA%\Ironite\Euchre\save.json`
(the same file as Euchre 1.x), outside the install folder.

## Code

| File | What it is |
|---|---|
| `main.go` | Window setup and the entry point. |
| `game.go` | Game state, card zones laid out from each player's seat, the hand script (on its own goroutine), results. |
| `internal/euchre/` | The rules and the computer players (no graphics; has tests). |
| `net.go` | Online play: host/guest protocol (JSON lines over TCP). |
| `setup.go`, `setup_ui.go` | Play Together: seating, lobby, pass screen, text fields, face picker. |
| `cast.go` | The ten folks: faces, titles, names and table talk. |
| `ui.go`, `panels.go` | The table, top bar, bid box and banner; title, rules, credits and result panels. |
| `draw.go`, `glyphs.go`, `assets.go` | Vector drawing, text and suit symbols, embedded art. |
| `sound.go`, `save.go`, `common.go` | Music and sound effects, the save file, shared bits. |
| `assets/` | Card faces, cameos, props, fonts, music and sound effects. |
| `tools/bake/` | Bakes the original canvas art and synthesized audio into `assets/`. |
| `tools/mkres/` | Writes the Windows icon and version info into the .exe. |
| `installer/` | Inno Setup scripts for the standalone `Euchre-Setup-v<version>.exe`. |

`headless_test_main.go` and `sound_stub.go` are only used by test builds:
`go run -tags headless .` plays a solo game, two online games between a host
and two guests over TCP on this computer (including a guest leaving mid-game),
and a shared-computer game through the pass screen. `-tags nosound` builds
without audio.

## Building

You need Go 1.24 or newer and bash (Git Bash works on Windows). No C
compiler is needed.

```bash
./build.sh
```

This writes `dist/Euchre/Euchre.exe` along with its README, CREDITS,
CHANGELOG and license files. The version comes from the top entry of
`CHANGELOG.md`.

To build the installer, install Inno Setup 6.3 or newer, run `./build.sh`, then:

```
ISCC.exe installer\EuchreSetup.iss
```

## Releasing

Add a new version section at the top of `CHANGELOG.md` and push to `main`.
The release workflow builds the game and publishes `Euchre-<version>-windows.zip`
as a GitHub release, which Ironite Launcher installs and updates from.

(c) 2026 Ironite
