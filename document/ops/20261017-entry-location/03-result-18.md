# 결과18 — 첫 두줄 버튼과 기본위치 버튼만 유지

2026-10-18 Chief 세버튼 거부에 따라 17의 별도native복구버튼을 삭제했다. Codex 직접 작은 교정. LocationPermissionRecovery와 지원검사/native 이벤트함수 제거, 불필요import 제거. 기존 onPosition props는 호출부 호환을 위해 유지. 첫버튼 두줄·기본위치blue 유지. 차단 안내는 실제로 가능한 사이트설정 허용후 첫버튼 재시도로 환원. native를 숨겨두거나 자동클릭하는 우회 없음. 16의 조회실패 재시도·17의 중복2D easeTo 방지 유지.

selector계약의 native앵커 제거. 기존 DOM시험은 denied에서도 button2개/geolocation0개를 667·740·844×300에서 확인하고, 차단한번실패 후 합성허용 상태로 첫버튼 재시도→한국도착으로 변경했다. 실제 보안권한을 앱이 변경하는 테스트가 아니다.

실행 폴더 C:\20.HDev\boxcycle\apps\web:
- node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/identity/entry-location.test.ts scripts/map/entry-location-camera.test.mjs scripts/identity/entry-location-dom.test.mjs: 36PASS/0FAIL exit0. 로그 .out/entry-location16/two-buttons18.log.
- node scripts/ride-verify/verify-selectors.mjs: 19PASS exit0.
- npx eslint src/components/auth/EntryLocationDialog.tsx scripts/identity/entry-location-dom.test.mjs scripts/ride-verify/entry-contract.mjs: PASS exit0.
- npx tsc -b --noEmit: PASS exit0.
- git diff --check 변경3파일: PASS exit0.
- 실제 localhost5000/740×300 앱: dialog button2/native0, 첫버튼 클릭→합성서울 도착 PASS. 초기 app query denied·browsercontext grant로 연결검증, 개인위치·실제권한변경 미실시.

Chief 확인: 기존 http://localhost:5000/ 새로고침. 두줄현재위치/앱기본위치 두버튼 확인. 서버 재실행은 PowerShell Set-Location C:\20.HDev\boxcycle\apps\web 후 npm run dev -- --host 127.0.0.1 --port 5000 --strictPort. 이미5000서버실행중이면 재사용. 기존 영구차단은 브라우저설정에서 허용해야 하며 앱이 우회하지 않음.

다른dirty보존, 커밋·push·배포없음. 이전17의 native복구 UI채택은 Chief가 거부해 본18로대체. 기록삭제없음.
