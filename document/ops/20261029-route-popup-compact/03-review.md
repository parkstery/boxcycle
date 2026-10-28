# 03-review — 경로 생성 창 아이콘·너비 축소 독립 검증

Claude Code(Opus 5.5) 직접 감리. 2026-10-29. Codex 토큰 소진으로 Supervisor 교대 후 [02-result-cursor](02-result-cursor.md)를 독립 재검증했다. 구현은 Cursor AI. **판정 PASS.**

## 범위 확인

- 변경 7파일이 [01-task](01-task.md) 허용 소유(mapPopupElements.ts·RoutePickPopup.css·MapView.css/tsx 폭 값만·fixture·관련 e2e) 안에 있다. App.tsx·탐색·서버·Rules·새 의존성 없음.
- 모드 아이콘은 시안과 같은 Lucide `route` / `ruler`+`navigation-2` path를 기존 SVG 방식으로 인라인했다. aria-label 「출발·도착」「거리·방향」, title, role=tab·aria-controls 유지.
- 고정13(Start·+WP·End 글자)·15(제목·경로 삭제 빨간 테두리·하단 수단·녹색 원) 유지, 49 신규 항목과 일치.
- 시안 HTML은 Codex 미리보기 런타임 전용이라 단독으로는 아이콘·스타일이 그려지지 않는다. 비교는 구조·아이콘 종류·수치로 했다.

## 재실행 (Claude Code 직접)

| 명령 (폴더) | 결과 |
|---|---|
| `npx tsc -b --noEmit` (apps/web) | PASS |
| `node scripts/ride-verify/verify-selectors.mjs` (apps/web) | 20단계 PASS |
| `npx eslint` 변경 TS 5파일 (apps/web) | 오류 0 · 경고 10(MapView 기존) |
| Playwright `ui-redesign-batch5`·`route-media-controls`·`distance-direction-attention`·`route-ride-controls` workers1 retries0 RTW_DEV_PORT=5031, 증거 env 6종 scratchpad (apps/web) | **51 passed (2.0m)** |
| `node scripts/check-dep-direction.mjs --check` (루트) | PASS |
| `node scripts/check-code-tidy.mjs` (루트) | 기준선 이내 exports 186 |
| `git diff --check` | PASS |
| 시험 후 `git status --short -uno` | 커밋된 증거 PNG 변화 0 |

캡처 눈검수: `evidence/cursor/compact-location-699x273.png`·`compact-distance-699x273.png` — 아이콘 탭·경로 삭제 한 줄, Start/+WP/End, 거리 행·칩 1/3/5/10/20, 하단 수단·녹색 원 한 줄, 잘림 없음.

## 미실행

- `ride-summary-compact` 탭 회귀 1건: 에뮬레이터(8080) 필요, Cursor 실행 때 ECONNREFUSED. 탭 동작은 위 51건이 덮는다.
- 실폰·실 Firebase 진입·실 탐색 요금.
