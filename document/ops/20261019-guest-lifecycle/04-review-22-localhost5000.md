# 감리22 — localhost5000 Guest 진입 실패 조사

- 2026-10-19 / Supervisor Codex. Chief 스크린샷: localhost:5000, Guest 시작 후 연결 확인 실패.
- 원인: 5000 개발 서버는 development 모드·운영 프로젝트 boxcycle-dc2df를 사용한다. 신규 Guest 진입은 guestActivityHttp 성공 확인이 필수인데 해당 운영 함수는 미배포다. localhost:5000 Origin·POST·authorization 헤더의 OPTIONS를 운영 함수 URL로 보내 실제 404를 확인했다. 사용자 네트워크 장애로 확정할 근거는 없다.
- 제품의 실패 시 인증 차단·Guest 중복생성 방지는 유지한다. 서버 확인을 우회하거나 demo Auth 토큰을 운영 서버로 보내는 변경은 하지 않았다. 기존 지시의 배포 금지 범위도 유지한다.
- 올바른 현재 시험 주소: http://127.0.0.1:5004. demo Firebase·로컬 HTTP handler 사용. 운영 사용자·기록과 분리된다.

## 이번 검증

실행 위치 C:\20.HDev\boxcycle.

1. `node scripts/ride-verify/verify-selectors.mjs` (C:\20.HDev\boxcycle\apps\web): exit0, 계약19 PASS.
2. 5004 GET200.
3. 기존 서버 재사용용 임시 설정 `.out/guest-existing-server.config.mts`로 실제 SDK Guest 최초 진입·새로고침 동일 UID 시험을 실행: exit0, 1 PASS, 12.7초. 모바일 가로 viewport800×360, headless·worker1. 실기기 검증은 아니다.
4. 첫 시험 실행은 hoist된 의존성을 apps/web/node_modules에서 찾는 잘못된 경로로 MODULE_NOT_FOUND exit1. root node_modules 경로로 바로잡은 후 위 실제 시험 통과.

시험 명령:

```powershell
Set-Location C:\20.HDev\boxcycle
$env:FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099'
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'
$env:FIREBASE_DATABASE_EMULATOR_HOST='127.0.0.1:9000'
$env:VITE_FIREBASE_PROJECT_ID='demo-boxcycle-guest'
node node_modules/@playwright/test/cli.js test --config .out/guest-existing-server.config.mts guest-lifecycle.spec.ts --grep '최초 진입'
```

## 직접 확인

http://127.0.0.1:5004 에서 게스트로 시작 → 사용자 정보 표시 → 새로고침 → 같은 Guest 유지. 종료/재접속은 감리20·21의 계약을 따른다. 서버 재기동 명령은 감리21을 사용한다. localhost:5000은 운영 함수 반영 전까지 새 Guest 흐름의 확인 주소로 안내하지 않는다.

운영 Functions/Rules/Hosting 배포·Google 실계정 popup·실기기 검증은 이번 미실행. 기존 운영 Guest 삭제를 반복하지 않았다.
