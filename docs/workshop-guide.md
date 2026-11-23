# Spectra Workshop mod guide

Workshop items are zips that change a Spectra game. Players subscribe in Spectra Launcher (Workshop page),
the launcher installs them, and players turn them on and off in each game's **Mods** tab. Spectra staff
review every upload, and every new version, before it goes up.

Games that load mods: **Prismfall** (`prismfall`) and **LUMEN** (`lumen`).

## The zip

Put `spectra-mod.json` at the top of the zip (or inside one folder), next to the files it uses.
Zips can be up to 20 MB (60 MB unzipped, 500 files).

```json
{
  "name": "Hot Pink Rift",
  "game": "prismfall",
  "kind": "pack",
  "version": "1.0",
  "description": "Recolours Prismfall's neon in hot pink and gold.",
  "palette": { "colors": { "cyan": "#ff7ad9", "magenta": "#ffd166" } },
  "sounds": { "boom": "sounds/boom.mp3" },
  "css": ["pack.css"]
}
```

| Field | What it is |
| --- | --- |
| `name` | Up to 60 characters. |
| `game` | `prismfall` or `lumen`. |
| `kind` | `pack`, `data` or `code` (below). |
| `version` | Like `1.0` or `1.2.3`. Bump it for every update. |
| `description` | Optional; fills in the Workshop description. |
| `palette` | Colours, by section (see each game below). |
| `sounds` | Sound name → `.mp3` / `.ogg` / `.wav` file in the zip. |
| `css` | Stylesheets added to the game's menus and HUD. |
| `data` | Changes to the game's tables: an object, or a `.json` file in the zip. Data and code mods only. |
| `code` | `.js` file(s) the game runs. Code mods only. |

### Kinds

- **pack** (resource pack): `palette`, `sounds`, `css`, images and fonts the CSS uses. Achievements and online play stay on.
- **data** (data mod): everything a pack can do, plus `data`. Turns off achievements and online play while it's on.
- **code** (code mod): everything above, plus `code`. Turns off achievements and online play while it's on.
  Players are warned before subscribing. Staff read the code before approving it, so keep it readable (no minified or obfuscated code).

Allowed files: `.json .css .png .jpg .jpeg .webp .gif .svg .mp3 .ogg .wav .woff .woff2 .ttf .otf .txt .md`, and `.js` in code mods.

### Load order

Players order their mods in the game's Mods tab. Mods load top to bottom, so when two change the same
thing, the lower one wins.

## Data mods

`data` is `{ section: { key: { field: value } } }`. A value replaces one of the **same type** that is already
there (number, text or true/false); nested objects work the same way. Anything else is ignored, so you can't
add new things or break the game's functions with data alone.

### Prismfall sections

| Section | Keys | Example fields |
| --- | --- | --- |
| `upgrades` | upgrade ids (`speed`, `magnet`, `phoenix`, …) | `base`, `step`, `max`, `name` |
| `enemies` | hostile ids (`wisp`, `runner`, `brute`, …) | `hp`, `speed`, `dmg`, `r`, `xp`, `score` |
| `bosses` | boss ids (`wraith`, `queen`, `titan`, `nullem`, …) | `speed`, `dmg`, `hpMul`, `r`, `name` |
| `classes` | class ids (`striker`, `lancer`, …) | `name`, `desc` |
| `difficulties` | `easy` … `nightmare` | `hp`, `dmg`, `spawn`, `cap`, `score`, `firstBoss`, `bossGap` |
| `modifiers` | `fog`, `glass`, `swarm`, … | `mult`, `name`, `desc` |
| `prisms` | `easy` … `nightmare` | the prism multiplier (a number) |

```json
{ "difficulties": { "medium": { "hp": 0.75, "dmg": 0.7 } }, "enemies": { "wisp": { "speed": 48 } } }
```

### LUMEN sections

