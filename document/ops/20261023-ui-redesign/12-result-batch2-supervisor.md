# 묶음2 Supervisor 보완 기록

2026-10-23 Codex. Cursor 결과09 이후 실제 diff·화면·조작 검수로 아래를 보완했다. Cursor 원결과는 보존한다.

- 센서: ready/setup은 도크, idle/riding/paused는 기존 주행바. 접힌 도크에서도 footer를 남긴다. 도크 내 센서칩의 과거 fixed 배치를 scoped CSS로 해제하고 텍스트를 보여준다.
- 고도: 양 끝값 finite 검증, 두 숫자+화살표를 담는 폭 확보.
- 코칭: fresh tip이 이전 tipId를 유지할 수 있으므로 현재 영문 문구를 우선 매칭해 표시만 번역. 음성·추천 정책 미변경. 회전 회귀시험 추가.
- 프리뷰: 실제 카메라 상태 callback·일시정지 경로변경 callback, 실제 RouteMinimap + MapBottomLeftStack 사용. 예시 지도/수치임을 명시.
- 시험: 지표 검사는 HUD 그룹으로 한정, 도크의 새 DOM 반영, 36px 이전 상한을 승인 시안의 시작44/pause56 기준으로 교체. 센서 단계/접힘 및 canStartRide 연결·이어달리기·스택 계약은 보존.
- selector 정적 앵커는 실제 summary 비교식을 검사하도록 수정(주석으로 통과하지 않음).
- 신규 camera/coach 순수 표시 파일을 dep-layers의 해당 도메인에 등재. 기존 도메인 간 허용규칙 미변경.

검증·판정의 최종 기록은 10-review-batch2.md.
