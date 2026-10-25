# 결과 79 — Spinatlas 로고(심벌·파비콘) 교체

| 항목 | 값 |
|---|---|
| 지시 | [78-task-spinatlas-logo-replacement.md](78-task-spinatlas-logo-replacement.md) |
| Supervisor | Codex (2026-10-26 02:48 KST 인수) |
| Developer | Cursor CLI |
| 완료 | 2026-10-26 KST |

## 변경 요약

- 정본 자산: `apps/web/public/spinatlas-mark.svg` — `C:\Users\kdrea\Downloads\l-atlas.svg` 를 바이트 동일 복사.
- `SpinatlasMark`: 인라인 SVG 제거 → `/spinatlas-mark.svg` 를 `img`로 참조 (`className`·`alt=""`·`aria-hidden="true"` 유지).
- `apps/web/index.html`: favicon → `/spinatlas-mark.svg`.
- `apps/web/public/favicon.svg`: 삭제(미참조).

## 사용처 (rg)

| 파일 | 용도 |
|---|---|
| `AuthGateCard.tsx` | 로그인 카드 |
| `MenuPanel.tsx` | MENU 머리 |
| `AppIntroScreen.tsx` | 앱 인트로 |
| `SpinatlasMark.tsx` | 공용 컴포넌트 |
| `index.html` | 파비콘 |

`favicon.svg` 참조: `apps/web` 내 0건.

## SHA-256

| 파일 | SHA-256 |
|---|---|
| `C:\Users\kdrea\Downloads\l-atlas.svg` | `DF063EC98749260F512FB9AF36FD225A0B34D8DC01C915569FC7E0CD791D7042` |
| `apps/web/public/spinatlas-mark.svg` | `DF063EC98749260F512FB9AF36FD225A0B34D8DC01C915569FC7E0CD791D7042` |

## 검증 명령·결과

실행 위치: `C:\20.HDev\boxcycle`

| 명령 | 결과 |
|---|---|
| `Get-FileHash -Algorithm SHA256` (원본 vs 배치) | 일치 |
| `rg SpinatlasMark\|favicon apps/web` | 위 사용처만; favicon은 `spinatlas-mark.svg` |
| `cd apps\web && npx eslint src/components/brand/SpinatlasMark.tsx` | exit 0 |
| `cd apps\web && npx tsc -b --noEmit` | exit 0 (build 스크립트 내 포함) |
| `cd apps\web && npm run build` | exit 0, vite build 성공 |
| `git diff --check` | exit 0 (기존 dirty 파일 CRLF 경고만) |

## 범위 밖

- CSS(`*brand-svg` 클래스)·AuthGateCard·MenuPanel·AppIntroScreen TSX 본문·functions·e2e·기존 dirty 8건: **미변경**(로고 작업 범위 외 또는 보존 지시).

## 미수행 (지시 금지)

- 커밋·푸시·배포·worktree·restore·clean·stash·브랜치 전환

## 다음

- Chief 화면 확인.
- 고정16 심벌 형태: [261024-RTW-Chief-지정-디자인-고정.md](../../reference/product/261024-RTW-Chief-지정-디자인-고정.md) #16 **반영 완료** — Supervisor 감리 **PASS**(아래).
- 묶음 ops 다음 새 번호 **80**.

## Supervisor 감리 (Codex, 2026-10-26 KST) — **PASS**

Developer 결과를 Codex가 독립 재검증했다. 제품 코드·public 자산은 감리 중 변경하지 않았다.

### 자산·게이트

| 항목 | 결과 |
|---|---|
| 원본 `C:\Users\kdrea\Downloads\l-atlas.svg` vs `apps/web/public/spinatlas-mark.svg` SHA-256 | `DF063EC98749260F512FB9AF36FD225A0B34D8DC01C915569FC7E0CD791D7042` 동일 |
| `npx eslint` (`SpinatlasMark.tsx`) | exit 0 |
| `npx tsc -b --noEmit` | exit 0 |
| `npm run build` | exit 0 |
| `npm run test:quick` | 1361/1361 |
| `node scripts/check-code-tidy.mjs` | 통과 |
| `node scripts/check-dep-direction.mjs --check` | 0건 |
| `node scripts/check-document-system.mjs` | 오류 0 |

### 실제 앱 브라우저 (DOM·자산)

| 확인 | 결과 |
|---|---|
| `document.title` | `Spinatlas` |
| favicon | `/spinatlas-mark.svg` |
| SVG 요청 | HTTP 200, `image/svg+xml` |
| MENU 로고 (`SpinatlasMark`) | natural 301×301, render 18×18 |
| 인트로 로고 | natural 301×301, render 42×42 |
| `alt` / `aria-hidden` | 빈값 · `true` |

Mapbox 캔버스를 포함한 전체 화면 `Page.captureScreenshot` 은 **timeout으로 미확보**. 위 DOM·자산 로딩 검증은 통과.

### 고정 목록

- [261024-RTW-Chief-지정-디자인-고정.md](../../reference/product/261024-RTW-Chief-지정-디자인-고정.md) **#16** 심벌·파비콘 정본 반영 — 감리에서 일치 확인.

**판정: PASS** (Chief 화면 확인·커밋·배포는 별도).
