# 감리41 — 센서 선택 상태·여백 개선 승인

2026-10-15 Supervisor Codex, Developer MuseSpark1.3. **APPROVED / AWAITING_CHIEF**. Chief40통과 후 수정안17의다음센서창한개만진행,다른창미착수.

체험입력을명시선택한 manual-ready/manual 조건에서만 보이는제목 '체험 속도 · 선택됨'. 같은상태에서는센서연결버튼secondary로표시. 미선택/센서모드는기존제목/연결표시유지. 연결장치/RPM·단절/지원불가/주행중안내·버튼행동조건·명시수동선택정책·dialog/버튼aria 모두보존. 센서hook/주행게이트/SessionSpeedControl변경없음.

CSS panel gap/하단padding과handle하단margin만줄이고focus-visible추가. 기존font/버튼/slider크기·시트폭·상한유지. 실제diff 앱2파일확인,다른dirty/캐럿40보존.

자원사용: Developer1회종료→selector/tsc순차1회→headless browser1개/page1개로상태검수. 기존5013재사용,추가서버/병렬browser/전체suite/하위agent없음. 테스트첫실행은harness의Vite React createRoot export접근오류로exit1,스크립트만교정후재실행exit0. 앱실패로은폐하거나첫실행성공으로보고하지않음.

| 검증 | 결과 |
|---|---|
| `node scripts/ride-verify/verify-selectors.mjs` (작업web) | exit0,15앵커PASS·변경없음 |
| `npx tsc -b --pretty false` (작업web) | exit0 PASS |
| `node document/ops/20261013-face-redesign2/sensor-41-qa.cjs` | 수정후exit0,740×300/1366×768 각5상태10+실제Guest체험선택/닫기1 PASS. [결과](sensor-41-shots/results.json) |
| `git diff --check` (Developer) | PASS, [결과41](03-result-41.md) |

기본/체험선택높이740에서105.47→95.50px,PC139.77→124.55px. 연결119.72→108px,단절137.69→125.97px,지원불가147.36→135.64px(740). 모든대표상태가로/내부scroll0,전후버튼·입력rect/글자크기동일. 센서없음/닫기callback확인. 실제Guest에서도체험선택후제목/상태표시확인, [캡처](sensor-41-shots/740-live-manual.png).

미실행: 실제BLE장치연결/단절·스마트폰터치/ブラウザ高さ·실제주행·전체ride-entry e2e. PCviewport/mock연결상태와실제BLE성공을혼동하지않음. 앱/ops미커밋,commit/push/merge/deploy없음. 5013 센서설정→센서없음확인후Chief다음지시대기.
