[CmdletBinding()]
param(
    [string]$HostName = $(if ($env:NEIA_HOST) { $env:NEIA_HOST } else { "127.0.0.1" }),
    [int]$Port = $(if ($env:NEIA_PORT) { [int]$env:NEIA_PORT } else { 8080 }),
    [switch]$SkipUiBuild
)

$ErrorActionPreference = "Stop"
$DesktopDir = Split-Path -Parent $PSScriptRoot
$FrameworkRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\.."))
$RuntimeRoot = if ($env:NEIA_DESKTOP_RUNTIME_ROOT) { $env:NEIA_DESKTOP_RUNTIME_ROOT } else { Join-Path $DesktopDir ".runtime\windows-local" }
$StateDir = if ($env:NEIA_STATE_DIR) { $env:NEIA_STATE_DIR } else { Join-Path $RuntimeRoot "state" }
$LogDir = if ($env:NEIA_LOG_DIR) { $env:NEIA_LOG_DIR } else { Join-Path $RuntimeRoot "logs" }
$RunDir = if ($env:NEIA_RUN_DIR) { $env:NEIA_RUN_DIR } else { Join-Path $RuntimeRoot "run" }
$PidFile = Join-Path $RunDir "neia-daemon.pid"
$LogFile = Join-Path $LogDir "neia-daemon.log"
$ErrorLogFile = Join-Path $LogDir "neia-daemon-error.log"
$InstalledFile = if ($env:NEIA_INSTALLED_FILE) { $env:NEIA_INSTALLED_FILE } else { Join-Path $StateDir "installed.json" }
$PythonBin = if ($env:PYTHON_BIN) { $env:PYTHON_BIN } else { Join-Path $FrameworkRoot "neia-api\.venv\Scripts\python.exe" }

if (-not $SkipUiBuild -and $env:NEIA_SKIP_UI_BUILD -ne "1") {
    if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
        throw "npm.cmd is required to build the refactored NEIA UI. Use -SkipUiBuild only with a current neia-ui\dist build."
    }
    Push-Location (Join-Path $FrameworkRoot "neia-ui")
    try {
        & npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw "NEIA UI build failed with exit code $LASTEXITCODE" }
    }
    finally { Pop-Location }
}

if (-not (Test-Path (Join-Path $FrameworkRoot "neia-ui\dist\index.html") -PathType Leaf)) {
    throw "Missing neia-ui\dist\index.html; build the refactored NEIA UI first."
}
if (-not (Test-Path $PythonBin -PathType Leaf)) {
    throw "Missing Python executable at $PythonBin"
}

New-Item -ItemType Directory -Force -Path $StateDir, $LogDir, $RunDir | Out-Null
if (-not (Test-Path $InstalledFile) -and (Test-Path (Join-Path $FrameworkRoot "apps\installed.json"))) {
    Copy-Item (Join-Path $FrameworkRoot "apps\installed.json") $InstalledFile
}
if (Test-Path $InstalledFile) {
    try {
        [array]$InstalledApps = Get-Content $InstalledFile -Raw | ConvertFrom-Json
        if ($InstalledApps -contains "nexus") {
            [array]$InstalledApps = $InstalledApps | Where-Object { $_ -ne "nexus" }
            $InstalledJson = ConvertTo-Json -InputObject $InstalledApps
            [System.IO.File]::WriteAllText($InstalledFile, $InstalledJson + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
        }
    }
    catch { Write-Warning "Could not migrate optional app state at $InstalledFile" }
}

if (Test-Path $PidFile) {
    $ExistingPid = (Get-Content $PidFile -Raw).Trim()
    if ($ExistingPid -and (Get-Process -Id ([int]$ExistingPid) -ErrorAction SilentlyContinue)) {
        Write-Host "NEIA daemon already running with PID $ExistingPid"
        Write-Host "URL: http://${HostName}:$Port"
        exit 0
    }
    Remove-Item $PidFile -Force
}

$env:NEIA_CONTENT_ROOT = $FrameworkRoot
$env:NEIA_REGISTRY_DIR = Join-Path $FrameworkRoot "apps\registry"
$env:NEIA_INSTALLED_FILE = $InstalledFile
$env:NEIA_STATE_DIR = $StateDir
$env:NEIA_LOG_DIR = $LogDir
$env:NEIA_RUN_DIR = $RunDir
$env:NEIA_WORKFLOWS_DIR = if ($env:NEIA_WORKFLOWS_DIR) { $env:NEIA_WORKFLOWS_DIR } else { Join-Path $FrameworkRoot "workflows" }
$env:NEIA_HOST = $HostName
$env:NEIA_PORT = [string]$Port

$StartParameters = @{
    FilePath = $PythonBin
    ArgumentList = @("-m", "app.daemon", "--host", $HostName, "--port", [string]$Port)
    WorkingDirectory = Join-Path $FrameworkRoot "neia-api"
    RedirectStandardOutput = $LogFile
    RedirectStandardError = $ErrorLogFile
    WindowStyle = "Hidden"
    PassThru = $true
}
$Process = Start-Process @StartParameters
Set-Content -Path $PidFile -Value $Process.Id -Encoding ascii

Write-Host "Started NEIA daemon"
Write-Host "PID: $($Process.Id)"
Write-Host "URL: http://${HostName}:$Port"
Write-Host "Log: $LogFile"
