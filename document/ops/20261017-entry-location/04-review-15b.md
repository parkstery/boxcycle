# 검수15b — 위치 선택 버튼 두 줄 반영

2026-10-18 Codex Supervisor / Developer Cursor 세션 b4d4cbc3-2f77-4fff-9a2d-8f874c77fa2e. 로컬 APPROVED, Chief 화면 확인 대기. 커밋·push·배포 없음.

첫 버튼 안에 `내 위치 근처에서 시작`과 `(위치공유 필요)` 두 줄 표시. 외부 중복 제거, 기본 위치 버튼 테두리 #2563eb 유지. 브라우저 고정 geolocation 요소를 일반 버튼으로 대체하고 기존 onChooseCurrent 경로로 요청한다. 이미 차단한 경우 사이트 설정에서 위치 허용이 필요하다.

Cursor 결과15b 이후 Supervisor가 제거된 native 결과 앵커를 버튼 내부 두 줄 계약으로 갱신했다. 기존 단위시험의 사이트 설정 금지와 DOM 시험의 native selector를 새 요구에 맞췄다. 첫 DOM 재실행에서는 시험에 중복 클릭을 넣어 실패했고 중복 제거 후 통과했다. 제품 위치/카메라 로직 변경 없음.

검증 (실행 폴더 C:\20.HDev\boxcycle\apps\web):
- `npm run build` (루트 실행): PASS exit0, 타입 포함. 기존 riderRig export 경고.
- `npx eslint src/components/auth/EntryLocationDialog.tsx`: PASS exit0.
- `node scripts/ride-verify/verify-selectors.mjs`: 초기 native 결과 앵커 FAIL → 갱신 후 19단계 PASS exit0.
- `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/identity/entry-location.test.ts`: 24 PASS exit0. 초기 loader 없는 실행은 모듈 해석 실패, loader 추가 후 구 요구 assertion 수정.
- 같은 명령에서 시험 파일을 `scripts/identity/entry-location-dom.test.mjs`로 지정: 1 PASS exit0. Edge 위치 에뮬레이션, 클릭→서울 목적지/지도 이동, 일반 API 1회 요청. Mapbox fixture 토큰 경고 발생, 실타일 검증 아님.
- inline Vite/Edge Playwright: 667×300,740×300,844×390,1366×768에서 두 줄/외부 중복 없음/파란 테두리/화면 내 배치/두 콜백 각각1회 PASS. 버튼 높이54.06px/44px.
- `git diff --check -- apps/web/src/components/auth/EntryLocationDialog.tsx apps/web/src/components/auth/EntryLocationDialog.css apps/web/scripts/ride-verify/entry-contract.mjs apps/web/scripts/identity/entry-location.test.ts apps/web/scripts/identity/entry-location-dom.test.mjs`: PASS exit0.

화면·수치: `.out/entry-location-15/two-lines-667.png`, `two-lines-check.json`. 새 제품 디버그 코드/주소 스위치/상설 스크립트 없음. 기존 변경 보존. 실GPS·실제 브라우저 허용 팝업·스마트폰 미검증.

직접 확인: PowerShell `Set-Location C:\20.HDev\boxcycle\apps\web` 후 `npm run dev -- --host 127.0.0.1 --port 5000` → http://127.0.0.1:5000/ → 게스트로 시작 → 위치 선택 창. 첫 버튼 두 줄과 외부 문구 제거·기본 위치 파란 테두리 확인.
