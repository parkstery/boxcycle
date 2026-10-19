# 감리25 — 위치 선택창 LOCAL_VERIFIED / Chief 디자인 확인 대기

2026-10-19 Supervisor Codex. Chief의 최신 요청에 따라 제목을 유지하고 짧은 두버튼·파랑/아웃라인·컴팩트여백·장식아이콘을 반영했다. [결과25](03-result-25.md)에 실제 변경·명령·실패/통과·한계 기록.

26단위·실제위치hook/Mapbox카메라 DOM1·selector19·변경lint·build PASS. 폰가로667×300/844×390·PC의4상태 총12 컴포넌트실측: 폭220, 기본높이162, 버튼186×44, overflow없음. fixture PNG 직접시각확인. 실앱추가캡처는창이닫혀실패했으며폰실기기외관검증은Chief확인대기. 운영/권한정책변경없음, 배포커밋푸시없음.

실행폴더 **C:\20.HDev\boxcycle**. 현재 http://localhost:5004 실행중. 같은 주소에서 Ctrl+Shift+R → 필요시 게스트로 시작 → 위치 선택창 확인. 「내 위치」는 브라우저 위치 요청, 「기본 위치」는 기존 기본위치 선택이다. 허용이이미저장돼있으면선택창이생략될수있으며, 이경우사이트위치권한을묻기로바꾼후새로고침해확인한다(사이트데이터/인증삭제불필요).

서버가 꺼졌을 때만 실행:

```powershell
Set-Location C:\20.HDev\boxcycle
node C:/Users/kdrea/AppData/Roaming/npm/node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --only auth,firestore,database --project demo-boxcycle-guest "node scripts/guest-integration-supervisor.mjs --serve"
```

Guest 주소추적은 Chief중지지시로 종료. 진행중이던 자동redirect초안은 제거했고 강제주소이동·계정병합·삭제는없다. 기존 두주소에저장된Guest는각자보존한다.
