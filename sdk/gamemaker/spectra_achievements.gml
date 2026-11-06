/// Spectra achievements for GameMaker (2023.1+, needs string_trim).
///
/// IMPORTANT: GameMaker blocks writing outside its own save folder by default.
/// Turn on: Game Options > Windows > General > "Disable file system sandbox".
///
/// Create a Script asset, paste this in, set the game id below, then call:
///     spectra_unlock("first-win");
///     if (spectra_is_unlocked("first-win")) { ... }

#macro SPECTRA_GAME_ID "my-first-game"   // MUST match this game's "id" in catalog.json

/// @function spectra_achievements_file()
/// @description Path of this game's achievements file.
function spectra_achievements_file() {
    var _from_launcher = environment_get_variable("SPECTRA_ACHIEVEMENTS_FILE");
    if (_from_launcher != "") return _from_launcher;
    return environment_get_variable("APPDATA") + "\\Spectra Launcher\\achievements\\" + SPECTRA_GAME_ID + ".txt";
}

/// @function spectra_started_by_launcher()
function spectra_started_by_launcher() {
    return environment_get_variable("SPECTRA_LAUNCHER") == "1";
}

/// @function spectra_is_unlocked(achievement_id)
function spectra_is_unlocked(_id) {
    var _path = spectra_achievements_file();
    if (!file_exists(_path)) return false;
    var _f = file_text_open_read(_path);
    if (_f == -1) return false;
    var _found = false;
    while (!file_text_eof(_f)) {
        if (string_trim(file_text_readln(_f)) == _id) { _found = true; break; }
    }
    file_text_close(_f);
    return _found;
}

/// @function spectra_unlock(achievement_id)
/// @description Unlock an achievement by its id from catalog.json. Safe to call repeatedly.
function spectra_unlock(_id) {
    if (_id == "" || spectra_is_unlocked(_id)) return;
    var _path = spectra_achievements_file();
    var _dir = filename_dir(_path);
    if (!directory_exists(_dir)) directory_create(_dir);
    var _f = file_text_open_append(_path);
    if (_f == -1) { show_debug_message("[Spectra] Could not save achievement " + _id); return; }
    file_text_write_string(_f, _id);
    file_text_writeln(_f);
    file_text_close(_f);
    show_debug_message("[Spectra] Achievement unlocked: " + _id);
}
