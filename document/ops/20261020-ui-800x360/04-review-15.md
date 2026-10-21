# 주소창 너비 검수

2026-10-22 · record · LOCAL_VERIFIED / Chief 외관 확인 대기.

실제 RouteDock fixture에 제품 MapBottomLeftStack.css를 로드하고 미니맵 크기의 DOM을 넣어 Chromium headless에서 측정: 미니맵235/210/180px 각각 주소 shell235/210/180px, 좌우 차이0px. 미니맵 접힘 후 주소170px 복귀 PASS. `git diff --check` PASS. CSS 단일파일 변경으로 전체 빌드/전체 시험 미실행. 실제 지도·폰 미검증, 커밋/푸시/배포 없음.

현재 개발 서버5002. 직접 실행:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npm run dev:localhost -- --port 5002 --strictPort
```

http://127.0.0.1:5002 강력 새로고침 → 경로 선택 → 주행 시작 → 미니맵과 주소창 좌우 끝 확인 → 각각 접기/펼치기 확인. 단독 UI fixture는 미니맵이 없어 해당 변경이 보이지 않는다.
