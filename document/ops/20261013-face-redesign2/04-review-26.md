# 감리26 — 두 목록 행 추가 축소

2026-10-14 Supervisor Codex. APPROVED(구현·검수), AWAITING_CHIEF(사용 확인). Chief는 직전44px하한설명후두목록간격추가축소명시요청. 요청범위의선택행만32px예외적용,다른컨트롤확대없음.

## 실행·범위

MuseSpark1.3,opencode/muse-spark-1.3-contributor-free,세션ses_ec688fcf3ffewZT9gZ3iGVnpXb,run exit0. 실제모델응답·편집·[결과26](03-result-26.md)확인,로그muse-26.jsonl보존. Developer결과는worktree에작성되어주저장소같은묶음으로복사.

SavedRoutesPanel.css와OfficialCourseListModal.css 목록행값만. min44→32/heightauto/paddingblock3→1/lineheight1.2→1.15/Savedrowgap2→1/Publicsubmargin1→0. text/font-size/배지크기/데이터/TSX/창폭·상한/다른컨트롤/검색정렬선택로드재개이름/오류예외보존. 실제터치높이가32px이상으로작아지는특정예외이며44px충족이라보고하지않음. baseline saved-before-26.css/public-before-26.css.

기존5013서버가모델작업후보이지않아재실행시도했으나portinuse exit1. 서버를중복기동하지않고기존서버재사용,브라우저실제앱연결성공. 이를서버시작성공으로보고하지않음. commit/push/merge/deploy없음.

## 독립 검수

- `npx tsc -b --pretty false` (worktree apps/web): exit0.
- `git diff --check` (worktree): exit0.
- `node document/ops/20261013-face-redesign2/public-26-live.cjs`: exit0/PASS/errors0,실제Guest740/1024퍼블릭진입·검색·정렬·Escape,입문/내경로CSS교환전후rect동일.
- `node document/ops/20261013-face-redesign2/saved-26-qa.cjs`: exit0/PASS/errors0,6viewport×5상태30+기능6묶음. text/font일치,행≥32,metadata/progress같은행·겹침없음·Public/재개배지부모내표시·track너비≥24,필터4/정렬3/검색0·1/Enter·Space선택해제/rename/resume/load콜백검증.
- `node document/ops/20261013-face-redesign2/public-26-qa.cjs`: exit0/PASS/errors0,6viewport×5상태30+기능6묶음. text/font일치,선택행≥32,가로넘침0,검색정렬닫기겹침없음,입문전체DOMrect불변,긴제목등록자·disabled·1click load+close검증.

## 최종 실측

내경로20개완주/대기/진행률혼합·Guest안내없음,퍼블릭actualcatalog. 완전한행만계수.

| 화면 | 내경로 mock 전→후 | 퍼블릭 실제 전→후 |
|---|---|---|
|740×300|4→5|5→6|
|800×360|5→7|이번live미실행|
|1024×450|7→10|8→11|

내경로Public/D값/진행률/재개복합행44→36.72px,퍼블릭짧은행44→32px. font/배지크기동일. PC내경로14→16행,public20개모의15→20행으로전부보이며모달높이752→715로내용높이종료. 740/667/800/844/1024/1366의독립전후를기록했다.

증거 [saved최종JSON](saved-26-shots/results.json)·PNG, [public최종JSON](public-26-shots/results.json)·PNG, [실제최종JSON](public-26-live/results.json)·전후PNG. 캡처saved800/publicactual1024직접검수. API·브라우저·서버지연중에도파일과검증출력이유의미하게진행됐으며같은브라우저단계5분정체는없었다.

실제퍼블릭740×300완전행5→6,1024×4508→11,목록/패널높이동일. actualcatalog정보/수단거리/등록자/활동표시보존. 실제1024와Savedmock800캡처직접검수:행압축·배지정보접근·서로겹침없음.

## 검수 한계·확인

Savedmock은실제컴포넌트localprops/콜백에Public·D값·40%·활성재개배지동시주입한밀도검증. 실제등록계정50개자료의실클라우드저장/삭제/주행시험아님. 실기기터치·키보드체감미검증.

http://127.0.0.1:5013/ RTW → 내경로/퍼블릭. 작업위치 C:/Users/kdrea/.codex/worktrees/face-redesign2/boxcycle/apps/web. 서버재실행이필요할때만:

```powershell
Set-Location 'C:\Users\kdrea\.codex\worktrees\face-redesign2\boxcycle\apps\web'
npm run dev -- --host 127.0.0.1 --port 5013 --strictPort
```

