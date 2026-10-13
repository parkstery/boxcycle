# 결과 04 — 지시04 최종 감리 보정 (지시03 연속)

- 지시: `document/ops/20261013-face-redesign2/02-task-04.md` (최종 기준)
- 담당: OpenCode `opencode/muse-spark-1.3-contributor-free` (단일 코드 작성자, 기존 변경 보존)
- 위치: `C:/Users/kdrea/.codex/worktrees/face-redesign2/boxcycle`, 브랜치 `face-redesign2`
- 상태: 미커밋·미푸시·미배포. 5013(Supervisor 서버) 미터치 — 검증용 5015(본 worktree vite) 1회만 사용 후 종료.
- SUPERVISOR-NOTES.md 33줄 전량 실제 읽음. live-progress.md의 기존 'SUPERVISOR-NOTES: 없음'
  표기는 사실과 다르므로 본 묶음에서 정정했다.

## 항목별 결과 (6건)

1. MapHud `color:var(--rtw-trace)` — 재작업 없음, 실제 확인만. 파일 내 잔류 0건.
   파랑 분리 7개소: presence head 1(U09) + hero값/누적값/owned-hint/preview값/
   coach문구/coach-R1 6(지시04 지정). 긴급 지적 `opacity:0.55`는 삭제 없이 복구된
   상태로 확인. keyline/halo/투명바탕, 배경 없는 HUD 수치·시계 흰색 유지.
   S/E·trace-owned·LED 마커색은 MapHud에 선언이 없고 diff도 미터치.
2. RotateOverlay — 보정 수행. `background:#FFFFFF`+`color:#1F2937`,
   아이콘 `border:#2563EB`+`::after background:#2563EB`.
   animation/크기/배치不碰. 360x800 실렌더 확인: overlay `display:flex`,
   `rgb(255,255,255)`/`rgb(31,41,55)`, icon border+after `rgb(37,99,235)`.
   샷 `evidence/u04-rotate-360x800.png`(흰 전면+파랑 아이콘+짙은 안내문 육안 확인).
3. MapView 축척 박스 — 재작업 없음, 실제 확인만. `border:1.5px solid #CBD5E1`
   단일 선언(1364줄). 파일 내 다른 `1.5px solid` 2건은 별개 의미 규칙(펄스 링·
   재개점 마커)으로 원본 그대로.
4. MapViewSheet 닫기·selected:hover — 실오픈 확인, 추가 보정 불필요.
   닫기 실측 `rgb(241,245,249)`+`rgb(71,85,105)`(흰 패널 위 가독).
   `.chip.is-active` 실측 파랑+흰, hover 실측 진파랑+흰 유지(후순위 동명시도
   규칙이 hover를 덮으므로 옅은 바탕 흰글자 상태 없음, 칩 13개).
   샷 `evidence/u04-mapviewsheet-800x360.png`.
5. tokens/boxcycle-theme — 토큰 원값 변경 없음(`--rtw-trace:#E8A33D`,
   `--rtw-map-*`/keyline 유지, `--rtw-text-primary`不碰). theme 파랑 버튼+흰글
   전수 정합. 밝은 패널 희미 잔류 1건 보정: RideSummarySheet 구분점 `·`
   `#CBD5E1`→`#64748B`(색상만).
6. RouteMinimap milestone + activity popup — 보정 수행(의미색不碰).
   milestone: 흰 배경+파랑 강조(경로선/핀/펄스/S·깃발 의미색 유지, 애니 그대로).
   activity popup: wrapper/tip 흰색, 테두리 `#CBD5E1`, 본문 `#1F2937`,
   타이틀 `#DC2626`/heat `#B91C1C`(빨강 계열 유지). 확대/축척/지도 스타일不碰.
   적용 스타일시트 선언값을 실페이지에서 직접 대조(아래 LIVE-RULES).

## 검증 명령과 결과

| 명령 | 결과 |
|---|---|
| `git diff --check` | PASS (exit 0) |
| `node C:/20.HDev/boxcycle/document/ops/20261013-face-redesign2/supervisor-audit.cjs <worktree>` | 32 files, errors [] (exit 0, 읽기전용 재사용) |
| `node C:/20.HDev/boxcycle/node_modules/typescript/bin/tsc -b --pretty false` (apps/web) | PASS (exit 0) |
| 단일 브라우저 `evidence/u04-verify.mjs` (5015, 기존 u09/u10 패턴 재사용) | console/pageerror 0 |

실측값:

- `ROTATE-360x800: overlay rgb(255,255,255)/rgb(31,41,55)/flex, icon border
  rgb(37,99,235), after rgb(37,99,235)`
- `SHEET: close rgb(241,245,249)/rgb(71,85,105), chipActive rgb(37,99,235)/white`
- `SHEET-ACTIVE-HOVER: bg rgb(37,99,235)/white (hoverMatched true)`
- `LIVE-RULES: popup-content white/#1F2937/#CBD5E1, title #DC2626,
  heat-title #B91C1C, body #1F2937, tip #FFFFFF, milestone white/#2563EB`

## coverage·한계 (가짜 성공 아님)

- 실렌더 PASS: RotateOverlay 360x800 전면, MapViewSheet 실오픈(닫기·선택칩 hover).
- 적용 스타일시트 선언값 대조(주입 DOM 없음): activity popup 5규칙, milestone 1규칙.
- 실제 렌더 미검증으로 명시: milestone 띠(주행 이벤트 4초 노출 필요),
  activity popup 본문(실제 activity 레이어 클릭 필요), hero/coach/R1 실주행 상태.
  로그인/저장/삭제/등록 미수행. 전역 e2e 미실행(지시: 불필요).
- Supervisor 확인 근거(route shell 16·센서19·메뉴20·검색8·사용자50·주행설정26·
  프로필20·지도설정41·입문39·퍼블릭284·내경로10 지오메트리 동일, 입문/퍼블릭 실조회)는
  반복하지 않음. 검사도구 신규 제작 없음, 전체 브라우저 재탐색 없음.