| Section | Keys | Example fields |
| --- | --- | --- |
| `modules` | part ids (`core`, `plate`, `cannon`, `flak`, `lance`, `thruster`, `ballast`, `rod`, `bellows`, `maw`) | `hp`, `mass`, `name`, `desc`, `weapon.dmg`, `weapon.rate`, `weapon.range`, `weapon.speed` |

```json
{ "modules": { "core": { "hp": 140, "weapon": { "rate": 0.3 } } } }
```

## Palettes and CSS

### Prismfall

- `palette.colors`: `cyan`, `magenta`, `violet`, `gold`, `red`, `green` (the neon used everywhere).
- `sounds`: `lanceAbility`, `boom`, `beam`, `boil`, `fire` (and any other name in the game's sound table).
- `css`: menus and HUD, for example `.menu-foot`, `#hud`, `.btn`.

### LUMEN

- `palette.hull`: `player`, `pirate` and `salvage`, each with `fill`, `edge`, `dark`, `accent`.
- `css`: the menus use CSS variables, so a pack can recolour them in one go:
  `:root { --brass: #7fc8a9; --brass-bright: #d8f3e6; --ink: #06130f; }`

## Code mods

Code runs after the game has set up. Use `SpectraMods.api` for the game and `SpectraMods.on` for events.
Errors in a mod are caught and shown to the player; they don't stop the game.

```js
(function () {
  const api = SpectraMods.api;
  let kills = 0;
  SpectraMods.on('runStart', (run) => { kills = 0; api.announce('Good luck!'); });
  SpectraMods.on('kill', () => { if (++kills % 100 === 0) api.announce(kills + ' down'); });
})();
```

### Prismfall

`SpectraMods.api`: `game` (the live game state), `C` (colours), `UPGRADES`, `UPGRADE_BY_ID`, `ENEMY_TYPES`,
`BOSS_TYPES`, `CLASSES`, `DIFFICULTIES`, `MODIFIERS`, `announce(text, colour)`, `spawnEnemy(type, opts)`,
`spawnBoss(opts)`, `giveUpgrade(id)`, `player()`.

Events: `ready`, `runStart({ type, class, difficulty, player })`, `update(dt)`, `kill(enemy)`, `bossKill(boss)`,
`levelUp(player)`, `upgrade(player, upgrade)`, `runEnd({ won, type, score, time })`.

### LUMEN

`SpectraMods.api`: `LUMEN`, `world` (LumenSky: `MODULES`, `spawnPirate`, `spawnSalvage`, …), `render`,
`run()` (the current voyage), `save()`, `hint(text, ms)`, `start(opts)`.

Events: `ready`, `runStart({ mode, run })`, `update(dt, run)`, `runEnd({ won, summary, run })`.

## Rules

Staff reject mods that harm players or their PCs, collect data, cheat online, contain things that break the
Spectra rules, or that use someone else's work without permission. Code must be readable.

## Examples

The examples below has a pack, a data mod and a code mod for Prismfall, and a pack and a data mod for LUMEN,
each as a folder and a ready-made zip.

## For game developers

`spectra-mods.js` is the loader. Copy it next to your game's `index.html` and load it with a `<script>` tag after
your data scripts and before your main script. Then call `SpectraMods.palette(...)`, `SpectraMods.sounds(...)`,
`SpectraMods.data({...})` on your tables, `SpectraMods.emit(...)` at key moments, and `SpectraMods.ready(api)` once
the game is set up. Check `SpectraMods.modded` before unlocking achievements or joining online games. Add
`"mods": true` to the game's catalogue entry so the launcher shows its Mods tab and Workshop.

## Download the examples

- [lumen-iron-core.zip](assets/mods/lumen-iron-core.zip)
- [lumen-verdigris.zip](assets/mods/lumen-verdigris.zip)
- [prismfall-gentle-rift.zip](assets/mods/prismfall-gentle-rift.zip)
- [prismfall-hot-pink.zip](assets/mods/prismfall-hot-pink.zip)
- [prismfall-kill-counter.zip](assets/mods/prismfall-kill-counter.zip)
- [spectra-mods.js](assets/mods/spectra-mods.js) (the loader, for game developers)
