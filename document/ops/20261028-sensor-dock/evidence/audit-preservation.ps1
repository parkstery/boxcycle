$ErrorActionPreference = 'Stop'
Set-Location 'C:\20.HDev\boxcycle'
$baseline = Get-Content -Raw 'document/ops/20261028-sensor-dock/evidence/baseline.json' | ConvertFrom-Json
$changed = @()
$missing = @()
foreach ($entry in $baseline) {
  if (!(Test-Path -LiteralPath $entry.path)) { $missing += $entry.path; continue }
  $actual = (Get-FileHash -LiteralPath $entry.path -Algorithm SHA256).Hash
  if ($actual -ne $entry.hash) { $changed += $entry.path }
}
$report = [ordered]@{
  baselineCount = $baseline.Count
  changed = $changed
  missing = $missing
  protectedMediaChanged = @($changed | Where-Object { $_ -match '\.(png|jpg)$' })
}
$report | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 'document/ops/20261028-sensor-dock/evidence/preservation-review.json'
$report | ConvertTo-Json -Depth 4
