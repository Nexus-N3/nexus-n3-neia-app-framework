[CmdletBinding()]
param(
    [string]$InstallRoot = $(Join-Path $env:ProgramFiles "Nexus N3 NEIA"),
    [string]$DataRoot = $(Join-Path $env:ProgramData "Nexus N3 NEIA"),
    [string]$PythonBin = "python.exe",
    [string]$HostName = "127.0.0.1",
    [int]$Port = 8080,
    [string]$TaskName = "Nexus N3 NEIA",
    [switch]$NoStart,
    [switch]$ForceEnv,
    [switch]$RebuildVenv,
    [switch]$SkipUiBuild,
    [switch]$SkipPayloadCopy
)

$ErrorActionPreference = "Stop"
$Identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$Principal = [Security.Principal.WindowsPrincipal]::new($Identity)
if (-not $Principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run this installer from an elevated PowerShell window."
}

$FrameworkRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\.."))
$StateDir = Join-Path $DataRoot "state"
$LogDir = Join-Path $DataRoot "logs"
$RunDir = Join-Path $DataRoot "run"
$WorkflowsDir = Join-Path $StateDir "workflows"
$InstalledFile = Join-Path $StateDir "installed.json"
$VenvRoot = Join-Path $InstallRoot ".venv"
$VenvPython = Join-Path $VenvRoot "Scripts\python.exe"
$EnvFile = Join-Path $InstallRoot ".env"
$OpenScript = Join-Path $InstallRoot "open-neia.ps1"
$RunnerScript = Join-Path $InstallRoot "run-installed-daemon.ps1"
$UserDesktop = [Environment]::GetFolderPath("DesktopDirectory")
$ShortcutPath = Join-Path $UserDesktop "Nexus N3 NEIA.lnk"

if (-not (Get-Command $PythonBin -ErrorAction SilentlyContinue)) {
    throw "Python executable not found: $PythonBin"
}
if (-not (Get-Command robocopy.exe -ErrorAction SilentlyContinue)) {
    throw "robocopy.exe is required."
}

if (-not $SkipUiBuild) {
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

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
}

New-Item -ItemType Directory -Force -Path $InstallRoot, $StateDir, $LogDir, $RunDir, $WorkflowsDir | Out-Null

function Copy-DeploymentTree {
    param([string]$RelativePath, [string[]]$ExcludeDirectories = @())
    $Source = Join-Path $FrameworkRoot $RelativePath
    $Destination = Join-Path $InstallRoot $RelativePath
    if (-not (Test-Path $Source)) { return }
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    $Arguments = @($Source, $Destination, "/MIR", "/NFL", "/NDL", "/NJH", "/NJS", "/NP")
    if ($ExcludeDirectories.Count -gt 0) {
        $Arguments += "/XD"
        $Arguments += $ExcludeDirectories
    }
    & robocopy.exe @Arguments
    if ($LASTEXITCODE -ge 8) {
        throw "robocopy failed for $RelativePath with exit code $LASTEXITCODE"
    }
}

if (-not $SkipPayloadCopy) {
    Copy-DeploymentTree "apps" @("node_modules", "src", ".vite")
    Copy-DeploymentTree "shared" @("node_modules")
    Copy-DeploymentTree "neia-api" @(".venv", ".pytest_cache", "__pycache__")
    Copy-DeploymentTree "neia-ui\dist"
    Copy-DeploymentTree "docs"
    Copy-DeploymentTree "models" @("ollama")
    Copy-DeploymentTree "workflows"
}
Copy-Item (Join-Path $PSScriptRoot "open-neia.ps1") $OpenScript -Force
Copy-Item (Join-Path $PSScriptRoot "run_installed_daemon.ps1") $RunnerScript -Force
Copy-Item (Join-Path $PSScriptRoot "uninstall_windows_desktop.ps1") (Join-Path $InstallRoot "uninstall_windows_desktop.ps1") -Force

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
if (-not (Get-ChildItem $WorkflowsDir -Force -ErrorAction SilentlyContinue | Select-Object -First 1)) {
    Copy-Item (Join-Path $FrameworkRoot "workflows\*") $WorkflowsDir -Recurse -Force
}

