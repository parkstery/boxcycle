# 지시02 — Chief 승인 릴리스

2026-10-20 Chief가 「커밋 푸시 병합 배포하라」 승인. 지시01의 커밋·배포 금지는 이 릴리스에 한해 해제한다.

- 담당 Codex. Cursor는 앞선 1회 ENOMEM으로 시작 실패했으며 릴리스 조작·검수는 Supervisor가 직접 수행.
- 범위: 이전 설계 세션의 신규 도로 UI/geometry/서버 최신 날짜 저장·Rules와 현재 수정 전체. 코드·시험·의존 방향 등록·해당 ops 기록만 커밋. AGENTS/CLAUDE, lint16의 독립 시험 수정 4건, 다른 묶음 증거/패치·.out·cdbox.bat는 제외.
- 배포 전 추가 보완: 실제 서버 일자 YYYY-MM-DD를 클라이언트에서 일관되게 해석(기존 compact도 허용), 서버 long trace 12m 재분할로 양끝 신규 구간 누락 방지, 실제 삭제 함수에도 recentNewRoad 정리 추가. 인정 거리·Trust Tier 수치는 변경하지 않는다.
- 검증: 서버 전체 시험·lint, 웹 전체 push 게이트, 신규 도로 React 시트 시험, 신규 Firestore Rules 소유자 읽기/타인·인증전 읽기 차단/클라이언트 쓰기·삭제 차단.
- Git: codex/new-road-display-release → main2. main은 최종 안정선 규칙에 따라 변경하지 않는다. 현재 main2에 이미 존재하는 원격 미반영 2커밋(profile/menu)은 새로 수정하지 않는다.
- 배포는 커밋의 분리된 소스에서 빌드. 프로젝트 boxcycle-dc2df, 대상 Hosting·Firestore Rules·conquestOnRideCreated·deleteAccountHttp·resetGuestHttp·guestLifecycleSweep. 계정 정리 함수 변경은 신규 컬렉션 정리 연결이며 운영 삭제를 수동 실행하지 않는다.
- 완료: 원격 main2 SHA·병합 확인, 선택 대상 배포 성공, 운영 HTML/bundle 대조·읽기 smoke. 결과03-result-02-release.md와 검수04-review-02-release.md에 실제 종료코드와 한계를 기록.

새 디버그 코드·주소 스위치·스크립트를 만들면 `apps/web/dev-tools.json` 에 등록한다(분류·목적·켜는 법·만료). 운영에서 켜지는 도구 화면은 동적 import 로 분리한다. 이번 추가 파일은 시험 파일로 등록 예외다.
