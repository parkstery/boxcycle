# 감리24 — 퍼블릭 경로 목록 최종

2026-10-14 Supervisor Codex. APPROVED(구현·검수), AWAITING_CHIEF(사용 확인). 내경로22는Chief통과. 이번퍼블릭한창.

## 실행·범위

DeveloperMuseSpark1.3,모델opencode/muse-spark-1.3-contributor-free,세션ses_ec6b4b144ffeQxd1lWEXatEu0Y. 지시23새세션/24는이정확한세션이어실행,두run모두exit0,실제편집·응답·결과확인. [지시23](02-task-23.md) → [결과23](03-result-23.md) → [감리23](04-review-23.md) → [재지시24](02-task-24.md) → [결과24](03-result-24.md). 로그muse-23.jsonl/muse-24.jsonl 보존.

작업cwdface-redesign2/boxcycle,branchface-redesign2 HEAD8fdedae. 변경OfficialCourseListModal.css한파일100줄append,base삭제없음. 모든override퍼블릭aria-label정확범위. 폭560·viewport-16높이상한,검색/정렬/닫기한행,행구분선/44px최소높이,긴이름·등록자줄바꿈,긴오류본문scroll. 소수/빈/로딩은내용높이. 24는검색예약margin9rem→6.5rem한선언뿐. TSX·폰트·기존버튼높이·콜백·데이터/검색/정렬/주행정책불변.

SavedRoutesPanel.css/UserInfoSheet.css/tsx/MenuPanel.css는 [직전SHA256](preserved-before-23.json)과독립대조모두동일. 기존dirty보존,commit/push/merge/deploy없음. 수정전public-before-23.css 및23직후public-before-24.css보존.

## 독립검증

| 명령 | 결과 | 범위 |
|---|---|---|
| npx tsc -b --pretty false (작업apps/web) | exit0 |23CSS반영후TS,24는한CSS선언만이라반복하지않음 |
| git diff --check (작업cwd) | exit0 |24최종diff |
| node document/ops/20261013-face-redesign2/public-23-qa.cjs (주저장소) | 최종exit0/PASS/errors0 |5viewport×11상태55 +동작5묶음 |
| node document/ops/20261013-face-redesign2/public-23-live.cjs (주저장소) | 최종exit0/PASS/errors0 |실제Guest740/800퍼블릭진입·검색·정렬3종·Escape닫기·입문/내경로전체DOMrect불변 |

Mock은실제OfficialCourseListModal에localprops와callback주입,Firestore쓰기/실제입문로드없음. 상태0/1/2/20개, 긴제목/등록자, selected/주행중disabled, loading/error/미연결, 입문regression. 같은 DOM에서기존CSS만교환하여text/font/입력·닫기·정렬높이, 행최소44, 가로넘침0, 검색-정렬-닫기겹침없음assert. 각viewport입문rect/전체요소동일. 검색0/1개·정렬name00/recent19/distance19·행1click load:p3+close·Escape·disabled전체확인. 긴오류는내용이넘치는경우wheel scroll과헤더고정,다보이는경우스크롤불필요를구분.

최초harness실패들은앱변경없이수정후독립재실행:
- distance를오름차순으로기대한오류 → SoT의긴거리우선으로기대값정정(감리23).
- 오류가360px화면에서모두보이는데scrollTop>0만강제한오류 → overflow일때만스크롤요구.
- 실제Escape가메뉴도닫은뒤입문버튼을찾아timeout → 확인후RTW로메뉴를다시열도록driver수정.

실패/부분결과는 results-initial-23.json/results-initial-24.json에보존. 최종JSON만PASS근거로사용.

## 실측·시각

실제앱catalog 740×300:420×255→560×284,목록clientHeight166→225px,완전표시3→5행. 800×360:목록217→285px,4→6행. 경로비교를위해지도점유가늘어남(74048.24%→71.64%);지도가림감소라보고하지않음.0/1/2개mock740높이는72.89/109.16/153.16px로내용높이종료.

헤더740검색오른쪽528.86/정렬왼쪽540.14,간격11.28px(초기45.03px에서마감). 667도같은font/폭으로겹침없음. PC16px루트에서도겹침없음. 긴이름mock740은완전표시2→3행,정보숨김없이wrap.

실제740와mocklong740이미지직접검수:파랑선택/배지·등록자·수단·거리·활동안내유지, 현재읽기/비교밀도개선. 로직 변경 없음, 실제ロード/주행/실기기터치·키보드등은미검증.

증거 [mock최종JSON](public-23-shots/results.json) 및대표PNG, [live최종JSON](public-23-live/results.json) 및전후PNG. 전체기능/실기기PASS아님.

## 확인

http://127.0.0.1:5013/ RTW → 퍼블릭. 기존face-redesign2 apps/web서버유지,다음창Chief피드백후.

```powershell
Set-Location 'C:\Users\kdrea\.codex\worktrees\face-redesign2\boxcycle\apps\web'
npm run dev -- --host 127.0.0.1 --port 5013 --strictPort
```

