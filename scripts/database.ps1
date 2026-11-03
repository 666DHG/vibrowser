param([ValidateSet('start','stop','status')][string]$Action = 'start')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$bin = if ($env:VIBROWSER_PG_BIN) { $env:VIBROWSER_PG_BIN } else { 'D:\Installs\PostgreSQL\16\bin' }
$data = Join-Path $root '.data\postgres'
$port = 55432
if ($Action -eq 'start') {
  if (-not (Test-Path -LiteralPath (Join-Path $data 'PG_VERSION'))) {
    New-Item -ItemType Directory -Force (Split-Path $data) | Out-Null
    & (Join-Path $bin 'initdb.exe') -D $data -U vibrowser --encoding=UTF8 --locale=C --auth=trust
    if ($LASTEXITCODE -ne 0) { throw 'initdb failed' }
    Add-Content -LiteralPath (Join-Path $data 'postgresql.conf') -Encoding UTF8 -Value "`nlisten_addresses = '127.0.0.1'`nport = $port`n"
  }
  & (Join-Path $bin 'pg_ctl.exe') -D $data status *> $null
  if ($LASTEXITCODE -ne 0) {
    & (Join-Path $bin 'pg_ctl.exe') -D $data -l (Join-Path $root '.data\postgres.log') -w start
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL start failed' }
  }
  $exists = & (Join-Path $bin 'psql.exe') -h 127.0.0.1 -p $port -U vibrowser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='vibrowser'"
  if ($exists -ne '1') {
    & (Join-Path $bin 'createdb.exe') -h 127.0.0.1 -p $port -U vibrowser vibrowser
    if ($LASTEXITCODE -ne 0) { throw 'createdb failed' }
  }
} elseif ($Action -eq 'stop') {
  & (Join-Path $bin 'pg_ctl.exe') -D $data -m fast -w stop
} else {
  & (Join-Path $bin 'pg_ctl.exe') -D $data status
}
