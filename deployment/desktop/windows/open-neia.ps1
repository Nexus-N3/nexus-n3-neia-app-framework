[CmdletBinding()]
param(
    [string]$HostName = $(if ($env:NEIA_HOST) { $env:NEIA_HOST } else { "127.0.0.1" }),
    [int]$Port = $(if ($env:NEIA_PORT) { [int]$env:NEIA_PORT } else { 8080 }),
    [string]$TaskName = $(if ($env:NEIA_TASK_NAME) { $env:NEIA_TASK_NAME } else { "Nexus N3 NEIA" })
)

$Task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($Task -and $Task.State -ne "Running") {
    Start-ScheduledTask -TaskName $TaskName
}

Start-Process "http://${HostName}:$Port"
