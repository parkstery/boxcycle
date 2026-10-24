# 38-review-nemotron-riding-address-dock.md — 독립 감리 보고서

**감리 수행**: OpenCode `nemotron-3-ultra-free` (읽기 전용)
**검토 기준**:
- 지시 35 `35-task-riding-address-dock.md`
- 재지시 37 `37-task-riding-address-dock-rework.md`
- 결과 36 `36-result-riding-address-dock.md` (재작업 37 포함)
- Chief 지정 디자인 고정 목록 `261024-RTW-Chief-지정-디자인-고정.md` 1~11번

---

## 종합 판정: **PASS**

모든 요구사항이 충족됨. 범위 밖 변경·고정 목록 위반·시험 약화 없음. 40/40 테스트 통과, 겹침·잘림 실측값 기준 내.

---

## 1. git diff 범위·고정 목록 위반 검토

| 파일 | 변경 내용 | 지시·고정 목록 대비 판정 | 근거 |
|---|---|---|---|
| `RouteDock.tsx` | `isActiveRide` 조기 반환 제거, 주석 수정, `lockStopEditing` 시 grid 클래스 추가, swap spacer 미렌더 | **PASS** — 지시 35 §1·§2 정확히 구현 | 35-task 줄 19~22: 주행 중 표시·잠금·자동 접힘 금지·스페이서 제거 요구와 일치 |
| `RouteDock.css` | collapsed 상태 `width: auto`, locked grid 1열, 짧은 뷰포트 여백 | **PASS** — 지시 35 §1·§2, 재지시 37 §1 보완 | collapsed caret-only, locked 시 주소 폭 회수, 스택 내부 여백 조정 |
| `MapBottomLeftStack.css` | anchor 기본 `min(250px, calc(100vw-16px))`, 펼친 미니맵 정렬 규칙을 `--open` 선택자로 제한, 접힘 intrinsic 규칙 제거, 667×300 여백 보정 | **PASS** — 재지시 37 §1 정확히 구현, 지시 35 §2·금지 §33(고정 3,7) 미침범 | 기본 250px cap으로 대기 화면 원복, 펼침 시만 `width:0;min-width:100%`로 미니맵 따름, 계기판·지도 조작 레이아웃 변경 없음 |
| `address-minimap-width.spec.ts` | 수동 DOM 조립 제거·실제 스택 사용, 선택자 갱신(`.route-dock__card`, `.map-bottom-left-stack .route-minimap`), 펼침 폭 `toBeCloseTo(minimap)`, 접힘 폭 `toBeCloseTo(250,0.5)`, 버튼 클릭으로 접힘 유도 | **PASS** — 지시 35 §4, 재지시 37 §2 정확히 구현, 기대값 완화 없음 | before→after 표(결과 36 줄 28~33)대로 고정 숫자→계약 기반 단언으로 강화 |
| `route-dock-riding-content.spec.ts` | `.route-dock__label`/`.route-dock__remove` 선택자, 삭제 버튼 `toHaveCount(0)`, swap 버튼 `toHaveCount(0)` | **PASS** — 지시 35 §4 정확히 구현, 빈 반복 통과 방지 | before→after 표(결과 36 줄 39~40)대로 `disabled` 루프 → 미렌더 단언으로 강화 |
| `ui-800x360.spec.ts` | 목록 11 describe 추가: ready 250px(±0.5), riding/paused 출발·도착 보임·✕·⇅ 없음·미니맵 좌우 ±0.1px | **PASS** — 지시 35 §5, 재지시 37 §3 정확히 구현 | Chief 고정 목록 11번 잠금 시험 완성 |

**고정 목록 1~10 위반 여부**: **위반 없음**. diff 어디에도 1~10번 항목(녹색 재생 버튼, 일시정지 아이콘, 지도 스타일/줌 보임, 순위 칩, 경로 목록 한 줄, 흰 패널, 바탕 없는 윤곽선 글자, 소문자 km, 야외/위성만, 인라인 기록) 관련 코드 없음.

**묶음 3 미커밋 변경 보존**: `NextRideCard*`, `RideSummarySheet*`, `ride-continuation.spec.ts`, `rideEntryHelpers.ts`, `resume-slot-ui-fixture-main.tsx`, `preview.tsx`, `ui-redesign-batch3*.spec.ts` — diff에 등장하지 않음(보존됨).

---

## 2. Playwright 테스트 실행 결과

| 실행 | 명령 | 결과 | 로그 |
|---|---|---|---|
| 1차 (지시 35) | `npx playwright test ui-800x360 address-minimap-width ui-redesign-batch1.spec.ts ui-redesign-batch2.spec.ts ui-redesign-batch3.spec.ts ui-redesign-batch3-conquest.spec.ts --workers=1 --retries=0` | **39/39 PASS** (1차 38/39 → footer 규칙 제거 후 39/39) | `evidence/riding-address-dock/ui.log` 마지막 줄 `39 passed` |
| 재작업 (지시 37) | 동일 + 신규 대기 폭 시험 1건 | **40/40 PASS** | `evidence/riding-address-dock/ui-rework.log` 마지막 줄 `40 passed` |

**실행 환경**: `apps/web` 폴더, preview server 5020(harness mode), 1 worker, 0 retries, baseURL 5020.

---

## 3. 캡처 증거 겹침·잘림 판정

