# RIDE-IN-RIDE-HIERARCHY-3 완료 보고

| 항목 | 내용 |
|---|---|
| 작업 ID | `RIDE-IN-RIDE-HIERARCHY-3` |
| 브랜치 | `cursor/ride-in-ride-hierarchy-3` |
| base | `main2` |
| 완료 | 2026-09-13 |

## 변경 요약

1. **라이브 진행 위계** — `map-hud--active-ride` 에서 누적·% 강조, 접속·동행·Trail 배지·날씨·지명 검색 축소.
2. **주행 중 편집 UI 접기** — `RouteDock` riding/paused 자동 접힘·경유지/저장 숨김; ready-to-start 저장·삭제 숨김(Go·재개 유지).
3. **Publication 표기** — `publicationDisplay.ts` 로 목록 메타(프로필·거리·목적지) 정리; ETA·도시 % 없음.

## 6A 확인

main2 기준 `CadenceHudChip` 은 여전히 `MapHud` 우상단 — **6A 미반영**. 이번 PR에서 센서 칩 이동 없음.

## H1–H5

| ID | 증거 |
|---|---|
| H1 | `npm run test:next-ride` — 197 pass / 0 fail (기존 ride-entry·continuation 계약 유지) |
| H2 | `route-dock-riding-contract.test.ts` — riding/paused 편집 숨김·ready-to-start Go 유지 |
| H3 | MapHud.css 기존 `max-height:560px` 규칙 + riding 시 presence/지명 제거로 겹침 완화 |
| H4 | `publication-display-contract.test.ts` — Publication title·목적지·ETA 금지 |
| H5 | `npm run test:next-ride` exit 0; `npm run build` exit 0 |

## 남은 결함

- 6A(센서 칩→RouteDock) 별도 PR 대기.
- 브라우저 e2e(ride-entry) — 이번 세션 미실행(수퍼바이저 게이트).
