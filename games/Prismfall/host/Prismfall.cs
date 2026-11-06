// Prismfall.exe: a small WebView2 window that runs index.html (the game) and connects it to the
// Spectra Launcher.
//
//  - Shows index.html from the folder next to the exe, starting borderless fullscreen.
//  - Injects window.SPECTRA_GAME_ID / SPECTRA_LAUNCHER / SPECTRA_ACHIEVEMENTS_FILE / SPECTRA_UNLOCKED
//    and window.SPECTRA_HOST / SPECTRA_FULLSCREEN.
//  - Page -> host messages:
//      "spectra-unlock|<id>"          append the achievement id to the launcher's achievements file
//      "spectra-window|fullscreen-on" / "spectra-window|fullscreen-off"
//  - Host -> page: window.SPECTRA_FULLSCREEN is updated and a "spectra-fullscreen" event is fired.
//  - Saves (localStorage) live in %LOCALAPPDATA%\Spectra Games\Prismfall\WebView2.
//
// Build with build.ps1 (needs only the .NET Framework 4 C# compiler that ships with Windows).
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Prismfall
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            try
            {
                Application.Run(new GameForm());
            }
            catch (Exception ex)
            {
                MessageBox.Show("Prismfall could not start.\n\n" + ex.Message, "Prismfall", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }

    class GameForm : Form
    {
        const string DefaultGameId = "prismfall";
        const string UnlockPrefix = "spectra-unlock|";
        const string WindowPrefix = "spectra-window|";
        const string WebView2Download = "https://go.microsoft.com/fwlink/p/?LinkId=2124703";
        static readonly Regex IdPattern = new Regex("^[A-Za-z0-9._-]{1,64}$");

        readonly WebView2 webView;
        readonly HashSet<string> unlocked = new HashSet<string>(StringComparer.Ordinal);
        readonly string gameId;
        readonly string achievementsPath;

        bool fullscreen;
        Rectangle windowedBounds;
        bool windowedMaximized;

        public GameForm()
        {
            gameId = ResolveGameId();
            achievementsPath = ResolveAchievementsPath(gameId);
            LoadExistingUnlocks();

            Text = "PRISMFALL";
            ClientSize = new Size(1280, 800);
            MinimumSize = new Size(800, 520);
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.FromArgb(5, 6, 15);
            KeyPreview = true;
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }

            webView = new WebView2();
            webView.Dock = DockStyle.Fill;
            webView.DefaultBackgroundColor = Color.FromArgb(5, 6, 15);
            Controls.Add(webView);

            Load += OnLoaded;
        }

        static string ResolveGameId()
        {
            string id = Environment.GetEnvironmentVariable("SPECTRA_GAME_ID");
            return !string.IsNullOrWhiteSpace(id) && IdPattern.IsMatch(id) ? id : DefaultGameId;
        }

        static string ResolveAchievementsPath(string id)
        {
            string fromLauncher = Environment.GetEnvironmentVariable("SPECTRA_ACHIEVEMENTS_FILE");
            if (!string.IsNullOrWhiteSpace(fromLauncher)) return fromLauncher;
            // Same place the launcher uses, so unlocks still count when the exe is run directly.
            return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Spectra Launcher", "achievements", id + ".txt");
        }

        void LoadExistingUnlocks()
        {
            try
            {
                if (!File.Exists(achievementsPath)) return;
                foreach (string line in File.ReadAllLines(achievementsPath))
                {
                    string id = line.Trim();
                    if (id.Length > 0 && IdPattern.IsMatch(id)) unlocked.Add(id);
                }
            }
            catch { }
        }

        // ---------------- fullscreen ----------------
        void SetFullscreen(bool on)
        {
            if (on == fullscreen) return;
            if (on)
            {
                windowedMaximized = WindowState == FormWindowState.Maximized;
                if (WindowState == FormWindowState.Normal) windowedBounds = Bounds;
                FormBorderStyle = FormBorderStyle.None;
                WindowState = FormWindowState.Normal;
                Bounds = Screen.FromControl(this).Bounds;
            }
            else
            {
                FormBorderStyle = FormBorderStyle.Sizable;
                if (windowedBounds.Width > 0) Bounds = windowedBounds;
                else
                {
                    Rectangle wa = Screen.FromControl(this).WorkingArea;
                    Bounds = new Rectangle(wa.X + (wa.Width - 1280) / 2, wa.Y + (wa.Height - 800) / 2, 1280, 800);
                }
                if (windowedMaximized) WindowState = FormWindowState.Maximized;
            }
            fullscreen = on;
            NotifyFullscreen();
        }

        void NotifyFullscreen()
        {
            if (webView.CoreWebView2 == null) return;
            webView.CoreWebView2.ExecuteScriptAsync("window.SPECTRA_FULLSCREEN = " + (fullscreen ? "true" : "false") +
                "; window.dispatchEvent(new Event('spectra-fullscreen'));");
        }

        protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
        {
            // Alt+Enter toggles fullscreen even if the page has focus issues.
            if (keyData == (Keys.Alt | Keys.Enter)) { SetFullscreen(!fullscreen); return true; }
            return base.ProcessCmdKey(ref msg, keyData);
        }

        // ---------------- WebView2 ----------------
        async void OnLoaded(object sender, EventArgs e)
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string page = Path.Combine(baseDir, "index.html");
            if (!File.Exists(page))
            {
                MessageBox.Show("index.html was not found next to Prismfall.exe.\n\nExpected:\n" + page, "Prismfall", MessageBoxButtons.OK, MessageBoxIcon.Error);
                Close();
                return;
            }

            SetFullscreen(true);

            string dataDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Spectra Games", "Prismfall", "WebView2");
            try
            {
                Directory.CreateDirectory(dataDir);
                CoreWebView2Environment env = await CoreWebView2Environment.CreateAsync(null, dataDir, new CoreWebView2EnvironmentOptions());
                await webView.EnsureCoreWebView2Async(env);
            }
            catch (WebView2RuntimeNotFoundException)
            {
                SetFullscreen(false);
                DialogResult r = MessageBox.Show("Prismfall needs the Microsoft Edge WebView2 Runtime, which isn't installed on this PC.\n\nOpen the download page now?",
                    "Prismfall", MessageBoxButtons.YesNo, MessageBoxIcon.Information);
                if (r == DialogResult.Yes) { try { Process.Start(WebView2Download); } catch { } }
                Close();
                return;
            }
            catch (Exception ex)
            {
                SetFullscreen(false);
                MessageBox.Show("Prismfall could not start.\n\n" + ex.Message, "Prismfall", MessageBoxButtons.OK, MessageBoxIcon.Error);
                Close();
                return;
            }

            CoreWebView2Settings settings = webView.CoreWebView2.Settings;
            settings.AreDefaultContextMenusEnabled = false;
            settings.IsStatusBarEnabled = false;
            settings.AreDevToolsEnabled = false;
            settings.IsZoomControlEnabled = false;
            settings.AreBrowserAcceleratorKeysEnabled = false;

            webView.CoreWebView2.NewWindowRequested += delegate (object s, CoreWebView2NewWindowRequestedEventArgs a) { a.Handled = true; };
            webView.CoreWebView2.WebMessageReceived += OnWebMessage;
            // If the page ever uses the browser Fullscreen API, follow it with the window.
            webView.CoreWebView2.ContainsFullScreenElementChanged += delegate (object s, object a)
            {
                SetFullscreen(webView.CoreWebView2.ContainsFullScreenElement);
            };

            await webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(BuildInjectionScript());
            webView.CoreWebView2.Navigate(new Uri(page).AbsoluteUri);
        }

        void OnWebMessage(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            string msg;
            try { msg = e.TryGetWebMessageAsString(); } catch { return; }
            if (string.IsNullOrEmpty(msg)) return;

            if (msg.StartsWith(WindowPrefix, StringComparison.Ordinal))
            {
                string cmd = msg.Substring(WindowPrefix.Length);
                if (cmd == "fullscreen-on") SetFullscreen(true);
                else if (cmd == "fullscreen-off") SetFullscreen(false);
                else if (cmd == "fullscreen-toggle") SetFullscreen(!fullscreen);
                return;
            }

            if (!msg.StartsWith(UnlockPrefix, StringComparison.Ordinal)) return;
            string id = msg.Substring(UnlockPrefix.Length).Trim();
            if (!IdPattern.IsMatch(id) || unlocked.Contains(id)) return;
            try
            {
                string dir = Path.GetDirectoryName(achievementsPath);
                if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
                File.AppendAllText(achievementsPath, id + Environment.NewLine, new UTF8Encoding(false));
                unlocked.Add(id);
            }
            catch { }
        }

        string BuildInjectionScript()
        {
            StringBuilder sb = new StringBuilder();
            sb.Append("window.SPECTRA_HOST = true;");
            sb.Append("window.SPECTRA_FULLSCREEN = ").Append(fullscreen ? "true" : "false").Append(";");
            sb.Append("window.SPECTRA_GAME_ID = ").Append(ToJsString(gameId)).Append(";");
            sb.Append("window.SPECTRA_ACHIEVEMENTS_FILE = ").Append(ToJsString(achievementsPath)).Append(";");
            sb.Append("window.SPECTRA_LAUNCHER = ").Append(Environment.GetEnvironmentVariable("SPECTRA_LAUNCHER") == "1" ? "true" : "false").Append(";");
            sb.Append("window.SPECTRA_UNLOCKED = [");
            bool first = true;
            foreach (string id in unlocked)
            {
                if (!first) sb.Append(",");
                sb.Append(ToJsString(id));
                first = false;
            }
            sb.Append("];");
            return sb.ToString();
        }

        static string ToJsString(string s)
        {
            StringBuilder sb = new StringBuilder("\"");
            foreach (char c in s ?? "")
            {
                if (c == '\\') sb.Append("\\\\");
                else if (c == '"') sb.Append("\\\"");
                else if (c < 32 || c == (char)0x2028 || c == (char)0x2029 || c == '<') sb.Append("\\u").Append(((int)c).ToString("x4"));
                else sb.Append(c);
            }
            return sb.Append("\"").ToString();
        }
    }
}
