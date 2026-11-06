# Spectra Launcher

The desktop launcher for Spectra games. No games ship with it. It downloads the list of games from your server and installs each one from there.

## Run it

```bash
npm install
npm start
```

## Build the installer

```bash
npm run dist
```

This creates `dist/SpectraLauncherSetup.exe`, a normal Windows setup wizard with a desktop shortcut, a Start menu entry and an uninstaller.

## Releasing a launcher update (auto-update)

Installed launchers check GitHub for updates when they start and every 4 hours. A newer version downloads in the background, and a green **Restart to update** button appears in the title bar. If the player ignores it, the update installs the next time they close the launcher. It never restarts while a game is running or a download is in progress.

1. Bump `version` in `package.json` (e.g. `0.2.0` → `0.3.0`) and `launcherVersion` in `docs/config.js`.
2. Run `npm run dist`.
3. On GitHub, go to **Releases → Draft a new release**:
   - Tag: `v0.3.0` (must match the version)
   - Attach **all three** files from `dist/`: `SpectraLauncherSetup.exe`, `SpectraLauncherSetup.exe.blockmap` and `latest.yml`
   - Leave **Set as the latest release** ticked, then click **Publish release**

Launchers find the update through the release marked **Latest**, and so does the website's Download button (`releases/latest/download/SpectraLauncherSetup.exe`).

> **Game releases must not be "Latest".** When you make a release for a game zip (like Prismfall), **untick "Set as the latest release"** (or tick "Set as a pre-release"). Otherwise launchers look for `latest.yml` in the game's release, can't find it, and stop updating. The website's Download button would break too. If it happens, open the launcher release on GitHub, click **Edit** and tick **Set as the latest release** again.

Updates only run in the installed app. When you use `npm start`, Settings shows that updates are off.

The installer isn't code-signed, so Windows SmartScreen will show "Windows protected your PC" the first time. Players click **More info → Run anyway**. Removing that warning needs a paid code-signing certificate.

## How games get in

1. Host a `catalog.json` somewhere (any web server, GitHub Pages, an S3 bucket, and so on). Copy `catalog.example.json` to start.
2. For each game, upload a `.zip` of the Windows build and put its URL in `download`. Set `exe` to the executable's path inside the zip.
3. Point the launcher at the catalogue: set `catalogUrl` in `src/catalog.js`, or paste the URL into **Settings → Game server**.

When a player clicks **Install**, the launcher downloads the zip, extracts it to `<install folder>/<game id>` (default `~/Spectra Games`), and **Play** runs `exe` from there while tracking playtime.

The launcher caches the last catalogue it loaded, so the library still works offline.

### Game fields

| field | required | notes |
|---|---|---|
| `id` | yes | letters, numbers, dashes. Used as the install folder name |
| `title` | yes | |
| `status` | | `available`, `early-access`, `coming-soon` or `in-development`. Only the first two can be installed; the others show a Wishlist button |
| `download`, `exe`, `sizeBytes` | to be installable | |
| `cover` (3:4), `banner` (wide) | | image URLs. Without them (or if they fail to load), art is generated from `art` |
| `tagline`, `description`, `version`, `released`, `genres`, `platforms`, `featured`, `features`, `achievements`, `patchNotes` | | shown on the store and game pages |

Achievements: see [sdk/README.md](sdk/README.md) for how games unlock them, plus ready-made helpers for Unity, Godot and GameMaker.

`news` items appear on the Home page. Link one to a game with `"game": "<id>"`.

## Games in this repo

`games/` holds Spectra's own games. Each one has a `catalog-entry.json` to merge into your `catalog.json`.
- **Prismfall**: neon arena survival shooter with 5 achievements. See [games/Prismfall/README.md](games/Prismfall/README.md).

## Website

`docs/` is the public site: Home, Games, a page for each game, Launcher info with an FAQ, and Download. It's plain static files. To host it on GitHub Pages: repo **Settings → Pages → Deploy from a branch → `main` / `/docs`**. It will be live at `https://nautiquatic.github.io/Spectra/`.

Set things up in `docs/config.js`:
- `catalogUrl`: the **same** `catalog.json` the launcher uses, so the site always lists the same games. Your catalogue host must allow cross-origin requests (CORS) if it's on a different domain from the site. Putting `catalog.json` next to the site avoids that.
- `downloadUrl`: link to the launcher installer. It's already set to the latest GitHub release.

To test with a catalogue without editing config, add `?catalog=<url>` to the page address.

## Browser preview

`src/index.html` also runs in a normal browser for working on the design. There, installs are simulated and games can't be launched.
