# 간편 인터벌 자동 종료와 구간 저장

2026-11-20, Codex. 간편 인터벌로 생성한 경로에서 프로그램이 완료되면 주행을 한 번 종료한다. 일반 경로에서 인터벌을 끝내면 자유 주행을 이어간다. 간편 경로를 바꾸거나 인터벌을 끄면 일반 주행으로 돌아간다.

`9d11be99`와 `9ff9b78f`를 `origin/main2`에 올렸다. `9ff9b78f` 사본으로 Firestore Rules, `getAdminDashboard`, Hosting을 배포했다. 운영 Rules와 로컬 소스를 대조했다. 관리자 통계 함수는 `getadmindashboard-00009-pun`으로 활성화됐고, 운영 HTML과 JS·CSS 17개가 빌드 파일과 일치했다. 확인 주소는 https://boxcycle-dc2df.web.app/ 이다.

종료 결과의 「내 경로로 저장」은 출발점부터 실제 종료 위치까지의 선을 완주 경로로 저장한다. 중간에 직접 끝내도 같은 방식으로 자른다. 목적지에 먼저 도착하면 원래 경로 전장을 사용한다. Ride의 계획 거리와 진행률은 기존 기준으로 기록한다. 거리가 짧아 경로 저장 자격이 없는 경우 운동 기록은 기존 인터벌 보존 기준을 따른다.

같은 릴리스에 수동 사이클용 강도 선택, 칼로리 추정, 수행·체감 기록, 기간 통계를 포함한다. 이 기능의 체감 평가 저장에는 Firestore Rules 변경이 필요하다. 서버에는 짧은 거리의 운동 기록을 관리자 통계에서 집계하는 `getAdminDashboard` 변경을 반영한다.

단위 시험은 `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/quick-interval/quick-interval-cut.test.ts`로 실행한다. 실제 앱 동작은 `e2e/quick-interval-end-cut.spec.ts`에서 로컬 Firebase 에뮬레이터와 결정적인 자동 경로 응답을 사용해 확인한다. 결과 캡처는 저장소의 `tmp/quick-interval-end-cut`에 생성한다.

- 자동 종료와 수동 종료에서 저장한 Route는 실제 주행 거리만 포함하고 완주로 기록됐다. Ride에는 원래 계획 거리가 남았다. 간편 경로를 일반 경로로 교체한 경우 인터벌 완료 뒤에도 계속 주행했다. 방향 자동 생성·경로 교체 회귀도 통과했다.
- 보간을 제거하거나 지도에서 사용하는 거리 대신 길이 비율로 자르면 단위 시험이 실패하는 것을 별도 사본에서 확인했다. 원본 사본으로 다시 실행한 시험은 통과했다.
- 원본 Git 훅으로 웹 회귀 1,618개, 서버 307개, 진입 셀렉터 21개, 코드 정련·의존성 검사를 통과했다. Firestore 에뮬레이터의 저장·조회·권한 시험 5개도 통과했다. 첫 종합 화면 시험은 시간 제한에 걸렸고, 지도 클릭 위치와 수동 종료 시험의 거리 조건을 보완해 관련 시나리오를 다시 확인했다. 실폰·실물 센서와 운영 주행은 미실행이다.
- 로그와 캡처는 `tmp/quick-interval-release`에 있다. 자동 종료와 일반 경로는 `candidate-1/tmp/quick-interval-end-cut`, 수동 종료는 `candidate-2/tmp/quick-interval-end-cut`에 저장했다.
