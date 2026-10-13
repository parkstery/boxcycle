# live-progress — 지시03 연속 컬러 적용 (Muse, face-redesign2 worktree)

- 모델: Muse Spark 1.3 Free (`opencode/muse-spark-1.3-contributor-free`)
- 서버: 5014 = 본 worktree vite (PID 14788, 이전 실행 기동 유지), 5013 = Supervisor (PID 57364). 새 서버 없음.
- SUPERVISOR-NOTES.md: 07:25 출현분부터 U10 경계에서 실제 전량 읽음 (아래 U10·U11 반영).
  기존 "없음" 표기는 사실과 달라 정정 (지시04 요구).
- 검증 원칙: 단위별 `git diff --check` + 색상외 선언 자동검사 + 실앱 headless 1장(필요시 상태별), 쓰기 동작 없음.

## 표면 인벤토리 (37 CSS, apps/web/src)

- U01 센서칩: `maphud/CadenceHudChip.css` (+dock 변형)
- U02 RouteDock 단독: `route-dock/RouteDock.css` (+`features/map-overlays/MapBottomLeftStack.css`는 색 선언 없음 — 확인만)
- U03 케이던스 창·속도 제어: `sensor/CadenceSensorSheet.css`, `sensor/SessionSpeedControl.css`
- U04 MENU·지명검색: `MenuPanel.css`, `MenuPlaceSearch.css`, `PlaceSearchPanel.css`
- U05 맵 설정·지도툴바·시트: `map/MapViewSheet.css`, `maphud/MapHud.css`(일부), `features/map-overlays/RouteMinimap.css`, `map/MapView.css` 잔여(wrapper/툴바)
- U06 계정/프로필/인증: `auth/AuthGateCard.css`, `auth/GuestEntryCard.css`, `auth/SignUpNicknameCard.css`, `ProfileEditSheet.css`, `UserInfoSheet.css`
- U07 경로목록: `ride/FirstRideIntroCard.css`, `ride/LocalFirstEntryCard.css`, `ride/NextRideCard.css`, `ride/OfficialCourseListModal.css`, `ride/RideRoutePanel.css`, `ride/SavedRoutesPanel.css`, `ride/RouteSortSelect.css`, `PublicRouteRequestModal.css`
- U08 주행 설정/기록/결과/이어달리기: `ride/RideSettingsSheet.css`, `ride/RideHistoryPanel.css`, `ride/RideSummarySheet.css` (+RouteDock resume은 U02에서)
- U09 Trail·존재표시: `trail/TrailHubPanel.css`, `trail/TrailheadPresence.css`, `PublicationSharedPresence.tsx`(CSS 없음 — inline 확인)
- U10 나머지 HUD/카드: `maphud/MapHud.css` 잔여 + `boxcycle-theme.css` HUD 섹션(§2,5,6,7,8) + `App.css`, `RotateOverlay.css`
- U11 공통 정리·최종 sweep: `tokens.css`/`boxcycle-theme.css` :root 잔여, `index.css`, lab 2건(토큰 추종 확인만), TSX inline 컬러, 전체 AST sweep + tsc + diff-check
- 제외(보존): 지도 타일/라이트, 3D 라이더, S/E·경유지·정복궤적·activity 의미색, 속도/센서 LED, 배경없는 지도위 텍스트 흰+keyline, 스크림/그림자 검정, lab 기능.

## U01 — 센서칩(CadenceHudChip.css) — DONE 2026-10-13
- 파일: `apps/web/src/components/maphud/CadenceHudChip.css` (TSX inline 컬러 없음 확인)
- 매핑: 칩 바탕 `rgba(15,23,42,0.55)`→`#FFFFFF`, 테두리→`#CBD5E1`, 글자 `#f8fafc`→`#1F2937`,
  hover/open 테두리→`#2563EB`, focus outline `#e8a33d`→`#2563EB`,
  dock변형 바탕→`#FFFFFF`/hover `#EFF6FF`+테두리 `#2563EB`,
  attention 펄스 금색→파랑(`#2563EB`, `rgba(37,99,235,0.14)`, reduced-motion 포함),
  LED 흰 `#f8fafc`→`#F1F5F9`(흰칩 위 식별, 링 유지), LED 녹색 `#34d399`+glow 보존(의미색).
