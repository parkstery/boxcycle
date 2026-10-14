# 감리25 — 내 경로·퍼블릭 행 밀도

2026-10-14 Supervisor Codex. APPROVED(구현·검수), AWAITING_CHIEF(사용 확인). Chief 첨부2장 기준 두 목록의 줄 간격·항목 간격을 더 줄이는 요청을 반영했다.

## 실행·범위

Developer OpenCode Muse Spark1.3,모델opencode/muse-spark-1.3-contributor-free,세션ses_ec6a0a373ffeskzwkKx5z3BQRP,run exit0. 실제응답/편집/결과 확인. [지시25](02-task-25.md) → [결과25](03-result-25.md),muse-25.jsonl 보존. Developer가 결과를 worktree ops에 작성하여 Supervisor가 주저장소 같은 묶음으로 복사했다.

작업face-redesign2/boxcycle HEAD8fdedae. 허용SavedRoutesPanel.css/OfficialCourseListModal.css만. TSX·font-size·문구·데이터·검색/선택/정렬/load/resume/rename/공개·삭제·기록 정책 불변. 창폭/상한/헤더/기존 긴안내 예외 불변,commit/push/merge/deploy 없음.

- 내경로:행grid로 제목/상태 첫줄 전체폭,거리·날짜·Public 배지와 진행률·재개 배지 둘째줄 좌우 배치. 진행률이 없는 행은 metadata 전체폭. padding-block3px,gap2px,line-height1.2,metadata margin0,track6→4px,진행값/퍼센트는 그대로.
- 퍼블릭:해당aria범위에서 padding-block3px,이름/sub line-height1.2,sub margin1px. 행 구분선/gap0,44px 최소 선택행 유지. 입문 공용base 변경 없음.

## 독립 검증

| 명령 | 결과 | 범위 |
|---|---|---|
| npx tsc -b --pretty false (작업apps/web) | exit0 | TS |
| git diff --check (작업cwd) | exit0 | 실제diff |
| node document/ops/20261013-face-redesign2/saved-25-qa.cjs | exit0/PASS/errors0 |6viewport ×many/selected/rename/quota/error30상태+동작6묶음 |
| node document/ops/20261013-face-redesign2/public-25-qa.cjs | exit0/PASS/errors0 |6viewport ×many/long/selected/disabled/intro30상태+동작6묶음 |
| node document/ops/20261013-face-redesign2/public-25-live.cjs | exit0/PASS/errors0 |실제Guest740/1024:퍼블릭 진입/검색/정렬/닫기,입문·내경로 회귀 대조 |

viewport740×300/667×300/800×360/844×390/1024×450/1366×768. 실제React컴포넌트 mock props/콜백,전후같은DOM에서baselineCSS만교환. baseline saved-before-25.css/public-before-25.css. text/font-size동일,입력·툴바버튼높이보존,행≥44,가로넘침0. Saved는Pub/D86/40%/활성이어달리기중을동시에 넣고 metadata/progress동일행·서로겹침없음·배지부모내위치·track너비≥24px검증. 필터4/정렬3/검색0·1건/Enter·Space 선택해제/rename/resume/load콜백 통과. Public는긴제목/등록자·선택·disabled/1click load+close/Escape 통과.

Mock준비단계 node--check가fixture문자열의escaped quotes로실패한것은driver문자열만정정후syntaxcheck/전체실행으로해결. 앱오류로간주하지않고최종PASS근거와구분한다. 실제등록계정저장자료/실제삭제/공개/주행/실기기 터치검증이아니다.

## 실측

배지·진행률이섞인20개내경로,Guest안내없는상태. 완전한행만계수.

| viewport | 완전행 전→후 | 복합 첫행 높이 전→후 |
|---|---|---|
|740×300|3→4|74.27→44px|
|667×300|3→4|74.27→44px|
|800×360|4→5|74.27→44px|
|844×390|5→6|74.27→44px|
|1024×450|6→7|74.27→44px|
|1366×768|9→14|86.95→47.83px|

퍼블릭mock긴제목740은3→4행,짧은제목PC1366은13→15행. 짧은 행이44px하한에 도달한 폰 화면은 개수가 늘지 않는다: 실제catalog740은5→5,1024는8→8. 이를증가로보고하지않는다. 폰트/hitbox를더줄여개수를억지로늘리지않음. 패널크기·목록높이동일,행내부만압축.

Savedmany800/1024이미지직접검수:Public·날짜·퍼센트·재개배지모두둘째줄,겹침없음,배지/행구분선·선택스타일유지. Pubmocklong740및실제740/1024의기존동작/입문불변확인. UI성능·실기기/키보드출현 등은미검증.

증거 [saved JSON](saved-25-shots/results.json)·같은폴더PNG, [public JSON](public-25-shots/results.json)·PNG, [live JSON](public-25-live/results.json)·전후PNG.

## 확인

http://127.0.0.1:5013/ RTW → 내경로 / 퍼블릭. 기존face-redesign2 apps/web서버유지,Chief피드백대기.

```powershell
Set-Location 'C:\Users\kdrea\.codex\worktrees\face-redesign2\boxcycle\apps\web'
npm run dev -- --host 127.0.0.1 --port 5013 --strictPort
```