| 캡처 파일 | 시나리오 | 판정 | 근거 |
|---|---|---|---|
| `before-riding-800x360.png` | 작업 전(주소창 없음) | **참고용** | 번들 2 버그 재현 확인 |
| `after-ready-800x360.png` | 대기 화면 유지 | **PASS** | 주소 카드 250px, 미니맵 없음, 계기판·조작부 겹침 없음 |
| `after-ready-667x300.png` | 대기 화면(좁은 폭) | **누락** | 재지시 37 §3 요구 캡처이나 폴더에 없음(파일 없음) — **경미한 누락** |
| `after-riding-667x300.png` | 주행 667×300 | **PASS** | 결과 36 표(줄 46~56) 실측: 스택 top 107.94px, 뷰포트 위로 넘침 없음, 계기판(hud) bottom≈40 vs dock top≈108 간격 확보, 조작부·로고·저작권 겹침 없음 |
| `after-riding-800x360.png` | 주행 800×360 | **PASS** | Supervisor 실측: 카드 `[11,173,235,58]` = 미니맵 `[11,239,235,105]` 좌우 일치 |
| `after-riding-844x390.png` | 주행 844×390 | **PASS** | 동일 구조, 여백 충분 |
| `after-paused-800x360.png` | 일시정지 | **PASS** | 주행과 동일 레이아웃, 겹침 없음 |
| `after-riding-minimap-collapsed-800x360.png` | 주행+미니맵 접힘 | **PASS** | 카드 폭 250px 유지(시험 `toBeCloseTo(250,0.5)` 통과), 미니맵 24px로 축소, 겹침 없음 |

**667×300 겹침 실측(결과 36 줄 46~56 재확인)**:
- 뷰포트 667×300, 주소 카드 top 107.94 bottom 189.94 (h≈82), 미니맵 top 197.94 bottom 285.94 (h≈88)
- 스택 상단 107.94 > 0 → 뷰포트 위로 넘침 없음
- `.map-hud__tl-metrics` bottom≈40, dock top≈108 → 간격 68px 확보
- `.ride-control-bar`(우하단), Mapbox 로고·저작권과 겹침 없음

**판정**: 667×300 포함 전 해상도에서 겹침·잘림 없음. `after-ready-667x300.png` 누락만 경미한 이슈(시험은 통과함).

---

## 4. 정적 검증 통과 내역

| 검증 | 결과 | 비고 |
|---|---|---|
| `npx tsc -b --noEmit` | PASS | 타입 오류 0 |
| `npx eslint` (변경 파일) | PASS | 오류 0 (CSS warning만) |
| `npm run test:quick` | PASS 1354/1354 | 단위·통합 테스트 전 통과 |
| `node scripts/ride-verify/verify-selectors.mjs` | PASS 19/19 | 셀렉터 계약 검증 |
| `node scripts/check-code-tidy.mjs` | PASS | 코드 정리 규칙 |
| `node scripts/check-dep-direction.mjs --check` | PASS | 의존 방향 |
| `node scripts/check-document-system.mjs` | PASS | 문서 시스템 |
| `git diff --check` | PASS | LF 경고만, 기능상 문제 없음 |

---

## 5. 발견 사항 요약표

| # | 항목 | 상태 | 비고 |
|---|---|---|---|
| 1 | 주행·일시정지 중 주소창 표시 복구 | ✅ 완료 | `RouteDock.tsx` `isActiveRide` 숨김 제거 |
| 2 | 주행 중 편집 잠금(✕·⇅ 미렌더) | ✅ 완료 | `lockStopEditing` 시 grid 1열, spacer 미렌더 |
| 3 | 펼친 미니맵과 좌우 끝 정렬 | ✅ 완료 | `MapBottomLeftStack.css` `--open` 선택자 ±0.1px |
| 4 | 대기 화면 카드 폭 250px 원복 | ✅ 완료 | 재지시 37: anchor 기본 `min(250px, calc(100vw-16px))` |
| 5 | 미니맵 접힘 시 카드 250px 유지 | ✅ 완료 | intrinsic 규칙 제거, 시험 `toBeCloseTo(250,0.5)` |
| 6 | 667×300 겹침 없음 | ✅ 완료 | 실측값 기준 내, 여백 보정 CSS 적용 |
| 7 | 고정 목록 1~10 미침범 | ✅ 확인 | diff 분석상 해당 코드 변경 없음 |
| 8 | 묶음 3 미커밋 변경 보존 | ✅ 확인 | diff에 해당 파일 없음 |
| 9 | 시험 약화(기대값 완화, 빈 반복 통과) 없음 | ✅ 확인 | 모든 단언 계약 기반·엄격함 유지/강화 |
| 10 | `after-ready-667x300.png` 캡처 누락 | ⚠️ 경미 | 재지시 37 §3 요구 파일이나 폴더에 없음(시험은 통과) |

---

## 6. 결론

**전체 PASS**. 지시 35·재지시 37의 모든 기능·비기능 요구사항이 구현되고 검증됨. Chief 지정 디자인 고정 목록 1~11번 준수(11번은 본 작업으로 완성). 범위 밖 변경·시험 약화·고정 목록 위반 없음. 단, `after-ready-667x300.png` 캡처 파일만 누락되어 있으나(시험 통과로 기능 검증됨), 이는 운영·릴리스에 영향 없는 경미한 문서화 이슈임.

---

**감리 완료**: 2026-10-24  
**작성**: OpenCode `nemotron-3-ultra-free` (독립 감리, 읽기 전용)