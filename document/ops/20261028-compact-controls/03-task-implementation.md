# 승인 v2 구현 — Cursor AI

상태 IN_PROGRESS. Chief 최신「구현하라」로 승인. Supervisor Codex / Developer Cursor AI. 이전01/02의시안대기 문구를 이지시가 대체한다. 당신은 혼자 작업하지 않으며 다른 사람의 dirty와 원본 증거를 보존한다. 일상 판단·관련검증은 자율완료, 결과는 `04-result-cursor.md`에 한국어로 작성.

## 읽을 기준

AGENTS.md, 이묶음 README·02-proposal-v2.md, `mockups/approved-v2.html`(정확한시각기준), Chief디자인고정목록, Ontology, UI공간밀도원칙, `.agents/skills/ride-verify/SKILL.md` 및 하네스. 시안의예시데이터/가짜지도/모의동작을 제품에 이식하지 말고 실제컴포넌트·API·저장을 유지.

## 확정 작업

1. **LeaderboardSheet**: 740×324→폰가로440×236px 목표, 오른쪽내용형창·지도덜가림. 큰좌측요약을상단짧은요약으로병합. 10명데이터가있을때 스크롤없이최소10명보임: 행24px, 왼쪽1~5위/오른쪽6~10위 두열5행. 작은실제viewport699×273에서도10명전체경계내. 내순위·값·차이, 탭·기간·인정조건, 회원등록/게스트/순위없음/로딩/오류/내주변순위/같이달리기·10명초과접근 유지. 참가자10미만시있는인원만, 가짜행금지. 10초과목록은이중컬럼흐름을명확히하면서접근유지. 서버/서비스API변경금지. 개척탭의uses등기존보조정보·동작은접기/상세등으로살리고 무단삭제금지. 긴닉네임툴팁/접근성이름 유지. 짧은데이터/긴데이터상태 검증.
2. **EdgePanelHandle**: 양쪽visible34×72→20.4×43.2px(정확60%). 동일반달·아이콘도비례. 터치영역은현재44×76유지가능, 주행지도/RouteDock/미니맵터치가로채지않음. 클릭·스와이프·키보드·열기닫기 유지. 부모transform에의한시각크기변경주장금지, 실제rect검증.
3. **RideSettings**: 승인시안처럼두열3행(코칭/음성/배경음악, 페이서/효과음/인터벌), 폭약460px·높이약249px. 아래인터벌요약+운동설정, 칼로리계산+프로필수정. 모든항목을스크롤없이,실제699×273에서전체노출. 기존토글·저장·음악미설정비활성·프로필미설정·고도loading·인터벌다른설정복원·계정embedded도정상. 긴문구/수치줄바꿈으로하단잘리면불합격. overflow:hidden으로가리거나항목삭제금지. 필요시중복설명정리·접근성설명으로이동(중요값유지). 별도운동설정/프로필수정이동·복귀 유지.
4. **CameraViewMenu**: 두트리거→단일트리거. 클릭시한판두컬럼동시노출. 왼쪽1번전체/20/200/300/400/500/1000m세로·열폭62px·오른쪽정렬. 오른쪽2~6세로·기존파란그라데이션방향도안+번호·6아래3D뷰. 기본총폭154px정도. 트리거현재선택번호·방향/높이표시·현재항목선택강조. 선택닫기·외부클릭닫기·Escape·메뉴열기키보드·포커스복귀/aria 정확. 기존카메라프레이밍·야외잠금·1번위성정책·자동2D표시/3D토글의미 변경금지. MapHud배치·계정/스타일/줌 독립공간 유지.

## 소유·금지

Cursor허용: `apps/web/src/components/leaderboard/LeaderboardSheet.{tsx,css}`, `components/ui/EdgePanelHandle.{css,tsx}`(필요최소), `components/ride/RideSettingsPanel.tsx`·`RideSettingsSheet.{css,tsx}`(필요최소), `components/maphud/CameraViewMenu.{tsx,css}`, 관련e2e/previewfixture 및진입계약충돌부분. 기존파일로충분하면새추상화/공용API안만듦. 범위내구현에진짜필요한최소CSS위치조정만가능하며결과에명시. `src/App.tsx`/카메라알고리즘/데이터서비스는읽기만, 필요변경은먼저결과에보고.

