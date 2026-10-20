# 검수03

LOCAL_VERIFIED / Chief화면확인대기. Chief요청에 따라작은좌상단 ‹/› 로변경. 가로접힘이며캐럿·RouteDock세로위치고정,터치·키보드및3개폰가로크기PASS. 타입·변경파일lint·diff PASS. 운영배포없음.

직접확인:
```powershell
Set-Location 'C:\20.HDev\boxcycle\apps\web'
npm run dev -- --port 5000
```
기존서버실행중이면재사용. http://localhost:5000 강력새로고침→주행시작→미니맵왼쪽상단 ‹ 클릭→같은자리에남은 › 클릭.
