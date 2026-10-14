# 감리22 — 내 경로 목록 최종

2026-10-14 Supervisor Codex. 판정 APPROVED(구현·재작업 검수), AWAITING_CHIEF(사용 확인). 계정20은Chief통과,이번한창내경로목록. 입문/퍼블릭은이번미변경.

## 실행·diff

Muse Spark1.3,opencode/muse-spark-1.3-contributor-free,정확한21세션 ses_ec6c62167ffeQmR1I24s3iLrrS를명시하여22이어실행.21/22CLI exit0,실제응답/편집/결과확인. [지시21](02-task-21.md)·[결과21](03-result-21.md)·[감리21](04-review-21.md) → [재지시22](02-task-22.md)·[결과22](03-result-22.md)·[로그22](muse-22.jsonl).

face-redesign2 HEAD8fdedae,작업cwd기존worktree. 이번SavedRoutesPanel.css한파일만. CSS로폭560/화면높이상한,선택전툴바접힘,행구분선/44px최소행,상단여백정리. 긴오류/쿼터만본문scroll예외+안내내부scroll+목록최소88px를보장. 창헤더고정. TSX/폰트/버튼높이/문구/선택·load/resume/이름/삭제/공개/필터/정렬콜백변경없음. 기존계정20·메뉴18·추가15/16유지,commit/push/merge/deploy없음.

## 독립검증

| 명령 | 결과 | 범위 |
|---|---|---|
| npx tsc -b --pretty false (작업apps/web) | exit0 |21CSS반영후TS,22는CSS예외만이라재실행불필요 |
| git diff --check (작업cwd) | exit0 |22마감diff |
| node document/ops/20261013-face-redesign2/saved-21-qa.cjs | exit0/errors0 |5viewport×9상태45+동작5묶음,21초기일반상태/동작PASS;시각예외는감리21에서재작업판정 |
| node document/ops/20261013-face-redesign2/saved-21-live.cjs | exit0/PASS/errors0 |실제Guest740/800내경로진입/검색/닫기;입문/퍼블릭DOM전체rect CSS교환전후동일 |
| node document/ops/20261013-face-redesign2/saved-22-qa.cjs | exit0/PASS/errors0 |22최종740/667/800×many/selected/quota/error12상태+동작3묶음;일반상태의rect·행수21유지 |

Mock은실제SavedRoutesModal/Panel에0/1/2/20개localprops및callback주입.클라우드저장/변경/삭제없음.필터4개수7/7/6/20·정렬3종·검색0/1건·Enter/Space선택해제·이어달리기r19·열기r3·rename콜백검증.21harness최초optionrole이native<select>option도잡아timeout,행class로scope후재검증;실패는감리21에기록.

22추가:긴안내실제높이60px이상assert,실제wheel로안내내부scrollTop증가,쿼터확인버튼click/dismiss콜백,긴error후rename입력접근,본문scroll후헤더같은y좌표검증. CSS baseline은수정전saved-before-21.css,같은DOM에서CSS만교환.21/22직전CSS도각각보존.

## 정상목록실측

20경로,Guest안내,완주/대기/40%진행률혼합.완전한행만계수하며다음행일부는포함하지않음.

| viewport | 미선택완전행 전→후 | 목록높이 전→후 | 선택후완전행 |
|---|---|---|---|
|740×300|1→3|97→164px|2|
|667×300|1→3|97→164px|2|
|800×360|2→3|148→224px|3|
|844×390|2→4|174→254px|3|
|1366×768|5→9|375→612px|8|

740많은목록:420×255→560×284px,화면점유48.24%→71.64%。지도점유가증가하는대신경로비교공간을늘린단위이며모든패널을작게만드는목표가아니다.0/1/2개는내용높이로종료(740:131.30/167.91/235.78px)。짧은1개리스트를전체높이로늘리지않음.진행률혼합740에서4행목표는미달(3행),이를숨기거나행높이·폰트를줄여달성하지않음.

many740·quota/error22캡처직접검수:행정보/배지/진행률보존,조건부toolbar·읽히는안내공간확인. 긴안내에서는본문scroll로다음행/확인행동접근;예외JSON의visibleFullRows는listrect내계수로부모본문클립을반영하지않으므로예외의완전표시행수로인용하지않음.

증거 [초기21JSON](saved-21-shots/results-initial-21.json), [실제앱JSON](saved-21-live/results.json), [최종22JSON](saved-22-shots/results.json),각폴더PNG.실기기터치/키보드실출현/실제등록계정데이터/실제공개·이름·삭제확정은미검증.조회/수정정책변경없음.

## 확인

http://127.0.0.1:5013/ 왼쪽위RTW → 내경로. 서버face-redesign2 apps/web에서실행유지.다음창은Chief피드백후.

```powershell
Set-Location 'C:\Users\kdrea\.codex\worktrees\face-redesign2\boxcycle\apps\web'
npm run dev -- --host 127.0.0.1 --port 5013 --strictPort
```
