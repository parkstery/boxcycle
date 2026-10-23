# 묶음 1 — MENU + 경로 목록

상태: IN_PROGRESS · Supervisor Codex · 2026-10-23

Chief 요청: OpenCode DeepSeek v4.1 Flash·GLM-5.3 Flash와 로컬 Cursor에 분배하여 구현·감리 후 시안/실제 캡처 비교 보고.

## 공통 입력과 범위

- 원본: `mockups/06-Menu.html`·`.png`, `mockups/07-RouteList.html`·`.png` (800×360을 두 배로 그린 시안).
- 규칙: `../20261023-leaderboard/design-system/README.md`·`tokens.json`, 루트 AGENTS.md, Ontology, 교대 플레이북, `.agents/skills/ride-verify/SKILL.md`.
- MENU: 왼쪽 흰 판 300px, 우측 모서리 18px, Spinatlas/닫기 헤더, 경로 3행+지명 검색/순위/주행 설정 3행, 구분선·선 아이콘, 지금 달리는 Trail 목록. 실제 값만 표시; 시안의 7개/1위/Trail 예시를 제품에 하드코딩하지 않는다.
- 경로 목록: 개별 승인 시안 07의 투명 바탕·흰 글자·740×324 배치 우선(공통 흰 판 규칙과 다른 의도적인 예외). 출처/검색/기존 정렬/닫기 한 줄, 44px 목록행, 이름·부정보/실제 상태/오른쪽 거리, 하단 안내. 667×300·800×360·844×390에서 잘림·가로 넘침 없음.
- 가까운 순·완주 상태·출발 주소는 현재 제공되는 데이터/기능이 있을 때만. 신규 API·완주 조회·지리 정렬을 만들지 않는다. 기존 정렬 옵션과 동작 유지, 차이는 결과에 명시.
- 검색/출처 전환/선택/주행 잠금/이어달리기/이름 변경/삭제/공개 신청/필터/쿼터 안내/포커스/ESC/드래그/합류 의미 유지. 목록에서 변경·삭제 같은 관리 동작은 기존 선택 후 도구로 유지해 접근 가능해야 한다.
- 「Trail 메뉴」 접근성 버튼, 입문·퍼블릭·내 경로 모달 이름, 검색 이름·닫기 셀렉터 계약 보존. 기존 입문/퍼블릭 버튼의 exact 접근성 이름은 유지 가능(시각 라벨 확장 시 aria-label로 보존).
- 신규 course 계열 식별자 금지. functions/·Rules·데이터 모델·dep-layers.json·검사 기준선·인증/동기화 변경 금지. LocalFirstEntryCard·RideHistoryPanel 결정 대기 항목 제외.
- 모든 실행자는 같은 작업 트리에 있다. 다른 실행자의 수정은 되돌리지 않고 수용한다. 소유 파일 밖 수정 필요 시 결과에 제안만 기록한다.
- git worktree/restore/clean/stash/브랜치 전환/커밋/푸시/배포 금지. 기존 dirty 증거 JSON·.out/·cdbox.bat 보존. localhost:3000 건드리지 않는다. 비밀 값 출력 금지.

## 역할과 파일 소유권

### DeepSeek v4.1 Flash — 선행 조사·독립 코드 검토

제품·시험 파일은 읽기 전용. `02-analysis-deepseek.md`만 작성한다. MENU children 구성을 App부터 추적하고 경로/Trail 실제 소유 컴포넌트와 CSS, 셀렉터/props 계약, 함정·시안 차이를 파일:줄로 정리한다. 가능한 구현 diff가 있으면 회귀 후보도 검토한다. 검토만으로 PASS라 하지 않는다. 마지막 메시지에 간단한 요약.

### GLM-5.3 Flash — 실제 컴포넌트 검증 하네스

소유: `apps/web/scripts/ui-redesign-batch1/*`, `apps/web/e2e/ui-redesign-batch1.spec.ts`, `03-result-glm.md`. 제품 파일과 기존 시험 수정 금지. React 실제 MENU/경로/Trail 컴포넌트·제품 CSS를 import한 메모리 전용 프리뷰와 의미 있는 Playwright 검증을 작성한다. CSS/JSX 복제 금지, 인증/운영 쓰기 없음. 3화면폭, 메뉴→출처 3종 전환/검색/닫기/ESC/포커스·행 선택/저장 경로 관리 동작과 overflow 확인. 시안과 같은 대표 상태·긴 이름·빈 상태·데이터 있는 상태 지원. 캡처는 `evidence/batch1-*`에 저장(시험 코드의 기본 출력은 test-results, 증거 위치는 환경변수로 주입). 임의의 기대치 완화 금지. Cursor가 제품 구현 중이므로 처음에는 실행하지 않고 작성 후 Supervisor에 명령을 남긴다.

### Cursor — 제품 화면 구현

소유: `MenuPanel.tsx/css`, `ride/RideRoutePanel.tsx/css`, `OfficialCourseListModal.tsx/css`, `RouteListModalShell.tsx`, `SavedRoutesPanel.tsx/css`, `SavedRoutesModal.tsx`, `RouteSortSelect.tsx/css`; App의 MENU children에서 쓰는 Trail 목록 컴포넌트/CSS는 조사 후 해당 화면 스타일에 필요한 최소 변경만 허용. 경로는 모두 apps/web/src/components 아래. `04-result-cursor.md`에 변경·실행 증거·시안 차이 기록. App 공용 props 확장 필요 시 최소 wiring만 허용하고 설명. 디자인 토큰 재사용, 글로벌 CSS 영향 주의. GLM의 독립 하네스 파일은 수정 금지.

제품 구현 후 변경 소스 eslint, `npx tsc -b --noEmit`, selector 계약만 직접 실행. 무거운 e2e·전체 단위·서버 시험은 Supervisor가 순차 실행한다. 결과파일을 먼저 남겨 메모리 종료에 대비한다.

## Supervisor 감리·완료 조건

실제 diff·범위·시안 비교 직접 검토. `npx tsc -b --noEmit`, 변경소스 eslint, `npm run test:quick`, `node scripts/ride-verify/verify-selectors.mjs`, 루트 `node scripts/check-code-tidy.mjs`·`node scripts/check-dep-direction.mjs --check`, 새 화면 시험·기존 ui-800x360(기존 :84 실패와 신규 회귀 구분), `RTW_DEV_PORT=5017 npm run test:e2e:ride`, functions `npm test`를 순차 실행. 브라우저 5분 무진전 시 프로세스/포트/로그 조사 후 다른 검증 경로로 전환. 에뮬레이터 중복 기동 금지.

`05-review-batch1.md`에 명령·성공/실패/미실행·실제 캡처 경로·시안과의 차이를 기록한다. 실앱 진입 e2e와 메모리 프리뷰 캡처를 구분한다. 직접 실행 폴더·명령·URL을 Chief에게 보고. 구현·감리 완료 후 Chief 화면 승인 대기; 이번 요청에는 커밋·푸시·배포가 포함되지 않았다.
