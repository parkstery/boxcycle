# 지시 06-4 — Mapbox 컨트롤은 제자리, 카드가 비킨다

- 담당: Developer(Cursor CLI) · 보고: `03-result-06d.md` · 커밋 **금지**
- **금지**: `git worktree`·`git restore`·`git clean`·`git checkout -- <path>`·`git stash`. **`.env*` 파일 생성·수정·복사 금지**(Chief 결정 사항).

## 배경 ([검수 06-3](04-review-06c.md))
06-3 은 짧은 뷰포트 전체에서 Mapbox 우측 컨트롤을 화면 중앙으로 밀었다 — 주행 중에도 적용돼 지도를 가린다. 되돌리고 다른 해법으로.

## 요구
1. `MapView.css` 의 `max-height:560px` **margin-right 예약을 제거**한다. Mapbox +/−/지구/나침반은 **오른쪽 가장자리** 유지(주행 중·대기 모두). 06-3 의 `margin-top`(TR 44px+「맵」 아래) 조정은 유지 가능.
2. 「다음 주행」 카드가 Mapbox 컨트롤 열과 겹치지 않도록 **카드 쪽**을 조정: 짧은 뷰포트에서 카드의 `right` 를 컨트롤 열 폭+간격만큼 띄우거나(카드가 컨트롤 왼쪽), 카드를 컨트롤 열 **아래**로. 화면 하단·RouteDock·미니맵·시계(우하단)와도 겹치지 않을 것.
3. 「거리」 체크박스 실패(`ride-summary-compact.spec.ts` ~158 「들어오면 거리가 켜져 있다」) 판정: 현재 작업 트리에서 이 spec 만 `--grep` 으로 2회 실행해 재현성 확인, 그리고 `git log -L` 또는 blame 으로 관련 코드의 최근 변경 커밋을 찾아 원인 후보를 기록(수정은 하지 말 것 — 범위 밖).
4. 지도 타일이 비어 보이는 문제가 있으면 **고치지 말고** 콘솔의 Mapbox 오류(401 등) 를 결과에 기록.

## 허용 파일
`components/map/MapView.css`, `components/ride/NextRideCard.css`(+ 필요 시 `.tsx` 배치 클래스).

## 완료 조건
1. `cd apps/web && npx tsc -b --noEmit` 0.
2. 「다음 주행 카드 자리」 spec PASS, `npm run test:e2e:menu-a` PASS.
3. 계측: 690·740·1000 대기(카드 있음) + **690 주행 중**에서 Mapbox 컨트롤 x 가 오른쪽 가장자리(≥ 뷰포트폭 − 60)인지, 카드∩컨트롤 = 0.
4. 촬영 `shots-06d/`, `03-result-06d.md`.
