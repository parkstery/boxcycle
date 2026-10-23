# 묶음 2 — 지도 대기·주행·일시정지

2026-10-23 Chief 「로그인 복구하고 다음 작업 진행」. Supervisor Codex, 구현 Cursor. 로컬 구현·감리·캡처까지, 커밋/푸시/배포 없음.

먼저 AGENTS.md·Ontology·디자인 규칙(`../20261023-leaderboard/design-system/README.md`)·ride-verify 스킬과 `mockups/04-Main.html/png`, `08-Riding.html/png`, `09-Paused.html/png`를 읽고 화면부터 확인한다. 묶음1 제품 변경·프리뷰·증거는 보존. 기존 dirty JSON·.out/·cdbox.bat 보존.

## 구현

1. 대기: 출발 전 0 시간/평균/속도 대신 「경로 N km」「고도 시작→끝 m」. 실제 route-preview에 이미 있는 거리·표고 데이터를 최소 props wiring으로 전달. 표고 없거나 로딩/오류면 실제 상태 설명, 숫자 만들기/새 API 금지. active ride metrics·누적/전체·새도로 의미 유지. 센서 케이던스 실제 데이터가 있으면 주행지표에 rpm 표시, 실제 값 없는 상태 숫자 가짜 표시 금지.
2. 카메라: 1~6 버튼을 「현재 시점 ▾」 버튼 하나+메뉴로 압축. 기존6개 onSelect 콜백/1번 순환 동작 그대로 재사용. 1번 안의 모드 접근도 잃지 말고 현재 label 반영. 열기/닫기/ESC/바깥 클릭/현재 aria 선택/폰 터치 가능. 주행·일시정지 시 지도 스타일/줌 등은 시안대로 정리하되 접근 경로 없애지 않는다(맵뷰 기존 기능 보존).
3. 주행 시작은 파랑 주버튼(44px, 시안 「주행 시작」 text). 주행중 pause 파랑56px, stop 흰44px+중립 아이콘. 일시정지: 「잠깐 멈췄어요」·경로 바꾸기/주행 끝내기/다시 달리기 직접 노출, ... 뒤에 숨기지 않음. label 재개·주행 종료 등 기존 aria 앵커는 호환 유지 가능. sensor chip 하나 유지·실제 준비 조건/핸들러 변경 금지.
4. 코칭 사용자 문구 영어가 있으면 실제 문장 생성 소스를 찾아 한국어 해요체로. 수치·운동 알고리즘·TTS/재생 정책 변경 금지.
5. RouteDock 흰 단일 판·출발/경유/도착 줄·교환 버튼·원형/색 장식 정리. 04 시안 250px 폭 기준. 주행시 미니맵은 기존 엔진·위치/접기 계약 유지. 출발+경유3+도착 전체 주소 정보 유지, 캡처에서 잘림 없는지 확인. 변경은 표현/레이아웃만.

## 소유/금지

소유: `apps/web/src/components/maphud/MapHud.tsx/css` 및 새 `CameraViewMenu.tsx/css` 허용, `ride/RideControlBar.tsx/css`·`RideMediaButton.css`, `route-dock/RouteDock.tsx/css`와 해당 시각 전용 CSS. App 최소 props wiring, features/map-overlays의 HUD props 타입 필요시 최소 변경. 실제 코칭 문구 소스는 파일 먼저 결과에 명시하고 표시 문구만 변경. `apps/web/scripts/ui-800x360/preview.tsx` props를 실제앱과 함께 갱신 가능. 다른 파일은 필요한 최소 수정 사유 기록.

functions/·Rules·데이터모델·인증·동기화·비용/API·카메라 수학·기준선/dep-layers 검사규칙 변경 금지. git worktree/restore/clean/stash/브랜치전환/커밋/푸시/배포 금지. localhost3000/5000/5020/5021 및 에뮬레이터는 Supervisor가 소유. 서버 시작/종료 금지.

같은 작업 트리에 Supervisor가 로그인 환경/검증 파일 편집 중이므로 되돌리지 않는다. product CSS/JSX를 프리뷰에 복제하지 않는다. UI 데이터 하드코딩 금지. 공용 컴포넌트 style 영향 주의. 큰 파일 래칫에 맞춰 새 카메라 UI는 별도 컴포넌트로 분리. 반복 CSS/JSX 정리, 기준선 증가 금지.

## 검증·결과

결과 `09-result-batch2-cursor.md`를 먼저 만들고 갱신. tsc -b --noEmit / 변경eslint / selector19만 실행. 무거운 전체단위·e2e는 Supervisor가 순차 실행.

Supervisor: 667×300·800×360·844×390 ready/riding/paused actual component 캡처, 시작→pause→resume→end, 카메라 메뉴·6개 콜백·ESC, 실제 App e2e7, selector·타입·lint·단위·정련·의존방향. 기존 ui-800x360:84의 「주행bar 높이≤36」은 실제 44px 조작을 반영하지 못하므로 신규56px 시안 계약에 맞춰 검사 의도를 갱신하되 조작 가능/지도겹침 조건 유지. 옛 camera selector 시험도 새 메뉴 선택에 맞춰 동등 기능을 검증한다. 보고 `10-review-batch2.md`·comparison-batch2.html, Chief 직접 확인 경로/명령/주소 포함.
