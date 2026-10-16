# 결과 P3 — 앱 리그 동등성 시험 (s5 ↔ rider14, 8위상)

| 항목 | 내용 |
|---|---|
| 지시 | [02-task-p3.md](02-task-p3.md) |
| 작업자 | §0 보정 = **Developer (Muse Spark)** · 동등성 시험 본체 = **Supervisor (Claude) 대행** |
| 대행 사유 | Muse Spark 무료 모델 사용량 한도(`Rate limit exceeded`) — 22:35 1차 중단, 5분 뒤 재개도 즉시 같은 오류. 공정 지연을 막으려고 Supervisor 가 작성. 감리 독립성이 약해지는 점은 아래 판정 근거(수치·음성 대조)로 보완 |
| 작업 위치 | `C:\20.HDev\boxcycle-rider14` |

## §0 P2b 보정 (Muse)

- `riderPaletteKit.ts` `dispose()` 첫 줄에 `this.material.map = this.originalMap;` — 키트 해제 전 원본 map 복귀.
- `rider-palette-kit.test.ts` 에 해제 시험 추가(pacer 적용 → rig dispose → 원본 map·키트 텍스처 각 dispose 1회). Muse 가 보정 전 코드로 되돌려 **시험이 실패(0 !== 1)함을 역검증** 후 복원.

## 동등성 시험 `scripts/rider-preserve/rider14-equivalence.test.ts`

- 앱 코드 그대로(`PreservedRiderRig` + `getRiderModelProfile`)로 두 후보를 열어 8위상(0°, 45° … 315°) 비교.
- 다리 6쌍은 같은 인덱스 비교(정점 순서 동일, 사전 실측), 강체 7그룹은 `preserved-<group>` 변환 행렬 비교.
- `test:rider-preserve` 스크립트에 포함(실행 1.7 s).

| 위상 | 다리 위치 최대 차 | 법선 최대 각 | 법선 중앙값(메시별 최대) | 강체 행렬 최대 차 |
|---:|---:|---:|---:|---:|
| 0° | 7.948e-6 m | 1.1118° | 0.3623° | **0** |
| 45° | 7.952e-6 m | 1.1118° | 0.3623° | **0** |
| 90° | 7.925e-6 m | 1.1118° | 0.3623° | **0** |
| 135° | 7.967e-6 m | 1.1118° | 0.3623° | **0** |
| 180° | 7.921e-6 m | 1.1118° | 0.3623° | **0** |
| 225° | 7.953e-6 m | 1.1118° | 0.3623° | **0** |
| 270° | 7.939e-6 m | 1.1118° | 0.3623° | **0** |
| 315° | 7.951e-6 m | 1.1118° | 0.3623° | **0** |

원시값: `apps/web/scripts/rider-preserve/.out/rider14/p3/equivalence.json`

위상 무관 단언(통과): 가이드 가중치 두 후보 바이트 동일, 두 리그 가이드 미매칭 0(생성자 무예외), `pedalBind`·`crankPhase`·`crankRadius` 차 ≤ 1e-5, rider14 좌우 위상차 = π(1e-9), 강체 7그룹 노드에 `<그룹>__` 메시 1개씩, `rig.object` 직속 = 다리 6 + `static__Palette`.

**음성 대조(통과)**: rider14 리그의 `pedalBind.R[0]` 을 +1 mm 옮긴 리그는 90° 위상에서 강체 행렬 또는 다리 위치 기준을 넘어 **실패로 잡힌다**.

### 법선 기준 조정 (지시서 0.5° → 최대 1.5° · 중앙값 0.5°)

첫 실행에서 법선 최대 1.11° 로 지시서 기준 0.5° 를 넘었다. 원인 조사:
- 값이 8위상 모두 같다 → 리그가 아니라 **저장된 휴지 법선** 차이.
- 메시별 분포(리그 bake 후 월드): 중앙값 0.27–0.36°, p95 0.55–0.71°, 최대 0.64–1.11°, 6메시 모두 비슷한 모양.
- rider14 meshopt 본은 법선을 **정규화 Int8** 로 저장(눈금 1/127 ≈ 0.45°/성분). 무압축 LOD0 은 rider 작업 폴더 `rigcheck` 에서 차 0.
→ 압축 양자화 오차이며 셰이딩으로 구분 불가한 크기. 0.5° 는 Int8 저장을 고려하지 않은 Supervisor 기준 설정 오류로 판단해 **최대 1.5°**(양자화 상한 여유) + **중앙값 0.5°**(엉뚱한 법선 혼입은 중앙값을 끌어올림)로 바꿨다.

## 검증 명령 (PowerShell, `apps/web`)

| 명령 | exit | 요약 |
|---|---:|---|
| `npm run test:rider-preserve` | 0 | TS 25/25 + 계약 5/5 |
| `npx tsc --noEmit -p tsconfig.app.json` | 0 | |
| `npx eslint scripts/rider-preserve src/lib/riderPrototype src/lib/map/riderPreservedLayer.ts` | 0 | |

## 변경 파일 (P3 분)

- `apps/web/src/lib/riderPrototype/riderPaletteKit.ts` (§0, 1줄)
- `apps/web/scripts/rider-preserve/rider-palette-kit.test.ts` (§0 시험)
- `apps/web/scripts/rider-preserve/rider14-equivalence.test.ts` (신규)
- `apps/web/package.json` (`test:rider-preserve` 에 동등성 시험 추가)
