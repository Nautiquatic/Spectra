/*
 * Spectra Launcher config.
 *
 * No games ship with the launcher. On startup it downloads a catalogue (a JSON
 * file) from your server and shows whatever games are listed there. Each game
 * has a `download` URL pointing at a .zip of the build, which the launcher
 * downloads and extracts when the player clicks Install.
 *
 * Point catalogUrl at your server once you have one (it can also be changed in
 * Settings → Game server). See catalog.example.json for the format.
 *
 * Examples:
 *   'https://games.example.com/spectra/catalog.json'
 *   'C:\\path\\to\\catalog.json'   (local file, handy for testing — desktop app only)
 */
window.SPECTRA_CONFIG = {
  catalogUrl: 'https://nautiquatic.github.io/Spectra/catalog.json',
};
