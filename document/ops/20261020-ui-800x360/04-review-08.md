# 감리08 — Mapbox 상시 툴 제거

2026-10-21 Supervisor Codex. 지시08 실제 diff 확인 및 독립 시험으로 **LOCAL_VERIFIED**. 지구본·나침반 컨트롤은 생성/등록하지 않고, 하단 지표·저작권·로고는 보존한다. [결과08](03-result-08.md)의 명령/미실행 범위를 따른다. 기존 미관련 dirty는 제외한다.

확인: Node2/2·타입포함 build·변경TS lint 오류0·실 Mapbox DOM3크기·diff PASS. 실기기/주행 e2e 미실행. 이 파일은 배포 완료 증거로 갈음하지 않으며, 정상 push/Hosting 후 결과를 추가한다.

직접 확인:

```powershell
Set-Location C:\20.HDev\boxcycle
npm run dev:localhost
```

http://localhost:5000 → 800×360 → 지도 오른쪽의 지구본·나침반이 없고 맵 설정/확대축소·하단 축척/고도가 유지되는지 확인.
