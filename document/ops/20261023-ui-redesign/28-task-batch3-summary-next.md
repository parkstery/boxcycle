# 지시 28 — 묶음3 주행 결과·다음 주행의 UI·UX 품질 개선

2026-10-24 Chief: 「우리가 현재 진행하고 있는 UI 수정 작업은 아마추어 같은 품질 낮은 UI, UX의 퀄리티를 높이는 것이다. 이 관점에서 작업을 이어간다. 다음 작업 계속해.」

Supervisor Codex / Developer Cursor CLI. 결과 `29-result-batch3-summary-next.md`. 로컬 구현·비교까지, 새 화면 배포는 이번 실행자 범위 밖이다.

## 먼저 읽을 것

- `document/reference/product/261024-RTW-Chief-지정-디자인-고정.md` 1~10.
- `document/ops/20261023-leaderboard/design-system/README.md`·`tokens.json`.
- `document/ops/20261023-ui-redesign/mockups/10-Summary.html`·`.png`, `11-NextRide.html`·`.png`.
- `apps/web/src/components/ride/RideSummarySheet.tsx/.css`, `NextRideCard.tsx/.css` 및 해당 단위·계약 시험. 기존 동작이 정본. 시안의 가짜 값이나 오래된 Guest 설명을 복사하지 않는다.

## 목표·허용 범위

1. 주행 결과: 폰 가로800×360에서 흰 두 칸 판(약740×324), 왼쪽은 사실에 기반한 스토리·새 도로 주인공 숫자·진행 정보, 오른쪽은 결과 제목·보조 지표·저장 상태·기록 보호 안내·기존 행동. 667×300에서도 숫자·단위·확인·저장·닫기에 접근 가능. 작은 화면은 필요한 구역만 스크롤하고 영구적으로 잘리지 않게 한다. 데이터가 없으면 기존의 확인 중/실패/재확인/0·50m 미만/저장중 상태를 유지하고 허위 숫자·내 도로망 합계를 만들지 않는다. 외곽 판 안에 상자를 중첩하지 말고 여백·줄·정렬로 구분.
2. 다음 주행: 같은 흰 판·파란 강조·버튼 종류를 적용. 위치·남은 거리·경로/진행 정보의 위계를 정리. 이어달리기(준비만)·끝점에서 새 경로·지도 보기·숨기기 콜백과 조건을 그대로 유지한다. 종료점이 없거나 완료·미완료·긴 지명 등 기존 상태를 다룬다. 새 버튼·마케팅 문구·확인 단계 추가 금지. 겹침 없이 지도 공간을 확보.
3. JSX 구조·CSS·접근성 문구·프리뷰·필요한 화면 시험만 변경. 계산·인증·저장·Firestore/API·스토리 정책·주행/정복/다음주행 판정·공용 props 인터페이스 변경 금지. App.tsx 변경이 필요하면 결과에 사유만 적고 이번에는 건드리지 않는다. 기존 class/aria/data-* 시험 계약 보존.
4. `scripts/ui-800x360/preview.tsx`에 다음주행 상태(메모리 fixture)와 결과 주요 상태를 연결. 새 테스트 fixture·상태는 이 스크립트 안에 두고 제품에 디버그 props를 추가하지 않는다. 가능한 기존 컴포넌트 props만 사용. `e2e/ui-redesign-batch3.spec.ts`에서 800×360·667×300·844×390 레이아웃/숫자/버튼과 콜백·긴문구·저장 상태 검증. 기존 기대값·게이트 완화 금지.
5. 캡처 `evidence/batch3/before-*`·`after-*`(800×360·667×300). 변경 전 먼저 캡처. 기존5000은 운영 연결이므로 시험·운영 데이터 읽기/쓰기 금지. 프리뷰5020 harness만 사용하고 끝나면 자신이 만든 서버만 종료. before/after를 기존 시안과 비교할 파일 `comparison-batch3.html` 작성. 캡처 실제 데이터를 바꾸거나 앱처럼 보이게 합성하지 말 것.

## 금지 — Chief 고정

1 녹색 원형 시작 아이콘 / 2 아이콘 일시정지 조작 / 3 주행·일시정지 중 지도 스타일·줌 / 4 순위 원형 그래프 아이콘 / 5 경로당 한 줄·이동수단 아이콘 / 6 경로 목록 불투명 흰 판 / 7 지도 위 정보 바탕 없는 윤곽선 / 8 소문자 km / 9 야외·위성만 / 10 인라인 주행 기록 유지. 계정 패널·지도 조작부·경로 목록은 변경 범위 밖.

다른 작업자와 같은 작업 트리다. 다른 변경을 되돌리지 말 것. `.out/`·`cdbox.bat`·`15-entry-flight-metrics.json` 손대지 말 것. 기존3000/5000/5040 종료 금지. git worktree/restore/checkout/clean/stash/commit/push 금지. 기준선·시험 기대값 완화 금지. HANDOFF/PROGRESS/상태보드·결정 로그는 Supervisor 소유. functions·의존 파일·도메인 lib 수정 금지.

## 검증·인계

실행 폴더 `C:\20.HDev\boxcycle\apps\web`.

- `npx tsc -b --noEmit`, 변경파일 eslint, selector19.
- 프리뷰 harness `$env:RTW_DEV_PORT='5020'; npm run dev:localhost -- --mode harness --strictPort`.
- `node ../../node_modules/@playwright/test/cli.js test ui-redesign-batch3 --workers=1 --retries=0`.
- 무거운 전체 시험은 실행하지 말고 Supervisor에게 맡긴다. 명령·결과·안 한 것 구분. 5분 무진전이면 같은 대기 반복 금지, 로그/프로세스/포트 조사 후 단일worker·headless 경로 전환.
- 결과29에 실제 diff·보존 기능·숫자/상태 계약·캡처 경로·명령별 증거와 남은 제한 기록. 실행 종료 시 포트5020 정리.