- 검증: `git diff --check` PASS, check-colors.mjs PASS(비색상 동일, braces 27/27),
  실앱 5014 headless — 캐럿 LED 계산값 `rgb(241,245,249)`=출하 CSS 확인(서버 정합 증명),
  칩 오버레이 주입 계산값 hud/dock 모두 `rgb(255,255,255)`/`rgb(31,41,55)`/`rgb(203,213,225)`,
  주입 제거 leftover 0, console error 0. 샷 `evidence/u01-800x360.png`(초기 토스트 목격),
  `evidence/u01-dock-800x360.png`(접힘 캐럿만), `evidence/u01-overlay-800x360.png`.
- 문제: 실컴포넌트 칩은 센서 상태 없이는 렌더 안 됨(`sensorChipSlot` → caret LED만).
  시각 검증은 동일 DOM 오버레이 계산값으로 대체, 기능 PASS 아님. 초기 화면 검정 토스트
  「서비스에 연결할 수 없습니다」 목격 — U10 토스트 범위, 여기선 미수정.
- 다음: U02 RouteDock.

## U02 — RouteDock(RouteDock.css) — DONE 2026-10-13
- 매핑: 셸 `#FFFFFF`+`#CBD5E1`, top/panel 글자 `#1F2937`, 캐럿 `#475569`/hover `#EFF6FF`,
  중립버튼 `#F1F5F9`+`#CBD5E1`+`#475569`/hover `#EFF6FF`+`#2563EB`,
  stop `#DC2626`-hover/`rgba(220,38,38,·)`, resume박스 `#EFF6FF`+`#CBD5E1`,
  radio `#2563EB`, stop행 `#F8FAFC`+`#E2E8F0`/hover `#EFF6FF`,
  Go `#2563EB`+흰글자(토큰반전 해소)+hover `#1D4ED8`+`rgba(37,99,235,0.35)`,
  S `#16a34a`·WP골드·E `#dc2626` 보존. disabled opacity 유지.
- 추가 규칙(색만): `.route-dock__stop-remove:hover`에 `color:#DC2626`,
  `.route-dock__caret.hud-glass`(+hover) 보정 — theme §2 `.hud-glass`가 뒤에서
  다크글래스를 덮던 것을 dock 스코프 명시도(0,2,0)로 색만 재정의. 비색상은 테마 그대로.
- 검증: diff-check PASS, check-colors PASS(선언줄 비색상 0, 색줄 +9=허용추가 포함),
  실앱 5014: 셸 `rgb(255,255,255)`, Go `rgb(37,99,235)`+흰글자, Go hover `rgb(29,78,216)`,
  중립 `#F1F5F9`/`#475569`, stop `#F8FAFC`, 캐럿 보정후 `rgb(255,255,255)`/`#475569`,
  오버레이 제거 leftover 0, console 0. 샷 `u02-overlay-800x360.png`(지도+팝업+주입샘플),
  `u02-caret-800x360.png`. 전체 dock 펼침 상태는 서비스 없이 경로 없어 미확인 —
  flat 클래스 계산값 검증으로 대체(기능 PASS 아님).
- 다음: U03 케이던스 창·속도제어.

## U03 — 케이던스 센서 창·속도 제어 — DONE 2026-10-13
- 파일: `sensor/CadenceSensorSheet.css`, `sensor/SessionSpeedControl.css`
- 매핑: 패널 `#FFFFFF`+`#CBD5E1`+`#1F2937`(scrim 검정·그림자 유지), 핸들 `#CBD5E1`,
  보조글 `#64748B`, 닫기/중립 `#F1F5F9`+`#CBD5E1`+`#475569`/hover `#EFF6FF`+`#2563EB`,
  primary `#2563EB`+흰글자+hover `#1D4ED8`(추가 규칙 — U01 흰아이콘 재발 방지),
  rpm `#2563EB`, 오류 `#DC2626`, notice `#64748B`, 구분선 `#E2E8F0`,
  선택됨 초록 `#15803D`+`rgba(22,163,74,·)`(성공/연결 의미), step `#F1F5F9`+`#1F2937`,
  range accent `#2563EB`, number `#FFFFFF`+`#1F2937`. blocked amber박스 유지(진짜 경고).
