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

To release a new launcher version:
1. Bump `version` in `package.json` and `launcherVersion` in `docs/config.js`.
2. Run `npm run dist`.
3. On GitHub, go to **Releases → Draft a new release**, tag it (e.g. `v0.2.0`) and attach `dist/SpectraLauncherSetup.exe`.

The website's Download button links to `releases/latest/download/SpectraLauncherSetup.exe`, so it always serves the newest release with no website change.

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

`news` items appear on the Home page. Link one to a game with `"game": "<id>"`.

## Website

`docs/` is the public site: Home, Games, a page for each game, Launcher info with an FAQ, and Download. It's plain static files. To host it on GitHub Pages: repo **Settings → Pages → Deploy from a branch → `main` / `/docs`**. It will be live at `https://nautiquatic.github.io/Spectra/`.

Set things up in `docs/config.js`:
- `catalogUrl`: the **same** `catalog.json` the launcher uses, so the site always lists the same games. Your catalogue host must allow cross-origin requests (CORS) if it's on a different domain from the site. Putting `catalog.json` next to the site avoids that.
- `downloadUrl`: link to the launcher installer. It's already set to the latest GitHub release.

To test with a catalogue without editing config, add `?catalog=<url>` to the page address.

## Browser preview

`src/index.html` also runs in a normal browser for working on the design. There, installs are simulated and games can't be launched.
