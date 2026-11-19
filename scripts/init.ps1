$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (!(Test-Path -LiteralPath '.env')) {
  $content = Get-Content -LiteralPath '.env.example' -Raw
  $demoPass = 'Local-' + [guid]::NewGuid().ToString('N') + '!'
  $dbPass = [guid]::NewGuid().ToString('N')
  $rootPass = [guid]::NewGuid().ToString('N')
  $content.Replace('DEMO_PASSWORD=', 'DEMO_PASSWORD=' + $demoPass).Replace('local-only-change-me',$dbPass).Replace('local-root-change-me',$rootPass) | Set-Content -LiteralPath '.env' -Encoding utf8
}
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { throw 'Docker Compose 啟動失敗，請先確認 Docker Desktop 正在運作。' }
Write-Host 'OpsFlow 已啟動：http://localhost:3000。Demo 密碼位於 .env 的 DEMO_PASSWORD。'