- **금지 고정**: 1녹색원형시작글자없음,2정지/재개/옵션아이콘,3주행중지도조작상시,7바탕없는지도HUD,8km소문자,11주소/미니맵숨기지않고접기,20닉네임유지,21카메라2~6야외잠금·1번위성정책,27방향도안·세로배열(62폭만최신지시대체),28축소상한없음,30지도조작/계정비겹침,31인터벌왼쪽검정25%,32기본3프리셋·직접조절접힘·최근값,33준비/마무리직접입력,35카메라6아래3D,39계기판한행18px·왼쪽20px,40응원생명주기 유지.
- 다른변경되돌리기·git restore/clean/stash/worktree/브랜치전환/커밋/푸시/배포금지. `functions/`·Rules·dep-layers.json·인증·동행·3D리소스·카메라알고리즘 변경금지.
- **기존증거덮어쓰기절대금지**. baseline은evidence/implementation-baseline.json/zip. 새캡처는이묶음 evidence/implementation/ 또는 evidence/review/에만. 기존e2e가옛경로에PNG저장하면실행전에이번묶음으로출력경로를교정. 테스트의옛PNG를새PNG로대체금지.
- `document/ops/20261017-dev-byproducts/02-rules.md` §8준수: 개발부산물·이후불필요한시험전용코드를제품에남기지않고 작업증거는정해진묶음으로격리.
- Codex소유문서/기존HANDOFF/고정목록은수정하지않음. 당신은구현·시험·결과만 담당. 새증거·신규spec은허용.

## 검증

폰가로800×360·736×300·699×273·667×300 실제제품컴포넌트로검증(시안HTML복제금지). 순위10명·20명·3명·0명/게스트/오류/개척보조/내순위10위밖, 설정모든항목·긴값·loading·토글저장·別편집복귀, 단일트리거2열同時열기·1전체/높이선택·2~6방향·3D·Escape/외부닫기/포커스복귀, 양반달정확60%·クリック/끌기·지도터치,우상단비겹침. 기존preview와APIstub을활용하되제품데이터에가짜행이없음을검증. 新e2e `e2e/compact-controls.spec.ts`로이묶음핵심고정 권장. 本인생산코드복제시验금지.

관련카메라프레이밍계약 `npm run test:ride-camera-framing`; `node scripts/ride-verify/verify-selectors.mjs`19계약; `npx tsc -b --noEmit`; 바뀐TS/TSX대상eslint; `npm run build`; 루트`node scripts/check-dep-direction.mjs --check`·`node scripts/check-code-tidy.mjs`·대상diff검사. code-tidy기존exports188>186 baseline실패가능,증가금지/숨기지말것. 現카메라2트리거·높이폭96·반달크기옛고정시험은Chief이번지시에충돌하는기대값만교정(시험삭제/skip금지). 관련 ui-800x360·ui-redesign-batch4·ride-interval-settings·ride-ui-moments·map-menu-consolidation 회귀중변경영향분실행. 테스트명을구체적으로보고. test:quick는마지막1번필요성판정,기존프로세스/권한실패분리.

실행`C:\20.HDev\boxcycle\apps\web`. 기존5031이HTTP200이면재사용,아니면`npm run dev:localhost -- --port 5031`;테스트에RTW_DEV_PORT=5031·단일worker·retries0 지정. 3000서버건드리지말것. 브라우저5분무진전시로그/포트/프로세스확인후대체검증. 무거운빌드/e2e동시실행금지.

완료`04-result-cursor.md`: 변경파일/설계·시안대비실측크기/실행명령·PASS·FAIL·미실행이유/이번결함과기존실패분리/증거절대경로/한계/재현주소/남은일. 모든필수작업완료또는진짜외부막힘확인후종료. 토큰아끼려무관전수탐색/불필요전체시험반복안함. 새지시당Cursor기본실행1회,지금지시안에서필요수정·재시험은자율완료하라.
