[CmdletBinding()]
param(
    [string]$InstallRoot = $(Join-Path $env:ProgramFiles "Nexus N3 NEIA"),
    [string]$DataRoot = $(Join-Path $env:ProgramData "Nexus N3 NEIA"),
    [string]$TaskName = "Nexus N3 NEIA",
    [switch]$KeepData,
    [switch]$KeepInstallRoot
)

$ErrorActionPreference = "Stop"
$Identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$Principal = [Security.Principal.WindowsPrincipal]::new($Identity)
if (-not $Principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run this uninstaller from an elevated PowerShell window."
}

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

$ShortcutPath = Join-Path ([Environment]::GetFolderPath("DesktopDirectory")) "Nexus N3 NEIA.lnk"
if (Test-Path $ShortcutPath) { Remove-Item $ShortcutPath -Force }
if (-not $KeepInstallRoot -and (Test-Path $InstallRoot)) { Remove-Item $InstallRoot -Recurse -Force }
if (-not $KeepData -and (Test-Path $DataRoot)) { Remove-Item $DataRoot -Recurse -Force }

if ($KeepData) {
    Write-Host "Removed Nexus N3 NEIA and kept data under $DataRoot"
}
else {
    Write-Host "Removed Nexus N3 NEIA and its application data"
}
