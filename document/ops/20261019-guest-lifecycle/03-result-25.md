# 결과25 — 위치 선택창 간소화

2026-10-19 / Codex 직접 구현·검증. 직전 Cursor CLI ENOMEM 사용불가 후 작은 UI 수정 직접 수행. 기존 dirty 보존·커밋/푸시/배포 없음.

- EntryLocationDialog: 제목 유지, 버튼 「내 위치 / 기본 위치」, 위치핀/지구본 장식SVG(aria-hidden), 보조문구 제거. 위치 권한 요청·차단·진행·fallback 동작 보존.
- CSS: 카드220px폭·20px모서리·16px내부여백, 제목/버튼14px, 파란 주버튼·파란 아웃라인 보조버튼, 버튼44px·동일너비186px. 초기카드162px높이, 차단안내228px, 진행140px. 상단중앙 유지·안전영역·출처여백·overflow 유지. 사용되지 않는 옛 native 컨트롤 스타일 제거.
- ride-verify entry-contract·rideEntryHelpers·entry-location 단위/DOM 시험의 문구계약 동기화. 임의 Tailwind 의존성 추가 없음.
- Guest 주소차이 조사: Chief 중지지시 반영. 직전 Task24의 opt-in자동redirect 초안(Vite/plugin/env)은 제거. 같은주소에서 종료없이 실제Chromium 프로세스를3회다시열어 같은UID·개인localfixture·Auth증가0 확인한1 PASS(15.3초)는 기록으로만 보존. 인증 의미변경·기존Guest삭제 없음.

## 실행 결과

실행폴더 C:\20.HDev\boxcycle\apps\web.

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/identity/entry-location.test.ts
node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/identity/entry-location-dom.test.mjs
node scripts/ride-verify/verify-selectors.mjs
npx eslint src/components/auth/EntryLocationDialog.tsx scripts/identity/entry-location.test.ts scripts/identity/entry-location-dom.test.mjs e2e/rideEntryHelpers.ts
npm run build
```

- 단위26 PASS / DOM1 PASS / selector19 PASS, 각각exit0. DOM은 실제Mapbox엔진·permission/currentLocation callback을 사용하고 지도타일 외관은 범위밖이다. fixture의 Mapbox 토큰 미설정 경고 잔존. 로마→한국 카메라 실제3446ms·완료좌표 확인.
- 첫 DOM 명령은 Vite env import loader 누락으로 extensionless module 해석실패 exit1. 위 명령으로 재실행해 PASS.
- 변경파일lint exit0, build exit0. 기존 riderRig SADDLE/PELVIS·큰 번들 경고 잔존.
- root `node .out/location-design-preview.mjs`: 실제 React 컴포넌트로 667×300/844×390/1366×768 × choice/prompt·choice/denied·checking·locating 총12상태 캡처·rect·스크롤·각callback1회 검사 exit0. 전부 버튼44px이상·내부스크롤없음. 화면 PNG·metrics는 `.out/location-design/` (중립배경fixture이며 실지도합격으로 보고하지 않음).
- 실제앱844 화면 추가캡처 시도는 위치창이 해제돼 screenshot 시점 DOM분리로 exit1. 이를 실앱 화면검수PASS로 처리하지 않는다. 기능회귀는 위 실제hook/카메라DOM시험으로, 디자인은 컴포넌트12상태로 검증했다.
- `git diff --check` exit0(기존CRLF경고). localhost5004 GET200. 운영·실기기BLE·Google실팝업 미실행.
