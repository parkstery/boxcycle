# 최종 검수45 — 경로 설정 시 시작 버튼 안내

2026-10-15 **APPROVED / AWAITING_CHIEF 사용 확인**. 지시44 → 결과44 → 접힘 경계 재지시45 → 결과45 → Supervisor 독립검증. 코드 커밋 `51866a5`(face-redesign2), 선행 UI 커밋 `b4239b5`. 사용자 외부 Cursor 코드전달 명시 승인 후 진행. 기존 자동 승인 거부 및 Muse429는 인계44·검수44에 보존.

## 동작과 범위

- App은 routeGeometry 참조만 RouteDock에 연결. 새 경로 계산 완료 시 시작 버튼의 배경/그림자를 **600ms 주기 2회** 강조, animationend 후 정상 표시 복귀. 주행 자동 시작 없음.
- 센서 미준비로 disabled인 경우에도 위치 안내. 기존 disabled/시작 게이트와 시작·일시정지·재개·종료 콜백 유지. 로딩·경로 삭제·주행·일시정지 때 안내 해제.
- 동일 경로의 일반 재렌더·입력 설정·완료 후 접기/펼치기로 재점멸하지 않음. 경로 교체는 두 동일 keyframe의 이름을 교대해 즉시 재시작.
- 새 경로를 설정하면 접힌 주행 패널도 펼쳐 시작 버튼 표시. 사용자가 점멸 중 접으면 안내 종료, 다시 펼쳐도 재점멸 없음.
- reduced-motion은 일정한 색/그림자의 1200ms 정적 강조로 대체하고 종료. 타이머/추가 서비스 없음.
- 앱 diff는 App.tsx, RouteDock.tsx, RouteDock.css **3파일만**. NextRideCard.tsx/css SHA256 전후 일치. 카드 동작/스타일 변경 없음.

## 실행 증거

Supervisor 실행:

- apps/web `node scripts/ride-verify/verify-selectors.mjs`: exit0, 진입 셀렉터 15단계 PASS.
- apps/web `npx tsc -b --pretty false`: exit0.
- apps/web `npx eslint src/App.tsx src/components/route-dock/RouteDock.tsx`: exit0, 오류0 / 기존 App 경고7. 정상 pre-commit도 동일 결과.
- `git diff --check`: exit0.
- `node document/ops/20261013-face-redesign2/start-44-qa.cjs`: exit0. 실제 RouteDock 모듈, StrictMode, headless browser1/page1, 기존5013 서버 재사용. [결과JSON](start-44-results.json), [캡처](start-44.png).
- 실제 Web Animation의 duration600/iterations2 확인, 완료 후 애니메이션0. 동일참조/센서재설정/접기 재시작0, 새참조·로딩완료·삭제후재설정·disabled 안내, 점멸중접기 종료·접힌패널의 새설정 펼침·시작/재개 콜백 PASS. pageerror0.
- 667×300, 740×300, 844×390, 1366×768에서 세 주행 버튼의 전후 위치/크기/font 동일, viewport 내부 표시 PASS. 기존 버튼 크기를 이번 변경에서 축소/확대하지 않음.

초기 검증 fixture의 ReactDOM default export 처리 및 Vite client 초기화 누락 오류는 harness만 수정해 해소. 실제 index HTML을 사용하고 main.tsx만 차단해 지도 없는 실제 컴포넌트 검증. 앱 오류로 보고하지 않으며 최종 실행 pageerror0 확인.

## 한계와 다음 행동

실기기 터치/Bluetooth/실 Firebase 주행 진입·운영 저장 전체 e2e는 미실행. 버튼/패널 경량 실제 컴포넌트 및 정적 진입 계약 검증 범위. push/merge/deploy 미실시. 5013에서 경로 설정·새 경로 교체 시 시작 버튼 위치 안내를 사용 확인한다. 다음 주행 카드는 현상 유지.
