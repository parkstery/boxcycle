# 결과16 — 위치 조회 실패 후 재시도 복구

2026-10-18 Codex 직접 구현. Cursor CLI가 uv_os_get_passwd ENOMEM으로 시작 실패하여 지시16 범위를 Supervisor가 수행했다. 별도 Developer와의 독립 검수는 아니다. 기존dirty 보존, 커밋·push·배포 없음.

## 확인된 사실

Chief는 운영 https://boxcycle-dc2df.web.app 에서 신고. 공개 HTML의 main JS는 /assets/index-bNS98Rln.js. 두줄 UI와 최신 인트로/카메라 수정이 배포되지 않은 버전이다. 운영의 위치 session에는 권한 대기를 제외하는 granted watchdog 구분이 이미 있다. 따라서 단순히 그 수정 미반영으로 단정하지 않는다.

운영 실제 앱을 새 브라우저 컨텍스트에서 실행, 권한prompt/위치 합성 서울좌표 성공을 주입하면 클릭1회→서울zoom15 도착 PASS. 로컬5000 실제 앱도 성공 PASS. 실제 사용자의 위치provider 오류 코드는 확보하지 못했으며 기기·브라우저와 안내 문구를 질문했다. IP로 대한민국을 추정하거나 외부 IP위치 API를 추가하지 않았다.

현재 실패 경로: timeout/position unavailable/invalid 좌표에 ready+Rome을 확정해 대화상자를 닫고 재시도를 제거한다. 재시도 요구 시험2개가 수정전 ready!=choice로 FAIL. 이 확인된 결함을 고쳤다.

## 변경

- src/lib/geo/entryLocation.ts: 실패/시간초과/invalid는 choice·target null·구분된 notice로 복귀. granted choice도 명시 클릭 재요청 허용. 타이머 정리·generation 무효화로 이전 요청 callback 무시. 기본 위치 명시 선택·정상 성공·권한 대기/denied 규율 유지. 위치API 미지원은 기존 fallback 유지.
- scripts/identity/entry-location.test.ts: 새 동작과 retry/이전callback 차단 회귀. 하네스가 실제 이전 callback을 캡처하도록 getter 사용. 기존 native locating 시험의 위도127 오타는 유효 좌표로 교정.
- scripts/identity/entry-location-dom.test.mjs: granted 첫 조회error2→choice→버튼 재시도→서울 카메라 도착 검증을 기존 시험에 추가.
- 기존 UI·브랜딩·다른 dirty 소스 수정 안 함. 운영 반영 선별용 제품 패치 .out/entry-location16/location-retry-only.patch 준비(HEAD 기준 native API 등 미커밋 작업 제외).

## 실행 검증

실행 폴더 C:\20.HDev\boxcycle\apps\web.

- node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test --test-name-pattern='허용 후' scripts/identity/entry-location.test.ts: 수정전2FAIL, 수정후 아래 전체에 포함 PASS.
- node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/identity/entry-location.test.ts scripts/map/entry-location-camera.test.mjs: 33PASS exit0.
- node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/identity/entry-location-dom.test.mjs: 1PASS exit0. 합성좌표·실Mapbox engine. 토큰 없는 fixture의 Mapbox console 경고 존재, 실타일 품질 검증 아님.
- npx eslint src/lib/geo/entryLocation.ts scripts/identity/entry-location.test.ts: PASS exit0.
- node scripts/ride-verify/verify-selectors.mjs: 19단계PASS exit0.
- 루트 npm run build: 타입 포함PASS exit0. 기존 riderRig export·plugin timing 경고.
- git diff --check (변경3파일): PASS exit0.
- 실제 로컬 앱5000, 844×390 Playwright: granted 첫 조회error2→로마에서 선택창/실패안내 유지→재시도→서울zoom15 도착. 요청2회, 성공후 대화상자 닫힘·오류 해소. 실제 운영 앱은 성공주입만 검증했고 오류 패치는 배포하지 않음.

테스트는 합성 서울 좌표만 사용. 사용자실GPS·OS 위치서비스·실기기 검증 미완. 전체quick/e2e/운영배포 미실행.

Chief 직접 확인: PowerShell Set-Location C:\20.HDev\boxcycle\apps\web 후 npm run dev -- --host 127.0.0.1 --port 5000. http://127.0.0.1:5000/ → 게스트 시작 → 위치 공유/내위치 버튼 → 성공시 해당위치 이동, 조회실패시 설명과 두선택지 유지. 운영 주소에는 아직 미반영.
