# 다섯 위치·미디어 버튼 검수

2026-10-22 · record · LOCAL_VERIFIED / Chief 실제폰 확인 대기. [지시29](02-task-29.md) · [결과29](03-result-29.md).

실제 diff 검수: 다섯 위치 버튼 복원/기존 경유지 모델 유지, App 시작 게이트·콜백 재사용, popup 준비 상태 동기화, 하단 왼쪽 재생·오른쪽 삭제, 독립 원형 미디어 스타일 및 접근성 유지. 첨부 이미지는 색/형태 참고이며 CSS로 구현했다. 새 서버·DB·경로 알고리즘·운영 자산 변경 없음.

브라우저14 PASS(53.6s), 거리145 PASS, 진입 셀렉터19 PASS, 타입/build PASS, lint0오류/기존15경고, diff PASS. 실제 MapView와 UI fixture를 구분하며 실제폰/BLE·Firebase 전체진입은 미검증. 초기 실패와 수정 이유는 결과29에 기록했다. 캡처에서 재생 버튼이 최하단 왼쪽, 파란 일시정지/빨간 종료가 공통 흰 배경 없이 각각 원형으로 표시됨을 직접 확인.

## Chief 확인

기존 개발 서버5002 보존. http://localhost:5002 새로고침 → 지도 길게누르기 → 출발·도착 탭의5버튼 → 출발·W1~W3·도착 지정/교체 → 경로 탐색·주행 입력 준비 → 최하단 왼쪽 재생 → 우하단 원형 일시정지·재개·종료 확인. 이번 변경은 운영 미배포.

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npm run dev:localhost -- --port 5002 --strictPort
```

이미 실행 중이면 서버를 추가 실행하지 않고 주소만 새로고침한다. 서버 필요 없이 UI 검수만 할 경우 같은 서버의 http://localhost:5002/scripts/ui-800x360/preview.html?state=riding 및 `/scripts/ui-800x360/map-route-runtime.html`은 서버 쓰기 없는 시험 화면이다.

Git 선별 커밋·푸시 최종 결과는 아래에 추가한다. 기존 공용 ops dirty·out/evidence/cdbox는 보존하며 이번 요약만 선별 stage한다.

## Git 완료

제품·관련 시험/기록 `c7ee09ba` (`feat(ui): restore waypoint slots and circular ride controls`) origin/main2 푸시 exit0. pre-commit lint 오류0/기존15경고. pre-push 전체 단위1340 PASS/실패0/77.2s, 타입·의존성·개발부산물·동행재생·진입19단계 PASS. `.out/step29-push.log`. Git Bash 프로세스에 시스템 Node/npm PATH 우선·ENTRY_LOCATION_TEST_BROWSER=chromium 지정, 훅 우회 없음.

이번 변경은 커밋·푸시까지만 완료했으며 Hosting 배포는 하지 않았다. 운영은 이전28 상태다. 기존 서버5002·미커밋 공용 ops 내용 및 관련 없는 출력은 보존. 이번 상태 요약만 선별 stage하여 별도 문서 커밋·푸시한다.
