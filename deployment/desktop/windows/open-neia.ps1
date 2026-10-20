[CmdletBinding()]
param(
    [string]$HostName = $(if ($env:NEIA_HOST) { $env:NEIA_HOST } else { "127.0.0.1" }),
    [int]$Port = $(if ($env:NEIA_PORT) { [int]$env:NEIA_PORT } else { 8080 }),
    [string]$TaskName = $(if ($env:NEIA_TASK_NAME) { $env:NEIA_TASK_NAME } else { "Nexus N3 NEIA" })
)

function Test-NeiaPort {
    $Client = [Net.Sockets.TcpClient]::new()
    try {
        $Connection = $Client.BeginConnect($HostName, $Port, $null, $null)
        if (-not $Connection.AsyncWaitHandle.WaitOne(250, $false)) { return $false }
        $Client.EndConnect($Connection)
        return $true
    }
    catch { return $false }
    finally { $Client.Dispose() }
}

if (-not (Test-NeiaPort)) {
    $Task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($Task -and $Task.State -ne "Running") {
        Start-ScheduledTask -TaskName $TaskName
    }
    elseif (-not $Task) {
        $RunnerScript = Join-Path $PSScriptRoot "run-installed-daemon.ps1"
        $PowerShellExe = (Get-Process -Id $PID).Path
        Start-Process `
            -FilePath $PowerShellExe `
            -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$RunnerScript`"") `
            -WorkingDirectory $PSScriptRoot `
            -WindowStyle Hidden
    }

    $Deadline = [DateTime]::UtcNow.AddSeconds(30)
    while ([DateTime]::UtcNow -lt $Deadline -and -not (Test-NeiaPort)) {
        Start-Sleep -Milliseconds 200
    }
}

Start-Process "http://${HostName}:$Port"
