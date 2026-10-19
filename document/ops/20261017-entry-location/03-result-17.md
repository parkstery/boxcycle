# 결과17 — 차단 허용 복구와 초기 카메라 경합 교정

2026-10-18 Codex 직접 수행. 지시16 Cursor CLI ENOMEM으로 시작 실패한 교대 상태를 유지했다. 다른 작업 변경 보존. 커밋·push·배포 없음.

## 증거와 원인

Chief 추가 스크린샷의 양쪽 주소는 localhost:5000. 좌측에 permission denied 안내가 분명히 표시됐다. 이전 운영 주소 답변에 기초한 조사와 구분한다. 15b에서 두줄 custom 버튼을 위해 native geolocation을 삭제한 결과, 이미 차단된 권한을 클릭으로 재허용하는 native 흐름이 제거됐다. 일반 getCurrentPosition은 기존 차단을 다시 허용하는 UI를 보장하지 않는다. 공식 근거 https://developer.chrome.com/blog/geolocation-html-element .

별도 전체 앱 시험 첫 실행에서는 native 결과로 창이 닫혔지만 로마잔류/15초 도착대기 실패가 1회 있었다. 재로딩·계측 후 같은 좌표로 도착했고, 추가 2회는 익명인증 완료 전 ready→완료 후 ready 유지/서울 도착했다. 3D helper는 2D pitch0 상태에서도 easeTo를 호출한다. 실제 MapView 위치 effect 다음 3D effect를 실제 helper와 실행하면 이미 시작한 flyTo가 취소됨을 단위시험으로 재현(수정전1FAIL, pitched→2D 기존행동1PASS).

## 변경

- EntryLocationDialog.tsx: 두줄primary 유지, choice+denied+native지원 때만 보이는 실제 geolocation 복구 버튼 추가. 브라우저 고정문구·표시·44px 기존 CSS 존중. autolocate/overlay/syntheticclick 없음. native location 유효좌표→기존 onPosition→acceptPosition 연결. 취소/error는 선택지 유지. 미지원만 기존 사이트설정 안내. 일반 진입 외부 중복문구 없음.
- rideCameraFollow.ts: 이미 pitch0이면 easeTo 생략. 실제 3D→2D(기울어진 pitch)는 기존400ms 복원 유지. 범위는 이 한 호출 guard뿐.
- entry-contract.mjs: 차단복구/위치결과 앵커 추가.
- entry-location-camera.test.mjs: 실제 두 MapView effect+실제 apply3DState 본문으로 초기화 순서 재현, 기존 3D→2D 회귀 추가.
- entry-location-dom.test.mjs: 실제 helper 포함, denied native control 실제 클릭/네이티브 location 결과/한국 도착, early granted(지도load전 위치결정) 도착 검증 추가. ENTRY_LOCATION_TEST_BROWSER=chrome으로 같은 시험 실행 가능. test용 env이며 제품스위치 아님.

## 검증

실행 폴더 C:\20.HDev\boxcycle\apps\web.

- node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/identity/entry-location.test.ts scripts/map/entry-location-camera.test.mjs: 35PASS exit0(16의 provider실패 재시도 포함).
- 같은 실행기 scripts/identity/entry-location-dom.test.mjs: Edge PASS. 기존 첫클릭·실패재시도·native복구·earlygranted를 한 브라우저시험으로 실행. native valid/44px/667,740,844×300 화면내배치/기본 두줄 확인. 실제 Mapbox engine 카메라 서울zoom15 도착.
- $env:ENTRY_LOCATION_TEST_BROWSER='chrome' 후 같은 DOM시험: Chrome에서도 실행, 최종판정은 검수17 참고.
- npx eslint src/components/auth/EntryLocationDialog.tsx src/components/map/rideCameraFollow.ts src/lib/geo/entryLocation.ts scripts/map/entry-location-camera.test.mjs scripts/identity/entry-location-dom.test.mjs scripts/identity/entry-location.test.ts scripts/ride-verify/entry-contract.mjs: PASS exit0.
- node scripts/ride-verify/verify-selectors.mjs: 19단계PASS.
- npm run build: 타입 포함 최종 빌드 검수17 참고. 기존 riderRig export 경고.
- git diff --check 변경7파일: 마지막 EOF 빈줄 수정 후 재확인.

브라우저 회귀는 격리 컨텍스트에 합성 서울좌표를 제공했다. app query만 denied로 주입하고 browser context는 geolocation grant로 준비해, 실제 native control 클릭→location 이벤트→지도 연결을 확인한다. 실제 보안dialog에서 사용자 허용을 대신 누른 것이 아니며 개인기기 OS차단·진짜원주좌표 취득을 확인했다고 보고하지 않는다. fixture Mapbox 토큰 경고는 존재하나 실지도 엔진의 목적지 검증은 PASS. 실폰 미검증. 제품 진단코드/새상설스크립트 없음.

## Chief 재확인

기존 http://localhost:5000/ 를 Ctrl+Shift+R로 새로고침. 차단 상태면 새로 보이는 native ‘위치 사용’ 버튼 클릭→브라우저 허용. 허용 상태면 기존 두줄 ‘내 위치 근처에서 시작’ 클릭. 위치 조회 성공 후 해당 지역으로 이동하는지 확인. 코드는 현재 로컬 서버에 반영됨. 서버 재실행 PowerShell:

Set-Location C:\20.HDev\boxcycle\apps\web
npm run dev -- --host 127.0.0.1 --port 5000

http://localhost:5000와 http://127.0.0.1:5000는 사이트 권한이 별도일 수 있으므로 첨부화면과 같은 localhost를 사용한다. 운영주소에는 미배포.