if ($RebuildVenv -and (Test-Path $VenvRoot)) {
    Remove-Item $VenvRoot -Recurse -Force
}
if (-not (Test-Path $VenvPython -PathType Leaf)) {
    & $PythonBin -m venv $VenvRoot
    if ($LASTEXITCODE -ne 0) { throw "Failed to create Python virtual environment." }
}
& $VenvPython -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) { throw "Failed to upgrade pip." }
$Wheel = Get-ChildItem (Join-Path $InstallRoot "neia-api\dist\*.whl") -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTimeUtc |
    Select-Object -Last 1
if ($Wheel) {
    & $VenvPython -m pip install --force-reinstall $Wheel.FullName
}
else {
    & $VenvPython -m pip install --force-reinstall (Join-Path $InstallRoot "neia-api")
}
if ($LASTEXITCODE -ne 0) { throw "Failed to install NEIA API." }

if ($ForceEnv -or -not (Test-Path $EnvFile)) {
    $EnvLines = @(
        "NEIA_HOST=$HostName"
        "NEIA_PORT=$Port"
        "NEIA_DEV=0"
        "NEIA_DEV_FALLBACK=0"
        "NEIA_GATEWAY=zeromq"
        "NEIA_SITE=lab"
        ('NEIA_CONTENT_ROOT="{0}"' -f $InstallRoot)
        ('NEIA_REGISTRY_DIR="{0}"' -f (Join-Path $InstallRoot "apps\registry"))
        ('NEIA_INSTALLED_FILE="{0}"' -f $InstalledFile)
        ('NEIA_STATE_DIR="{0}"' -f $StateDir)
        ('NEIA_LOG_DIR="{0}"' -f $LogDir)
        ('NEIA_RUN_DIR="{0}"' -f $RunDir)
        ('NEIA_WORKFLOWS_DIR="{0}"' -f $WorkflowsDir)
    )
    [System.IO.File]::WriteAllLines($EnvFile, $EnvLines, [System.Text.UTF8Encoding]::new($false))
}
elseif (-not (Select-String -Path $EnvFile -Pattern '^NEIA_WORKFLOWS_DIR=' -Quiet)) {
    [System.IO.File]::AppendAllText(
        $EnvFile,
        [Environment]::NewLine + ('NEIA_WORKFLOWS_DIR="{0}"' -f $WorkflowsDir) + [Environment]::NewLine,
        [System.Text.UTF8Encoding]::new($false)
    )
}

$PowerShellExe = (Get-Process -Id $PID).Path
$TaskArguments = "-NoProfile -ExecutionPolicy Bypass -File `"$RunnerScript`""
$Action = New-ScheduledTaskAction -Execute $PowerShellExe -Argument $TaskArguments -WorkingDirectory (Join-Path $InstallRoot "neia-api")
$Trigger = New-ScheduledTaskTrigger -AtLogOn -User $Identity.Name
$TaskPrincipal = New-ScheduledTaskPrincipal -UserId $Identity.Name -LogonType Interactive -RunLevel Highest
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $TaskPrincipal -Settings $Settings -Force | Out-Null

$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $PowerShellExe
$Shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$OpenScript`" -HostName $HostName -Port $Port -TaskName `"$TaskName`""
$Shortcut.WorkingDirectory = $InstallRoot
$Shortcut.Save()

if (-not $NoStart) {
    Start-ScheduledTask -TaskName $TaskName
}

Write-Host "Installed Nexus N3 NEIA desktop daemon"
Write-Host "Task: $TaskName"
Write-Host "Shortcut: $ShortcutPath"
Write-Host "URL: http://${HostName}:$Port"
