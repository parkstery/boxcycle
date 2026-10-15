$ErrorActionPreference = 'Stop'
$site = 'https://boxcycle-dc2df.web.app'
$dist = 'C:/20.HDev/boxcycle/apps/web/dist'
$response = Invoke-WebRequest -Uri ($site + '/') -Headers @{ 'Cache-Control' = 'no-cache' } -TimeoutSec 40
$html = [string]$response.Content
$localHtml = [System.IO.File]::ReadAllText((Join-Path $dist 'index.html'))
if ($html -cne $localHtml) { throw 'Published index.html differs from current local production build.' }
$paths = [regex]::Matches($html, '(?:src|href)="(/assets/[^"]+)"') | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique
if ($paths.Count -lt 2) { throw 'Expected JavaScript and stylesheet references.' }
$client = [System.Net.Http.HttpClient]::new()
$checks = @()
try {
  foreach ($asset in $paths) {
    $remote = $client.GetByteArrayAsync($site + $asset).GetAwaiter().GetResult()
    $local = [System.IO.File]::ReadAllBytes((Join-Path $dist $asset.TrimStart('/')))
    $remoteHash = [Convert]::ToHexString([System.Security.Cryptography.SHA256]::HashData($remote))
    $localHash = [Convert]::ToHexString([System.Security.Cryptography.SHA256]::HashData($local))
    if ($remoteHash -ne $localHash) { throw "Published asset differs: $asset" }
    $checks += [pscustomobject]@{ path = $asset; bytes = $remote.Length; sha256 = $remoteHash; matches = $true }
  }
} finally { $client.Dispose() }
$result = [pscustomobject]@{ PASS = $true; url = $site; status = [int]$response.StatusCode; indexMatches = $true; assets = $checks; checkedAtUtc = [DateTime]::UtcNow.ToString('o') }
$result | ConvertTo-Json -Depth 4 | Set-Content 'C:/20.HDev/boxcycle/document/ops/20261013-face-redesign2/hosting-verify-71.json'
$result | ConvertTo-Json -Depth 4
