# 검수72 — 지도 배경 앱 인트로

2026-10-15 Supervisor Codex. 원본 C:/20.HDev/boxcycle main2 HEAD c818ed4. Developer Cursor session 0e0fda5c-9605-443e-83f8-4f0b74699fc0, 실행 exit0. 지시72/결과72 및 실제 diff 대조.

판정: UI 구현 PASS. 기존 E2E helper 호환성은 지시73으로 보정 후 합산 판정. Chief 최종 확인 별도.

## 확인한 변경

신규 AppIntroScreen.tsx/css, App.tsx 메모리 dismiss와 기존 GuestEntry 앞 분기, ride-entry.spec.ts 및 entry-contract.mjs만. 기존 인증·지도 초기화·저장 로직·데이터 모델·주행 동작 변경 없음. 참고 워크트리 읽기 전용. 최초 인증 전 소개이며 CTA는 기존 인증 선택으로 넘긴다. 이미 로그인한 상태는 needsGuestEntry의 !user 조건으로 소개 대상에서 제외(실계정 로그인은 미실행).

## 독립 실행 증거

- `node document/ops/20261013-face-redesign2/intro-72-qa.cjs` exit0: 실제 두 컴포넌트를 Vite에서 import해 모의 지도 위 667×300,740×300,800×360,844×390,1366×768,740×180 여섯 상태 PASS. CTA 180×44px, 화면 경계 안·중앙 hit·가로 넘침 없음. Enter→기존 GuestEntry 단독 표시, Guest/Google 버튼 유지, 우측 모의 지도 버튼 클릭 및 reduced-motion PASS.
- `node document/ops/20261013-face-redesign2/intro-72-live.cjs` exit0: 실제 앱 9확인 PASS. CTA 전후 local/sessionStorage 변화 없음, 새로고침 소개 복귀, 4 viewport 추가 확인, 명시 로그아웃 소개 생략, account-deleted 안내 소개 생략, 실제 앱 우측 줌 확대/축소 버튼 클릭 PASS. 인증·주행 버튼은 누르지 않았다.
- apps/web `node scripts/ride-verify/verify-selectors.mjs` exit0: 17단계 PASS.
- apps/web `npx tsc --noEmit` exit0.
- apps/web `npx eslint src/App.tsx src/components/auth/AppIntroScreen.tsx` exit0: 오류0, 기존 hooks 경고7.
- apps/web `npm run build` exit0: 422모듈. 번들크기 경고와 기존 riderRig SADDLE/PELVIS 미export 경고(이번 변경 밖) 존재.
- `git diff --check -- apps/web` exit0.

증거: intro-72-shots/results.json, live-results.json 및 app-*.png, 크기별 fixture PNG. 캡처는 입장 animation 종료 상태로 고정. 최초 QA harness는 react-dom ESM default export 처리 누락으로 실패 후 harness만 수정하여 통과. 최초 live harness는 탈퇴 안내 storage key 오기로 중단, 실제 appSessionKeys.ts의 키로 고친 뒤 통과. 이 실패들을 제품 실패로 보고하지 않는다.

## 한계

샌드박스의 api.mapbox.com 등 요청이 ERR_NETWORK_ACCESS_DENIED라 실제 지도 타일이 없는 캡처다. 외부 네트워크 허용 브라우저 검수는 자동 승인 검토가 토큰·인증 앱 데이터 외부 전송 가능성을 이유로 거부했다. 우회하지 않음. 기존 지도 컴포넌트와 저작권/하단 컨트롤은 유지됨을 DOM/배치로 확인했고 모의 지도 버튼 hit를 검증했으나 실지도 외관·실기기·BLE·실계정·실주행 e2e는 미검증. 배포·푸시 없음.
