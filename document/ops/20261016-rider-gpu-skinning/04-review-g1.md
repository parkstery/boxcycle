# 감리 G1 — 다리 DQS 정점 셰이더

| 항목 | 내용 |
|---|---|
| 감리 | 2026-10-17 · Supervisor (Claude) |
| 대상 | [03-result-g1.md](03-result-g1.md) (Developer — OpenCode Muse Spark, 한도 걸림 없음) |
| 판정 | **APPROVED** — 기본 cpu 유지 상태로 병합·배포, 실기기 cpu/gpu 비교 후 G2(기본 gpu) 결정 |

## 확인한 것

- 수식: `skinVertexDQ`·GLSL 이 기존 `updateSkin` 루프와 항 단위로 같음(위치 `v + 2(q×c) + 2(w·e − e_w·q + q×e)`, 법선 회전·정규화). 부호 반전은 `poseDualQuaternions` 로 분리해 CPU·GPU 가 같은 값을 씀. 리그 수학 무변경.
- 동등성: 8위상 전 정점 위치 ≤ 6e-8 m, 화면 4위상 픽셀 차 0. 법선 metric(저장 길이 오차) 보정 판단 타당.
- 셰이더 주입 순서 스킨 → 흔들림, 흔들림 문자열 바이트 동일, 캐시 키 `rider-sway-v1:skin-gpu` 분리.
- 폴백: `onShaderError` 에서 `uSkinDQ` 셰이더만 cpu 로 내림, 이전 콜백 보존. GPU 조건(정점 유니폼 ≥ 128, highp ≥ 23 bit) 미달 시 cpu.
- 여러 라이더: 레이어가 라이더마다 `setPhase → render` 하므로 같은 유니폼 객체 값 갱신으로 충분. 복제 머티리얼은 리그 `dispose` 순회로 정리. 다리 메시 `frustumCulled=false` 라 휴지 경계 구 문제 없음.
- Supervisor 재실행: `tsc -b` 0, `test:rider-preserve` EXIT 0.

## 남은 제약(이번 범위 밖)

- 실행 중 **cpu → gpu 전환**(`setSkinMode("gpu")` 를 생성 뒤 처음 부를 때)은 새 복제 머티리얼에 흔들림 주입·컬러 키트가 붙지 않는다. 앱은 생성 시 모드 결정 + gpu → cpu 폴백만 쓰므로 영향 없음. G2 에서 기본을 gpu 로 바꿀 때도 생성 시 결정이라 무관.
- GPU 정점 셰이더는 `w < 1e-6` 가중치를 건너뛰지 않는다(CPU 는 건너뜀) — 차이는 1e-6 배 이하, 화면 차 0 으로 확인.

## 다음

병합·배포 → 실기기(PC GTX 1660 headed 스크립트, 폰 perflab)에서 `?skin=cpu` vs `?skin=gpu` 의 `msPerRider`·fps 비교 → Chief 확인 후 G2.