- 검증: diff-check PASS, check-colors 2건 PASS, 실앱 5014 캐럿클릭 실오픈 —
  패널 `rgb(255,255,255)`/`#1F2937`, primary+hover `#1D4ED8`+흰글자, step/number 정합,
  console 0. 샷 `u03-800x360.png`. rpm행·blocked박스는 센서 없어 미렌더(정적만).
- 다음: U04 MENU·지명검색.

## U04 — MENU·지명 검색 — DONE 2026-10-13
- 파일: `MenuPanel.css`, `MenuPlaceSearch.css`, `PlaceSearchPanel.css`
- 매핑: 메뉴 `#FFFFFF`+`#1F2937`+우테두리 `#CBD5E1`(scrim 유지), head선 `#E2E8F0`,
  칩3종 `#F1F5F9`+`#CBD5E1`+`#475569`/hover `#EFF6FF`+`#2563EB`, body `#F8FAFC`,
  검색블록 `#F8FAFC`+`color-scheme:light`, 입력 `#FFFFFF`+`#1F2937`+focus `rgba(37,99,235,0.45)`,
  결과목록 `#FFFFFF`, 항목 `#1F2937`+구분 `#E2E8F0`/hover `#EFF6FF`,
  검색패널 `#FFFFFF`+`#CBD5E1`, 닫기 `#F1F5F9`+`#475569`/hover `#EFF6FF`+`#1F2937`.
- 검증: diff-check PASS, check-colors 3건 PASS, 실앱 5014 메뉴 실오픈(흰패널/밝은칩 샷
  `u04-menu-800x360.png` — 본문 TRAIL/경로탭은 미완료 단위라 아직 다크, 범위 정상),
  검색패널 실오픈 `u04-place-800x360.png` + 입력 focus 계산값(흰/짙은글/파랑outline), console 0.
- 다음: U05 계정/프로필/인증.

## U05 — 계정/프로필/인증 — DONE 2026-10-13
- 파일: `auth/AuthGateCard.css`, `auth/GuestEntryCard.css`(점 `#dc2626`→`#2563EB` 1건),
  `auth/SignUpNicknameCard.css`(선택 `#2563EB`+흰글, err `#DC2626`; 시스템컬러 유지),
  `ProfileEditSheet.css`(입력 흰/짙은글), `UserInfoSheet.css`
- 매핑(게이트): 카드 `#FFFFFF`+`#CBD5E1`+`#1F2937`+scheme light(scrim 유지),
  도트 `#2563EB`, 닫기 `#F1F5F9`+`#475569`/hover `#EFF6FF`, primary `#2563EB`+흰+hover `#1D4ED8`,
  secondary 흰+`#475569`, Google 흰+`#1F2937`/hover `#EFF6FF`, meta `#64748B`, err `#DC2626`,
  닉네임행 일체(입력 흰, placeholder `rgba(71,85,105,0.6)`, focus 파랑, 칩선택 파랑+흰).
- 매핑(사용자시트): `#FFFFFF`+`#1F2937`, 아바타 `#F1F5F9`/게스트 `#E2E8F0`,
  닫기/수정 `#F1F5F9`+`#475569`/hover `#EFF6FF`, 플랜박스 `#EFF6FF`, CTA `#2563EB`,
  구독경고 `#B45309`/정상 `#16A34A`, 탭 `#F1F5F9`+`#475569`/선택 `#2563EB`+흰(색추가),
  통계셀 `#F8FAFC`, 완료 `#16A34A`/부분 `#B45309`/미상 `#64748B`,
  버튼 `#F1F5F9`+`#1F2937`/hover `#EFF6FF`, Google 흰, danger `rgba(220,38,38,·)`+`#DC2626`,
  탈퇴입력 흰, 자산 `#F8FAFC`/정복강조 파랑, hero숫자 `#2563EB`, 스토리 `#1F2937`(주석 갱신).
