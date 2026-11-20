# 간편 인터벌 자동 종료와 구간 저장

2026-11-20, Codex. 간편 인터벌로 생성한 경로에서 프로그램이 완료되면 주행을 한 번 종료한다. 일반 경로에서 인터벌을 끝내면 자유 주행을 이어간다. 간편 경로를 바꾸거나 인터벌을 끄면 일반 주행으로 돌아간다.

종료 결과의 「내 경로로 저장」은 출발점부터 실제 종료 위치까지의 선을 완주 경로로 저장한다. 중간에 직접 끝내도 같은 방식으로 자른다. 목적지에 먼저 도착하면 원래 경로 전장을 사용한다. Ride의 계획 거리와 진행률은 기존 기준으로 기록한다. 거리가 짧아 경로 저장 자격이 없는 경우 운동 기록은 기존 인터벌 보존 기준을 따른다.

같은 릴리스에 수동 사이클용 강도 선택, 칼로리 추정, 수행·체감 기록, 기간 통계를 포함한다. 이 기능의 체감 평가 저장에는 Firestore Rules 변경이 필요하다. 서버에는 짧은 거리의 운동 기록을 관리자 통계에서 집계하는 `getAdminDashboard` 변경을 반영한다.

단위 시험은 `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/quick-interval/quick-interval-cut.test.ts`로 실행한다. 실제 앱 동작은 `e2e/quick-interval-end-cut.spec.ts`에서 로컬 Firebase 에뮬레이터와 결정적인 자동 경로 응답을 사용해 확인한다. 결과 캡처는 저장소의 `tmp/quick-interval-end-cut`에 생성한다.
