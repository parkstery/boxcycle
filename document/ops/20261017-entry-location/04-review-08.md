# 검수08 — 차단 시 두 시작 위치 선택

2026-10-17 Supervisor Codex. **APPROVED / Chief 화면 확인 대기**. 구현 OpenCode GLM-5.3 (`opencode/glm-5.3-flash-free`), 실행 결과 [결과08](03-result-08.md).

실제 diff 확인: denied에서 현재 위치 버튼을 숨기지 않는다. 라벨은 「내 위치 근처에서 시작」「앱 기본 위치에서 시작」. denied 위치 오류는 choice/denied/target null로 복귀하며 자동 기본 위치 확정이 없다. 사용자 재클릭으로만 다시 요청한다. 설정에서 허용 후 성공하면 현재 좌표로 ready. 지시07의 지연 승인 교정·generation 취소·중복 요청 방지 보존. 인증·지도·위치 저장·외부 API 변경 없음.

Developer 실행의 위치/지도29, selector19, 변경 파일 lint, 타입 포함 build, diff 검사 PASS를 확인했다. Supervisor가 다음을 독립 재실행했다(작업 폴더 `C:\20.HDev\boxcycle\apps\web`):

- `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/identity/entry-location.test.ts scripts/map/map-boot-center.test.ts scripts/map/entry-location-camera.test.mjs` → exit0, 29 PASS.
- `node scripts/ride-verify/verify-selectors.mjs` → exit0, 19단계 PASS.
- `git diff --check` → exit0.

감리 중 Developer가 보고한 옛 라벨 소비자 `scripts/perf/run-real-gpu.mjs` 두 곳은 Supervisor가 같은 작업의 최소 호환 범위로 추가 교정했다. `npx.cmd eslint scripts/perf/run-real-gpu.mjs` → exit0. 실제 GPU 측정은 이번 범위가 아니므로 미실행. Developer 결과의 「범위 밖 미반영」은 Developer 종료 시점 기록이며 이 보완으로 해소했다.

UI는 기존 컴포넌트 렌더/버튼 콜백 시험으로 확인했다. 브라우저 실권한·스마트폰·실 Firebase E2E는 미검증. 큰 청크/SADDLE/PELVIS 기존 빌드 경고 유지. 커밋·푸시·배포 없음. 이전 변경 보존.

## Chief 직접 확인

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npm.cmd run dev -- --host 127.0.0.1 --port 5014 --strictPort
```

http://localhost:5014 접속 → 브라우저 위치 권한을 차단 → 새로고침/인트로 진입 → 「내 위치 근처에서 시작」「앱 기본 위치에서 시작」 두 버튼 확인 → 내 위치 버튼 클릭 시 차단이면 선택 유지 → 사이트 위치 권한 허용 후 같은 버튼으로 재시도 → 현재 위치 확대 확인. 별도 새 세션에서 앱 기본 위치 선택 시 콜로세움 확대 확인. 이미 같은 작업 폴더의 서버를 실행 중이면 그 주소에서 새로고침해 확인 가능. 실기기는 승인된 HTTPS 환경에서 별도 확인한다.