- 검증: diff-check PASS, check-colors 5건 PASS, 실앱 5014 계정칩 실오픈 —
  시트 흰/탭 파랑+흰/hero 파랑/danger 적색 샷 `u05-800x360.png`,
  게이트는 게스트 상태 실오픈 불가 → 동일DOM 오버레이 계산값(카드/primary/secondary/Google/err
  전부 정합, leftover 0) 샷 `u05-gate-800x360.png`, console 0.
- 다음: U06 경로 목록.

## U06 — 입문/퍼블릭/내 경로 목록 — DONE 2026-10-13
- 파일 8건: `FirstRideIntroCard`, `LocalFirstEntryCard`, `NextRideCard`,
  `OfficialCourseListModal`, `RouteSortSelect`, `PublicRouteRequestModal`,
  `RideRoutePanel`(vars `--rp-*` 스코프 교체), `SavedRoutesPanel`(vars `--sr-*` 교체)
- 매핑: 카드/모달 흰+짙은글, primary `#2563EB`+흰(토큰반전 2건 해소: seg-badge, panel-btn),
  선택 파랑+흰(색추가: mode/seg/filter/tool/btn), hover `#EFF6FF`+`#2563EB`,
  오류 `#DC2626`, 도착성공 `#15803D`, 경고박스 amber 유지+글 `#B45309`,
  뱃지 ok `#15803D`/pending `#64748B`/soon `#B45309`/public 파랑/resume 파랑+흰,
  진행바 `#2563EB`, activity `#16A34A`, danger 적색화, violet 폐기(중립/파랑).
- 검증: diff-check PASS, check-colors 8건 PASS, 실앱 5014 —
  입문/퍼블릭 모달 실오픈(흰/파랑타이틀칩/흰검색/연한카드, 정렬select 흰) 샷 2장,
  활성탭 파랑+흰, 항목 hover `#EFF6FF`+파랑테두리, console 0.
  항목 클릭은 경로로드 후 모달이 닫혀 is-selected 실화면 미확보(정적+hover로 대체).
  내경로 빈목록(게스트), 공개요청모달 실오픈 불가 → 동일DOM 오버레이 전항목 정합 샷 `u06-pr`.
  첫라이딩/다음주행 카드는 idle 조건 미충족 미렌더(정적만).
- 다음: U07 주행 설정/기록/결과.

## U07 — 주행 설정/기록/결과 — DONE 2026-10-13
- 파일: `RideSettingsSheet.css`, `RideHistoryPanel.css`(시스템컬러 — 무변경),
  `RideSummarySheet.css`
- 매핑(설정): 패널 흰+`#CBD5E1`+`#1F2937`, 핸들 `#CBD5E1`, 보조 `#64748B`,
  토글 accent `#2563EB`, 중립 `#F1F5F9`+`#475569`/hover추가 `#EFF6FF`+`#2563EB`,
  primary `#2563EB`+흰+hover `#1D4ED8`(추가), err `#DC2626`, 입력 흰,
  칩 +hover추가/선택 파랑+흰.
- 매핑(결과): 시트 흰+`#1F2937`, 핸들 `#CBD5E1`, 헤드라인 `#2563EB`(주석 갱신),
  새도로 hero `#EFF6FF`+파랑라벨/값(지도궤적 제외·UI강조 파랑 통일),
  진행 이번구간 `#2563EB`/이전 `#CBD5E1`/트랙 `#F1F5F9`, 저장 primary 파랑+흰+hover,
  ghost `#475569`, 입력 흰+focus 파랑, err `#DC2626`, 미저장경고 amber유지+글 `#B45309`,
  게스트CTA 파랑, 칼로리버튼 파랑, 재시도 중립.
- 검증: diff-check PASS, check-colors 3건 PASS(기록 무변경 확인),
  실앱 5014 설정시트 실오픈(흰/밝은칩/파랑체크) 샷 `u07-settings`,
  결과시트는 주행완료 연출불가 → 동일DOM 오버레이 전항목 정합 샷 `u07-summary`, console 0.
- 다음: U08 Trail·존재표시.

