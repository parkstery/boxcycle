# 승인된 왼쪽 메뉴 구현 — Cursor 지시

2026-10-29 Chief 「구현해 . 커서 활용해」. Supervisor Codex, 구현 Cursor CLI. 시안은 README와 preview.html. 원본 fragment 경로는 README 참조. 즉시 구현·관련 검증하고 02-result-cursor.md에 파일/명령/통과/실패/미실행을 기록한다.

## 범위와 동작

1. MenuPanel 헤더 브랜드 오른쪽에 텍스트 없는 지명검색 아이콘, 오른쪽 끝 닫기. 기존 검색 callback 유지, 접근성 이름·한국어 tooltip. 헤더 drag 영역과 버튼 충돌 금지.
2. RideRoutePanel 기존 「경로」/「경로 선택」단일 진입을 「경로 선택」중간 제목과 한 줄 내 경로 / 퍼블릭 / 입문 버튼으로 대체. 각각 기존 selectSource(saved/public/basic 대응 실제 타입 확인)로 목록을 바로 열고 기존 목록 탭/닫기/선택 기능 유지. 순위 행·지명검색 행 제거. 오른쪽 순위 전체보기 유지.
3. 「인터벌」행을 주행 설정 위로 이동해 기존 인터벌 설정 창 직접 열기. 주행 설정 내 인터벌 스위치/요약/운동설정은 이동에 따라 제거하되, 인터벌 사용 켜기/끄기는 기존 인터벌 설정 창에 반드시 보존(이미 존재하는지 확인). 저장/최근설정/적용/주행 중 잠금/INT 진입/경로시간 경고 기능 유지. 불필요한 전역 상태·새 저장 경로 금지.
4. 툴팁 누락 감사: 양쪽 EdgePanelHandle 및 메뉴·지도·RouteDock·카메라·미니맵/주행 조작 등 화면상 아이콘 버튼에서 aria만 있고 title 없는 항목을 관련 범위 내 보완. 기존 CSS tooltip 기제가 있으면 활용; 최소 native title과 aria 유지. 좌우 에지는 상태별 메뉴 열기/닫기·순위 목록 열기/닫기를 한국어로 설명. 기존 aria 선택자 가능하면 유지. 메뉴 close 영어 tooltip도 한국어로. 관련 파일 외 광범위 리팩터링 금지.

## 소유권/금지

제품 관련 MenuPanel/RideRoutePanel/RideSettingsPanel/Sheet/App/EdgePanelHandle/관련 CSS와 아이콘 tooltip, 관련 UI preview/e2e/entry-contract만 수정. 다른 변경이 존재하며 혼자 작업하는 코드베이스가 아니다. 기존 dirty 절대 되돌리거나 덮어쓰지 말고 공존한다. Supervisor는 HANDOFF/고정목록/ops 최종문서를 소유하므로 수정 금지(02 결과만 작성).

금지: git worktree/restore/clean/stash/브랜치 전환/커밋/푸시/배포, functions/·Rules·dep-layers.json·비용·동기화 변경, 게이트/래칫 완화, 기존 증거 덮어쓰기, .out/·cdbox.bat·다른 프로젝트 서버3000/3001 종료. 기존5031서버 보존. e2e 캡처는 이번 묶음 새 evidence에만 저장.

고정14: 반달20.4×43.2·touch44×76·tap 전용·열린 왼쪽도 가장자리 위치/캐럿 반전·색 유지. 고정16: 브랜드정본 SpinatlasMark 유지. 고정5/6: 목록 흰 불투명/어두운 글자/경로 한 줄. 주행 재생/일시정지 아이콘·카메라·주소창·미니맵·계정 등 다른 고정 항목 유지. 고정18/42의 메뉴/인터벌 위치만 Chief 새 승인으로 대체(Supervisor가 정본 갱신).

## 검증

ride-verify 스킬 및 scripts/ride-verify/HARNESS.md 읽고 entry-contract/e2e 실제 앵커 동시 갱신. 기존 경로 선택 단일버튼을 쓰는 관련 spec/preview를 새 진입으로 업데이트(검사 삭제/완화 금지). npx tsc -b --noEmit, 변경파일 eslint, node scripts/ride-verify/verify-selectors.mjs, npm run build. 필요 UI 시험은 1worker/0retry·별도 포트 사용, 같은 증상5분 무진전이면 서버/포트/로그 확인 후 다른 경로. Supervisor가 최종 독립검증한다. Cursor에서 무거운 전체 e2e는 돌리지 말고 관련 spec/하네스 사용법을 결과에 남긴다.
