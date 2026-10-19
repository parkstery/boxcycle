# 결과07 — 지연 위치 승인 미이동 교정

2026-10-17. main2 @ c798276에서 시작. 시작 시 tracked dirty 없음. 지시07과 ops 진행 문서만 Supervisor가 먼저 추가했다. 제품 수정은 Codex 직접 수행, commit/push/deploy 없음.

## 실행 경위

기본 Cursor를 `agent -p --workspace C:\20.HDev\boxcycle "document/ops/20261017-entry-location/02-task-07.md…"`로 실행했다. 샌드박스 실행은 `uv_os_get_passwd returned ENOMEM`으로 exit 1. 승인된 환경 재실행은 약 5분 동안 출력·파일 변경 없이 정지했고 CPU도 거의 변하지 않았다. 이번 실행의 node PID 35448/16528만 중지했다. 다른 쓰기 담당이 없음을 확인한 뒤 Supervisor가 직접 구현·시험했다. Cursor 구현 성공 또는 독립 Developer 검증으로 보고하지 않는다.

## 확인한 원인과 변경

`startLocate` 자체 8000ms watchdog은 권한 창에서 기다린 시간까지 포함했다. 24초 후 승인하는 fake clock 시험을 추가하니 기존 코드에서 phase가 locating 대신 ready(콜로세움)로 바뀌어 실패(exit 1, pass 0/fail 1)했다. 이미 완료 처리되어 한국 테스트 좌표의 정상 응답도 버리는 경로다. Chief 실제 기기의 오류 코드·위치 provider까지 관찰한 것은 아니다.

- `src/lib/geo/entryLocation.ts`: prompt/unknown의 권한 선택 중에는 자체 8초 watchdog으로 종료하지 않는다. 브라우저 위치 취득 timeout(8000ms)·오류 콜백은 유지. 기승인 요청의 무응답 watchdog 유지. 성공 시 permission=granted. 명시 콜로세움 선택과 비활성화 후 늦은 응답 차단 유지.
- `scripts/identity/entry-location.test.ts`: prompt/unknown 각각 24초 대기 후 한국 테스트 좌표 성공. 지연 대기 중 콜로세움 선택도 검증. 성공 뒤 prompt를 기대하던 기존 assertion을 granted로 교정.
- `scripts/map/entry-location-camera.test.mjs`: 실제 MapView 소스 AST에서 목적지 갱신/이동 effect를 찾아 실행. 위치 세션의 지연 성공 결과를 연결해 일반 모션 flyTo·동작 줄이기 jumpTo가 한국 테스트 좌표/zoom15를 받는지 검증. 권한 대기 중 이동 없음·1회 이동도 확인. 지도 API는 stub이며 WebGL·네트워크·React 전체 생명주기를 검증하지 않는다. MapView 제품 코드는 수정하지 않았다. *.test.*이므로 부산물 등록 제외.

## 검증

실행 폴더 `C:\20.HDev\boxcycle\apps\web`.

| 명령 | exit | 결과 |
|---|---|---|
| `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test --test-name-pattern='권한 선택을 8초' scripts/identity/entry-location.test.ts` (제품 수정 전) | 1 | FAIL 1, 조기 ready 재현 |
| `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/identity/entry-location.test.ts scripts/map/map-boot-center.test.ts scripts/map/entry-location-camera.test.mjs` (최종) | 0 | PASS 27 / FAIL 0 |
| `node scripts/ride-verify/verify-selectors.mjs` | 0 | PASS 18단계 |
| `npx.cmd eslint src/lib/geo/entryLocation.ts scripts/identity/entry-location.test.ts scripts/map/entry-location-camera.test.mjs` | 0 | 오류·경고 없음 |
| `npm.cmd run build` | 0 | tsc·Vite PASS, 기존 큰 청크 및 SADDLE/PELVIS 경고 |
| `git diff --check` | 0 | PASS |

중간 실패도 보존: 첫 전체 시험은 성공 permission의 기존 prompt 기대 때문에 24/25 PASS. 기대 교정. 새 카메라 시험은 vm 전역 const 중복 선언 때문에 25/27 PASS였고, effect 생성식을 IIFE로 감싸 최종 27/27 PASS. 제품 오류와 시험 도구 오류를 구분한다.

실 Firebase 인증 E2E·실제 브라우저 권한 창·Mapbox 타일·스마트폰 GPS는 미실행. 운영 배포하지 않았으므로 현 운영 사이트는 이전 코드다. 브라우저가 위치 요청 콜백을 전혀 주지 않는 prompt/unknown 환경은 사용자가 콜로세움 버튼으로 종료할 수 있다.

## Chief 확인

PowerShell:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npm.cmd run dev -- --host 127.0.0.1 --port 5014 --strictPort
```

접속: http://localhost:5014 . 다른 서버가 해당 포트를 쓰면 종료하거나 다른 포트를 지정한다. 브라우저 위치 권한을 묻기로 초기화 → 인트로 게스트/로그인 → 내 위치에서 시작 → 권한 창에서 8초 이상 대기 → 허용 → 실제 현재 위치로 확대되는지 확인. 새 세션에서 거절/콜로세움 선택도 확인. localhost는 PC 확인용이다. 스마트폰의 실제 위치 검수는 HTTPS 운영 또는 승인된 HTTPS 미리보기 반영 후 수행해야 한다.
