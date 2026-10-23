# 묶음 1 — 1차 감리 재작업 (Cursor)

2026-10-23 Codex. 최초 지시의 금지/소유권 유지. GLM 하네스는 손대지 않는다. 결과 `07-result-cursor-rework.md`.

실제 중간 검증에서 확인한 다음 문제를 수정하고 tsc/변경 eslint/selector만 실행한다. Supervisor가 전체 시험·캡처한다.

1. `RideRoutePanel` 입문·퍼블릭 버튼에 기존 exact 접근성 이름 `입문`·`퍼블릭`을 유지한다. 실제 `ui-800x360.spec.ts:259`는 입문 버튼을 못 찾아 실패했다. 시각 문구는 입문 경로·퍼블릭 경로 유지.
2. map `RouteListModalShell`에서 `titleId`에 해당하는 실제 heading이 없어졌다. map/흰 모드 모두 제목 id를 보존한다(시각 숨김 가능). ride-entry는 `#oc-modal-title`을 가진 dialog로 찾는다. 소스 문자열 검사가 통과해도 실제 DOM이 없으면 실패다.
3. 기존 `.oc-modal[aria-label="입문 경로"]`/퍼블릭·하위 규칙이 map class보다 specificity가 높아 460/560px 폭과 헤더 패딩/검색 margin-right가 남는다. 중간 캡처가 460px로 확인됨. 해당 레거시 규칙은 `:not(.oc-modal--map)`로 제한하거나 불필요하면 제거해 map740×324/내부padding 12px 16px 10px 20px가 실제 적용되게 한다. .oc-modal__search의 기존 -webkit-text-fill-color가 흰 글자를 덮는 문제도 수정. 출처탭 없는 독립 모달도 제목·검색·정렬·닫기가 정상이어야 함.
4. 승인 시안 서체 Gothic A1/Saira Condensed를 실제 대상 컴포넌트에 지정한다. 앱은 index.html에 폰트를 이미 로드. 현재 --rtw-font/--rtw-font-num은 다른 글꼴. MENU header padding을 폰 가로에서 4px로 덮어 시안보다 위로 올라가는 것도 교정. 퍼블릭 경로 보조문구가 38% 제한으로 잘리지 않게 한다. hover는 media(hover:hover) 범위로 제한.
5. `publicationStartSubtitle`는 목적지를 출발로 오표시한다. 출발 주소 필드가 없으면 기존 실제 프로필/등록자 등의 메타를 표시하고 목적지에 출발을 붙이지 않는다. 기존 부정보를 display:none으로 감추지 말고 행 두 번째 줄로 읽히게 한다. 중복 거리 메타는 줄여도 됨. 서버/API 추가 금지.
6. 내 경로 map 모드에서 기존 내역을 불필요하게 감추지 않는다. 선택/관리/필터/쿼터 동작 보존. 특히 이름·거리·상태 3열을 44px로 배치하되 이름이 길면 읽을 수 있게 래핑/행 높이 확장. 667×300에서 관리 도구와 목록 최소 한 행이 화면 안에 남아야 함.
7. 기존 `apps/web/scripts/ui-800x360/preview.tsx`는 제품 props 이동에 따라 지명/설정/순위 행을 잃는다. 이 파일의 최소 wiring 수정은 이번 재작업에서 허용: MenuPanel 옛 callbacks→RideRoutePanel로 옮기고 순위 callback도 제공. 제품 JSX/CSS 복제 금지.

변경 함수·데이터 계약 확대/외부 쓰기/커밋/푸시/배포 금지. `functions/`, dep-layers, 기준선 수정 금지. 같은 디렉터리에서 GLM과 Supervisor가 별도 파일 작업 중이며 그 변경을 되돌리지 않는다. 중간 캡처 evidence/intermediate-routes.png는 문제 증거로만 사용.
