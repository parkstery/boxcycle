# 20261006-rider-missing

| 항목 | 내용 |
|---|---|
| 목적 | 주행 중 3D 라이더 모델이 보이지 않는 회귀 원인 규명·수정 |
| 상태 | **CLOSED** — Chief 확인(서버 재실행 후 정상) |
| 근거 | Chief 캡처 2026-10-06 16:29 — 카메라 6, 야외, 주행 중(53%), 파란 위치 점·닉네임은 보이나 라이더 GLB 없음 |
| 지시 | [14](02-task-14.md) |

## 종료 (2026-10-06)
- Chief 확인: 개발 서버가 멈췄던 탓으로 보이며, 서버 재실행 후 라이더가 보인다 → 지시 14 **중단(CLOSED)**.
- 중단 시점 Developer 의 미검증 가설·작업분: 「`setStyle` 의 style diff 가 Three custom layer 를 좀비(onAdd 상태 없음)로 남겨 스타일 전환 뒤 GLB 가 복구되지 않는다 → `setStyle(..., { diff: false })` + 재설치」. 검증 전이라 작업 트리에서 되돌렸고 diff 만 [unverified-wip-14.diff](unverified-wip-14.diff) 로 보존. **카메라 1번 진입/이탈(위성↔야외) 뒤 라이더가 사라지면 이 가설부터 확인.**
