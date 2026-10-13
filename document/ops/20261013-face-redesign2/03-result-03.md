# 결과 03 — 승인 팔레트 나머지 UI 연속 적용 (지시03)

- 지시: `document/ops/20261013-face-redesign2/02-task-03.md` (Chief 2026-10-13 승인)
- 담당: OpenCode `opencode/muse-spark-1.3-contributor-free` (실제 모델 Muse Spark 1.3 Free)
- 작업 위치: `C:/Users/kdrea/.codex/worktrees/face-redesign2/boxcycle` (본 worktree만, 브랜치 `face-redesign2`)
- 기준: `e3c4fcc` + 지시01 승인 미커밋 변경(보존). 종료 상태: 미커밋·미푸시·미배포.
- 단위별 즉시 기록: `live-progress.md` (U01–U10 DONE). 최종 보고 몰아쓰기 없음 — 본 파일이 최종본.
- SUPERVISOR-NOTES.md(07:25 출현)를 단위 경계에서 확인, U10에서 보정 5건 반영.

## 변경 파일 (앱 CSS 30건 + App.css + theme = 32건, 신규 생성 없음)

U01 `maphud/CadenceHudChip.css` · U02 `route-dock/RouteDock.css` ·
U03 `sensor/CadenceSensorSheet.css`, `sensor/SessionSpeedControl.css` ·
U04 `MenuPanel.css`, `MenuPlaceSearch.css`, `PlaceSearchPanel.css` ·
U05 `auth/AuthGateCard.css`, `auth/GuestEntryCard.css`, `auth/SignUpNicknameCard.css`,
`ProfileEditSheet.css`, `UserInfoSheet.css` ·
U06 `ride/FirstRideIntroCard.css`, `ride/LocalFirstEntryCard.css`, `ride/NextRideCard.css`,
`ride/OfficialCourseListModal.css`, `ride/RouteSortSelect.css`,
`PublicRouteRequestModal.css`, `ride/RideRoutePanel.css`, `ride/SavedRoutesPanel.css` ·
U07 `ride/RideSettingsSheet.css`, `ride/RideHistoryPanel.css`(err 1줄),
`ride/RideSummarySheet.css` ·
U08 `trail/TrailHubPanel.css`, `trail/TrailheadPresence.css`(err 1줄) ·
U09 `maphud/MapHud.css`, `boxcycle-theme.css`(§§2–9), `map/MapViewSheet.css`,
`map/MapView.css`(잔여) · U10 `App.css`(err 2줄).
무변경(검토済): `RideHistoryPanel.css`(위 1줄 제외 전부 시스템컬러),
`features/map-overlays/RouteMinimap.css`(지도 의미색),
`RotateOverlay.css`(takeover 스크림 제외), `tokens.css`, `index.css`,
`rideCameraLab`·`riderLightLab`(토큰 추종 dev 도구), `MapBottomLeftStack.css`(색 선언 없음).

## 컬러 매핑 (지시 토큰만; 알파 패턴 보존)

- 바탕/글자: 패널·카드·시트·모달 `#FFFFFF` + `#1F2937`, 보조 `#475569`/`#64748B`,
  연한 바탕 `#F1F5F9`/`#F8FAFC`, 테두리 `#CBD5E1`/`#E2E8F0`.
- 실행/선택: `#2563EB` + 흰 글자(토큰반전 3건 해소: Go, seg-badge, panel-btn),
  hover `#1D4ED8`, 보조 hover `#EFF6FF`, 입력 focus `rgba(37,99,235,·)`,
  range/checkbox accent `#2563EB`.
- 성공/연결: `#15803D`/`#16A34A` (+연한 틴트). 오류/삭제: `#DC2626` (+연한 틴트).
- 경고 amber 유지(진짜 경고만): 저장확인·할당량·soon뱃지·blocked박스·미저장경고
  (흰바탕 가독 `#B45309`).
- 지도 UI 강조 분리(토큰 원값不碰): 계기 hero·정복카운터·코칭·R1·스토리·새도로hero·
  결과헤드라인·진행이번구간 금색 → `#2563EB` (keyline·펄스·크기 유지).
- 보존: S `#16a34a`·E `#dc2626`·경유지 골드·재개점 `#8a2be2`·정복궤적·고도·activity·
  속도/센서 LED·표고 텍스트·미니맵 일체·`--rtw-trace*`/`--rtw-map-*`/keyline 토큰,
  스크림·그림자 검정, 투명 지도텍스트(흰/파랑+keyline), Google 로고색, lab 토큰 추종.
