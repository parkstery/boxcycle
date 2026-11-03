# HANDOFF — 지금 상태 한 장


| 항목 | 값 |
|---|---|
| 담당 | **Claude Code** — 2026-10-30 구름·톱니·접기 캐럿 배포 완료, 대기 |
| 갱신 | 2026-10-30 19시 — 11eb53aa 배포, 시안 20261030-gear-cloud-mockup |
| 브랜치 | `main2` |
| 마지막 배포 | 2026-11-03 Hosting(Claude Code): f8d19c69 — 펼친 경로 카드가 버튼 숨김을 막던 결함·ⓖ 빈칸. 앞서 Rules+Hosting fd0ef880 — 닉네임 15자·-_·게스트 ⓖ·메뉴 센서·인터벌 영어 음성. 번들 SHA256 일치 |

## 진행 중

**11-03 전세계 지역 데이터(Claude Code)** — G1 커밋됨(main2, 미푸시·배포 없음): `functions/src/geoRegion/`·`functions/geo-data/v1/`(4.8MB)·`functions/scripts/geo-region/`, package.json 시험 목록 1줄. geoRegion 30/30·functions 201/201·eslint 0. 원본 54MB는 scratchpad(리포 미포함, 재생성은 README). **G0.5 P5·P2 커밋됨(main2, 미푸시)**: `scripts/check-firebase-accessors.mjs`(pre-push 11종째·생존 확인 2항목), `functions/src/rtdbInstances.ts` + 정리 코드 5파일·시험 1파일, `githooks/pre-push`, `scripts/verify-gates-alive.mjs`. functions 204/204·eslint 0·사보타주 확인. **P1 진행 중**(Chief 승인: 이름표 필드+Rules만, 접속 코드 그대로. Rules 배포는 직전 설명 후) — [계획 §5.1](20261103-global-geo-data/00-plan.md). 확인 `cd C:.HDevoxcycleunctions; npx tsc; node --test lib/geoRegion/geoRegion.test.js`

**11-03 버튼 숨김 멈춤 수정+ⓖ 빈칸(Claude Code) — 배포됨(f8d19c69, 운영 js SHA256=로컬)**: 원인 = 펼친 경로 카드(줄 띠)가 RideControlsAutoHide BUSY 에 있어 5초 숨김·탭 토글 둘 다 멈춤(폰 699×273 터치 실앱 실측). BUSY 에서 제외, 고정66 보완. 게스트 이름 `ⓖ tHQb`(고정73). 실앱 시험 `ride-entry.spec.ts` 「실앱 버튼 숨김」(사보타주 확인), ride-entry 8/8, 하네스 autohide 7/7, test:quick 1475/0. 남은 것: Chief 폰 확인.

**11-03 닉네임·게스트 ⓖ·센서 메뉴·인터벌 영어 음성 + 게스트 전부 삭제(Claude Code) — 배포·완료**: 499c0bf2·fd0ef880 푸시(pre-push 10종·1475/0), firestore:rules·Hosting 배포(운영 js SHA256=로컬, 번들에 새 문구 확인). 고정73. 게스트 62명 삭제·검증(Google 5 보호, 남은 것 0) — [README](20261103-guest-reset/README.md). 리셋 도구에 `--baseline`·`--google` 인자 추가. 남은 것: Chief 사이트 확인(새로고침).

**11-03 인터벌 창 3건+RouteDock 줄 띠(Claude Code)**: 운동 중 불꽃·글자 깜빡임·「페달 강도」 문구 제거·진도 막대 아래 테두리 띠(P1)·RouteDock 줄 단위 띠(R2). 고정72 ⑦~⑩(⑩ 주행 시작 카메라 2). **배포됨(939f0ca3, 운영 js·css SHA256=로컬)** — ⑪ 경로 카드 폭 35.28vw 포함.

**11-03 Chief 5건+탭 토글(Claude Code)**: 센서 LED 볼록 단추(A2)·미니맵 캐럿 28px·인터벌 캐럿 왼쪽 위(C1)·도넛 1초 깜빡임·단계 선 그림+작은 글자(B2)·지도 탭 토글+5초 유지. 고정72, [README](20261103-interval-sensor-look/README.md). tsc 0·eslint 0·test:quick 1470/0·화면 e2e 19종 167/3(배치1 기존). **배포됨(f45d6193, 운영 js·css SHA256=로컬)** — 이후 미니맵 버튼 세로(낮은 폰+인터벌+카드만 가로)·도넛 칸 단계 색 포함.

