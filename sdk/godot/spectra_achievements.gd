# Spectra achievements for Godot 4.
# 1. Add this script as an Autoload named "SpectraAchievements"
#    (Project > Project Settings > Globals > Autoload).
# 2. Set GAME_ID below.
# 3. Anywhere in your game:
#        SpectraAchievements.unlock("first-win")
#
# Works whether the game is started from the Spectra Launcher or run directly.
extends Node

## MUST match this game's "id" in catalog.json
const GAME_ID := "my-first-game"

var _unlocked := {}

func _ready() -> void:
	var path := file_path()
	if FileAccess.file_exists(path):
		var f := FileAccess.open(path, FileAccess.READ)
		if f:
			while not f.eof_reached():
				var line := f.get_line().strip_edges()
				if line != "":
					_unlocked[line] = true

## Path of this game's achievements file.
func file_path() -> String:
	var from_launcher := OS.get_environment("SPECTRA_ACHIEVEMENTS_FILE")
	if from_launcher != "":
		return from_launcher
	return OS.get_environment("APPDATA").path_join("Spectra Launcher").path_join("achievements").path_join(GAME_ID + ".txt")

## True when the game was started by the Spectra Launcher.
func started_by_launcher() -> bool:
	return OS.get_environment("SPECTRA_LAUNCHER") == "1"

## Unlock an achievement by its id from catalog.json. Safe to call repeatedly.
func unlock(achievement_id: String) -> void:
	if achievement_id == "" or _unlocked.has(achievement_id):
		return
	var path := file_path()
	DirAccess.make_dir_recursive_absolute(path.get_base_dir())
	var f: FileAccess
	if FileAccess.file_exists(path):
		f = FileAccess.open(path, FileAccess.READ_WRITE)
		if f:
			f.seek_end()
	else:
		f = FileAccess.open(path, FileAccess.WRITE)
	if f == null:
		push_warning("[Spectra] Could not save achievement: %s" % error_string(FileAccess.get_open_error()))
		return
	f.store_string(achievement_id + "\n")
	f.close()
	_unlocked[achievement_id] = true
	print("[Spectra] Achievement unlocked: ", achievement_id)

## Has this achievement already been unlocked?
func is_unlocked(achievement_id: String) -> bool:
	return _unlocked.has(achievement_id)
