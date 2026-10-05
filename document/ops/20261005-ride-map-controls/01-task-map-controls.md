# Cursor CLI 구현 지시

| 항목 | 내용 |
|---|---|
| 문서 유형 | execution — Codex Supervisor → Cursor CLI |
| 최초 작성 | 2026-10-05 |
| 독자 | AI |
| 상태 | READY_FOR_DEVELOPMENT |

## 확정 범위·완료 조건

Chief 요청: 주행 시 Quick Camera 1~6 바로 아래에 기존 맵 HUD 기능을 연결한 Outdoors/Satellite 토글 버튼과 줌 조절 UI를 배치한다. 하나의 간결한 보조 행으로 배치하고 계정 버튼/센서/RouteDock/지도와 겹치지 않게 한다. 기존 맵 뷰 시트는 유지한다.

담당 파일: apps/web/src/components/maphud/MapHud.tsx·MapHud.css와 App.tsx의 해당 prop 배선, 필요할 때 공통 맵 설정의 기존 helper·동작 공유 및 의미 있는 회귀 확인. 기존 mapStyle/mapZoom/zoom 버튼의 handler·경계값을 재사용한다. 맵 스타일 옵션에 RTW Dark가 있으면 삭제하지 않고 새 버튼만 Outdoors↔Satellite 두 상태를 제공한다. 현재가 Dark이면 첫 클릭에 Outdoors로 전환한다. 토글 표시/aria는 현재 스타일과 다음 동작을 알린다.

줌은 기존 맵 뷰 HUD의 줌/거리 조절 의미와 연결한다. topDown/routeFit/follow에서 기존 시트가 서로 다른 제어를 쓴다면 해당 동작을 먼저 조사해 공통화/재사용하고 동작 차이를 결과에 명시한다. 새 카메라 거리·zoom 체계를 만들지 않는다. 주행 중 클릭 값이 매 프레임 카메라에 즉시 덮어써지지 않는지 확인한다. 기존 공용 동작 의미가 바뀌는 새 설계는 실행하지 않고 사실과 대안을 보고한다.

주행 중 카메라 버튼이 표시될 때만 새 UI도 표시한다. 클릭/touch/pointer 전파를 맵으로 차단한다. UI 공간밀도 지침을 읽고 740×300 폰 가로에서 전/후 캡처·rect·터치타깃을 보고한다. 버튼 짧은 텍스트 또는 ± 아이콘, 접근성 이름·disabled 경계 처리. 임의 고정 폭/큰 패널 금지.

## 구현·검증

- 다른 작업 변경이 많은 공유 워크스페이스다. 단독 작업이 아니며 기존 변경을 되돌리거나 커밋에 섞지 않는다. 커밋·push·merge·배포 금지. document 정리나 브랜드/calorie 변경은 범위 밖.
- .agents/skills/ride-verify/SKILL.md와 apps/web/scripts/ride-verify/HARNESS.md를 따르고 `node scripts/ride-verify/verify-selectors.mjs`(apps/web 기준) 필수. 변경된 앵커가 없으면 계약을 불필요하게 수정하지 않는다.
- 적절한 typecheck·변경 파일 lint와 기존 관련 camera/zoom 계약 검증. 토글 왕복·줌 +/-·모드별 지속 적용에 대한 의미 있는 검사. UI만 저위험 변경이므로 구현을 그대로 복제한 테스트는 만들지 않는다.
- 실제 dev/Playwright가 가능하면 기존 서버를 재사용해 단일 worker로 시각/행동 검증. 전/후 캡처와 폰 가로 rect 및 overlap 검사. 테스트 환경은 기존 harness를 사용하고 auth bypass를 새로 만들지 않는다. 5분 무진전이면 서버/포트/프로세스/log를 확인하고 정적/단위 등 대체 경로로 전환. 브라우저 준비 불가를 성공으로 보고하지 않는다.
- 실행 명령·exit code·pass/fail·미실행 이유, 실제 변경 파일, 카메라 모드별 UI 동작, 한계·캡처 경로를 `02-result-map-controls.md`에 남긴다. 결과는 DEVELOPMENT_DONE까지만. README 최신 결과 링크 갱신. 긴 stdout 설명 대신 결과 파일에 기록하고 최종 stdout은 10줄 이내.
- 토큰 절약: 필요한 함수와 관련 문서만 읽고 전체 저장소 탐색을 반복하지 않는다. 증거 중심으로 구현·검증을 완료한다.
