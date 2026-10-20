[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$DesktopDir = Split-Path -Parent $PSScriptRoot
$RuntimeRoot = if ($env:NEIA_DESKTOP_RUNTIME_ROOT) { $env:NEIA_DESKTOP_RUNTIME_ROOT } else { Join-Path $DesktopDir ".runtime\windows-local" }
$RunDir = if ($env:NEIA_RUN_DIR) { $env:NEIA_RUN_DIR } else { Join-Path $RuntimeRoot "run" }
$PidFile = Join-Path $RunDir "neia-daemon.pid"

if (-not (Test-Path $PidFile)) {
    Write-Host "NEIA daemon is not running"
    exit 0
}

$DaemonPid = (Get-Content $PidFile -Raw).Trim()
if ($DaemonPid -and (Get-Process -Id ([int]$DaemonPid) -ErrorAction SilentlyContinue)) {
    Stop-Process -Id ([int]$DaemonPid)
    Write-Host "Stopped NEIA daemon PID $DaemonPid"
}
else {
    Write-Host "NEIA daemon PID $DaemonPid is not running"
}
Remove-Item $PidFile -Force
