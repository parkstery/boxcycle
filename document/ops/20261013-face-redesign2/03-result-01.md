# 결과 01 — 경로 생성 팝업 컬러 변경

- 작업: `document/ops/20261013-face-redesign2/02-task-01.md` (Supervisor Codex, Chief 2026-10-13 승인)
- 담당: OpenCode `opencode/muse-spark-1.3-contributor-free` (Muse Spark 1.3 Free)
- 작업 위치: `C:/Users/kdrea/.codex/worktrees/face-redesign2/boxcycle` (본 worktree만 수정, main worktree 미수정)
- 시작 상태: branch `face-redesign2`, HEAD `e3c4fccdb66523c3a15aacab3a0fea02e9ad2ac7`, dirty 없음
- 종료 상태: 미커밋·미푸시·미배포 (지시대로 멈춤)

## 변경 파일

- `apps/web/src/components/map/MapView.css` 하나만 변경 (87 insertions, 79 deletions, `git diff --check` PASS).
- `mapPopupElements.ts` 미수정. 이유: 파일 내 유일한 컬러 inline style은
  `createRouteEndpointPinEl`의 S핀 `#16a34a`·E핀 `#dc2626`이며, 이는 「지도와 대응하는
  의미색」이라 지시가 보존을 명하므로 손대지 않았다. 나머지 팝업 DOM은 전부 CSS 클래스 방식이다.
- `:root`/공용 테마 토큰 미수정 (해당 파일에 `:root` 없음, 팝업 스코프 내 값만 교체).
- 대상 밖(RouteDock, MapViewSheet, activity 팝업, HUD, 라이더·동행 마커, 표고, 축척) 미수정.
- 추가 1건: `.map-view__pick-btn--profile.is-active:hover:not(:disabled)` 규칙 1개 추가
  (아래 「실측 수정」 참조). 색 성분 선언 3개뿐이며, DOM·문구·이벤트 변경 없음.

## 컬러 매핑 (지시 토큰으로만)

