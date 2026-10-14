# 최종감리37 — 위치/거리 별도 화면 전환 승인

2026-10-14 Supervisor Codex, Developer OpenCode Muse Spark1.3, 검증계약36 Codex. **APPROVED / AWAITING_CHIEF**. Chief34컨셉승인에따른구현34+국소마감35/37 완료. 이전33/두토글디자인은Chief미채택,기술검수기록만보존. face-redesign2/5013유지, commit/push/merge/deploy 없음.

## 구현 결과

- 위치화면: 공통제목/삭제, 주소/고도, Start/WP/End한행, 그아래 이동수단3개+거리›. 거리입력·프리셋숨김.
- 거리화면: ‹위치선택복귀+목표거리제목, 출발설정됨·현재수단요약, 미세조정한행·프리셋한행·ETA·상태. 위치핀버튼/수단버튼행/주소/좌표/중간두토글/보이는checkbox없음. 같은패널내용을단일view로교체,양쪽동시노출불가.
- 거리진입/복귀는기존mode/arm·disarm경로를통해방향대기준비/원정리. 전환만으로핀·수단·거리·생성경로임의초기화없음. 방향지도클릭이실제탐색trigger라는기존계약유지.
- 공통삭제는제목영역에서두모드모두접근가능. 삭제pointerdown만stopPropagation하여dragHandle capture와충돌제거,preventDefault없음. 다른위치의제목drag와키보드삭제보존.
- 새진입/복귀button44px을기존profile/거리header행안에결합. 흰/파랑색·주소/기존버튼/글자크기유지. 이전32ResizeObserver/33높이상한유지.

## 검증과 증거

| 명령 | 결과 | 검증 범위 |
|---|---|---|
| `node document/ops/20261013-face-redesign2/pick-37-qa.cjs` | exit0 PASS, 32상태 | [결과](pick-37-shots/results.json), 667/740/844/1366, 위치/거리분리·중간toolbar없음·44px·키보드복귀/삭제·거리값보존·토큰부족시arm없음·검색/실패/발견·재개·Start전후·가로overflow0·pageerror0 |
| `node document/ops/20261013-face-redesign2/pick-37-live.cjs` | exit0 PASS, 15상태 | [결과](pick-37-live/results.json), 실제Guest 667×300/740×300/844×390 위치→거리→복귀→거리값유지→drag, 삭제실제click/close, canvas경계내·가로/내부스크롤0·pageerror0 |
| `npm run test:distance-auto-route` | exit0 PASS, 141/141 | [결과36](03-result-36.md), 기존8파일 회귀·갱신한공통삭제계약 |
| `npx tsc -b --pretty false` / `npx eslint src/components/map/mapPopupElements.ts` | 각각 exit0 PASS | 최종37pointer이벤트보정포함 |
| 변경테스트lint / e2e spec `--list` | exit0 PASS | 36기록. 전체e2e실행아님 |
| `git diff --check` | exit0 PASS | 실제작업worktree |

실제740×300 dock 높이: 위치132.53px / 거리180.28px(이전33 실제위치161.05/거리222.27). 위치/거리 모두184.25px폭, 내용잘림/스크롤0. [위치 캡처](pick-37-live/740-position.png), [거리 캡처](pick-37-live/740-distance.png)에서모드별표시·제목전체표시확인. mock긴주소의위치폭219.84px은실제주소보다넓지만가로overflow0. 전환검수중 Mapbox Directions 요청0.

실패/재작업이력: 34QA는44px CSS우선순위FAIL→35보정; 35live삭제click은drag captureFAIL→37보정. 최종37QA 첫병렬실행은페이지domcontentloaded12초timeout(exit1), 다른검증종료후단일headless브라우저·navigation최대30초로재실행하여32상태PASS. 실패를삭제하거나첫실행PASS로기재하지않음.

## 범위와 한계

이번앱변경34/35/37은mapPopupElements.ts와MapView.css의pick영역. 앞선32MapView.tsx observer유지. Supervisor36테스트2파일정렬. 다른메뉴/계정/목록dirty보존. 결과35는Developer가worktree쪽에작성하여Supervisor가공식ops로복사(내용변경없음),결과37은지정절대경로직접작성.

PC의모바일viewport검증이며실제스마트폰/Bluetooth·주행·방향클릭후원격경로생성·토큰실제차감·전체ride-summary-e2e는미실행. Chief사용확인·디자인채택은대기. 앱/공식ops미커밋,배포완료아님. 확인 http://127.0.0.1:5013/ 지도클릭→Start→거리›→‹위치선택.
