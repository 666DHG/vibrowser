param([switch]$Browser)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$runtimePath = Join-Path $root '.data/runtime.json'
if (Test-Path -LiteralPath $runtimePath) {
  $runtime = Get-Content -LiteralPath $runtimePath -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($runtime.root -and [IO.Path]::GetFullPath($runtime.root) -eq [IO.Path]::GetFullPath($root)) {
    $env:VIBROWSER_DB_PORT = [string]$runtime.dbPort
    $env:VIBROWSER_API_PORT = [string]$runtime.apiPort
    $env:VIBROWSER_UI_PORT = [string]$runtime.uiPort
  }
}
& (Join-Path $PSScriptRoot 'database.ps1') start
& (Join-Path $PSScriptRoot 'sbt.ps1') scalafmtCheckAll test
Push-Location (Join-Path $root 'frontend')
try {
  & npm.cmd run format:check
  if ($LASTEXITCODE -ne 0) { throw 'Frontend formatting failed' }
  & npm.cmd test
  if ($LASTEXITCODE -ne 0) { throw 'Frontend tests failed' }
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
  if ($Browser) {
    $env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $root '.cache\playwright'
    & npx.cmd playwright install chromium
    if ($LASTEXITCODE -ne 0) { throw 'Browser installation failed' }
    & node --test tools/measure.test.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Layout measurement tests failed' }
    & npm.cmd run test:e2e
    if ($LASTEXITCODE -ne 0) { throw 'Browser smoke failed' }
  }
} finally { Pop-Location }
