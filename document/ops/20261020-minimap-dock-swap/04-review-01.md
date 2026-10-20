# 검수01

LOCAL_VERIFIED / Chief 화면 확인 대기. 요구한 상하 교환을 실제 App 배선 diff와 브라우저 fixture에서 확인했다. 신규 모드 없이 기존 한 배치 경로를 교체했다. 미니맵의 absolute 배경·이정표를 담기 위해 컨테이너 position:relative 유지. 5크기 rect와 캡처에서 RouteDock 위·미니맵 아래,8px 간격 확인. 준비·idle에서 미니맵을 표시하지 않는 기존 조건 유지.

셀렉터19·TypeScript·변경 TSX lint(오류0/기존경고7)·diff-check PASS. 실제 주행·지도 이미지·휴대전화 실기는 미검증이며 제품 전체 e2e 통과로 확대하지 않는다. Cursor ENOMEM 후 Codex 직접 수정. 배포·커밋·푸시 없음.

Chief 확인:
```powershell
Set-Location 'C:\20.HDev\boxcycle\apps\web'
npm run dev -- --port 5000
```
기존 서버가 있으면 그대로 사용한다. http://localhost:5000 에서 강력 새로고침→경로 선택→주행 시작→왼쪽 위 RouteDock/아래 미니맵 확인→RouteDock 접기/펼치기 확인.
