<#
  Danchi: send this project from the laptop to the mini PC and set it up there.

  Usage (PowerShell, in E:\DANCHI PROJECT):
      .\deploy\push-to-minipc.ps1 rafi@192.168.1.50
      .\deploy\push-to-minipc.ps1 rafi@minipc -Update      # later updates (faster)

  Needs: SSH access to the mini PC (Windows has ssh/scp/tar built in).
  Your laptop .env is NOT copied; the mini PC gets its own with fresh secrets.
#>
param(
  [Parameter(Mandatory = $true)][string]$Target,
  [string]$Dir = "danchi",
  [switch]$Update
)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$tgz = Join-Path $env:TEMP "danchi-deploy.tgz"
if (Test-Path $tgz) { Remove-Item $tgz }

Write-Host "🍑 Packing Danchi..." -ForegroundColor Magenta
tar -czf $tgz --exclude=node_modules --exclude=.next --exclude=.env --exclude=.git --exclude=tsconfig.tsbuildinfo --exclude=*.log .
if ($LASTEXITCODE -ne 0) { throw "tar failed" }
Write-Host ("   {0:N1} MB" -f ((Get-Item $tgz).Length / 1MB))

Write-Host "🍑 Sending to $Target ..." -ForegroundColor Magenta
ssh $Target "mkdir -p ~/$Dir"
if ($LASTEXITCODE -ne 0) { throw "Can't reach $Target over SSH" }
scp $tgz "${Target}:~/$Dir/danchi-deploy.tgz"
if ($LASTEXITCODE -ne 0) { throw "scp failed" }

$script = if ($Update) { "deploy/update.sh" } else { "deploy/setup-minipc.sh" }
Write-Host "🍑 Setting up on the mini PC ($script)..." -ForegroundColor Magenta
Write-Host "   (if it asks for a password, type your mini PC password, it won't show while typing)" -ForegroundColor DarkGray
ssh -t $Target "cd ~/$Dir && tar -xzf danchi-deploy.tgz && rm danchi-deploy.tgz && sed -i 's/\r$//' deploy/*.sh scripts/*.sh && script -q -e -c 'bash $script' deploy-setup.log"
$code = $LASTEXITCODE
Remove-Item $tgz -ErrorAction SilentlyContinue
# Keep a copy of what happened next to this script
scp -q "${Target}:~/$Dir/deploy-setup.log" "deploy\setup.log" 2>$null
if ($code -ne 0) { Write-Host "Something went wrong (exit $code). See deploy\setup.log" -ForegroundColor Red; exit $code }
Write-Host "🌼 Done! Open https://danchi.rafiarsya.com" -ForegroundColor Green
