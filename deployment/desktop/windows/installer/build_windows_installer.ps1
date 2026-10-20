[CmdletBinding()]
param(
    [string]$Version = "",
    [string]$OutputDir = "",
    [string]$PythonBin = "python.exe",
    [string]$IsccPath = "",
    [switch]$SkipUiBuild,
    [switch]$SkipApiBuild
)

$ErrorActionPreference = "Stop"
$InstallerDir = $PSScriptRoot
$WindowsDir = Split-Path -Parent $InstallerDir
$DesktopDir = Split-Path -Parent $WindowsDir
$FrameworkRoot = [System.IO.Path]::GetFullPath((Join-Path $InstallerDir "..\..\..\.."))
$BuildRoot = Join-Path $DesktopDir ".build\windows-installer"
$StageRoot = Join-Path $BuildRoot "payload"
$GeneratedIss = Join-Path $BuildRoot "neia.iss"
if (-not $OutputDir) { $OutputDir = Join-Path $WindowsDir "dist" }
$OutputDir = [System.IO.Path]::GetFullPath($OutputDir)

if (-not (Get-Command robocopy.exe -ErrorAction SilentlyContinue)) {
    throw "robocopy.exe is required."
}
if (-not (Get-Command $PythonBin -ErrorAction SilentlyContinue)) {
    throw "Python executable not found: $PythonBin"
}
if (-not $IsccPath) {
    $Candidates = @()
    if ($env:LOCALAPPDATA) {
        $Candidates += Join-Path $env:LOCALAPPDATA "Programs\Inno Setup 6\ISCC.exe"
    }
    if (${env:ProgramFiles(x86)}) {
        $Candidates += Join-Path ${env:ProgramFiles(x86)} "Inno Setup 6\ISCC.exe"
    }
    if ($env:ProgramFiles) {
        $Candidates += Join-Path $env:ProgramFiles "Inno Setup 6\ISCC.exe"
    }
    $IsccPath = $Candidates | Where-Object { $_ -and (Test-Path $_ -PathType Leaf) } | Select-Object -First 1
}
if (-not $IsccPath -or -not (Test-Path $IsccPath -PathType Leaf)) {
    throw "Inno Setup 6 compiler (ISCC.exe) was not found. Install Inno Setup or pass -IsccPath."
}

if (-not $SkipUiBuild) {
    if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
        throw "npm.cmd is required to build neia-ui."
    }
    Push-Location (Join-Path $FrameworkRoot "neia-ui")
    try {
        & npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw "NEIA UI build failed with exit code $LASTEXITCODE" }
    }
    finally { Pop-Location }
}
if (-not (Test-Path (Join-Path $FrameworkRoot "neia-ui\dist\index.html") -PathType Leaf)) {
    throw "Missing neia-ui\dist\index.html."
}

if (-not $SkipApiBuild) {
    Push-Location (Join-Path $FrameworkRoot "neia-api")
    try {
        & $PythonBin -m build --wheel
        if ($LASTEXITCODE -ne 0) { throw "NEIA API wheel build failed with exit code $LASTEXITCODE" }
    }
    finally { Pop-Location }
}
if (-not (Get-ChildItem (Join-Path $FrameworkRoot "neia-api\dist\*.whl") -ErrorAction SilentlyContinue | Select-Object -First 1)) {
    throw "Missing neia-api wheel under neia-api\dist."
}

if (-not $Version) {
    $ProjectConfig = Get-Content (Join-Path $FrameworkRoot "neia-api\pyproject.toml") -Raw
    if ($ProjectConfig -notmatch '(?m)^version\s*=\s*"([^"]+)"') {
        throw "Could not determine the package version from neia-api\pyproject.toml."
    }
    $Version = $Matches[1]
}

if (Test-Path $BuildRoot) { Remove-Item $BuildRoot -Recurse -Force }
New-Item -ItemType Directory -Force -Path $StageRoot, $OutputDir | Out-Null

function Copy-PayloadTree {
    param([string]$RelativePath, [string[]]$ExcludeDirectories = @())
    $Source = Join-Path $FrameworkRoot $RelativePath
    $Destination = Join-Path $StageRoot $RelativePath
    if (-not (Test-Path $Source)) { return }
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    $Arguments = @($Source, $Destination, "/MIR", "/R:2", "/W:1", "/NFL", "/NDL", "/NJH", "/NJS", "/NP")
    if ($ExcludeDirectories.Count -gt 0) {
        $Arguments += "/XD"
        $Arguments += $ExcludeDirectories
    }
    & robocopy.exe @Arguments
    if ($LASTEXITCODE -ge 8) {
        throw "robocopy failed for $RelativePath with exit code $LASTEXITCODE"
    }
}

Copy-PayloadTree "apps" @("node_modules", "src", ".vite")
Copy-PayloadTree "shared" @("node_modules")
Copy-PayloadTree "neia-api" @(".venv", ".pytest_cache", "__pycache__", "build")
Copy-PayloadTree "neia-ui\dist"
Copy-PayloadTree "docs"
Copy-PayloadTree "models" @("ollama")
Copy-PayloadTree "workflows"
Copy-PayloadTree "deployment\desktop\windows" @("installer", "dist", ".build")

$Template = Get-Content (Join-Path $InstallerDir "neia.iss.template") -Raw
$Rendered = $Template.Replace("@APP_VERSION@", $Version)
$Rendered = $Rendered.Replace("@STAGE_ROOT@", $StageRoot)
$Rendered = $Rendered.Replace("@OUTPUT_DIR@", $OutputDir)
[System.IO.File]::WriteAllText($GeneratedIss, $Rendered, [System.Text.UTF8Encoding]::new($false))

& $IsccPath $GeneratedIss
if ($LASTEXITCODE -ne 0) { throw "Inno Setup failed with exit code $LASTEXITCODE" }

$InstallerPath = Join-Path $OutputDir "Nexus-N3-NEIA-Setup-$Version.exe"
if (-not (Test-Path $InstallerPath -PathType Leaf)) {
    throw "Inno Setup completed without producing $InstallerPath"
}
Write-Host "Built Windows installer:"
Write-Host "  $InstallerPath"
