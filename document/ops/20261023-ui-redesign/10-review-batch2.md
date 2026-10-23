# 묶음2 감리 — 지도 대기·주행·일시정지

2026-10-23 Codex · 구현 Cursor · **LOCAL_VERIFIED — Chief 화면 확인 대기.** 커밋·푸시·배포 없음.

[지시](08-task-batch2.md) · [Cursor 원결과](09-result-batch2-cursor.md) · [Supervisor 보완](12-result-batch2-supervisor.md) · [시안/캡처 비교](comparison-batch2.html) · [로그인 복구](11-login-environment-fix.md)

## 변경과 검수

- 출발 전 경로 거리·출발/도착 고도. 기존 표고 프로필 연결, 로딩/실패/없음 표시, finite 검증. 새 API·숫자 조작 없음.
- 카메라 6종을 현재 시점 메뉴 하나로 변경. 기존 선택 callback·1번 순환 유지, 현재 선택·ESC·바깥 클릭 검증.
- 시작44px 파랑, pause56px 파랑, stop44px 흰색. 일시정지 경로 바꾸기/주행 끝내기/다시 달리기 직접 표시.
- 250px 흰 경로 카드·기존 주소/경유/교환/접기. 센서 설정은 ready/setup 카드, 나머지 사용 단계는 기존 주행바. 접어도 접근 유지.
- 한국어 코칭 표시. 현재 문구 우선 번역으로 fresh-tip 회전의 stale tipId를 처리. TTS·운동 알고리즘 유지.
- 감리에서 발견한 센서 숨김·fixed CSS·고도 폭 회귀를 수정했다. 기존 준비 조건·이어달리기·스택 계약의 시험을 보존했다.

## 시안 비교

비교 HTML은 시안04/08/09와 실제 App 캡처를 나란히 제공한다. 메모리 프리뷰는 선택자로 별도 표시한다. 지도와 수치는 원본 시안과 다르다.

| 화면 | 반영 | 차이/범위 |
|---|---|---|
| 대기04 | 거리·고도, 흰250px 카드, 파란 시작 | 실제 Guest 계정·센서 상태 사용. +경유지는 기존 지도 팝업 접근 |
| 주행08 | 카메라 메뉴 하나, pause/stop 색·크기, 한국어 코칭 | 기존 미니맵 엔진·HUD 밀도·하단 시계 여백 유지. 실제 BLE 없는 수치는 생성 안 함 |
| 일시정지09 | 멈춤 안내·직접 조작3개, 속도 숨김 | 기존 미니맵 경로/접기/도착 표시 유지. 기존 센서 접근 보존 |

## 실행 검증

실행 위치 `C:\20.HDev\boxcycle\apps\web`. 실제 주행은 운영 Firebase가 아닌 auth/functions/firestore/database 에뮬레이터에서 단일 worker로 실행했다.

| 명령 | 결과 |
|---|---|
| `npm run test:quick` | PASS 1347/1347. 당시 계약시험7개; 이후 보존 계약13개+새 코칭1개 아래 별도 검증 |
| `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/ride-hierarchy/sensor-chip-slot-contract.test.ts scripts/ride-hierarchy/coaching-display-ko.test.ts` | PASS 14/14 |
| `npx tsc -b --noEmit` | PASS |
| 변경 source/preview/vite eslint | PASS 0error, App 기존hook경고7 |
| `node scripts/ride-verify/verify-selectors.mjs` | PASS 19단계 |
| 실제 주행진입 `ride-entry` | PASS 7/7 (`evidence/batch2-live-final.log`) |
| 최종 화면17+실앱캡처1 | PASS 18/18, `evidence/batch2-review-final.log` |
| 지도/고도 로딩 후 최종캡처 재수집 | PASS 1/1, `evidence/batch2-capture-final.log`. ready 46→30m 실제값, 주행/일시정지 route-fit 캡처 |

저장소 루트 `C:\20.HDev\boxcycle`:

- `node scripts/check-code-tidy.mjs`: PASS 기준선 이내, 반복줄18·exports185·types44.
- `node scripts/check-dep-direction.mjs --check`: PASS 방향0·순환0·미지정0. 신규 표시 파일 도메인 등재, 허용규칙 미변경.
- `node scripts/check-document-system.mjs`: PASS 새 오류/깨진 링크0.
- `git diff --check`: PASS.
- 기존 dirty 증거 JSON SHA256 `4CAFA2A22CEAC8547D7EDB44D22A09082D0710EBDD71B6BDC34D59D57378179F` 보존.

초기 실패도 보존: UI 초기 label strict/프리뷰 no-op, 그다음 고도 넘침/옛 DOM/작은 접기버튼은 수정. 실앱 캡처 첫 실행의 `Basic 4` 텍스트 셀렉터는 묶음1의 정리된 제목과 달라 timeout; 기존 주행 시험처럼 카탈로그4번째 항목을 선택하도록 수정했다. Firebase CLI 첫 실행은 sandbox config 읽기 EPERM으로 실패, 권한 있는 에뮬레이터 실행으로 전환했다. 실패를 PASS에 포함하지 않는다.

## Chief 직접 확인

현재 정상 앱5000·프리뷰5020 서버 실행 중이면 실행 명령은 생략한다. 앱/로그인은 **http://localhost:5000/**. 계정선택까지 확인했으며 Google 로그인 완료 자체는 Chief가 직접 선택한다.

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
$env:RTW_DEV_PORT='5000'
npm run dev -- --host 0.0.0.0 --strictPort
```

확인: 앱 진입 → 사용자 정보 → 회원 등록/로그인 → Google 계정 선택. 프리뷰용 harness 루트에서 로그인하지 않는다.

시안 비교 파일 전체 경로 `C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\comparison-batch2.html`.

프리뷰 서버가 없을 때:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
$env:RTW_DEV_PORT='5020'
npm run dev:localhost -- --mode harness --strictPort
```

`http://127.0.0.1:5020/scripts/ui-800x360/preview.html?state=ready` → 시작 → 일시정지 → 다시 달리기 → 종료. 대기에서 경로 접기 후 센서 설정, 주행에서 카메라 메뉴6개/1번 반복도 확인. 프리뷰는 서버 기록 없는 예시 화면이다.

## 실행자 운용

OpenCode 무료 DeepSeek·GLM은 묶음1에 조사/기계 작업으로 참여했다. 이번 MiMo도 공통 무료한도 종료로 진행 불가. Cursor 구현, Codex 감리/보완/시험/캡처. ego lite CLI는 일반/권한 실행 모두 bootstrap 연결 실패하여 Playwright로 전환했다. 도구 실패를 제품 검증 통과로 계산하지 않는다.
