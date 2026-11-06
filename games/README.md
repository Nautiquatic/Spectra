# Spectra Games

Games built in-house for the Spectra Launcher.

| Game | Version | Status | Folder |
| --- | --- | --- | --- |
| Prismfall | 1.0.0 | Released | [`Prismfall/`](Prismfall/) |

Prismfall also reports Spectra achievements (`first-blood`, `level-ten`, `rift-sealed`,
`survive-five`, `score-five-k`) through the launcher's achievements file contract.

## Prismfall

A neon arena survival shooter. Auto-fire, dash, collect light shards, choose upgrades and
survive the Prism Wraith. Runs in any modern browser with no build step.

```text
Prismfall/
├─ Prismfall.exe            standalone game window (stays open while playing)
├─ index.html               game page
├─ style.css                neon UI
├─ game.js                  all game logic + rendering
├─ README.md                controls, packaging and launcher notes
├─ catalog-entry.json       Spectra Launcher catalogue entry
└─ (the packed zip goes in a GitHub release, not in git)
```

## Running a game

Double-click the game's `.exe`, or open its `index.html` in a browser. No server is required;
everything (art, audio, logic) is generated locally.

## Publishing to the launcher

Each game folder ships a `catalog-entry.json` with the fields the launcher expects. Zip the game
folder (files at the top level), upload it to a GitHub release, point `download` at the public URL, then merge the entry into your launcher
`catalog.json`. See the game README and `SpectraLauncher/README.md` for the full format.