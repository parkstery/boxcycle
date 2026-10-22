# 거리·방향 단계별 유도 결과

2026-10-22 · record · Codex 직접 구현. [지시23](02-task-23.md).

- 거리 칩1/3/5/10/20, 숫자 Enter/change, ± 확정 후 기존 원/화살표4레이어 paint를1.4초 동안2회 펄스. 새 좌표·source·카메라 애니메이션·서버 요청 없음. 새 helper는 원 전용이며 수단 버튼 애니메이션은 기존 CSS 그대로 재사용.
- 기본 거리만 표시된 상태에는 수단 버튼을 숨긴다. 유효 거리 확정 뒤 지도 클릭은 방향을 보관하고 기존 profile 행을 표시, 자동차→자전거→도보 순서2사이클 CSS 적용. 수단 클릭 시 기존 arm/탐색 실행. 선택 profile은 기존 hook의 동기 ref에서 읽어 React 커밋 전 기본 cycling으로 요청하는 경합 방지.
- 거리 재편집/확정 및 거리 탭 이탈은 방향을 초기화하고 버튼을 숨김. Enter 후 blur는 같은 펄스를 다시 실행하지 않음. 방향 선택/탭 이탈/팝업 abort/맵 unmount는 원 펄스 중단·기본 paint 복원. 탐색 중 버튼 비활성 및 클릭 중복 차단.
- 기존 수동 경로의 profile 행·순차 강조 재사용. 기존 reduced-motion 규칙이 nth-of-type보다 specificity가 낮아 무시되던 결함 수정. 원 펄스도 reduced-motion에서는 실행하지 않음.

시험: 거리144 PASS, 브라우저13종 분할 재검증 PASS, 타입/lint/build/diff PASS. 실제폰/실 API 탐색은 미검증. 검수23에 명령·초기 실패와 교정·증거 기록. 기존21/22 dirty와 공용 문서/evidence/서버 보존, 커밋·푸시·배포 없음.
