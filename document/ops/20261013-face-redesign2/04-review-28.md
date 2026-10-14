# 감리28 — 입문 행을 퍼블릭 밀도로

2026-10-14 Supervisor Codex. APPROVED(구현·검수), AWAITING_CHIEF(사용 확인). Chief 명시요청으로 입문 선택행에도32px 예외 적용. 다른컨트롤 확대 없음.

MuseSpark1.3 모델opencode/muse-spark-1.3-contributor-free,세션ses_ec65fc008ffejSohQbaBy93inO,run exit0. 실제편집·응답·[결과28](03-result-28.md) 확인. [지시28](02-task-28.md),로그muse-28.jsonl보존.

실제변경OfficialCourseListModal.css 한파일의입문규칙5선언만. 직전intro-before-28.css와줄별대조: min44→32,padding2→1px,name/sublineheight1.2→1.15,submargin1→0. 줄435/437/450/458/459만변경. 폰트·글자·배지·TSX·콜백·헤더/폭/나가기/공용/퍼블릭rule불변. 기존dirty보존,commit/push/merge/deploy없음.

## 독립 검수

- git diff --check (worktree cwd): exit0.
- node document/ops/20261013-face-redesign2/intro-28-qa.cjs: exit0/PASS/errors0,740×300/667×300/1366×768 ×7상태21+기능3묶음. 실제컴포넌트mockprops,3행/긴이름/선택+나가기/disabled/0/1개/퍼블릭회귀. 같은DOM에서baselineCSS교환하여text/font일치·입력/닫기/정렬높이보존·행≥32·가로넘침0·검색/정렬/닫기겹침없음·퍼블릭전체rect동일. 정렬3·검색0/1·load+close·leave+close/Escape콜백검증.
- node document/ops/20261013-face-redesign2/intro-28-live.cjs: 최종exit0/PASS/errors0. 실제Guest740입문진입/검색/정렬/Escape,퍼블릭/내경로전체DOMrect불변.
- TypeScript는직전27에서exit0. 이번5CSS선언만변경으로반복하지않음.

첫live대조는퍼블릭목록로드가완료되기전에rect을기록해baseline교환동안내용이변한assert실패. driver가퍼블릭실제행출현을기다리도록수정후같은검증독립재실행,앱변경없음. 초기결과intro-28-live/results-initial-28.json보존,성공으로보고하지않음.

740실제입문4개 모두표시 유지,행44→32px,창460×241.16→460×193.16px(높이48px감소). 화면점유49.97%→40.02%. mock3개높이197.16→161.16px. 내용이이미모두표시되므로항목수증가라고보고하지않음. 실제740캡처직접검수:같은폰트/색,가까워진구분선,긴이름내용접근,정렬헤더정상.

증거 [mock JSON](intro-28-shots/results.json)·PNG, [실제 JSON](intro-28-live/results.json)·전후PNG. 실제경로로드/주행·실기기터치·키보드출현미검증.32px예외는44px충족이아니며인접행과겹치는가짜hitbox없음.

확인 http://127.0.0.1:5013/ RTW→입문. 서버기존face-redesign2 apps/web 유지. 다음창Chief피드백후.

