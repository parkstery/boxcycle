# 지시 W1 — 흔들림 구현 + 시험

| 항목 | 내용 |
|---|---|
| 발행 | 2026-10-16 · Supervisor (Claude) |
| 대상 | Developer — Cursor Agent CLI |
| 계획 | [01-plan.md](01-plan.md) §0·§1·§2 — **먼저 전부 읽을 것** |
| 작업 위치 | `C:\20.HDev\boxcycle-sway` (브랜치 `feat/rider14-sway`). `C:\20.HDev\boxcycle` 본 작업트리는 읽기만 |
| 결과 파일 | `C:\20.HDev\boxcycle-sway\document\ops\20261016-rider14-sway\03-result-w1.md` |

## 참고 원본 (읽기 전용)

`C:\Users\kdrea\OneDrive\Documents\img\helmet_fix\revision\20260919-natural_joint_skin\20261015_01-s6-poly-drawcall-reduction\tools\viewer.html` 의 `installSway`·`swayUniforms`·`updateSway`(205–245행 부근)와 `tools\lib\sway.mjs`. **수식과 셰이더 문자열은 이것을 그대로 옮긴다.** 뷰어의 UI 의존(`document.getElementById`)만 파라미터로 바꾼다.

## 만들 것

1. `apps/web/src/lib/riderPrototype/riderSway.ts` (신규) — 계획 §2.1. `RIDER_SWAY_DEFAULTS`, `computeRiderSway(phaseRev, crankPhaseR, envelope, params?)`. 그리고 envelope 를 관리하는 작은 클래스:
   ```ts
   export class RiderSwayEnvelope {
     update(id: string, phaseRev: number, nowMs: number, enabled: boolean): number; // 0–1
     prune(liveIds: ReadonlySet<string>): void;
   }
   ```
   규칙: 최근 300 ms 안에 `phaseRev` 가 바뀌었으면 목표 1, 아니면 0. `enabled=false`(줌 < 19, `?sway=0`)면 목표 0. 시상수 400 ms 지수 추종. 처음 보는 id 는 0 에서 시작.
2. `riderModelProfile.ts`: 인터페이스에 `readonly supportsSway: boolean` — rider14 `true`, s5 `false`.
3. `preservedRiderRig.ts`:
   - `supportsSway` 이면 생성자에서 공용 머티리얼(들)에 `onBeforeCompile` 주입(뷰어와 같은 3곳, 속성명 `_sway`, 균일 변수 `uSwayRoll`·`uSwayBob`·`uSwayPivot`), `customProgramCacheKey = () => "rider-sway-v1"`, `needsUpdate = true`. 균일 변수 객체는 리그 필드.
   - `setSway(v: { shaderRollRad: number; bobM: number }): void` — 균일 변수 값만 바꾼다. `supportsSway` 가 false 면 아무것도 안 한다.
   - `get crankPhaseR(): number` — 기존 private `crankPhase.R` 읽기 전용 노출(계산 변경 없음).
   - `get supportsSway(): boolean`.
   - **리그 수학·기존 메서드 동작 불변.**
4. `map/riderPreservedLayer.ts` 그리기 루프 (계획 §2.4):
   - 레이어에 `RiderSwayEnvelope` 1개. 루프 전에 `const nowMs = performance.now()`, `enabled = animatePose && !swayDisabledByQuery`.
   - 라이더마다: 기존 `setPhase`·`setVisualKind` 뒤에 `envelope.update(spec.id, phase, nowMs, enabled)` → `computeRiderSway(phase, rig.crankPhaseR, env)` → `rig.setSway(...)`. 모델 행렬의 lean 을 `lean + sway.bikeRollRad` 로(리그가 `supportsSway` 일 때만).
   - 루프 뒤 `envelope.prune(현재 spec id 집합)`.
   - 기존 계약 시험이 찾는 문자열(`for (const spec of this.specs)`, `rig.setPhase(spec.phaseRev ?? 0)`, `rig.setVisualKind(spec.kind ?? "self")`, `queryTerrainElevation`, `90 - spec.bearingDeg`, `spec.leanDeg`)은 그대로 남긴다.
   - envelope 이 0 보다 큰 동안에는 `map.triggerRepaint()` 가 계속 불리는지 확인한다(멈춘 뒤 0 으로 수렴하는 애니메이션이 끊기지 않도록). 이미 다른 경로로 매 프레임 그린다면 그 사실을 결과에 적고 추가하지 않는다.
5. `config.ts`: `isRiderSwayDisabledByQuery()` — **DEV 에서만** `?sway=0` 이면 true, 운영은 항상 false(`import.meta.env.DEV` 분기).

## 시험 (`apps/web/scripts/rider-preserve/rider-sway.test.ts` 신규, `test:rider-preserve` 에 추가)

1. `computeRiderSway` — 위상 0, 45, …, 315° 에서 뷰어 수식(시험 안에 뷰어 식을 독립적으로 한 번 더 써서 비교)과 1e-12 이내. envelope 0 이면 세 값 모두 0. 기본값에서 `|bikeRoll|` 최대 = 0.4°, `|shaderRoll|` 최대 = 0.9°(0.5 + 0.4), bob 최소 = −2 mm, 최대 0.
2. `RiderSwayEnvelope` — 위상이 계속 바뀌면 1 로 수렴(2 s 후 > 0.99), 멈추면 0 으로(2 s 후 < 0.01), `enabled=false` 면 0 으로, 새 id 는 0 에서 시작, `prune` 후 상태 삭제.
3. 리그 — rider14 리그에 `setSway({0,0})` 상태에서 다리 정점·강체 행렬이 흔들림 도입 전과 같다(기존 `rider14-equivalence.test.ts` 가 계속 통과하면 충족 — 그 시험은 수정하지 않는다). s5 리그는 `supportsSway=false`, 머티리얼 `onBeforeCompile` 미설치. rider14 리그 머티리얼의 `customProgramCacheKey()` = `"rider-sway-v1"`, 그리고 `onBeforeCompile` 에 가짜 shader 객체(`{ uniforms:{}, vertexShader: "#include <common>\n#include <beginnormal_vertex>\n#include <begin_vertex>" }`)를 넣으면 세 주입이 모두 들어가고 균일 변수 3개가 등록된다.
4. `_sway` 속성 — 시험 로더로 연 rider14 장면의 `static__Palette` 에 `_sway` 가 있고(10,792), 다른 메시에는 없다. 리그 bake 후에도 유지된다.

## 검증 (PowerShell, `apps/web`)

`npx tsc --noEmit -p tsconfig.app.json` · 변경 파일 `npx eslint …` · `npm run test:rider-preserve` · `npm run build` 후 `dist/assets/*.js` 에서 `sway=0` 쿼리 처리 문자열(`"sway"` 를 읽는 URLSearchParams 코드)이 제거됐는지 검색해 기록(셰이더 문자열 `uSwayRoll` 등은 남는 것이 정상).

브라우저 확인은 이번 단계에서 **하지 않는다**(W2 에서). 다만 dev 서버를 띄워야 하면 포트 **5050**, 끝나면 반드시 종료.

## 결과 파일 `03-result-w1.md`

변경 파일·줄 수, 각 명령 exit code·요약, 시험 개수, 운영 빌드 검색 결과, 구현 중 판단한 것(특히 triggerRepaint), 남은 문제.

## 금지

리그 수학 변경, 흔들림 확정값 변경, 기존 시험 완화, rider 작업 폴더 쓰기, commit · push · 배포 · `npm install`, 백그라운드 잔류.
