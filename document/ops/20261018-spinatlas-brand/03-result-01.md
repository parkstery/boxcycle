# 결과01 — Spinatlas 사용자 표시와 A안 인트로

| 항목 | 내용 |
|---|---|
| 문서 유형 | execution — 구현 결과 |
| 작성 | 2026-10-18 |
| 상태 | DEVELOPMENT_DONE — 셀렉터 계약 실패(앵커 실종) 확인, [재지시02](02-task-02.md) 후속 처리 |
| 독자 | Chief · Supervisor |
| 담당 | OpenCode 별도 세션 / LongCat 2.5 Preview Free (`opencode/longcat-2.5-preview-free`) |
| 연결 문서 | [지시01](02-task-01.md) · [재지시02 결과02](03-result-02.md) |

## 수행 환경

- **모델·세션**: `opencode/longcat-2.5-preview-free` — 지시서 명시 예외(기존 GLM-5.3 지침 우선 아님). 별도 CLI 세션으로 실행.
- **cwd**: `C:\20.HDev\boxcycle`
- **branch / HEAD**: `main2` / `0936cfe910c4a826c9b829a529478a2f9950d5f2` (지시서 기준과 일치)
- **시작 dirty**: 위치 진입 작업의 미커밋 변경이 있었다. `App.tsx`, `MapView.tsx`, `useEntryLocation.ts`, `entryLocation.ts`, `mapBootCenter.ts`, `EntryLocationDialog.css/.tsx`, `entry-location-camera.test.mjs`, `entry-location.test.ts`, `entry-contract.mjs`, `260707-RTW-결정-로그.md`, `document/ops/20261017-entry-location/README.md`, `document/ops/PROGRESS.md`, `document/ops/README.md`, 미추가 `.out/`, `entry-location-dom.test.mjs`, `20261017-entry-location` 지시·결과·검수 문서 다수. **전부 보존** — 이번 브랜드 변경과 무관한 파일을 되돌리거나 커밋에 포함하지 않았다. 커밋·push·배포 없음.

## 변경 파일과 범위

### 제품 소스 — 사용자 노출 브랜드 표시 문자열만 (내부 식별자·URL·동작 유지)

| 파일 | 변경 |
|---|---|
| `apps/web/src/components/auth/AppIntroScreen.tsx` | 브랜드 `RTW` → `Spinatlas`. 보조 행 `RIDE THE WOILD` 대신 `RIDE THE WORLD` span 제거. 제목을 두 span으로 변경: `땀으로 그리는,` / `나만의 지구 지도.`. 부제를 `실내 자전거로 실제 도로를 달리면, 달린 길이 내 지도에 남습니다.`로 변경. `onStartGuest`·`onLogin` 콜백·`aria-label="앱 소개"`·CTA 버튼 문구 유지. |
| `apps/web/src/components/auth/AppIntroScreen.css` | 사용하지 않게 된 `.app-intro__brand-sub` 규칙 제거. 색·레이아웃·44px 터치 영역·폰 가로 미디어 커리·`env(safe-area-inset)`·`prefers-reduced-motion`·맵박스 출처 표시 보존. 이름 길이 수용을 위한 추가 조정 불필요(아래 CSS 근거 참고). |
| `apps/web/src/components/auth/GuestEntryCard.tsx` | 브랜드 `RTW` → `Spinatlas`. |
| `apps/web/src/components/auth/AuthGateCard.tsx` | 브랜드 `RTW` → `Spinatlas`. |
| `apps/web/src/components/maphud/MapHud.tsx` | HUD 브랜드 버튼 `RTW` → `Spinatlas` + 주석의 브랜드 언급 정정(`idle=RTW만` → `idle=브랜드만` 등). `aria-label="Trail 메뉴"`·`title="Trail menu"`·버튼 동작 유지. |
| `apps/web/src/components/RotateOverlay.tsx` | `RTW 는` → `Spinatlas 는` (추가 발견 사용자 노출 문자열. [재지시02](02-task-02.md)에서 `Spinatlas는`로 띄어쓰기 수정). |
| `apps/web/index.html` | `<title>RTW</title>` → `<title>Spinatlas</title>`. |
| `apps/web/src/lib/map/rtwMapConfig.ts` | 사용자 노출 스타일 라벨 `RTW Dark` → `Spinatlas Dark`. 상수 `RTW_MAP_STYLE_URL`·value·`mapStyleHudShortLabel`·동작 유지. |
| `apps/web/src/components/map/MapViewSheet.tsx` | 임시 POI 토글 title의 `RTW Dark에서` → `Spinatlas Dark에서` (라벨 일관). |

### 문서

| 파일 | 변경 |
|---|---|
| `document/reference/product/260714-RTW-Ontology.md` | §0.1 뒤에 §0.2 브랜드 명명 추가: 현재 제품 표시명 **Spinatlas**(스핀아틀라스), RTW·Ride the World는 과거 브랜드, 내부 식별자·경로·projectId·과거 파일명 유지, 「내 도로망」 기능 의미 유지, 「내 지도」는 이번 인트로 감성 카피. |
| `document/260707-RTW-결정-로그.md` | 2026-10-18 `[Ontology]` `[Product]` `[UI]` 행 추가(최신 위). 기존 미커밋 위치 관련 행 보존. |
| `CLAUDE.md` | 1·3번 줄 브랜드 설명 수정: `# Spinatlas (repo: boxcycle)`, 브랜드명 문구. 파일명·용어 규칙·문서 라우팅 등 다른 계약 유지. |
| `AGENTS.md` | 1·3번 줄 브랜드 설명 수정(동일). |

