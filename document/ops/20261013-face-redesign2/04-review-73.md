# 검수73 — 인트로·기존 E2E 진입 최종 검수

2026-10-15 Supervisor Codex. 원본 main2 HEAD c818ed4. Developer Cursor session c2c711c9-6fa3-4de7-8d45-c5f8e8e6d481. 지시73·결과73 및 실제 diff 대조.

판정: **APPROVED / Chief 화면 확인 대기**. 검수72의 UI PASS와 합산. 인트로는 최초 인증 전에 표시, 시작하기는 기존 인증 카드로만 이동하며 Guest·Google 인증 자체는 기존 동작. 기존 테스트 진입도 명시적 공통 도우미로 보정 완료.

## 범위

지시73은 공용 rideEntryHelpers.ts와 기존 35개 E2E 호출 파일만 변경(ride-entry.spec.ts는 지시72). 공용 helper는 인증 정착 화면을 poll하고 소개일 때만 CTA 클릭. 앱·데이터·인증 함수·기존 주행/센서 분기 변경 없음. 기존 optional gate 처리 보존. fixture의 숨은 자동 클릭이나 저장소 우회 없음. 임시 _patch-intro-73.mjs 제거 확인.

## 독립 검증

- `node --experimental-strip-types document/ops/20261013-face-redesign2/intro-73-qa.cjs` exit0, 최종 helper 수정 후 재실행 PASS. 실제 앱 최초 진입·이미 닫힘·명시 로그아웃·탈퇴 안내 4상태, DOM fixture 계정/닉네임/설정누락/접속실패/기존 Guest 카드 5상태, 300ms 로딩 뒤 소개가 나타나는 경합 1상태: 총10 PASS. 실계정 인증은 모의 계정 버튼으로만 검증, 실제 인증 실행 없음.
- apps/web `npx playwright test --list` exit0, **105 tests / 58 files** 수집. intro-73-collection.txt.
- apps/web `npx tsc --ignoreConfig --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --skipLibCheck --types node e2e/rideEntryHelpers.ts` exit0. E2E helper도 별도 타입 검증. 최초 실행은 TS6의 --ignoreConfig 누락으로 TS5112 exit1, 옵션 보정 후 PASS.
- `git -c core.safecrlf=false diff --check -- apps/web` exit0.
- Developer 결과: selector17·tsc·수정36파일 eslint(error0/warning0)·collection PASS. 검수72에서 앱 selector/tsc/eslint 및 production build를 독립 확인했다.

증거: intro-72-shots/helper-results.json, results.json, live-results.json 및 크기별 캡처, intro-72-qa.cjs / intro-72-live.cjs / intro-73-qa.cjs.

## 한계·다음

실지도 타일·실기기·BLE·실계정·실주행 및 E2E 전체 실행은 미검증. 외부 지도 요청은 샌드박스 차단, 외부 통신을 허용한 캡처 시도는 토큰/앱 데이터 전송 가능성을 이유로 자동 승인 검토 거부(검수72). 우회하지 않았다. UI와 코드 완료 판단은 로컬 실제 앱 및 모의 지도 검수에 한정한다. build의 기존 번들크기/riderRig export 경고, App hooks 경고7 보존. 배포·푸시 없음. Chief는 새 시크릿 창 http://localhost:5014 에서 확인 가능.
