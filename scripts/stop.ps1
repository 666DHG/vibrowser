$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$runtimePath = Join-Path $root '.data\runtime.json'
if (Test-Path -LiteralPath $runtimePath) {
  $runtime = Get-Content -LiteralPath $runtimePath -Encoding UTF8 -Raw | ConvertFrom-Json
  if ($runtime.root) {
    if ([IO.Path]::GetFullPath($runtime.root) -ne [IO.Path]::GetFullPath($root)) { throw 'Runtime belongs to another worktree' }
    $records = $runtime.processes
    $env:VIBROWSER_DB_PORT = [string]$runtime.dbPort
  } else { $records = $runtime }
  foreach ($record in $records) {
    $process = Get-Process -Id $record.id -ErrorAction SilentlyContinue
    $expectedStart = ([DateTime]$record.started).ToUniversalTime()
    if ($process -and $process.StartTime.ToUniversalTime().Ticks -eq $expectedStart.Ticks) {
      Stop-Process -Id $process.Id -Force
      $process.WaitForExit(5000) | Out-Null
    }
  }
}
$ports = if ($runtime -and $runtime.root) { @($runtime.apiPort,$runtime.uiPort) } else { @(8787,5173) }
foreach ($port in $ports) {
  $client = [System.Net.Sockets.TcpClient]::new()
  $listening = $false
  try { $client.Connect('127.0.0.1', $port); $listening = $true } catch {} finally { $client.Dispose() }
  if ($listening) { throw "Port $port remains active. The process may belong to another session; stop it from its original terminal. No unrelated process was killed." }
}
& (Join-Path $PSScriptRoot 'database.ps1') stop
if (Test-Path -LiteralPath $runtimePath) { Remove-Item -LiteralPath $runtimePath }
Write-Output 'Stopped only the recorded Vibrowser processes and its project-local PostgreSQL instance.'