**11-03 Chief 폰 캡처 6장 후속 배포됨(f32dc99d, Claude Code)**: 글자 선택 막기·순위 목록 계정 아래(묶음 겹침 허용)·왼쪽 원형 메뉴 버튼·왼쪽 끝 20px·접힌 인터벌 알약 버튼 오른쪽·경로 손잡이/미니맵 둘 다 접힘=세로·manifest fullscreen+viewport-fit=cover. pre-push 10종·test:quick 1470/0, 화면 e2e 16종 137/3(배치1 기존), 운영 js·css SHA256=로컬·manifest 200. 고정71·README 「후속 2」. 남은 것: Chief 폰 「홈 화면에 추가」 실기 확인. Chief 6장 중 3~6(고도 숫자·이름표 겹침·빈 핀)은 별도·보류.

**11-02 주행 화면 배치 개편 1~5단계·A~C·인터벌 「설정 적용」 전부 배포됨(Claude Code)** — 기록은 [README](20261102-ride-screen-layout/README.md)·고정63~70·git log. App.tsx 래칫 한도 3807 — 더하지 말고 훅·컴포넌트로. 하네스 e2e 남은 실패 14건은 개편 이전부터(9e27638b). 실앱 측정 시험은 5초 숨김 때문에 화면 누름 필요.

10-30~11-01 배포분(D안 인터벌·톱니·구름·RouteDock 도구줄·인터벌 진입·주행 설정·경로 창) 기록은 각 묶음 README·git log. 주행 중 인터벌 진입: 10-30 Chief 결정 — 주행 중 불가, 일시정지에서 INT.

간편 인터벌 01: 실앱 live FAIL 원인 = 시험 결함(adhoc 결과시트엔 .ride-summary__close 없음 → 닫힌 줄 오인, 시트 열린 채 반달 숨김). 제품 루프 없음·HEAD 동일 확인(임시 계측, 파일 삭제됨). impl-standard 재작업 2 진행: 「저장 안 함」으로 정식 닫기, live 2회 연속 PASS.
별도 기존 결함 후보: 일반 주행 결과시트 「닫기」가 10초 내 클릭 안 됨(HEAD 동일), rideEntryHelpers.loadIntroCourse 의 Trail 메뉴 클릭이 지도에 가려짐 → test:e2e:ride 확인 필요. 다음: 재작업 2 재감리 → Chief 보고 → 커밋·푸시·배포.

## 다음 한 걸음

1. Firestore 타인 위치fanout 구조 저감과 운영원가귀속. 자기 문서 제외는 배포됨. 상시 백업을 끊는 안은 복구 지연 때문에 채택 안 함. ([09](20261029-peer-cost-quality/09-firestore-read-reduction.md))
2. [인터벌 경로 계획](20261029-quick-interval-ride/00-plan.md)(Chief 순서 변경): 간편 01(진행 중) → [거리 부족 안내](20261029-interval-route-hint/01-task.md) → [01-B](20261029-quick-interval-ride/01b-task-end-and-cut.md). 인터벌 기준 모두 25km/h(`resolveIntervalBasisKmh` 한 곳), 간편=25×1.3.
3. 커밋 제외: compact-controls evidence zip 2개(각 182MB), `.out/`(배포 빌드 복사본), 빈 `claude-headless.err`.

## Chief 결정 대기

그 밖에 없음 — 2026-10-29 Chief 「한꺼번에 하자」: 간편 인터벌 01 감리·커밋 후 그때까지의 커밋 전부를 한 번에 푸시·Hosting 배포한다(배포 전 대상·범위 설명 후 실행, 적용 검증).

## 잊지 말 것

- 순위 센서 조건 임시 완화는 **출시 전 서버 상수 true 복구** 필요([묶음](20261029-leaderboard-sensor-test/README.md), 체크리스트 §6).
- Firestore 백업이 꺼져 있다(2026-10-08 기준). 운영 데이터 삭제·이동은 Chief 승인 + 사전 스냅샷.

## 지킬 것

- 타인의 변경 보존: `git restore`·`checkout -- .`·`clean`·`stash`·worktree·일괄 되돌리기 금지. 비추적 `.out/`·`cdbox.bat`은 손대지 않는다.
- 다른 프로젝트(imgman) 개발 서버(포트 3000·3001)는 종료하지 않는다.
- Chief에게 링크를 주지 않는다(터미널에서 안 열림). 보여줄 파일은 `Start-Process "<전체 경로>"`로 직접 연다.
- 보고에 수행 agent 명시.
- 실행자 호출·게이트 명령·배포·환경 사실: [수퍼바이저 교대 플레이북](../reference/operations/261023-RTW-수퍼바이저-교대-플레이북.md) §3~§7. 화면 고정 항목: [Chief 지정 디자인 고정](../reference/product/261024-RTW-Chief-지정-디자인-고정.md).
- 옛 구역(10-24~25 묶음3~5 완료 기록, 배포 방법 복제본 절차, 포트 PID 기록)은 archive에 있다.
