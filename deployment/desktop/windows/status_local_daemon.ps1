[CmdletBinding()]
param(
    [string]$HostName = $(if ($env:NEIA_HOST) { $env:NEIA_HOST } else { "127.0.0.1" }),
    [int]$Port = $(if ($env:NEIA_PORT) { [int]$env:NEIA_PORT } else { 8080 })
)

$DesktopDir = Split-Path -Parent $PSScriptRoot
$RuntimeRoot = if ($env:NEIA_DESKTOP_RUNTIME_ROOT) { $env:NEIA_DESKTOP_RUNTIME_ROOT } else { Join-Path $DesktopDir ".runtime\windows-local" }
$RunDir = if ($env:NEIA_RUN_DIR) { $env:NEIA_RUN_DIR } else { Join-Path $RuntimeRoot "run" }
$LogDir = if ($env:NEIA_LOG_DIR) { $env:NEIA_LOG_DIR } else { Join-Path $RuntimeRoot "logs" }
$PidFile = Join-Path $RunDir "neia-daemon.pid"

if (-not (Test-Path $PidFile)) {
    Write-Host "NEIA daemon is not running"
    Write-Host "Expected PID file: $PidFile"
    exit 0
}

$DaemonPid = (Get-Content $PidFile -Raw).Trim()
if ($DaemonPid -and (Get-Process -Id ([int]$DaemonPid) -ErrorAction SilentlyContinue)) {
    Write-Host "NEIA daemon running"
    Write-Host "PID: $DaemonPid"
    Write-Host "URL: http://${HostName}:$Port"
    Write-Host "Logs: $LogDir"
    exit 0
}

Write-Host "Stale PID file found at $PidFile"
Write-Host "Logs: $LogDir"
exit 1