- 허용 추가 규칙(색선언만): 선택+hover 흰아이콘 방지 5건
  (pick-profile U01, stop-remove, cadence/btn primary-hover, settings chip-hover,
  mapsheet close-hover), theme 덮음 보정 1건(`.route-dock__caret.hud-glass`,
  명시도 0,2,0), 선택 foreground 명시(파랑+흰) 다수.

## 검증 명령과 결과 (exit/pass/fail/미실행)

| 명령 | 결과 |
|---|---|
| `git diff --check` | PASS (exit 0) |
| `check-colors.mjs` 32건 (비색상 선언 multiset 대조 + braces) | PASS 전건 (색줄만 차이, 허용추가 포함) |
| Supervisor 감사 `supervisor-audit.cjs <worktree>` | 30 files, errors [] (재사용, 읽기전용) |
| `node C:/20.HDev/boxcycle/node_modules/typescript/bin/tsc -b --pretty false` (apps/web) | PASS (exit 0, 최종 1회) |
| 실앱 headless (5014, 별도 세션, 쓰기동작 없음) | console/pageerror 0 (전 스크립트) |
| 전역 e2e/실주행 | 미실행 (지시: 불필요) |
| 구조 변경 테스트 | 추가 없음 (지시: 금지) |

## 실앱 증거 (서버 `http://127.0.0.1:5014/`, worktree vite 유지 중)

- U01: 캐럿 LED `rgb(241,245,249)`=출하 CSS(서버 정합), 칩 오버레이 흰/짙은글/`#CBD5E1`, 제거 leftover 0.
- U02: 셸 흰, Go `#2563EB`+흰, hover `#1D4ED8`, 캐럿 보정 흰. 펼침 전체는 경로 없어 flat 계산값(기능 PASS 아님).
- U03: 캐럿클릭 센서시트 실오픈 — 흰 패널, primary+hover, 파랑 슬라이더. rpm·blocked 미렌더(정적).
- U04: 메뉴 실오픈(흰/밝은칩), 검색패널 실오픈 + 입력 focus 파랑.
- U05: 계정칩 사용자시트 실오픈(흰/파랑탭/hero/적색 danger). 게이트 실오픈 불가 → 동일DOM 오버레이 정합.
- U06: 입문/퍼블릭 모달 실오픈(흰/파랑타이틀/연한카드), 활성탭 파랑+흰, 항목 hover. 항목선택은 로드 후 닫힘 → is-selected 정적. 내경로 빈목록, 공개모달 오버레이 정합. 첫라이딩/다음주행 미렌더(정적).
- U07: 설정시트 실오픈(흰/밝은칩/파랑체크). 결과시트 주행완료 연출불가 → 오버레이 정합.
- U08: 메뉴 Trail 실오픈(흰허브/파랑키커). 행/펄스 미렌더(정적).
- U09: 800×360+667×300 흰 RTW/계정/컨트롤/캐럿 + 파랑도트, 시계 halo 유지. 계기/코칭 idle 미렌더(정적).
- U10: hero/coach/R1/conquest 오버레이 `rgb(37,99,235)`+keyline 유지, `oc-modal__close` `#475569` 실측.
- 캡처: `evidence/u01*·u02*·u03-·u04-*·u05-·u06-*·u07-*·u08-·u09-*·u10-*` (기본 1장/단위 + hover·선택·오류).

## 표면별 coverage·한계 (가짜 성공 아님)

- 실오픈 PASS: 센서시트, MENU, 검색패널, 입문/퍼블릭 모달, 사용자시트, 설정시트, Trail빈상태, HUD 필.
- 오버레이 계산값(동일 DOM·출하 CSS, 기능 PASS 아님): 센서칩, dock 펼침요소, 게이트, 공개모달, 결과시트.
- 정적 감리만: 센서연동 상태(chip/rpm/blocked), 펼침 dock, 항목 is-selected 실화면,
  첫라이딩/다음주행 카드, Trail 행·펄스·공개점, 계기·코칭 실주행 상태, 인증 플로우 전체,
  결과시트 실주행 상태, lab 2건(토큰 추종 확인만).
- fixture로 확인한 것을 실앱 PASS로 표기하지 않음. 오버레이는 제거 확인(leftover 0).
- 기존 기록(MapView.css 팝업 변경, ops 기록) 보존. main/main2·mobile-ui-redesign 미수정.
- 남은 컬러(의도적): `tokens.css` 다크 토큰(지도 레이어 SoT 공유), map 의미색 일체,
  takeover 스크림, dev 틱/디버그 마커, lab 골드(trace 추종).
- 브라우저 5분 무진전 전환 불필요(전 단위 3분 내 완료). dev 서버 2대 유지(5013 Supervisor 관찰용, 5014 검증용).
