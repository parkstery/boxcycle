# 지시 17 — 경로 목록 한 줄 행 + 이동수단 아이콘

2026-10-23 Chief 지시 · 발주 Claude Code(Supervisor) · 구현 **Cursor CLI** · 결과 파일 `18-result-route-list-one-line.md`

> Chief 원문: 「입문, 퍼블릭, 내 경로에서 경로를 표시할 때 경로당 1줄로 표시해(지금은 2줄로 표시하고 있다). '자동차', '자전거', '도보'는 텍스트로 하지 말고 경로 탐색 시 3가지 방법에 사용한 것과 같은 이미지를 사용해. 되도록 많은 경로가 목록에 보이도록 하라.」

선행: [15 흰 박스 지시](15-task-route-list-surface.md)·[16 결과](16-result-route-list-surface.md). 흰 불투명 판은 그대로 유지한다.

## 지금 상태 (파일)

- 입문·퍼블릭 행: `apps/web/src/components/ride/OfficialCourseListModal.tsx` `PublicCoursePickRow` — 1줄 `oc-modal__item-name` + 2줄 `oc-modal__item-subline`(「자동차 · 작성자」). 라벨 함수 `lib/route/publicationDisplay.ts` `publicationProfileLabelKo`.
- 내 경로 행: `apps/web/src/components/ride/SavedRoutesPanel.tsx` — 2줄에 `PROFILE_LABEL[profile] · 날짜 · 만료 · 심사 · 이어달리기` 문구. 같은 파일에 자체 `RouteProfileIcon`(경로 팝업과 **다른** 그림)이 있다.
- 경로 탐색 팝업의 3가지 이동수단 아이콘: `apps/web/src/components/map/mapPopupElements.ts:37` `PICK_POPUP_PROFILE_ICON_SVG` (Lucide `car-front`·`bike`·`footprints`, stroke 1.75). **이 그림이 기준이다.**
- 스타일: `OfficialCourseListModal.css`(map 레이아웃 `oc-modal__item--map-row`), `SavedRoutesPanel.css`.

## 할 일

1. **아이콘 원본 하나로.** 팝업의 세 SVG를 React·DOM 양쪽이 쓰는 한 곳으로 옮긴다(예: `lib/route/routeProfileIcons.ts`에 path 데이터, 팝업은 거기서 문자열 생성, React는 작은 `RouteProfileIcon` 컴포넌트). 팝업 모양·클래스(`map-view__pick-profile-ico`)·동작은 바꾸지 않는다. `SavedRoutesPanel`의 옛 자체 아이콘은 지우고 새 공용 아이콘을 쓴다. 새 파일을 만들면 `apps/web/dep-layers.json`에 도메인을 등재하되 허용 규칙·기준선은 넓히지 않는다(`node scripts/check-dep-direction.mjs --check` 통과).
2. **행 = 한 줄.** 세 목록 모두 `[아이콘 16~18px] [경로 이름 — 남는 폭 전부, 말줄임] [상태(있을 때만, 짧게)] [거리 km]`.
   - 「자동차/자전거/도보·보행」 글자를 행에 쓰지 않는다. 아이콘에 `aria-label`/`title`로 한국어 이름(자동차·자전거·도보)을 단다.
   - 2줄에 있던 작성자·날짜·만료·심사 문구는 행에서 뺀다. 버리지 말고 행 버튼의 `title`(마우스 올림)과 접근성 설명(`aria-describedby` 또는 숨김 텍스트)에 남긴다.
   - 내 경로의 상태 칸(완주함·43% 달림·심사 중 등)과 입문·퍼블릭의 활동 배지는 기존처럼 오른쪽 상태 칸에 남긴다. 이어 달리기·선택·이름 바꾸기·삭제·공개 동작은 그대로.
   - 행 높이는 36px 안팎(최소 32px, 터치 가능). 위아래 여백을 줄여 **같은 판 높이에 지금의 약 2배 행**이 보이게 한다. 글자 크기는 줄이지 않는다(이름 15px 안팎 유지).
   - 이름은 한 줄 `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`. 거리 숫자는 오른쪽 정렬·줄바꿈 금지.
3. 단위는 소문자 `km`. 강조색 `#2457d6` 하나. 흰 판·어두운 글자(15번) 유지.

## 금지

- 데이터·Firestore·함수·인증·주행·지도 로직 변경 금지. 이번 작업은 표시만.
- `git worktree`·`restore`·`clean`·`stash`·브랜치 전환·커밋·푸시 금지. 다른 미커밋 변경(묶음 1·2 등)을 되돌리지 말 것.
- `document/ops/20261017-entry-location/evidence/15-entry-flight-metrics.json`, `.out/`, `cdbox.bat`, `firebase.route-list-qa.json` 손대지 말 것.
- 포트 3000·5000·5021 서버를 끄지 말 것. 운영 Firebase에 시험 데이터 쓰기 금지.
- 시험 조건·기준선을 느슨하게 해서 통과시키지 말 것. 셀렉터가 2줄 부제(`oc-modal__item-subline` 등)를 찾던 시험은 같은 의미(아이콘 접근성 이름·title)로 겨누게 고친다.

## 검증 (실행 폴더 `C:\20.HDev\boxcycle\apps\web`, 순서대로, 1 worker)

1. `npx tsc -b --noEmit`
2. 변경 파일 eslint (오류 0)
3. `npm run test:quick`
4. `node scripts/ride-verify/verify-selectors.mjs`
5. 화면 시험(프리뷰 5020이 이미 떠 있으면 재사용): PowerShell `$env:RTW_DEV_PORT='5020'; npx playwright test ui-800x360 ui-redesign-batch1.spec.ts --workers=1 --retries=0` — 결과를 `document/ops/20261023-ui-redesign/evidence/route-list-one-line/ui.log`로.
   - `ui-redesign-batch1.spec.ts`에 단언 추가: 각 행 높이 ≤ 40px, 이름이 한 줄(행 안 텍스트 줄 수 1), 행 안에 「자동차·자전거·도보·보행」 글자 없음, 아이콘 svg 존재 + 접근성 이름.
   - 캡처는 `evidence/route-list-one-line/`에 `preview-{intro,public,saved}-{667x300,800x360,844x390}.png`.
6. 루트 `C:\20.HDev\boxcycle`: `node scripts/check-code-tidy.mjs`, `node scripts/check-dep-direction.mjs --check`, `git diff --check`.

실앱 에뮬레이터 캡처는 Supervisor가 따로 돌린다(실행자는 하지 않음).

## 결과 파일 `18-result-route-list-one-line.md`

바꾼 파일 목록, 각 검증 명령의 통과·실패 수(실패는 원문 그대로), 캡처 경로, 하지 못한 것과 이유. 사실만.
