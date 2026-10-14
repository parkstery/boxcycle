# 감리40 — 왼쪽·콤팩트 캐럿 승인

2026-10-15 Supervisor Codex, Developer MuseSpark1.3. **APPROVED / AWAITING_CHIEF**. Chief 수정 이미지에 따라 캐럿만44px하한예외: 24px행·왼쪽정렬·상단여백0. 녹색이미지안내선은UI로추가하지않음.

이번 앱 diff는 MapView.css 공통caret규칙4선뿐. 보존한 pick-before-40.css와 대조하여 justify-content center→flex-start, min-height/height44→24, margin→0 외 변경없음 확인. SVG20px/파랑·전체폭·padding0·투명/무테두리·focus·기존폰트/버튼/TS/접기/값/삭제/drag 보존.

검수:
- `pick-40-qa.cjs`: 모바일667/740/844 각12상태36 완료, PC10상태까지 완료 후blocked상태caret.click 안정화대기12초timeout(exit1). 실패기록보존. [최초 결과](pick-40-shots/results.json) 46상태/pageerror0.
- `pick-40-pc-qa.cjs`: PC1366 단독재검수12상태 exit0 PASS. [결과](pick-40-pc-shots/results.json). 모바일36+PC12의고유48상태에서caret24px/iconLeft0/margin0,양방향4표시·aria정확·펼침/접기·keyboard·값보존·거리재활성·토큰/phase/삭제 PASS. timeout 재현없음.
- `pick-40-live.cjs`: 실제Guest667×300/740×300/844×390 각5상태15 exit0 PASS. [결과](pick-40-live/results.json), 위치/양쪽/접기/재활성/drag·삭제click·경계내·가로/내부scroll0,원격Directions요청0/pageerror0.
- 전후4선대조 PASS, `git diff --check` exit0 PASS(CRLF변환경고만).

실제740×300 높이 위치165.05→144.25px,양쪽261.36→240.56px. 왼쪽에붙은glyph와줄어든하단공간 [캡처](pick-40-live/740-location.png) 확인. 위쪽거리캐럿/펼침반전도동일공통스타일 적용.

CSS치수수정이므로이미통과한39의141알고리즘·tsc/lint는재실행하지않음. 동작·시각검수를이번변경에맞춰수행. 실기기/전체주행/원격탐색미검증. 다른dirty보존,commit/push/merge/deploy없음. face-redesign2/5013유지,Chief사용확인대기.
