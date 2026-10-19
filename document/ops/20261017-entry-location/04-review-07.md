# 검수07 — 위치 승인 후 미이동

2026-10-17 Supervisor Codex. 판정: **로컬 회귀 교정 PASS / Chief 실기기 확인·운영 반영 대기**.

[결과07](03-result-07.md)의 실행 증거와 실제 diff를 확인했다. Cursor 무진전 중지 후 동일 Codex가 직접 구현·검증한 예외이므로 별도 Developer와의 독립 검수는 아니다.

제품 diff는 `entryLocation.ts` 한 파일이다. prompt/unknown에서 자체 watchdog을 건너뛰되 브라우저 오류·timeout·명시 콜로세움 선택·취소는 유지한다. 기승인 watchdog도 유지한다. 성공 permission을 granted로 맞춘다. 좌표 저장·감시·전송 추가 없음. 인증·MapView·주행 카메라·데이터 모델 변경 없음.

수정 전 지연 승인 시험 FAIL, 수정 후 위치/기존 첫 지도/실제 MapView effect 소비 총27 PASS. 일반 flyTo와 reduced motion jumpTo의 목적지 인자까지 확인했다. selector18, 변경 파일 lint, 타입 포함 빌드, diff 공백 검사 PASS. MapView API stub 시험은 전체 앱 브라우저·기기 위치 provider 검증을 대신하지 않는다.

Chief의 실기기 증상이 이 원인만으로 설명되는지는 배포 후 실제 권한 선택·위치 취득을 확인해야 한다. 현 운영에는 아직 미반영. 커밋·푸시·배포 없음. 실행 폴더·명령·주소·확인 순서는 결과07 참고.
