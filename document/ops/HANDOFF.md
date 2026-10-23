# HANDOFF — 지금 상태 한 장

> 수퍼바이저는 교대된다(Claude Code ↔ Codex, 토큰 한도에 따라). **시작하면 이 파일부터 읽고, 작업 단위가 끝날 때마다·끊기기 전에 이 파일을 고친다.** 규칙: [수퍼바이저 교대 플레이북](../reference/operations/261023-RTW-수퍼바이저-교대-플레이북.md)

| 항목 | 값 |
|---|---|
| 담당 | Claude Code |
| 갱신 | 2026-10-23 |
| 브랜치 | `main2` |
| 마지막 커밋 | `9c77089f` 수퍼바이저 교대 체계 |
| 마지막 배포 | 2026-10-23 함수(`getLeaderboard` 상위 20) + 화면(순위 칩·순위판·결과 순위 줄·맵 뷰 정리·km 소문자) |

## 지금 하던 일

**전체 화면 디자인 변경** — [ops/20261023-ui-redesign/README.md](20261023-ui-redesign/README.md)
- chief 가 시안 16장을 승인했다. 3장은 배포됐고 2장은 일부만 배포됐다. 나머지는 6개 묶음으로 진행한다.

## 다음 한 걸음

1. **묶음 1(MENU + 경로 목록) 지시서**를 `document/ops/20261023-ui-redesign/01-task-batch1.md`로 쓴다.
   - 시안: `mockups/06-Menu.*`, `mockups/07-RouteList.*`
   - 대상 코드: `apps/web/src/components/MenuPanel.tsx`·`.css`, `apps/web/src/components/ride/OfficialCourseListModal.tsx`·`RouteListModalShell.tsx`·`SavedRoutesPanel.tsx`
   - 「Trail 메뉴」·경로 모달을 찾는 e2e(`ui-800x360.spec.ts:259` 등)와 진입 셀렉터 계약(`apps/web/scripts/ride-verify/entry-contract.mjs`)을 깨지 않게 할 것.
2. Cursor 로 구현을 맡긴다(플레이북 §3 명령).
3. 감리(§4) → chief 에게 시안·캡처 비교 보고 → 승인 → 커밋·푸시.

## chief 결정 대기

- `LocalFirstEntryCard`(「어디에서 첫 라이딩을 할까요?」) 삭제 여부. 권장: 삭제.
- `RideHistoryPanel` 연결(계정 패널 「마지막 주행 ›」) 또는 삭제.
- 묶음 순서는 위 계획대로 진행 중(이의 없으면 유지).

## 진행 중인 하위 작업

- 없음.

## 작업 트리 (커밋 안 된 것)

- `document/ops/20261017-entry-location/evidence/15-entry-flight-metrics.json`: 세션 시작 전부터 수정돼 있던 증거 파일이다. 손대지 않는다.
- `.out/`, `cdbox.bat`: 비추적이다. 손대지 않는다.

## 최근 주의

- 실행자(Cursor)가 PC 메모리 부족으로 강제 종료된 적이 있다(2026-10-23). 끊긴 뒤에는 `git status`와 결과 파일을 보고 남은 검증만 하면 된다.
- 리더보드 순위는 서버가 5분 동안 저장해 두고 보여 준다. 주행 직후 지도 칩이 몇 분 늦게 바뀌는 것은 정상이다.
