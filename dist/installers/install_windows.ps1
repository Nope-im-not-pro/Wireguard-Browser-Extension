# Installer Windows (Plan 9.2, EP-1 O-A).
# Legt Host-Binary + wireproxy nach %LOCALAPPDATA%, registriert Native-Messaging-Manifest
# via Registry HKCU\Software\Mozilla\NativeMessagingHosts\<name>.
# Ausfuehrung: powershell -ExecutionPolicy Bypass -File install_windows.ps1
param(
  [string]$HostBinary = "$PSScriptRoot\..\..\native-host\bin\host.exe",
  [string]$WireproxyBinary = "$PSScriptRoot\..\wireproxy\windows\amd64\wireproxy.exe",
  [string]$ManifestTemplate = "$PSScriptRoot\..\..\native-host\manifest\wireguard_browser_host.json"
)
$ErrorActionPreference = "Stop"
$HostName = "wireguard_browser_host"
$InstallDir = Join-Path $env:LOCALAPPDATA "WireGuardBrowserHost"
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

# Binaries kopieren.
Copy-Item $HostBinary (Join-Path $InstallDir "host.exe") -Force
Copy-Item $WireproxyBinary (Join-Path $InstallDir "wireproxy.exe") -Force

# Manifest mit absolutem Pfad rendern.
$hostPath = (Join-Path $InstallDir "host.exe")
$manifest = Get-Content $ManifestTemplate -Raw
$manifest = $manifest -replace "__HOST_BINARY_PATH__", ($hostPath -replace '\\','\\')
$manifestPath = Join-Path $InstallDir "$HostName.json"
Set-Content -Path $manifestPath -Value $manifest -Encoding UTF8

# Registry-Eintrag (Firefox liest Manifest-Pfad hier).
$regKey = "HKCU:\Software\Mozilla\NativeMessagingHosts\$HostName"
New-Item -Path $regKey -Force | Out-Null
Set-ItemProperty -Path $regKey -Name "(default)" -Value $manifestPath

# wireproxy fuer den Host auffindbar machen.
[Environment]::SetEnvironmentVariable("WIREPROXY_BIN", (Join-Path $InstallDir "wireproxy.exe"), "User")

Write-Host "Installiert nach $InstallDir; Manifest registriert unter $regKey"