| 부위 | 변경 전 | 변경 후 | 근거 |
|---|---|---|---|
| dock/popup 패널 바탕 | `rgba(15,23,42,0.92)` | `#FFFFFF` (불투명 흰색 허용 조항) | 기본 바탕 |
| 패널 테두리 | `rgba(248,250,252,0.18)` 등 | `#CBD5E1` | 테두리 |
| 팝업 tip 4방향 | `rgba(15,23,42,0.92)` | `#FFFFFF` | 패널과 동일 |
| 닫기 ✕ (2종) | 바탕 `rgba(248,250,252,0.12)`·글자 `#f8fafc` | `#F1F5F9`·`#475569`, hover `#EFF6FF`·`#1F2937` | 보조 바탕/보조/hover/본문 |
| 본문/주소 | `#f1f5f9`/`#f8fafc` | `#1F2937` | 본문 |
| 좌표·부가 | `rgba(226,232,240,0.78)` | `rgba(71,85,105,0.78)` (alpha 보존) | 보조 |
| pin-row sticky 바탕 | `rgba(15,23,42,0.98)` | `#FFFFFF` | 기본 바탕 |
| Start (주황) | `rgba(232,163,61,·)`·`#bae6fd` | `#2563EB`·`#FFFFFF`, hover `#1D4ED8` | 실행/선택, 선택글자, 주요버튼 |
| End (하늘) | `rgba(14,165,233,·)`·`#f0f9ff` | Start와 동일 `#2563EB`·`#FFFFFF` | 실행 통일 |
| WP (주황 tint) | `rgba(251,146,60,·)`·`#fed7aa` | `#F1F5F9`·`#CBD5E1`·`#1F2937`, hover `#EFF6FF`+테두리 `#2563EB` | 보조바탕/테두리/본문 |
| 토큰 구분선/제목 | `rgba(148,163,184,0.22)`·`#f8fafc` | `#CBD5E1`·`#1F2937` | 테두리/본문 |
| 토큰 title/부족/소진/대기 | `rgba(241,245,249,0.92)`/`#fca5a5`/`#86efac`/`rgba(191,219,254,0.9)` | `rgba(31,41,55,0.92)`/`#DC2626`/`#16a34a`(S핀과 같은 녹색 계열 유지)/`rgba(37,99,235,0.9)` (alpha 보존) | 오류/삭제, 의미색(녹색·파랑 계열) 보존 후 흰 바탕 가독 nominal |
| 경로삭제·중립 버튼 | `rgba(248,250,252,·)`·`#e2e8f0` | `#FFFFFF`/`#F1F5F9`·`#CBD5E1`·`#475569` | 중립 유지 (삭제 적색화 안 함) |
| 수단 버튼 미선택 |同上 중립 | `#F1F5F9`·`#CBD5E1`·`#475569`, hover `#EFF6FF` | 보조바탕/테두리/보조 |
| 수단 버튼 선택 | 주황 `rgba(232,163,61,·)`·`#f0f9ff` | `#2563EB`·`#FFFFFF` (+hover 유지 규칙 추가) | 실행/선택 |
| 거리 자동영역 상단선 | `rgba(248,250,252,0.1)` | `#CBD5E1` | 테두리 |
| 거리모드 글자/체크·슬라이더 accent | `rgba(226,232,240,0.9)`/`#ef4444` | `rgba(71,85,105,0.9)`/`#2563EB` | 보조/실행 |
| ±버튼·숫자입력 | `rgba(15,23,42,0.55)`·`#f8fafc` | `#F1F5F9`/`#FFFFFF`·`#CBD5E1`·`#1F2937` | 보조바탕/기본/테두리/본문 |
| 상태 기본/탐색중/실패/성공 | `rgba(226,232,240,0.9)`/`#fde68a`/`#fca5a5`/`#86efac` | `rgba(71,85,105,0.9)`/`#B45309`(amber 유지)/`#DC2626`/`#16a34a` | warning 의미 유지 + 흰바탕 가독 |
| 진행바 트랙/막대 | `rgba(248,250,252,0.12)`/`#f0a52f`(주황) | `#F1F5F9`/`#2563EB` | 보조바탕/실행 |
| awaiting outline | `rgba(232,163,61,0.35)` | `rgba(37,99,235,0.35)` (alpha 보존) | 실행 |
| 거리 칩/선택 칩 | `rgba(148,163,184,0.5)`/선택 `currentColor+rgba(148,163,184,0.22)` | `#CBD5E1`/선택 `#2563EB`+`#EFF6FF` | 테두리/선택 |
| 그림자 offset/blur/spread·backdrop-filter·opacity·두께·radius·배치·타이포·animation | 전부 보존 | — | 지시 보존 조항 |

보존: S핀 `#16a34a`·E핀 `#dc2626`(TS inline), 경유지 마커 골드 그라디언트, activity 팝업,
라이더/동행/펄스 색, 그림자 색상 `rgba(0,0,0,0.38)`(geometry와 함께 유지).

## 실측 수정 1건 (보고)

- 현상: after 캡처 `04-profile-cycling`에서 선택된 수단 버튼에 마우스가 올라가면
  기존 hover 규칙(명시도 0,3,0)이 `is-active`(0,2,0) 배경을 덮어 `#EFF6FF` 바탕에 흰 아이콘이
  되어 읽히지 않았다. 구 CSS도 같은 cascade였으나 짙은 패널이라 읽혔던 것이다.
- 조치: 색 성분만 가진 `.map-view__pick-btn--profile.is-active:hover:not(:disabled)`
  규칙 1개 추가 (`#1D4ED8`/`#1D4ED8`/`#FFFFFF`). DOM·문구·이벤트·셀렉터 계약(클래스명) 변경 없음.
- 재캡처에서 선택+hover가 진한 파랑+흰 아이콘으로 읽힘을 확인.

## 검증 명령과 결과

