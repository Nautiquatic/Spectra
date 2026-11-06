# Spectra achievements

Any Spectra game can unlock achievements in the Spectra Launcher. It works in any engine, because all the game does is **add a line to a text file**.

## How it works

```
catalog.json            lists each achievement (id, name, description)
      │
Your game               writes  "first-win"  as a new line in its achievements file
      │
Spectra Launcher        watches that file → "🏆 Achievement unlocked: First Win"
```

- Each game has one file: `%APPDATA%\Spectra Launcher\achievements\<game-id>.txt`
- One achievement id per line. Duplicates are ignored, and the order doesn't matter.
- When the launcher starts your game, it passes these environment variables:

| Variable | Value |
|---|---|
| `SPECTRA_ACHIEVEMENTS_FILE` | Full path of the file to write to |
| `SPECTRA_GAME_ID` | The game's `id` from `catalog.json` |
| `SPECTRA_LAUNCHER` | `1`, meaning the game was started by the launcher |

- **While the game is running**, the launcher checks the file about once a second. New unlocks pop up straight away as an in-launcher toast and a Windows notification.
- **If the game is run without the launcher** (for example, double-clicking the exe), the helpers below fall back to the same path. Those unlocks show up next time the launcher opens or is focused.
- Unlock times and the unlocked list are saved in the launcher, so uninstalling a game keeps its achievements.

## Step 1: List the achievements in `catalog.json`

```json
"achievements": [
  { "id": "first-win",     "name": "First Win",       "desc": "Win your first round." },
  { "id": "no-damage",     "name": "Untouchable",     "desc": "Finish a level without getting hit.", "icon": "https://your-server.com/ach/no-damage.png" },
  { "id": "secret-ending", "name": "The Real Ending", "desc": "Find the secret ending.", "hidden": true }
]
```

| Field | |
|---|---|
| `id` | What the game writes. Letters, numbers, `-`, `_` or `.`, up to 64 characters. **Never change it after release:** players who unlocked the old id would lose it. |
| `name`, `desc` | Shown in the launcher and on the website. |
| `icon` | Optional square image link. Without it, a trophy or lock icon is shown. |
| `hidden` | Optional. Shows as "Hidden achievement" on the website and in the launcher until unlocked. |

You can add more achievements later. An id the game writes before it's in the catalogue is still saved, and it appears once you add it.

## Step 2: Add the helper to your game

Copy one file, set your game id (the same `id` as in `catalog.json`), and call `unlock`.

### Unity: [`unity/SpectraAchievements.cs`](unity/SpectraAchievements.cs)
Drop it into `Assets/`, then set `GameId` at the top.
```csharp
SpectraAchievements.Unlock("first-win");
if (SpectraAchievements.IsUnlocked("first-win")) { /* ... */ }
```

### Godot 4: [`godot/spectra_achievements.gd`](godot/spectra_achievements.gd)
Add it as an Autoload named `SpectraAchievements` (Project Settings → Globals → Autoload), then set `GAME_ID`.
```gdscript
SpectraAchievements.unlock("first-win")
```

### GameMaker: [`gamemaker/spectra_achievements.gml`](gamemaker/spectra_achievements.gml)
Paste it into a Script asset and set `SPECTRA_GAME_ID`. Then turn on **Game Options → Windows → General → Disable file system sandbox**. Without that, GameMaker isn't allowed to write to the launcher's folder.
```gml
spectra_unlock("first-win");
```

### Anything else
1. Read the `SPECTRA_ACHIEVEMENTS_FILE` environment variable.
2. If it's empty, use `%APPDATA%\Spectra Launcher\achievements\<your-game-id>.txt`.
3. Create the folder if needed, then append `achievement-id` plus a newline.

## Step 3: Test it

1. Add the achievements to `catalog.json` and make sure the launcher has loaded it. **Settings → Game server** should say "Connected".
2. Install the game and press **Play** in the launcher.
3. Trigger the achievement. A toast appears within about a second.
4. Check the game's **Achievements** tab: it shows progress, unlock dates and revealed hidden ones.

You can also test without touching the game. While the launcher is open, add a line by hand:
```bash
echo first-win >> "%APPDATA%\Spectra Launcher\achievements\my-first-game.txt"
```
Then click the launcher window. The unlock is picked up when the window gets focus.

To reset your own achievements while testing, delete that `.txt` file **and** use **Settings → Reset launcher** (the launcher keeps its own copy).

## Things to know

- **Fullscreen games:** Windows may hold back notifications while a fullscreen game runs ("Do not disturb" / Focus assist). The unlock is still saved and shows in the launcher and in its notifications list. For an in-game popup, show your own when you call `unlock`.
- **Honour system:** the file is plain text, so a player could add lines by hand. That's normal for offline achievements, and fine for a free launcher with no leaderboards.
- **One PC each:** achievements are stored on the player's computer and don't sync between PCs.
