# 재지시 19 — 내 경로 조작부 압축 — 결과

2026-10-24 · 구현 Cursor CLI · [지시](19-task-saved-routes-compact.md) · 커밋·푸시 없음

## 요약

- map 모달 **내 경로**에서 필터 칩·정렬·관리 버튼(공개·열기/이어 달리기·이름·삭제)을 **한 줄**로 묶었다. 관리 버튼은 내용 폭·높이 28px, 선택 전에는 기존과 같이 툴바만 숨긴다.
- Guest 안내 문구는 목록 위에서 제거하고 `SavedRoutesModal` 하단 `footerHint`와 합쳤다(Guest일 때만 표시).
- Playwright: 667×300 목록 완전 노출 행 ≥4, 800×360·844×390 ≥6, 필터·「공개」 버튼 top 차 ≤4px.

## 변경 파일

| 파일 | 내용 |
|---|---|
| `apps/web/src/components/ride/SavedRoutesPanel.tsx` | map 한 줄 컨트롤·필터/툴바 JSX 공용화·map에서 상단 Guest 안내 제거 |
| `apps/web/src/components/ride/SavedRoutesPanel.css` | `--map-line` 레이아웃·칩/정렬/툴바 28px·map에서 선택 전 툴바만 숨김 |
| `apps/web/src/components/ride/SavedRoutesModal.tsx` | Guest 시 하단 안내에 회원 유지 문구 병합 |
| `apps/web/src/components/ride/OfficialCourseListModal.css` | map 내 경로 하단 footer 여백·글자 약간 축소 |
| `apps/web/e2e/ui-redesign-batch1.spec.ts` | 내 경로 밀도·한 줄 컨트롤 단언·목록 6건 기대(삭제 후 5) |
| `apps/web/scripts/ui-redesign-batch1/preview.tsx` | 6행 이상 검증용 샘플 경로 1건 추가(`s6`) |

## 검증 (실행 폴더·명령은 지시 17과 동일)

| # | 명령 | 결과 |
|---|---|---|
| 1 | `C:\20.HDev\boxcycle\apps\web` → `npx tsc -b --noEmit` | PASS |
| 2 | 변경 TS/TSX eslint | PASS 오류 0 |
| 3 | `npm run test:quick` | **FAIL** (exit 1) — `scripts/identity/entry-location-dom.test.mjs` 「first control directly requests browser location」 **60s 타임아웃 1건**(cancelled). ride/route/map/peer/meters/tools 도메인 자체는 실패 0. 합계 로그: 통과 1353 · 실패 0 · 제외 3. **본 작업과 무관한 기존 플레이크로 판단.** |
| 4 | `node scripts/ride-verify/verify-selectors.mjs` | PASS 19단계 |
| 5 | `$env:RTW_DEV_PORT='5020'; $env:ROUTE_LIST_ONE_LINE_EVIDENCE_DIR='C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\evidence\route-list-one-line'; npx playwright test ui-800x360 ui-redesign-batch1.spec.ts --workers=1 --retries=0` | PASS **18 passed / 0 failed** — 로그 `evidence/route-list-one-line/ui.log` |
| 6 | `C:\20.HDev\boxcycle` → `node scripts/check-code-tidy.mjs` | PASS (중복 제거 리팩터 후) |
| 6 | `node scripts/check-dep-direction.mjs --check` | PASS 위반 0 |
| 6 | `git diff --check` | PASS |

## 캡처 (`evidence/route-list-one-line/`, `ROUTE_LIST_ONE_LINE_EVIDENCE_DIR`)

- `preview-saved-667x300.png`, `preview-saved-800x360.png`, `preview-saved-844x390.png`
- 입문·퍼블릭 동일 규칙: `preview-intro-*`, `preview-public-*`
- 부가 시나리오: `batch1-preview-*.png` (Playwright가 함께 갱신)

## 하지 못한 것

- 실앱 에뮬레이터 캡처 — 지시상 Supervisor 담당.
- `test:quick` 전체 green — entry-location DOM 시험 타임아웃 1건 재현됐으나 재실행하지 않음(지시 범위 밖).

## Chief 확인용 재실행

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npx tsc -b --noEmit
$env:RTW_DEV_PORT='5020'
$env:ROUTE_LIST_ONE_LINE_EVIDENCE_DIR='C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\evidence\route-list-one-line'
npx playwright test ui-800x360 ui-redesign-batch1.spec.ts --workers=1 --retries=0
```

프리뷰: `http://127.0.0.1:5020/scripts/ui-redesign-batch1/preview.html` → Trail 메뉴 → 입문 → 내 경로.

## 감리 (Claude Code, 2026-10-24 00:25)

판정 **PASS — Chief 화면 확인 대기.** 지시 17(결과 18)과 재지시 19(이 파일)를 함께 판정한다.

- 캡처 직접 확인: 입문·퍼블릭 한 줄 행 32px 안팎, 아이콘·이름·거리 한 줄. 내 경로 667×300 4행(이전 2.5행), 800×360 6행. 필터·정렬·관리 버튼 한 줄, Guest 안내는 하단 줄에 합침. 자동차 아이콘이 팝업과 같은 그림으로 보임.
- 코드: 아이콘 path 는 `lib/route/routeProfileIcons.ts` 한 곳, 팝업 마크업·클래스 동일(`map-view__pick-profile-ico`). 데이터·로직 변경 없음.
- `test:quick` 실패 1건 재검: `entry-location-dom.test.mjs`를 test-quick 과 같은 플래그로 단독 실행 → **PASS 1/1 (27초)**. 전체 동시 실행 부하에서 60초 시간 초과가 난 일시 실패로 판정. 나머지 1353 PASS(실행자 로그). 시험 조건 미변경.
- 실앱 에뮬레이터 캡처 (`C:\20.HDev\boxcycle\apps\web`): 포트 5001을 다른 vite 서버(PID 33656, 23:05 시작, 인계 목록 밖)가 쓰고 있어 끄지 않고 Codex 의 임시 설정 `firebase.route-list-qa.json`(functions 5019)과 `VITE_FUNCTIONS_EMULATOR_HOST=127.0.0.1:5019`로 실행 → **PASS 1/1**, 로그 `evidence/route-list-one-line/live.log`, 캡처 `evidence/route-list-one-line/batch1-live-*-800x360.png`. 운영 Firebase 쓰기 없음.
- 비교 화면: [comparison-route-list-one-line.html](comparison-route-list-one-line.html).
- 보존 JSON SHA256 `4CAFA2A2…` 그대로, 추적 증거 PNG 변경 없음. 커밋·푸시·배포 없음.
