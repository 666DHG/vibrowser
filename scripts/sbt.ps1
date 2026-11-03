param([Parameter(ValueFromRemainingArguments=$true)][string[]]$SbtArguments = @('run'))
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$cache = Join-Path $root '.cache'
New-Item -ItemType Directory -Force $cache | Out-Null
New-Item -ItemType Directory -Force (Join-Path $cache 'tmp') | Out-Null
$launcher = Join-Path $cache 'sbt-launch-1.11.7.jar'
if (-not (Test-Path -LiteralPath $launcher)) {
  Invoke-WebRequest 'https://repo.maven.apache.org/maven2/org/scala-sbt/sbt-launch/1.11.7/sbt-launch-1.11.7.jar' -OutFile $launcher
}
Push-Location (Join-Path $root 'backend')
$env:COURSIER_CACHE = Join-Path $cache 'coursier'
try {
  & java '-XX:ActiveProcessorCount=4' '-Xmx1536m' "-Djava.io.tmpdir=$cache/tmp" "-Dsbt.boot.directory=$cache/sbt/boot" "-Dsbt.global.base=$cache/sbt/global" "-Dsbt.ivy.home=$cache/ivy" '-Dsbt.supershell=false' '-Dsbt.server.autostart=false' -jar $launcher @SbtArguments
  if ($LASTEXITCODE -ne 0) { throw "sbt failed: $LASTEXITCODE" }
} finally { Pop-Location }
