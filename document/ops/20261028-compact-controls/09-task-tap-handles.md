# 좌우 반달 탭 전용·위치 고정 — Cursor 구현

Chief 최신 직접 지시: 좌우 edge handle은 슬라이드가 아닌 터치(탭)만으로 열기/닫기. 왼쪽도 오른쪽처럼 화면 가장자리 동일 위치를 유지하고 열리면 캐럿만 반전. 기존60%크기20.4×43.2·44×76터치·색상보존. 이번은바로구현승인, 시안불필요. Supervisor Codex / 구현 Cursor AI. 기존dirty·다른사람의변경보존, 혼자작업하지않음을인지하라.

읽을것: AGENTS/HANDOFF·이묶음README·08-review-final.md·Chief고정목록14/4최신지시. UI shell변경은일상승인범위, DB/카메라/순위/동행의미변경불필요.

## 범위

- `EdgePanelHandle.tsx/css`: document capture edge swipe 등록해제. 가장자리20px에서손가락끌기/반달끌기로패널열고닫기/손가락추적 없음. native button의탭/클릭/Enter/Space만토글. drag후발생click이토글하지않는지검증, 필요시버튼내최소이동slop억제하되document전역새제스처금지. 인접지도pan/컨트롤터치가로채지않음.
- 왼쪽open의left=min300px/transform 이동제거. 항상safe-area왼쪽같은x/y,열렸어도z-index로메뉴위에보이고탭해닫을수있음. 캐럿만반전. 오른쪽도위치고정/캐럿반전. MENU 내용과스크림이왼쪽버튼을덮지않게실제hit-test확인. 드로어등기존등장애니메이션의전면삭제는불필요, 요구는조작방식변경.
- 죽은드래그콜백/상태는직접호출자App.tsx·preview.tsx에서이번핸들과관련된최소범위만정리가능. `edgePanelDocumentGesture.ts`가더이상어디에서도사용안되면해당미사용모듈은제거가능(그외header close drag등다른제스처보존). 기존공용타입변경은직접호출자같이갱신,새API/서버변경없음.
- 충돌기존e2e(ui-800x360·ride-ui-moments)에서스와이프열림기대만최신요구로교정·삭제/skip으로시험회피금지. compact-controls등직접연관시험보강: 양쪽탭열고닫기,위치rect동일,캐럿path반전복귀,열린왼쪽hit-test·Enter/Space,닫힌/열린상태의반달/빈가장자리drag로state불변. 폰가로800×360/699×273/667×300·마우스및touch실제포인터경로검증. 지도터치/카메라/설정/순위회귀보존.
- 기존dirty/PNG보존,커밋푸시배포·git restore/clean/stash/worktree/브랜치전환금지. 기존1~42중이번탭/고정위치지시로대체되는부분만변경. 데이터/주행/카메라/3D/Functions/Rules불변. Codex소유문서수정금지.

검증은단일worker/retries0/기존5031재사용. 관련e2e ui-800x360·ride-ui-moments·compact-controls(총90중직접관련)·selector19·tsc -b --noEmit·바뀐파일eslint·build·루트dep/tidy(기존188>186와비교)·diff. 기존PNG경로출력금지,새증거 `evidence/tap-handles/`만. `document/ops/20261017-dev-byproducts/02-rules.md` §8준수. 전체quick불필요,관련실패는고치고재검하되무관시험반복금지.

완료결과 `10-result-tap-handles.md`: 변경파일/명령/PASS·FAIL·미실행/실측위치/증거/한계/접속주소를한국어로기록하고종료. 모든실제구현은당신이수행하고Codex는감리. 기존08완료시점변경과이번변경혼동금지. baseline은`evidence/tap-baseline.json/zip`(Codex생성).
