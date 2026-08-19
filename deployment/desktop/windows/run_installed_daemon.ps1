[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$InstallRoot = $PSScriptRoot
$EnvFile = Join-Path $InstallRoot ".env"

if (Test-Path $EnvFile) {
    foreach ($Line in Get-Content $EnvFile) {
        if ($Line -match '^\s*([^#][^=]*)=(.*)$') {
            $Name = $Matches[1].Trim()
            $Value = $Matches[2].Trim().Trim('"').Trim("'")
            Set-Item -Path "Env:$Name" -Value $Value
        }
    }
}

$PythonBin = Join-Path $InstallRoot ".venv\Scripts\python.exe"
$HostName = if ($env:NEIA_HOST) { $env:NEIA_HOST } else { "127.0.0.1" }
$Port = if ($env:NEIA_PORT) { [int]$env:NEIA_PORT } else { 8080 }
$LogDir = if ($env:NEIA_LOG_DIR) { $env:NEIA_LOG_DIR } else { Join-Path $env:ProgramData "Nexus N3 NEIA\logs" }
$LogFile = Join-Path $LogDir "neia-daemon.log"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
Set-Location (Join-Path $InstallRoot "neia-api")
& $PythonBin -m app.daemon --host $HostName --port $Port *>> $LogFile
exit $LASTEXITCODE
