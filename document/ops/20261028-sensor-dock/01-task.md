# 센서 RouteDock 통합 구현 — Cursor AI

Chief 직접 승인. 지금 구현하고 검증까지 완료하라. 당신은 혼자 작업하지 않는다. 기존 dirty와 다른 작업·증거를 보존하라. Codex는 지시·감리, 당신은 제품 구현·관련 시험·결과 담당. 읽기: AGENTS.md, 이 README, Chief 디자인 고정12/29와 Ontology, `.agents/skills/ride-verify/SKILL.md`와 HARNESS.md. 작업범위는 UI 결선·표시이며 센서 입력/주행 의미·데이터 구조 변경 결정은 필요하지 않다.

## 확정 요구

1. 중앙 RideControlBar의 별도 센서 버튼을 없애 센서 진입점을 RouteDock 하나로 통합. idle/setup/ready-to-start/riding/paused에서 소실·중복 금지. gate/gate-nickname/summary 숨김 유지.
2. 경로 미설정 초기 화면은 큰 빈 RouteDock 없이 현재 RouteDock 자리의 **흰색(미연결) 또는 녹색(실제 연결) 점멸 LED만** 보인다. 체험 속도는 실제 센서 연결이 아니므로 녹색으로 오인시키지 말 것. LED는 경로 패널 펼치기 버튼이며 탭/Enter/Space로 연다. 점은 작아도 투명 터치영역은 최소28px(가능하면44px) 확보. aria-label/expanded/focus-visible, reduced-motion 반영.
3. 접힌 RouteDock에서도 기존 펼침 캐럿·센서 알약 대신 같은 LED 하나만. 펼치면 LED를 접기 버튼으로 바꾸고 패널 안에는 **현재 RouteDock 센서 알약 모양 그대로** 센서 버튼을 보여준다. 센서 버튼은 기존 상세 시트·연결·해제 열기 동작 그대로. 주행 중 펼쳐도 버튼이 있어야 한다. 센서 UI RPM 등 의미는 기존 계약을 검토해 보존.
4. 경로 설정 시 현재 자동 펼침을 유지. 초기 무경로는 LED만, 무경로에서도 사용자가 펼치면 기존 안내와 센서 버튼 제공. 주행 시작 자동접기·riding↔paused 사용자 선택·주행 종료 펼침 유지. 경로가 생김/삭제됨·단일 Start 설정 전환 검증.
5. 경로 주소/편집잠금/Start-End 교환·삭제·미니맵 독립 접기·위치/왼쪽 정렬·카메라·계정/반달 고정 보존. 이번 Chief 지시는 고정12/29 중 센서 위치·접힌 RouteDock 진입부만 대체.

## 소유 범위

`src/components/route-dock/RouteDock.{tsx,css}`, `src/lib/route/sensorChipSlot.ts`, `src/components/ride/RideControlBar.{tsx,css}`, 필요한 최소 `routeDockUiPolicy.ts`·App 호출자·CadenceHudChip·preview fixture·관련 계약/시험. 새 공용추상화 불필요. 실제 파일은 apps/web/ 아래. App은 필요 최소 결선만. 서버/functions/Rules/인증/센서 통신·상태기계/카메라/동행/3D/dep-layers.json 변경 금지. 기존 props 제거는 모든 호출자 일관되게. 센서 연결판단은 실제 CadenceHudState 계약 사용.

`git restore/clean/stash/worktree`·브랜치전환·커밋·푸시·배포 금지. 기존 PNG나 증거 파일 덮어쓰기 절대금지. 새 캡처는 이 묶음 `evidence/cursor/` 또는 새 spec의 testInfo.outputPath만. 기존 spec 캡처가 고정 경로를 사용하면 실행 전 별도 출력으로 안전하게 변경하거나 캡처 없는 관련 subset 실행. Codex 소유 README/HANDOFF/고정목록/baseline 문서는 수정하지 말 것.

## 검증·결과

우선 ride-verify selector 계약(필요시 대응계약 먼저 갱신) → `node scripts/ride-verify/verify-selectors.mjs`. 관련 센서슬롯/RouteDock 단위 계약 발견해서 이전요구 충돌 기대값만 갱신(삭제/skip/게이트 완화 금지). 新 `e2e/sensor-dock.spec.ts` 권장: 실제 RouteDock·RideControlBar 사용, idle LED→펼침→센서 시트 결선·접기, ready/riding/paused·미연결/연결/체험·재연결 상태 전환·무중복·키보드·reduced motion, 800×360/736×300/699×273/667×300 경계 확인. 실제 제품 fixture 재사용, 제품 복제 금지.

`npx tsc -b --noEmit`; 변경 TS/TSX eslint; `npm run build`; 루트 `node scripts/check-dep-direction.mjs --check`; `node scripts/check-code-tidy.mjs`(기존188>186 기록·증가 금지); 대상 `git diff --check`. 전체quick은 시간에 맞춰 수행하되 관련 단위·화면시험은 필수. 무거운 시험 병렬 금지. 기존 서버5031 HTTP200이면 재사용·3000 종료금지. RTW_DEV_PORT=5031, workers1/retries0. Firebase 실제쓰기·실주행은 실행하지 말 것.

모든 수행명령·PASS/FAIL/미실행 이유·변경파일·증거 경로·한계·확인 순서를 `02-result-cursor.md`에 한국어로 기록. 범위 안 결함은 자율수정 후 재검. 약20분 안 구현·시험·결과를 마쳐 Supervisor 감리시간을 확보하라. 이 작업에서 Cursor 기본1회, 무관 전수탐색 금지.
