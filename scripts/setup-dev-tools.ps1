<#
.SYNOPSIS
    Obsidian 볼트 연결·안내 노트·문서 게이트 확인.
.DESCRIPTION
    볼트 document junction을 저장소 문서에 연결한다. 전역 모델·권한 설정은 변경하지 않는다.
    기존 볼트와 안내 노트는 덮어쓰지 않는다.
#>
[CmdletBinding()]
param([switch]$SkipGates)
$ErrorActionPreference = 'Stop'
$repoRoot = 'C:\20.HDev\boxcycle'
$vault = 'C:\20.HDev\spinatlas-vault'
$repoDocs = Join-Path $repoRoot 'document'
function Say([string]$Message) { Write-Host "[setup] $Message" }
function Step([string]$Title) { Write-Host "`n[setup] === $Title ===" }
function Write-NoBom([string]$Path, [string]$Text) {
    [System.IO.File]::WriteAllText($Path, $Text, (New-Object System.Text.UTF8Encoding($false)))
}

# ── 2. Obsidian 볼트 바로가기 ──────────────────────────────
Step '1. Obsidian 볼트 연결 (바로가기)'
if (-not (Test-Path -LiteralPath $vault)) {
    New-Item -ItemType Directory -Path $vault -Force | Out-Null
    Say "볼트 폴더 생성: $vault"
}
$link = Join-Path $vault 'document'
if (Test-Path -LiteralPath $link) {
    Say "이미 있음: $link"
} else {
    New-Item -ItemType Junction -Path $link -Target $repoDocs | Out-Null
    Say "바로가기 생성: $link -> $repoDocs"
}
try {
    $count = (Get-ChildItem -LiteralPath (Join-Path $link 'reference\operations') -File -ErrorAction Stop | Measure-Object).Count
    Say "바로가기 확인 — reference\operations 파일 $count 개 보임"
} catch {
    Say "바로가기 확인 실패: $($_.Exception.Message)"
}

# ── 3. 볼트 안내 노트 ─────────────────────────────────────
Step '2. 볼트 안내 노트'
$notePath = Join-Path $vault '00-Spinatlas-시작.md'
if (Test-Path -LiteralPath $notePath) {
    Say "이미 있음: $notePath"
} else {
    $note = @'
# Spinatlas — Obsidian 시작

| 항목 | 내용 |
|---|---|
| 볼트 | `C:\20.HDev\spinatlas-vault` |
| 문서 정본 | `C:\20.HDev\boxcycle\document` (저장소 안, 1,616개 .md) |
| 연결 | 볼트 안 `document` 바로가기 → 정본. 사본 없음 |

## 먼저 볼 문서

| 볼 것 | 정본 파일 |
|---|---|
| 전체 입구 | `C:\20.HDev\boxcycle\document\README.md` |
| 지금 위치·다음 목표 | `C:\20.HDev\boxcycle\document\260928-RTW-현황판.md` |
| 목표·기능별 진도 | `C:\20.HDev\boxcycle\document\260707-RTW-기능-인벤토리-상태보드.md` |
| 결정 한 줄 | `C:\20.HDev\boxcycle\document\260707-RTW-결정-로그.md` |
| 지금 작업(에이전트) | `document\ops\HANDOFF.md` · `document\ops\PROGRESS.md` · `document\ops\README.md` |
| 기준 문서 23개 | `document\reference\` (product 11 · architecture 3 · operations 9) |

## 주의

- `README.md` 가 95개, `HANDOFF.md` 가 6개다. `[[README]]` 처럼 이름만 쓰는 위키링크는 겹친다 → `[[ops/20261111-rider15-app-integration/README]]` 처럼 경로를 같이 쓴다.
- `document\README.md` 의 "출시 전 확인사항" 링크는 `출시%20전%20확인사항.md`(공백 URL 인코딩)라 Obsidian 에서 안 열린다.
- Obsidian 의 파일 삭제·이름 변경은 곧 git 변경이 된다. 문서 수명 규칙은 `document\260509-BOXCYCLE-문서-생성-및-수정-지침.md` 를 따른다.
- 그래프보다 색인 문서로 navigat 하는 편이 빠르다(ops 묶음 94개 + 종료분은 `document\archive\README.md`).
'@
    Write-NoBom $notePath $note
    Say "안내 노트 작성: $notePath"
}

# ── 4. 문서 게이트 ─────────────────────────────────────────
Step '3. 문서 게이트'
if ($SkipGates) {
    Say '건너뜀(-SkipGates)'
} else {
    Push-Location $repoRoot
    try {
        foreach ($gate in @('scripts/check-document-system.mjs --check', 'scripts/check-dev-tools.mjs --check', 'scripts/handoff-check.mjs')) {
            Write-Host "--- node $gate"
            $out = @(& node ($gate -split ' ') 2>&1)
            $code = $LASTEXITCODE
            $out | Select-Object -First 200 | ForEach-Object { Write-Host "    $_" }
            if ($out.Count -gt 200) { Write-Host "    ... 그 외 $($out.Count - 200)줄 생략" }
            Write-Host "    exit=$code"
        }
    } finally {
        Pop-Location
    }
}

Step '완료'
Say 'Obsidian에서 C:\20.HDev\spinatlas-vault 볼트를 열어 document 문서를 확인한다.'
