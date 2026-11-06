// Spectra achievements for Unity.
// Drop this file anywhere in your Assets folder, set GameId below, then call:
//
//     SpectraAchievements.Unlock("first-win");
//
// Works whether the game is started from the Spectra Launcher or run directly.
// Unlocks earned while the launcher is closed are picked up next time it opens.

using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

public static class SpectraAchievements
{
    // MUST match this game's "id" in catalog.json
    public const string GameId = "my-first-game";

    static HashSet<string> _unlocked;

    /// <summary>Path of this game's achievements file.</summary>
    public static string FilePath
    {
        get
        {
            // Set by the launcher when it starts the game
            string fromLauncher = Environment.GetEnvironmentVariable("SPECTRA_ACHIEVEMENTS_FILE");
            if (!string.IsNullOrEmpty(fromLauncher)) return fromLauncher;
            // Fallback when the exe is run directly
            string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            return Path.Combine(appData, "Spectra Launcher", "achievements", GameId + ".txt");
        }
    }

    /// <summary>True when the game was started by the Spectra Launcher.</summary>
    public static bool StartedByLauncher => Environment.GetEnvironmentVariable("SPECTRA_LAUNCHER") == "1";

    static HashSet<string> Unlocked
    {
        get
        {
            if (_unlocked != null) return _unlocked;
            _unlocked = new HashSet<string>();
            try
            {
                if (File.Exists(FilePath))
                    foreach (string line in File.ReadAllLines(FilePath))
                        if (line.Trim().Length > 0) _unlocked.Add(line.Trim());
            }
            catch (Exception e) { Debug.LogWarning("[Spectra] Could not read achievements: " + e.Message); }
            return _unlocked;
        }
    }

    /// <summary>Unlock an achievement by its id from catalog.json. Safe to call repeatedly.</summary>
    public static void Unlock(string achievementId)
    {
        if (string.IsNullOrWhiteSpace(achievementId) || Unlocked.Contains(achievementId)) return;
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(FilePath));
            File.AppendAllText(FilePath, achievementId + "\n");
            _unlocked.Add(achievementId);
            Debug.Log("[Spectra] Achievement unlocked: " + achievementId);
        }
        catch (Exception e) { Debug.LogWarning("[Spectra] Could not save achievement: " + e.Message); }
    }

    /// <summary>Has this achievement already been unlocked?</summary>
    public static bool IsUnlocked(string achievementId) => Unlocked.Contains(achievementId);
}