### CSS 근거 — 이름 길이·긴 부제 수용에 추가 조정이 없는 이유

- **AppIntroScreen**: 스크롤 칸 폭 `min(46%, 26rem)`. 667px 가로에서 내부 콘텐츠 폭 ≈ 250px. `brand-name` 1.6rem × 9글자 + 점 + 자간 ≈ 155px — 여유. 낮은 높이(300px)에서 `landscape·max-height:480` 미디어 커리가 `brand-name` 1.35rem·`headline` 1.55rem으로 축소. 부제는 `.app-intro__support`가 `line-height:1.55`로 자연 줄바꿈. `app-intro__scroll`이 `overflow:auto` — 스크롤 접근성 확보.
- **GuestEntryCard**: 카드 `width:min(100%,22rem)`, 브랜드 0.95rem × 9글자 ≈ 100px — 충분.
- **AuthGateCard**: 브랜드 0.68rem × 9글자 + dot + gap ≈ 100px, 카드 16.5rem — 충분.
- **MapHud**: `hud-brand` 0.78rem × 9글자 + dot + capsule padding ≈ 111px, 계기판과 한 행(`map-hud__tl-row`)에서 667px 이상 가로에서 충분(Supervisor 4뷰포트 확인 통과).

## 검증 명령·종료 코드

PowerShell, `Set-Location 'C:\20.HDev\boxcycle'` 후 실행:

| 명령 | 종료 코드 | 결과 |
|---|---|---|
| `npm run build` | 0 (PASS) | chunk size 경고·`riderRig` IMPORT_IS_UNDEFINED 경고는 기존 것. 빌드 성공. |
| `npm run lint` | 1 (FAIL) | 16 errors·40 warnings. **에러 전부 `apps/web/scripts/ride-result/` 아래 시험 4파일**(`ride-result-f2-boundary.test.ts`, `ride-result-f2-card-resume.test.ts`, `ride-result-s1-timers.test.ts`, `ride-result-s2-end-snapshot.test.ts`)의 미사용 변수·`any`. 이번에 변경한 파일 에러 없음. Supervisor 독립 확인으로 이 4파일은 변경 없는 기존 실패. |
| `node scripts/check-document-system.mjs` | 0 (PASS) | 225파일, 깨진 링크 0, 구조 오류 0. |
| `node apps/web/scripts/ride-verify/verify-selectors.mjs` | 1 (FAIL) | **소개 제목 `/달린 길이,/` 앵커 실종** — 이번 제목 변경(`달린 길이,` → `땀으로 그리는,`)으로 생긴 계약 불일치. 상세는 [결과02](03-result-02.md). |
| `git diff --check` | 0 (PASS) | LF→CRLF 경고만(기존 파일 포함), whitespace 오류 없음. |

## Supervisor 독립 검증 증거 (이 세션이 직접 수행하지 않음 — 구분 기록)

Supervisor가 별도 실행으로 확인한 증거를 그대로 인용한다:

- 새 카피·실제 앱 4뷰포트(667×300, 740×300, 844×390, PC1366×768)·인트로 CTA 콜백·HUD 4상태 배치 통과.
- 빌드 통과.
- 변경소스 lint 통과.
- 전체 lint 16오류는 변경 없는 ride-result 시험 4파일.

## 미실행·한계

- 실기기(실제 스마트폰) 미검증 — PC 브라우저 기준.
- 민감한 인증(실제 게스트 로그인)은 실행하지 않고, CTA 콜백 존재·버튼 문구·HUD 배치로 확인.
- e2e(`ride-entry.spec.ts`) 미실행 — Firebase 에뮬레이터 미기동. 셀렉터 계약 정적 검증으로 대체.
- `npm run lint` 전체는 기존 실패(ride-result 시험 4파일)로 실패 처리되나, 이번 변경과 무관하며 수정 범위 외.

## Chief 재현 순서

1. 실행 폴더(전체 경로): `C:\20.HDev\boxcycle`
2. `Set-Location 'C:\20.HDev\boxcycle'`
3. 기존 dev 서버 재사용(확인 포트 **5000**): 이미 `http://127.0.0.1:5000` 에서 실행 중이면 그대로 접속. 없으면:
   ```powershell
   npm run dev -- --host 127.0.0.1 --port 5000
   ```
4. 새 브라우저 세션에서 `http://127.0.0.1:5000` 접속 → 최초 인증 전 인트로 화면에서 제목 `땀으로 그리는, / 나만의 지구 지도.`·부제·`Spinatlas` 브랜드·`게스트로 시작`/`로그인` CTA 확인. 게스트 진입 카드·인증 게이트 카드의 브랜드도 `Spinatlas` 확인.
5. **배포하지 않았음** — 로컬 dev 서버만 실행. 커밋·push·배포 없음.
