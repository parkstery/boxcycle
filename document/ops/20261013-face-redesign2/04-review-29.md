# 감리29 — 경로 생성 팝업 그룹·여백

2026-10-14 Supervisor Codex. 판정 APPROVED(구현·검수), AWAITING_CHIEF(사용 확인). Chief입문28승인후다음창으로경로생성팝업진행.

MuseSpark1.3,모델opencode/muse-spark-1.3-contributor-free,세션ses_ec6570185ffePxfmtXBB0ci1gf,run exit0. 실제응답·편집·[결과29](03-result-29.md)확인. [지시29](02-task-29.md),muse-29.jsonl보존.

작업face-redesign2 HEAD8fdedae. MapView.css의pick관련규칙만변경. 제목/meta/pin/profile/거리영역margin·padding절제,미선택profile테두리transparent,거리preset개별테두리대신공통중립배경,선택·hover/focus명시. 주소fontsize는추가16승인값그대로,다른fontsize·버튼width/height/padding·텍스트·TS/JSX·라우팅/토큰·상태reserve·anchor/drag규칙불변. HEADdiff의주소font변경은이번변경이아니므로pick-before-29.css기준으로대조. commit/push/merge/deploy없음.

## 독립 검증

- npx tsc -b --pretty false(worktree apps/web): exit0.
- git diff --check(worktree): exit0.
- node document/ops/20261013-face-redesign2/pick-29-live.cjs: exit0/PASS/errors0. 실제Guest740×300/800×360,지도지점클릭→Start→프로필/거리영역→경로삭제/닫힘. 같은DOM에서baselineCSS교환text/font/버튼rect동일. 실제팝업182.25×208.52→182.25×201.06px,높이7.46px감소. 글자·버튼축소없음.
- `node document/ops/20261013-face-redesign2/pick-29-qa.cjs`: 최종exit0/PASS/errors0. 740×300/667×300/800×360/844×390/1366×768 ×7상태35+기능5묶음. 실제buildPickPopup DOM제조기와local콜백으로테스트. 같은DOM에서baselineCSS교환,전체text/font/버튼width-height동일,가로넘침0,팝업높이증가없음. 초기pin-only/expanded/manual/긴주소/로컬차단응답/searching/failed,profile선택콜백/거리checkbox·preset5kmactive/Tab키focusoutline/Start콜백/clear콜백통과. API라우팅/Firestore쓰기없음. mock좌표고도는fixture문구고정,실제비동기고도처리검증아님.

초기mock드라이버는onArmDirectionPick콜백없이생성해거리컨트롤이숨김/disabled였다. 해당콜백과명시적거리모드checkbox선택을드라이버에추가했다. 또한마우스focus상태에서:focus-visible outline을요구한오류를Tab키검증으로바꿨다. 마지막으로비동기고도응답이CSS전후비교중fixture를덮어textassert실패하여mock고도문구를고정했다. 이세수정은앱변경없이검증fixture만고쳤고초기결과JSON을보존,전체PASS로보고하지않음.

실제800캡처직접검수:거리1/3/5/10/20한그룹표현·선택1 강조·미선택수단중립아이콘·선택자전거파랑유지. 작은높이개선이며구조전체개편으로과장하지않음. 이창은기존주소/버튼크기가작지만이번에더줄이지않았다.

## 한계·확인

실제검색/완성경로주행·센서·토큰잔액변경·실기기터치·drag동작은미실행. CSSdrag-handle/anchor규칙과TS불변이며드래그실동작PASS라고하지않음. Mock차단상태는getRouteTokenInsufficient local응답,실제서버토큰정책검증아님.

증거 [mock JSON](pick-29-shots/results.json)·대표전후PNG, [실제 JSON](pick-29-live/results.json)·전후PNG. 최초JSON results-initial-29.json/results-initial-focus-29.json보존.

확인 http://127.0.0.1:5013/ 지도지점클릭→경로생성창에서Start를눌러이동수단·거리그룹확인. 서버기존face-redesign2 apps/web유지,다음창Chief피드백후.

```powershell
Set-Location 'C:\Users\kdrea\.codex\worktrees\face-redesign2\boxcycle\apps\web'
npm run dev -- --host 127.0.0.1 --port 5013 --strictPort
```