| 명령 | 결과 |
|---|---|
| `git diff --check` | PASS (exit 0) |
| 비색상 동등 검사 (주석 제거 후 색토큰 `#…`/`rgba()`/`currentColor`를 `COLOR`로 치환해 전후 비교) | PASS — 추가 규칙 1개 제외 전면 동일 |
| 셀렉터 집합 비교 | 추가 규칙 1개 제외 175개 동일, 삭제·개명 0 |
| pick 스코프 구색 잔류 검사 (주황·짙은남색·구 accent 잔존 여부) | 0건 (히트 6건은 신 토큰 `#F1F5F9` 대소문자 중복 검출) |
| CSS 괄호 균형 `{`/`}` | 178/178 |
| `npx tsc -b` (apps/web) | 미실행 — worktree에 `node_modules` 없음(CSS-only 변경이라 타입 영향 없음). root tsc 바이너리는 main worktree에만 존재 |
| 전역 e2e | 미실행 (지시: 불필요). 관련 계약 `route-pick-popup-title` 스펙은 에뮬레이터 필수라 미실행 — 대신 아래 실앱 캡처로 대체 |
| 실앱 캡처 `evidence/capture.mjs` (Playwright chromium, 실서버) | PASS — 2 viewport × 4 상태 × 전후 = 16 PNG, console error 0 |

## 실앱 증거 (실행 URL `http://127.0.0.1:5014/`, 서버 유지 중)

- 서버: 본 worktree `apps/web`을 vite 8.0.11로 `RTW_DEV_PORT=5014 --strictPort` 기동.
  `node_modules`는 루트에 main worktree 동일 버전 junction 연결(git 무시 대상, repo 오염 없음).
  포트 5013은 타 세션 vite(Main worktree, PID 57364)가 이미 점유 중이라 5014 사용. 5000도 타 worktree 점유.
- 절차: Guest 시작 다이얼로그 → 지도 캔버스 클릭(60% x, 50% y) → `.map-view__pick` element 캡처 →
  Start 클릭 → 거리모드 체크 → 자전거 수단 클릭. 동일 절차·동일 viewport로 구 CSS(before)/신 CSS(after).
- rect 비교 (before vs after, 동일 viewport·상태): panel box·자식 box·scrollW/H 전부 소수점까지 동일
  (8/8 상태). 유일한 차이는 계산된 `color` 값 (`rgb(241,245,249)`→`rgb(31,41,55)`)으로 의도된 변경.
  줄바꿈·스크롤 변화 없음.

| viewport | 상태 | before | after |
|---|---|---|---|
| 800×360 | 핀 전 | `evidence/before-800x360-01-before-pin.png` | `evidence/after-800x360-01-before-pin.png` |
| 800×360 | Start 후 | `evidence/before-800x360-02-after-pin.png` | `evidence/after-800x360-02-after-pin.png` |
| 800×360 | 거리모드 ON | `evidence/before-800x360-03-distance-on.png` | `evidence/after-800x360-03-distance-on.png` |
| 800×360 | 자전거 선택 | `evidence/before-800x360-04-profile-cycling.png` | `evidence/after-800x360-04-profile-cycling.png` |
| 667×300 | 핀 전 | `evidence/before-667x300-01-before-pin.png` | `evidence/after-667x300-01-before-pin.png` |
| 667×300 | Start 후 | `evidence/before-667x300-02-after-pin.png` | `evidence/after-667x300-02-after-pin.png` |
| 667×300 | 거리모드 ON | `evidence/before-667x300-03-distance-on.png` | `evidence/after-667x300-03-distance-on.png` |
| 667×300 | 자전거 선택 | `evidence/before-667x300-04-profile-cycling.png` | `evidence/after-667x300-04-profile-cycling.png` |
| 계측 | — | `evidence/before-measurements.json` | `evidence/after-measurements.json` |
| 스크립트 | — | `evidence/capture.mjs` (실앱 표방 아님, 캡처 도구) | — |

## 한계·미확인 (가짜 성공 아님)

- 토큰 잔액 상태색(insufficient/spend/pending)·경고 토스트·disabled 중립색은 실 잔액을 조작하지
  않아 화면으로 미확인. 값 치환이 1:1이라 회귀 위험은 낮음. 필요시 Supervisor가 에뮬레이터로 확인.
- `04` 재캡처 후 `after-measurements.json`을 재생성했으므로 rect 비교는 최종 CSS 기준이다.
- 범위 밖 발견(수정 안 함): pin-row 버튼 높이가 약 20px로 작다(기존). 보고만 한다.
- dev 서버는 Chief 확인용으로 켜둠 (`http://127.0.0.1:5014/`). 끌 때는 해당 vite 프로세스 종료.

## 다음 금지

다음 패널 변경 금지. 커밋/push/배포 금지. 본 결과 제출 후 정지.
