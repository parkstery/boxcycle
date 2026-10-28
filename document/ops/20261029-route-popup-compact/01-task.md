# Cursor AI 구현 지시

Chief 승인: 시안대로 Cursor AI로 구현하고 검증. 당신은 혼자 작업하지 않는다. 기존 dirty 및 타인 변경·증거를 되돌리거나 덮어쓰지 말라.

## 기준과 범위

AGENTS.md, 이 묶음 README, mockups/approved.html, document/reference/product/261024-RTW-Chief-지정-디자인-고정.md, Ontology를 읽고 기존 실제 경로 생성 컴포넌트를 수정한다. 시안의 가짜 주소/모의동작/색상 변수를 제품에 복사하지 않는다. 시안은 외형·기하 기준이며 기존 제품 SVG 스타일·색상을 쓴다.

- 모드 Start·End 텍스트를 경로 두 지점을 잇는 아이콘으로, 거리·방향 텍스트를 자+방향화살표 아이콘으로 교체. 모드 너비50px·높이28px, aria 이름 출발·도착 및 거리·방향 유지, title 가능. 키보드 전환/aria 선택 계약 유지. 기존 앱은 Lucide 미사용이므로 새 의존성 없이 기존 방식 SVG로 그린다.
- 지점 Start/+WP/End는 각46px·높이28px. 글자 유지. 프리셋1/3/5/10/20 각30px·높이28px·gap4px. 숫자/입력·증감·지도방향탐색 등 모든 기능 유지.
- 경로 생성 패널 300→228px, 두 모드 같은 너비. 좌우 padding16/14px 기존 유지. 필요시 실제 box sizing 고려. 경로 삭제 텍스트·빨간 테두리 유지하고 탭과 한줄·겹침없음. 시안의 clear padding7px 참고. 기존 title17px·실제 토큰 긴 안내는 줄바꿈/높이확장 허용. 주소 긴 내용 접근성 유지.
- 거리 입력행은 228px 안에 맞게 목표거리 캡션·minus·input·km·plus를 재배치/폭축소. 숫자 입력은 기존 기능/서식 유지. 프리셋 남는 공간을 강제 확장하지 않는다.
- 하단 이동수단 세 개28px·gap6, 주행 녹색 원32px 유지, 오른쪽 끝. 창 축소하며 시안처럼 그 아래 줄바꿈 안 됨. 지도 앵커 팝업·도킹 모두 동일 적용.

허용 소유: apps/web/src/components/map/mapPopupElements.ts 및 RoutePickPopup.css, 필요한 최소 MapView.css/MapView.tsx(레이아웃 용도만), 관련 e2e 및 기존 preview 최소. 가능하면 첫 두 파일로 끝낼 것. 새 의존성·공용API·탐색알고리즘·인증·데이터·서버·Rules·App.tsx·3D·카메라 계산 금지. 위 범위외 필요는 결과에 보고. HANDOFF·고정목록·ops README는 Codex 소유이므로 수정 금지.

고정13의 지점 영어·색/기호, 고정15의 제목·경로삭제·하단행·자동차기본 유지. 이번 Chief 승인으로 모드 텍스트→아이콘과 폭만 대체한다. 고정1 녹색원시작 글자없음·8 km소문자·23 탐색완료5회펄스·26 주행중삭제 차단 유지.

git worktree/restore/clean/stash/브랜치전환/커밋/푸시/배포 금지. 기존 PNG 등 증거 덮어쓰기 금지: 새 캡처는 이 묶음 evidence/cursor/ 안에만. 기존 시험에서 저장 경로를 확인하고 환경변수 또는 testInfo.outputPath 등 안전한 경로 사용.

## 검증과 결과

실행 C:\20.HDev\boxcycle\apps\web. 기존5031 HTTP200이면 재사용(3000 건드리지 말 것), 없으면 npm run dev:localhost -- --port 5031. RTW_DEV_PORT=5031 단일worker retries0. 실제 컴포넌트 기존 preview/map-route-runtime fixture로 800×360·736×300·699×273·667×300에서 양 모드 실측228px·버튼50/46/30px·상단과하단 비겹침·가로 overflow0 확인, 지도 앵커/도킹 및 긴 주소·큰 거리 입력 확인. 아이콘-only/aria/키보드 전환, Start/End 선택·거리 프리셋/증감/입력·수단·주행/삭제 회귀를 기존 관련시험으로 검증. 필요시 신규 e2e 작성하되 기계적인 CSS 값만 복제하지 말고 실제 가시영역·동작 확인.

npx tsc -b --noEmit, 변경TS eslint, node scripts/ride-verify/verify-selectors.mjs, 관련 e2e(distance-direction-attention/route-media-controls 등 영향분)·npm run build, 루트 node scripts/check-dep-direction.mjs --check·node scripts/check-code-tidy.mjs·git diff --check. 무거운 시험 병렬 금지. 모든quick/서버 시험은 UI 한정으로 생략 가능하고 이유 기록. 브라우저5분무진전시 프로세스/서버/포트/로그확인후 대체검증.

02-result-cursor.md에 변경파일·실측기하·실행명령·통과/실패/미실행이유·증거절대경로·남은일을 사실대로 작성. 이 지시 내 수정/재시험 자율 완료 후 종료. 사용자에게 승인 재요청하지 말 것.
