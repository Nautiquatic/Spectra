# PRISMFALL

A neon arena survival shooter from Spectra Games.

You are the last light in a collapsing rift. Steer your hull, aim and fire by hand,
dash and grow stronger as the swarm closes in. A Prism Wraith boss breaches the rift at 1:50, then every 80 seconds.

## Play

Double-click **`Prismfall.exe`**. It opens the game fullscreen (press `F11` for a window) and stays running until
you close it, so the Spectra Launcher's playtime tracking is accurate.

Prefer a browser? Open **`index.html`** directly. No install, build step or internet connection
required either way.

The standalone player uses the Microsoft Edge **WebView2 Runtime** (already present on
Windows 11 and almost all Windows 10 PCs). If it is missing, the game shows a download link.

## Controls

| Action | Input |
| --- | --- |
| Thrust forward / back | `W` / `S` (or arrow keys) |
| Turn left / right | `A` / `D` (or arrow keys) |
| Fire (hold) | Left click or `Space` |
| Dash (brief invulnerability) | `Shift` |
| Fullscreen on/off | `F11` (or `F`, or `Alt+Enter` in Prismfall.exe) |
| Choose upgrade | `1` `2` `3` or click a card |
| Pause | `Esc` / `P` |
| Mute | `M` |

Touch: hold a finger down to steer toward it and fire; use the on-screen **DASH** button.

## Main menu

- **Play**: start a run.
- **Icon Kit**: choose your hull shape and colour (cosmetic). Some unlock with achievements: Wing (Resonant), Needle (Rift Sealed), Crimson (Last Light), Ember (Overcharge), Starlight (First Light).
- **Settings**: sound, volume, fullscreen, screen shake, and the controls list.
- **Exit**: closes the game (only shown in `Prismfall.exe`).

Use the mouse, or `W`/`S` / arrow keys and `Enter`. `Esc` closes a panel. From the pause and game-over screens, **Main menu** returns here.

## How it plays

- Your prism cannon fires where your hull points. Hold left click or Space to fire. Bolts curve slightly toward hostiles in front of them; the **Seeker Lens** upgrade makes them home harder.
- The arena is bigger than your screen and the camera follows you, looking slightly ahead.
- The arena has a **red border**. You can fly past it, but you then have **3 seconds** to get back in or you die. A dashed wall further out stops you completely.
- Up to 10 hostiles can be alive at once; the cap rises by 1 every 30 seconds.
- Upgrades escalate: each time you take one again it's stronger (Thruster +8%, +9%, +10%...).
- Enemies drop light shards. Collect them to level up and pick one of three augmentations.
- **Wisps** chase, **Runners** are fast, **Seers** shoot from range, **Brutes** are tanky.
- A **Prism Wraith** boss breaches at 1:50, then about every 80 seconds. Drop its hull to seal the rift and get a big score bonus.
- Dashing grants a moment of invulnerability — save it for emergencies.

## Achievements

Prismfall reports achievements to the Spectra Launcher using the standard text-file contract.
Play through `Prismfall.exe` and unlocks are written immediately — the launcher picks them up
about once a second and shows its toast.

| id | Name | Unlock |
| --- | --- | --- |
| `first-blood` | First Light | Destroy your first hostile |
| `level-ten` | Resonant | Reach level 10 in a single run |
| `rift-sealed` | Rift Sealed | Defeat a Prism Wraith |
| `survive-five` | Last Light | Survive for five minutes |
| `score-five-k` | Overcharge | Score 5,000 points in one run |

How it works inside this game:

- The WebView2 host reads `SPECTRA_GAME_ID`, `SPECTRA_LAUNCHER` and
  `SPECTRA_ACHIEVEMENTS_FILE` and injects them into the page as `window.SPECTRA_*`.
- Unlocks are sent over the WebView2 message bridge; the host appends one id per line to the
  achievements file. Duplicates are ignored, and ids are validated before writing.
- If `SPECTRA_ACHIEVEMENTS_FILE` is missing (game opened directly), the host falls back to
  `%APPDATA%\Spectra Launcher\achievements\prismfall.txt`, matching the launcher's own path.
- The game also shows its own in-game trophy toast, because Windows may suppress notifications
  while a fullscreen game is running.
- Achievements are remembered in the WebView2 profile as well, so already-unlocked ones do not
  toast again.
- Browser-only play (`index.html`) still shows the in-game toast and remembers locally, but a
  browser cannot write the launcher file.

For testing, the API is exposed in the page: `SpectraAchievements.unlock('first-blood')`,
`SpectraAchievements.isUnlocked('first-blood')`, `SpectraAchievements.unlocked()`.

## Files

| File | Purpose |
| --- | --- |
| `Prismfall.exe` | Standalone game window (WebView2 host, stays open while playing) |
| `Microsoft.Web.WebView2.*.dll`, `WebView2Loader.dll` | WebView2 dependencies used by `Prismfall.exe` |
| `index.html` | Game page (also opens directly in a browser) |
| `style.css` | Neon UI and screens |
| `game.js` | All game logic and rendering |
| `catalog-entry.json` | Ready-made Spectra Launcher catalogue entry |

## Adding it to Spectra Launcher

1. Zip this folder's files (at the top level of the zip) as `Prismfall-1.0.0.zip` and attach it to a GitHub release.
2. Put the URL in `catalog-entry.json` → `games[0].download`.
3. Merge the game (and optional news item) into your launcher `catalog.json`.

The zip has every file at its **top level**, so the launcher entry uses `"exe": "Prismfall.exe"`.
On Install the launcher extracts it to `<install folder>/prismfall`, then Play starts
`Prismfall.exe` with that folder as the working directory. Because the host process stays alive
for the whole session, playtime is counted correctly.

Player progress (best score, sound setting) is stored in a per-user WebView2 profile under
`%LOCALAPPDATA%\Spectra Games\Prismfall\`, not in the install folder, so uninstalling does not
wipe it.

## Development

`Prismfall.exe` is built from `host/Prismfall.cs` (a WinForms + WebView2 window). Rebuild it with
`powershell -ExecutionPolicy Bypass -File host\build.ps1`; it only needs the .NET Framework C# compiler that ships with Windows.
The `host/` folder is not included in the game zip.

Plain HTML/CSS/JavaScript with no dependencies. Edit `game.js` and refresh.
Everything is procedural — no image, font or audio files. Sound is synthesised with WebAudio.

---

© Spectra Games · v1.0.0 · 2026-11-07