## U08 — Trail·존재 표시 — DONE 2026-10-13
- 파일: `trail/TrailHubPanel.css`, `trail/TrailheadPresence.css`(시스템컬러+기존 연적색 — 무변경)
- 매핑: 허브 흰+`#CBD5E1`, 키커 `#2563EB`, 현재위치 `#1F2937`, 보조 `#64748B`,
  버튼 `#F1F5F9`/hover `#EFF6FF`, 공개선택 파랑+흰, 행카드 `#F8FAFC`+`#1F2937`,
  hover/선택 `#EFF6FF`+파랑좌선, 공개점 `#16A34A`/비공개 `#CBD5E1`,
  LIVE `#2563EB`+펄스파랑(alpha 유지), err `#DC2626`.
- 검증: diff-check PASS, check-colors 2건 PASS, 실앱 5014 메뉴 실오픈 —
  흰허브/파랑키커/밝은탭+파랑선택 샷 `u08-menu-800x360.png`, console 0.
  공개/행/펄스는 게스트 빈상태 미렌더(정적만).
- 다음: U09 나머지 HUD/카드/툴바.

## U09 — 나머지 HUD/카드/툴바 — DONE 2026-10-13
- 파일: `maphud/MapHud.css`, `boxcycle-theme.css`(§§2-9 HUD 셀렉터 색만),
  `map/MapViewSheet.css`, `map/MapView.css`(잔여),
  `features/map-overlays/RouteMinimap.css`·`RotateOverlay.css`(무변경)
- 매핑: 유리/칩/브랜드/계정/맵컨트롤/액션카드/힌트/트리거 흰+짙은글, accent 파랑+흰,
  danger 적색화, FAB 파랑+흰/일시정지 흰, bc 활성 파랑+흰, 퀵카메라 활성 파랑+흰,
  presence 패널(구분선/태그 파랑/복귀버튼 파랑-tint→hover 솔리드/본인·activity 초록/err 적),
  맵시트 흰+칩/줌/토글 파랑 +hover추가, 축척/고도 흰계기, 01잔여 auto-title `#1F2937`.
- 보존(지도 레이어): 계기값/히어로/정복카운터/코칭 골드+키라인, 시계 halo, 캡슐 그림자,
  activity팝업, S/E/경유지/재개점 마커, 표고 텍스트, 틱/디버그 마커, 미니맵 일체,
  takeover 스크림(RotateOverlay).
- 검증: diff-check PASS, check-colors 6건 PASS, 실앱 5014 800x360+667x300 —
  흰 RTW/계정/컨트롤/캐럿 + 파랑도트, 시계 halo 유지, console 0. 샷 2장.
  계기/코칭은 idle 미렌더(정적 보존 확인).
- 다음: U10 공통 정리·최종 sweep.

## U10 — 공통 테마 잔여 정리·최종 sweep — DONE 2026-10-13
- 공통: `boxcycle-theme.css` §§2-9 HUD 셀렉터 색만 교체(① `:root` 별칭·비색상 유지).
  `App.css` 폼 err 2건 `#DC2626`. `tokens.css`·`index.css` 무변경(의도적, 아래).
  lab 2건 무변경(토큰 추종 dev 도구 — 지시대로 충분).
- 토큰 보존 근거: `--rtw-trace*`는 지도 궤적 의미색과 공유 → 원값 유지, UI 참조만 분리.
  `--rtw-text-primary` 전역 반전 금지(배경없는 HUD 수치·코칭 흰+keyline 유지).
  `--rtw-map-*`/`trace-owned`/keyline/스크림·그림자 검정 유지.
- 잔여 var 감사: UI 크롬을 칠하는 다크 해석 var 0건.
  잔류는 지도 텍스트(흰/골드→파랑 분리 후 keyline 유지), warn 박스(진짜 경고),
  blur/shadow/폰트(비색상), lab 토큰 추종, trace-owned·마커 도메인색.
- TS inline 감사: UI 크롬 inline 색 0건. 전부 지도 레이어/도메인(S/E·궤적·고도·activity)/
  디버그/Google로고 — 보존.
- 활성 전경 독립 확인: `u10-active-audit` — 선택/주요/활성 40+ 규칙 전수 pairing 정합
  (파랑+흰 또는 연파랑+짙은글). 투명 HUD(계기/코칭/시계/표고)는 흰/파랑+keyline 유지.
