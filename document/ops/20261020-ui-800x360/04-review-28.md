# 거리·방향 출발 즉시 지정 검수·릴리스

2026-10-22 · record · LOCAL_VERIFIED. [지시28](02-task-28.md) · [결과28](03-result-28.md).

실제 diff 확인: 출발 미지정·거리 탭에만 즉시 출발 경로 추가, 기존 출발 버튼 처리 공통화, 거리 탭의 버튼 영역 제거, 안내 원문 교체. 일반 위치/기존 방향 탐색 유지. 기존 ops26/27 기록 원문 보존, 공용 ops 두 파일의 기존 미커밋 변경 및 out/evidence/cdbox 제외.

거리145 PASS, 브라우저 최종4 PASS/29.0s, 타입/build PASS, lint 오류0/기존경고8, diff 검사PASS. 브라우저는 실제 MapView/hook/HTTP adapter를 사용하되 지도와 API 응답 대체. 출발·도착 탭 버튼 복귀, 거리 탭 짧은 클릭 무선택, 터치 긴 누름 즉시 출발·임시마커0, 연속 방향 재탐색·삭제 후 마우스 긴 누름·늦은 응답 무시 확인. 실제폰 미검증.

최종 브라우저 명령:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
$env:RTW_DEV_PORT='5002'
node scripts/e2e/run-with-deadline.mjs --limit-sec 100 -- node ../../node_modules/@playwright/test/cli.js test e2e/distance-route-continuation.spec.ts e2e/map-route-runtime.spec.ts --workers=1 --retries=0 --reporter=line
```

Chief 확인: 운영 배포 후 https://boxcycle-dc2df.web.app 새로고침 → 가로화면 → 경로 생성/거리·방향 → 출발 미지정 안내·출발 버튼 없음 → 지도 위치 길게누르기 → 출발점 즉시 표시 → 거리 선택·방향 선택 → 경로 생성. 로컬 실행 필요 시:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npm run dev:localhost -- --port 5002 --strictPort
```

접속 http://localhost:5002. 기존 서버 보존. Git/Hosting 최종 결과는 아래에 추가한다.
