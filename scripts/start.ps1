param([switch]$Mock, [switch]$Wait, [switch]$SkipBuild,
  [ValidateRange(1024,65535)][int]$UiPort = 5173,
  [ValidateRange(1024,65535)][int]$ApiPort = 8787,
  [ValidateRange(1024,65535)][int]$DbPort = 55432)
if (@($UiPort,$ApiPort,$DbPort | Select-Object -Unique).Count -ne 3) { throw 'Ports must be distinct' }
$env:VIBROWSER_UI_PORT = [string]$UiPort
$env:VIBROWSER_API_PORT = [string]$ApiPort
$env:VIBROWSER_DB_PORT = [string]$DbPort
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$runtimePath = Join-Path $root '.data\runtime.json'
function Test-Port([int]$Port) {
  $client = [System.Net.Sockets.TcpClient]::new()
  try { $client.Connect('127.0.0.1', $Port); return $true } catch { return $false } finally { $client.Dispose() }
}
if ((Test-Port $ApiPort) -or (Test-Port $UiPort)) { throw "Port $ApiPort or $UiPort is occupied. No process will be stopped." }
if (-not (Test-Path -LiteralPath (Join-Path $root 'frontend\node_modules'))) {
  Push-Location (Join-Path $root 'frontend')
  try { & npm.cmd ci; if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' } } finally { Pop-Location }
}
if (-not $SkipBuild -or -not (Test-Path -LiteralPath (Join-Path $root '.cache\runtime-classpath.txt'))) {
  & (Join-Path $PSScriptRoot 'sbt.ps1') compile writeRuntimeClasspath
}
Push-Location (Join-Path $root 'frontend')
try {
  & npm.cmd run build:measure
  if ($LASTEXITCODE -ne 0) { throw 'Layout measurement build failed' }
  $env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $root '.cache\playwright'
  & npx.cmd playwright install chromium
  if ($LASTEXITCODE -ne 0) { Write-Warning 'Chromium unavailable; optional layout review will fall back to the validated page.' }
} finally { Pop-Location }
& (Join-Path $PSScriptRoot 'database.ps1') start
if ($Mock) { $env:VIBROWSER_MOCK = 'true' } else { Remove-Item Env:VIBROWSER_MOCK -ErrorAction SilentlyContinue }
$classpath = (Get-Content -LiteralPath (Join-Path $root '.cache\runtime-classpath.txt') -Encoding UTF8 -Raw).Trim()
$javaPath = (Get-Command java).Source
$nodePath = (Get-Command node).Source
$javaArgs = @('-XX:ActiveProcessorCount=4','-Xmx768m','--enable-native-access=ALL-UNNAMED',('-Djna.tmpdir="{0}"' -f (Join-Path $root '.cache\tmp')), '-cp', ('"' + $classpath + '"'), 'services.system.Main')
$backend = Start-Process -FilePath $javaPath -ArgumentList $javaArgs -WorkingDirectory (Join-Path $root 'backend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $root '.data\backend.log') -RedirectStandardError (Join-Path $root '.data\backend-error.log')
$frontend = $null
try {
  $vitePath = Join-Path $root 'frontend\node_modules\vite\bin\vite.js'
  $frontend = Start-Process -FilePath $nodePath -ArgumentList @(('"' + $vitePath + '"'),'--host','127.0.0.1') -WorkingDirectory (Join-Path $root 'frontend') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $root '.data\frontend.log') -RedirectStandardError (Join-Path $root '.data\frontend-error.log')
  $processes = @($backend,$frontend) | ForEach-Object { @{ id=$_.Id; started=$_.StartTime.ToUniversalTime().ToString('o') } }
  @{ root=$root; uiPort=$UiPort; apiPort=$ApiPort; dbPort=$DbPort; processes=$processes } | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $runtimePath -Encoding UTF8
  $ready=$false
  foreach ($attempt in 1..40) {
    if ($backend.HasExited -or $frontend.HasExited) { throw 'A service exited. Read .data/backend-error.log and .data/frontend-error.log.' }
    try {
      $health=Invoke-RestMethod "http://127.0.0.1:$ApiPort/health" -TimeoutSec 1
      $ui=Invoke-WebRequest "http://127.0.0.1:$UiPort/" -TimeoutSec 1 -UseBasicParsing
      if ($health.status -eq 'ok' -and $ui.StatusCode -eq 200) { $ready=$true; break }
    } catch { Start-Sleep -Milliseconds 500 }
  }
  if (-not $ready) { throw 'Services did not become ready. See .data logs.' }
  Write-Output ("Vibrowser ready: http://127.0.0.1:$UiPort/ | mode=" + $(if ($Mock) { 'MOCK (not real AI)' } else { 'LIVE (configure API in Settings)' }))
  if ($Wait) { Wait-Process -Id $backend.Id,$frontend.Id }
} catch {
  if ($frontend -and -not $frontend.HasExited) { Stop-Process -Id $frontend.Id -Force -ErrorAction SilentlyContinue }
  if (-not $backend.HasExited) { Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue }
  throw
} finally {
  if ($Wait) { & (Join-Path $PSScriptRoot 'stop.ps1') }
}
