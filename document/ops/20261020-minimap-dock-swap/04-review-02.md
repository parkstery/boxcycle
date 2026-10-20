# 검수02

LOCAL_VERIFIED / Chief 화면 확인 대기. 실제 diff와 브라우저에서 기본 펼침/접힘 후 다시 펼침 확인. 미니맵 group 안 버튼이 보조기술에 노출되고 네이티브 버튼 터치·키보드 동작 보존. 이미지·SVG를 제거하지 않아 토글로 이미지 재요청이 발생하지 않음. 주행 중·paused 및 RouteDock 접힘과 독립 확인. 667×300/740×300/844×390, 터치44px·8px간격·화면경계 PASS. selector19/tsc/변경파일eslint/diff PASS. 실기기·전체앱 실주행 미검증.

직접 확인(기존 서버 실행 중이면 재사용):
```powershell
Set-Location 'C:\20.HDev\boxcycle\apps\web'
npm run dev -- --port 5000
```
http://localhost:5000 새로고침→경로 선택·주행 시작→미니맵 우하단 화살표로 접기→남은 미니맵 버튼으로 펼치기. 로컬 변경, 커밋·푸시·배포 없음.
