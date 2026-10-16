# 감리 T1 — 코너 부드러운 회전 + 안쪽 기울기

| 항목 | 내용 |
|---|---|
| 감리 | 2026-10-16 · Supervisor (Claude) |
| 대상 | [03-result-t1.md](03-result-t1.md) (Cursor) |
| 판정 | **APPROVED (브랜치 커밋)** — 병합·배포는 Chief 육안 후 |

## 확인

- 코드: `riderTurn.ts`(chord ±5 m 목표 → τ 0.15 s 각도 추종, `atan(v·ω/g)` 기울기 상한 20°·τ 0.25 s, id 별 상태·prune). MapView 에서 본인(경로 거리 있으면 chord, 없으면 기존 GPS 방위)·동행·페이서 모두 smoother 통과, 기존 본인 기울기 식(×0.22, ±10°) 교체. 궤적·카메라·리그·흔들림·LOD 무변경. `peerMotion → rider` 의존 금지를 지키려 상수를 MapView 가 옵션으로 넘김 — 적절.
- **기울기 부호 검산(Supervisor)**: 레이어 변환 `T·S(m,−m,m)·Rx(π/2)·Ry(yaw)·Rx(lean)` 에서 동쪽을 볼 때 모델 +z → 메르카토르 +y(남) = 라이더 오른쪽. 양수 lean 은 머리를 +z 로 → 시계방향(우회전) ω > 0 → 오른쪽 = **안쪽**. 맞음.
- 재실행: tsc 0, `rider-turn` 4/4, `test:pacer` 14/14, `test:rider-preserve` 37 + 6. `test:quick` 의 route 3 실패는 이 worktree 에 `functions/lib`(빌드 산출물)이 없어서 — 본 작업트리 pre-push 에서는 통과하는 시험(환경 차이).
- 페이서 방향 시험 입력을 5 m 로 바꾼 것은 단언(0.05 m 당 < 3°) 유지 → 완화 아님.
- 순수 재생(파리 퐁뇌프 +80°, 20 km/h): 프레임당 최대 0.94°, 기울기 피크 +19.97°(코너 정점), 코너 ±15 m 밖 ≈ 0.
- 캡처는 12 MB 라 `apps/web/scripts/rider-preserve/.out/turn/capture/`(git 제외)로 이동. 0.2 s 정지 컷이라 기울기 피크 구간이 거의 안 잡혀 육안 판정은 Chief 의 실제 주행으로 한다.

## Chief 확인 포인트

파리 퐁뇌프 입문 코스(140 m 지점 우회전 80°)·암스테르담 폰델파크(749 m, 98°): 라이더가 1–2 초에 걸쳐 돌고, 코너 안쪽으로 최대 20° 기울었다 돌아오는지. 기울기가 과하면 상한 `RIDER_LEAN_MAX_DEG` 한 곳.
