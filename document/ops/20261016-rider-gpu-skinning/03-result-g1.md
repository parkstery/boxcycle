# 결과 G1 — 다리 DQS 정점 셰이더 (`?skin=gpu`, 기본 cpu)

| 항목 | 내용 |
|---|---|
| 지시 | `02-task-g1.md` (발행 2026-10-16 · Supervisor Claude) |
| 대상 | Developer — OpenCode Muse Spark |
| 작업 위치 | `C:\20.HDev\boxcycle-gpuskin` (브랜치 `feat/rider-gpu-skinning`, 기준 `main2` `2750734`) |
| 작성 | 2026-10-17 · UTF-8 |
| 결론 | 구현·검증 완료. 기본값 cpu 유지, 리그 수학 무변경, commit·push·배포 없음 |

## 1. 구현 (리그 수학은 손대지 않음)

| 파일 | 변경 |
|---|---|
| `apps/web/src/lib/riderPrototype/riderGpuSkin.ts` (신규) | 순수 JS `skinVertexDQ` + 동일 수식 GLSL 상수 1곳(`RIDER_SKIN_COMMON_GLSL`·`RIDER_SKIN_NORMAL_CHUNK`·`RIDER_SKIN_VERTEX_CHUNK`) + `packSkinDQ`(→ `uSkinDQ[8]`, `[2b]` 실수부·`[2b+1]` 쌍대부) |
| `apps/web/src/lib/riderPrototype/riderSkinMode.ts` (신규) | `?skin=gpu\|cpu` 판독(기본 cpu), GPU 조건 판정(정점 유니폼 ≥ 128·정점 highp ≥ 23 bit, Node 시험은 true), effective 저장소(`note/readEffectiveRiderSkinMode`) |
| `.../riderPrototype/preservedRiderRig.ts` | `updateSkin` 앞부분을 `poseDualQuaternions` 로 분리(CPU 루프·GPU 유니폼이 같은 값 사용). GPU 모드에서만 다리 머티리얼 좌·우 복제 + `skinWeight` 속성 + `uSkinDQ` 갱신, 버퍼는 휴지 그대로. 흔들림 주입은 기존 3곳·기존 문자열 그대로, 스킨 주입을 앞에 더함(스킨→흔들림 순서). 캐시 키 `rider-sway-v1` / `rider-sway-v1:skin-gpu`. `setSkinMode` (전환 시 `needsUpdate` 재컴파일 + cpu→gpu 휴지값 복원). `skinDQForTests`·`legDrawsForTests` 시험 진입점 |
| `.../riderPrototype/riderPaletteKit.ts` | `fromMaterials` (복제 3개도 한 벌 키트 텍스처로 `map` 교체). 1개(CPU) 동작 동일 |
| `.../riderPrototype/riderModelProfile.ts` | rider14 팔레트 1개 또는 3개(다리 복제) 허용. 그 외 개수·GLB 단일 팔레트 전제는 유지 |
| `apps/web/src/lib/map/riderPreservedLayer.ts` | rig 생성 시 `skinMode: readRequestedRiderSkinMode()` 전달. `renderer.debug.onShaderError` 로 스킨 셰이더(`uSkinDQ` 포함) 실패 시 `setSkinMode("cpu")` + repaint. 계약 문자열(`rig.setPhase(spec.phaseRev ?? 0)` 등) 유지 |
| `apps/web/src/components/perfLab/PerfLabPanel.tsx` | 상단에 `스킨 gpu/cpu`, 복사 JSON 에 `skinMode` |
| `apps/web/scripts/rider-preserve/rider-perf-bench.ts` | `window.__rtwBench.skin()` (실제값 증거용, additive) |
| `apps/web/scripts/rider-preserve/rider-gpu-skin.test.ts` (신규, `test:rider-preserve` 편입) | 아래 §2 |
| `apps/web/scripts/rider-preserve/capture-gpu-skin-compare.mjs` (신규) | 아래 §3 (브라우저 1개·단일 페이지 순차) |

