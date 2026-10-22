# 적용 수단·한 행 제어·두 줄 결과 검수

2026-10-22 · record · LOCAL_VERIFIED / Chief 화면 확인 대기. [지시30](02-task-30.md) · [결과30](03-result-30.md).

실제 diff·캡처 검수: 자동 탐색 성공 때 적용 수단 강조, 초기 실제 경로 여부로 재열기 수단 복원, 두 모드 공통 제어 한 행, 명시 개행과 고정폭. 기존 시작 조건/서버/경로 알고리즘 변경 없음. 세 viewport의 실제 hook 통합·DOM 회귀17 PASS, 거리146·진입19·타입/build·lint오류0/기존8경고·diff PASS. 실패 원인과 재검증은 결과30에 구분 기록했다.

운영은 기존28 배포 상태. 이번 변경은 로컬이며 커밋·푸시·배포하지 않았다. 실제폰/실 API 미검증. 기존 서버5002 보존.

## Chief 확인

http://localhost:5002 새로고침 → 거리·방향 → 출발 지정·목표거리0.5km → 방향 선택 → 실제 적용 수단 버튼 파랑/다른 수단 클릭 후 변경 확인 → 결과 메시지 두 줄·전후 너비 동일 확인. 출발·도착 탭에서도 세 수단 오른쪽에 재생·경로삭제가 같은 행에 있는지 확인.

필요할 때만 서버 실행:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npm run dev:localhost -- --port 5002 --strictPort
```

서버가 실행 중이면 추가 실행 없이 새로고침한다. 관련 없는 공용 ops dirty/out/evidence/cdbox 변경은 보존했다.
