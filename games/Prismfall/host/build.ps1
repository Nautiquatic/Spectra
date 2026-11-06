# Builds ..\Prismfall.exe from Prismfall.cs using the C# compiler that ships with Windows (.NET Framework 4).
# Run from anywhere:  powershell -ExecutionPolicy Bypass -File games\Prismfall\host\build.ps1
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$game = Split-Path -Parent $here
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) { $csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe' }

$cscArgs = @(
  '/nologo', '/target:winexe', '/optimize+', '/platform:x64',
  "/out:$(Join-Path $game 'Prismfall.exe')",
  "/r:$(Join-Path $game 'Microsoft.Web.WebView2.Core.dll')",
  "/r:$(Join-Path $game 'Microsoft.Web.WebView2.WinForms.dll')",
  '/r:System.Windows.Forms.dll', '/r:System.Drawing.dll', '/r:System.Core.dll'
)
$icon = Join-Path $here 'prismfall.ico'
if (Test-Path $icon) { $cscArgs += "/win32icon:$icon" }
$cscArgs += (Join-Path $here 'Prismfall.cs')

& $csc @cscArgs
if ($LASTEXITCODE -ne 0) { throw "csc failed ($LASTEXITCODE)" }
Write-Host "Built $(Join-Path $game 'Prismfall.exe')"