- s5·LOD2: gpu 요청에도 cpu·복제 없음·`skinWeight` 없음(시험). 흔들림 0·`sway` 쿼리·컬러 키트 경로 무변경.

## 2. 검증 — 동등성

- **JS 순수 함수 = CPU 경로**: rider14 리그 8위상(0,45,…,315°)·다리 6메시 전 정점 — 위치 최대 약 6e-8 m (기준 ≤ 1e-5), 법선 방향 최대 약 1e-6°대 (기준 ≤ 0.1°). 12/12 통과.
  - 참고: 법선 비교는 저장 법선을 정규화 후 방향만 본다(`rider14-equivalence` 의 `legDelta` 와 같은 방식). float32 저장 길이 오차(≈4e-8)를 그대로 `acos` 에 넣으면 0.016° 로 부풀려져 metric 결함으로 판명 → 방향 비교로 수정. 구현 문제가 아님.
- **기존 시험 무수정 통과**: `rider14-equivalence.test.ts` 포함 `test:rider-preserve` 전체 — strip-types 56/56 + 계약 6/6 (EXIT 0).
- `tsc -b` 0, 변경 파일 eslint 0, `npm run build` EXIT 0 (dist 기록).

## 3. 검증 — GPU 화면 = CPU 화면 (헤드리스 1회, dev 5070, 브라우저 1개, 종료함)

- 조건: `rider-perf-bench.html?animate=0&riders=1&zoom=22&phase=<0|90|180|270>&skin=<cpu|gpu>`, DPR 2, 라이더 크롭 1200×1120 (라이더 프레임 내 확인, 위상별 다리 자세 변화 육안 확인).
- 페이지 실제값: cpu 4장 `cpu`, gpu 4장 `gpu` (`__rtwBench.skin()`).
- 결과 (`scripts/rider-preserve/.out/gpu-skin/`, gitignore): 4위상 전부 **최대 채널 차 0·평균 0·차이 픽셀(>8) 0/1,344,000** — 기준(평균 ≤ 1, 비율 ≤ 0.5 %) 여유 있게 통과. ×8 차이 이미지 4장 전부 검정.

## 4. perflab 경향 (헤드리스 SwiftShader — 경향만)

`?animate=1&riders=3&zoom=22`, 10 s 구간, `__rtwRiderCost.read()`:

| skin | frames | msPerFrame | msPerRider | posePct |
|---|---|---|---|---|
| cpu | 26 | 3.65 | 1.2167 | 75.1 |
| gpu | 27 | 0.7259 | 0.242 | 15.8 |

- 자세 비율이 75 % → 16 % 로 붕괴 = CPU 다리 DQS(정점 루프·재업로드)가 사라진 효과. SwiftShader 저프레임(≈2.6 fps)이라 절댓값이 아닌 경향으로만 해석. 실기기 수치는 perflab(F1) 후속 영역.

## 5. 사전 존재 실패 (내 변경 무관)

- `test:quick`: 165 중 162 통과, 3 실패 = 전부 `functions/lib` 미존재(`harnessActive.js`·`index.js`·`index.harness.js`, worktree 미빌드). 지시서 예상과 일치.
- `node scripts/check-dep-direction.mjs --check`: M0 실패 = `scripts/route-token/... → ../../../../functions/lib/routeTokenCore.js` 깨진 상대경로 1건(같은 worktree 원인, 내 파일 무관). 지시서 지정 항목 **`lib 파일 전원 도메인 지정 PASS(미지정 0)`** 는 통과 — 신규 2파일은 `riderPrototype/` 폴더 규칙 적용.

## 6. 금지 준수

- 리그 수학(IK·DQ·가중치·관절 좌표) 무변경, 기본값 cpu 유지, LOD2·s5 무변경.
- 모든 명령 포그라운드(PowerShell `npm`), 브라우저 1회 1개, dev 5070 서버 시작→캡처→종료 확인(포트 닫힘).
- commit·push·배포 없음. 미커밋 변경: 수정 6 + 신규 4(시험·캡처·리그 2종) + 본 파일.