- SUPERVISOR-NOTES 보정 반영(07:25 발견 즉시):
  ① coach·R1·hero·conquest·preview 금색 → `#2563EB`(외곽선 유지, 토큰 원값不碰),
  계기 라벨 흰 유지. 오버레이 실측: hero/coach/R1/conquest `rgb(37,99,235)`+keyline.
  ② MapView scale 박스 border `#CBD5E1` 중복 선언 제거(단일 교체로 복원).
  ③ 닫기 희미 지적 → `oc-modal__close` 실측 `#475569`/투명(흰모달 위 가독) 샷 `u10-oc`.
  ④ supervisor-audit.cjs 재사용: 30 files, errors [].
  ⑤ checker 수정 중단(이미 확정본), 캡처 스크립트 재사용 전환.
- 최종 검증: check-colors 32건 PASS, `git diff --check` PASS,
  `tsc -b --pretty false`(apps/web) exit 0, console error 전단위 0.
  최종샷 `u10-final-*-idle/menu.png`(2 viewport).
- 미검증·한계는 최종보고(03-result-03.md)에 분리 기록. 커밋/push/배포 없음.

UNIT_DONE: U01 센서칩
UNIT_DONE: U02 RouteDock
UNIT_DONE: U03 케이던스창·속도제어
UNIT_DONE: U04 MENU·지명검색
UNIT_DONE: U05 계정·프로필·인증
UNIT_DONE: U06 경로목록
UNIT_DONE: U07 주행설정·기록·결과
UNIT_DONE: U08 Trail·존재표시
UNIT_DONE: U09 HUD·카드·툴바
UNIT_DONE: U10 공통정리·최종sweep

## U11 — 지시04 최종 감리 보정 — DONE 2026-10-13
- SUPERVISOR-NOTES.md 33줄 전량 실제 읽기 완료 (U01 caret LED 정상·U11 trace 분리·U04
  color-scheme 예외·U09 투명HUD 유지+금색강조 파랑분리·scale 중복border·MapHud hint
  opacity 복구·RotateOverlay/milestone/activity 취급·02-task-04 준비).
- 이미 반영済(재작업 없이 실제 확인만):
  ① MapHud `color:var(--rtw-trace)` 잔류 0건 — 7개소 파랑 분리(presence head 1 + hero/
  누적/owned-hint/preview/coach/R1 6), hint `opacity:0.55` 복구 확인,
  keyline/halo/흰 HUD수치·시계 유지, S/E·trace-owned·LED 마커색 미터치.
  ② MapView 축척 박스 border 단일(`1.5px solid #CBD5E1`, 1364줄; 1047/1432는 별개
  의미 규칙) — 중복 삽입 없음 확인.
- 실제 보정 4건(색상 선언만, geometry/animation/DOM/문구不碰):
  ② RotateOverlay — 바탕 `#FFFFFF`+글 `#1F2937`, 아이콘 border/`::after` `#2563EB`.
  ⑥ RouteMinimap milestone — 흰띠+파랑글(경로/핀/펄스/S의미색不碰).
  ⑥ MapView activity popup — wrapper/tip 흰+`#CBD5E1` 테두리, 본문 `#1F2937`,
  타이틀 `#DC2626`/heat `#B91C1C`(빨강계열 유지).
  ⑤ RideSummarySheet 구분점 `·` `#CBD5E1`→`#64748B`(밝은 패널 희미 잔류 해소).
  ④ MapViewSheet 닫기 `#F1F5F9`+`#475569` 실측 가독, 선택칩 hover 실측 진파랑 유지
  (`.is-active`가 후순위 동명시도로 hover 덮음 — 추가 규칙 불필요).
  ⑤ tokens `--rtw-trace:#E8A33D`·`--rtw-map-*`·keyline 원값 유지,
  theme 파랑버튼+흰글 전수 정합(다크글 잔류 0).
- 검증: `git diff --check` exit 0, supervisor-audit 32 files errors [],
  `tsc -b` exit 0, 단일 브라우저 1회(5015, console/pageerror 0).
  샷 `evidence/u04-rotate-360x800.png`·`u04-mapviewsheet-800x360.png`.
