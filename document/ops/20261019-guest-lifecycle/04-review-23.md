# 감리23 — Ready Ride 복구 / LOCAL_VERIFIED

2026-10-19 Supervisor Codex. Chief 신고(5004 첫 Ready Ride 자동 경로 연결 실패)를 조사·보완했다. [결과23](03-result-23.md)에 변경과 실패/성공 이력을 분리 기록했다. Cursor CLI 시작 실패 후 Codex 직접 수행. 제품 UI와 demo 서버 조립 수정으로 범위를 제한했고 운영 API/Rules/데이터는 변경하지 않았다.

## 판정

- 원인1: Guest 인증 전용으로 만든 demo 서버에 자동 경로 API 등록 누락. 네트워크 오류로 보였지만 실제 조립이 빠져 있었다. 실제 운영 구현 handler를 demo에 등록했다.
- 원인2: 첫 화면 거리 칩은 선택만 하고 기존 route가 있을 때만 재탐색, 같은 선택은 return. Chief 요구대로 클릭 즉시 탐색으로 변경.
- 추가 재현: 잔액 없는 최초 사용자 metadata를 0으로 읽어 지급 완료 전 경로를 차단. undefined를 null로 유지하고 서버 판단에 맡긴다. 실제0은 그대로0.
- 원주 단구동 2·3·5·10km 실제 생성4 PASS. 기본3km 최초 재클릭도 포함. 최종 16.8초, 거리 응답은 반올림2000/3000/5000/10000m, Go 표시까지 확인. 잔액 callback1/selector19/변경lint/build/diff PASS.
- 위성 타일 외관은 자동화 브라우저에서 네트워크 실패가 있어 검증하지 못했다. 경로 geometry·오렌지 경로·Go 검증과 구분한다. 실기기·Google popup 미검증, 운영배포 없음.

## Chief 직접 시험

실행 폴더 **C:\20.HDev\boxcycle**. 현재 http://localhost:5004 (또는 http://127.0.0.1:5004) 서버 실행중.

1. 기존 5004 탭을 Ctrl+Shift+R로 새로고침(HTTP API host도 변경됨).
2. 필요하면 게스트로 시작. demo 에뮬레이터 재시작으로 종전 임시 Guest 기록은 초기화될 수 있다. 운영 기록과 무관하다.
3. 지역이 선택된 첫 Ready Ride에서 2·3·5·10 중 하나 클릭 → 경로·주행 시작 표시. 같은 거리 재클릭도 다시 탐색.

서버가 꺼졌을 때만 실행(현재 실행중이면 중복 실행 금지):

```powershell
Set-Location C:\20.HDev\boxcycle
node C:/Users/kdrea/AppData/Roaming/npm/node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --only auth,firestore,database --project demo-boxcycle-guest "node scripts/guest-integration-supervisor.mjs --serve"
```

실행중 demo 서버 대상 회귀 재현:

```powershell
Set-Location C:\20.HDev\boxcycle
$env:FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099'
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'
$env:FIREBASE_DATABASE_EMULATOR_HOST='127.0.0.1:9000'
$env:VITE_FIREBASE_PROJECT_ID='demo-boxcycle-guest'
$env:GUEST_DEMO_ROUTE_LIVE='1'
node node_modules/@playwright/test/cli.js test --config apps/web/scripts/ride-verify/guest-demo-ready-ride.config.ts
node --test scripts/ready-ride-onboarding-supervisor.test.mjs
```

Chief 화면확인·최종CLOSED 및 별도 운영 반영 단계는 잔여다. localhost5000은 운영 연결이므로 신규 Guest 함수 미배포 문제는 별도로 남아 있다.
