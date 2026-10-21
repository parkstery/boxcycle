# 주소 너비 초과 교정 검수

2026-10-22 · record · LOCAL_VERIFIED / Chief 실제화면 확인 대기.

후속15의 짧은 주소 fixture만으로 충분하다고 판단한 검수를 정정한다. 이번에는 실제 RouteDock의 `?state=riding&long` 긴 주소2행과 제품 스택 CSS를 사용했다. Chromium headless에서 viewport800/667/844 × 미니맵235/210/180px의 9조합 모두 주소/미니맵 width 일치, 좌우 차이0px PASS. 캡처 `.out/address-minimap-long-fixed.png`. `git diff --check` PASS. 실제 위성지도·스마트폰 및 전체 빌드/전체 시험 미실행. 배포 없음.

현재 localhost5002 서버. 직접 실행:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npm run dev:localhost -- --port 5002 --strictPort
```

http://127.0.0.1:5002 강력 새로고침 → 주행 화면 → 긴 출발/도착 주소와 펼친 미니맵 오른쪽 끝 비교.
