# UI 이전 수정 우선 릴리스

| 항목 | 내용 |
|---|---|
| 문서 유형 | execution — 릴리스 |
| 최초 작성 | 2026-10-20 |
| 상태 | 코드 반영 중 — Chief 커밋·푸시·병합·배포 승인 |
| 독자 | chief · AI |
| 연결 문서 | [미니맵 검수](../20261020-minimap-dock-swap/04-review-03.md) · [lint 검수](../20261018-lint16/04-review-01.md) · [신규 도로 릴리스](../20261020-new-road-display/02-task-02-release.md) |

800×360 UI 개선 전의 src baseline을 분리한 체크아웃으로 검증한다. 범위: 위 RouteDock/아래 미니맵·좌상단24px캐럿, SPINATLAS 표기, AGENTS/CLAUDE 브랜드 설명, 기존 시험4파일 lint 정리. 기존 main2 원격 미반영 프로필·메뉴·신규 도로 커밋도 함께 릴리스한다. 800×360 새 UI와 제스처는 포함하지 않는다.

Git: fix/pre-ui-release-20261020 → main2. main은 최종 안정선으로 유지. 배포 boxcycle-dc2df Hosting 및 앞서 승인된 신규 도로 Rules/Functions 4종만. 운영 삭제 수동 실행 없음.

분리 실행 위치: C:\20.HDev\boxcycle\.out\pre-ui-release-20261020. 원래 작업 폴더 C:\20.HDev\boxcycle의 UI 수정은 보존한다.
