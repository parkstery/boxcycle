# 지시 G1 — 다리 DQS 스키닝을 정점 셰이더로 (`?skin=gpu` 스위치, 기본은 CPU 유지)

| 항목 | 내용 |
|---|---|
| 발행 | 2026-10-16 · Supervisor (Claude) |
| 대상 | Developer — **OpenCode Muse Spark** |
| 작업 위치 | `C:\20.HDev\boxcycle-gpuskin` (브랜치 `feat/rider-gpu-skinning`, 기준 `main2` `2750734`) |
| 결과 파일 | `C:\20.HDev\boxcycle-gpuskin\document\ops\20261016-rider-gpu-skinning\03-result-g1.md` |
| 참고 | `document/ops/20261015-rider14-replace/`(리그·동등성 시험 P3), `document/ops/20261016-rider14-sway/`(셰이더 주입 방식), `document/ops/20261016-rider-perf/01-plan.md`(F4) |

## 배경

perflab 실측: 가까운 줌에서 라이더 렌더 비용 ≈ 2.3–2.7 ms(3명) 중 **약 75–84 % 가 CPU 다리 DQS**(`PreservedRiderRig.updateSkin` — 다리 6메시 약 4,200 정점을 매 프레임·라이더마다 CPU 로 섞고 `position`/`normal` 을 GPU 로 다시 올림). 정점 셰이더에서 같은 계산을 하면 CPU 몫은 IK(정점 무관)와 듀얼 쿼터니언 8×4 개 계산만 남는다. 정점 셰이더 `highp float` 는 WebGL 필수 사양(perflab 실측 정밀도 23 bit — PC·폰 모두).

## 설계 (리그 수학은 바꾸지 않는다)

1. **같은 수식**: `updateSkin` 의 블렌딩(4 본 DQ 가중합 → 정규화 → 위치 `v + 2(q×(q×v + w v)) + 2(w·t − ...)` 식, 법선 회전·정규화, `dot < 0` 이면 부호 반전 규칙)을 **GLSL 로 그대로** 옮긴다. 먼저 셰이더와 줄 단위로 같은 **순수 JS 함수**(`skinVertexDQ(rest, normal, weights, dq[4])`)를 만들고, 그 함수로 기존 CPU 결과와 일치함을 시험한 뒤, 같은 식을 GLSL 문자열로 둔다(문자열 상수 한 곳).
2. **데이터**: 다리 메시마다 정점 속성 `skinWeight`(vec4, 기존 `draw.weights`, Float32), `position`/`normal` 은 **휴지(rest) 값 고정**(GPU 모드에서는 매 프레임 덮어쓰지 않음). 균일 변수 `uSkinDQ[8]`(vec4 ×8 = 4 본 × (실수부, 쌍대부)) — **좌·우가 다르므로 다리 메시는 좌/우 별도 머티리얼**(공용 팔레트 머티리얼을 복제 2개, 다른 메시는 그대로). 복제 머티리얼에도 **컬러 키트 map 교체·흔들림 셰이더·`customProgramCacheKey`** 가 동일하게 적용되게(키트는 팔레트 머티리얼 전부에 적용하도록 확장, 캐시 키는 `rider-sway-v1` + `skin` 구분).
3. **프레임 흐름**: GPU 모드에서 `setPhase` 는 IK·`solveLeg`·DQ 계산까지만 하고, 정점 루프 대신 좌/우 머티리얼의 `uSkinDQ` 값을 갱신(라이더마다 그리기 직전 — 레이어가 이미 `setPhase → setVisualKind → setSway → render` 순서). `needsUpdate` 로 버퍼 재업로드 없음.
4. **스위치**: `?skin=gpu|cpu`(운영 포함), **기본 `cpu`**. 셰이더 컴파일 실패·확장 미지원 시 자동으로 cpu. perflab 상단에 `스킨 gpu/cpu`, 복사 JSON 에 `skinMode`.
5. LOD2(정적 메시)·s5 프로필은 영향 없음(rider14 리그 메시만).

## 검증 — 동등성이 핵심

- **JS 순수 함수 = CPU 경로**: rider14 리그로 8 위상(0,45,…,315°) 다리 6메시 전 정점 위치 차 ≤ 1e-5 m, 법선 각 ≤ 0.1°(시험 `scripts/rider-preserve/` 에, `test:rider-preserve` 포함). 기존 `rider14-equivalence.test.ts` 는 수정하지 않고 통과.
- **GPU 화면 = CPU 화면**: 헤드리스 1회(dev 5070, 브라우저 1개, 끝나면 종료) — 벤치 페이지 `rider-perf-bench.html?animate=0&riders=1&zoom=22&phase=<0|90|180|270>` 를 `skin=cpu` / `skin=gpu` 로 각각 캡처(DPR 2, 라이더 크롭), 픽셀 차이 통계(최대·평균·차이 픽셀 비율)와 ×8 차이 이미지. 기준: 평균 채널 차 ≤ 1, 차이 픽셀(>8) 비율 ≤ 0.5 %(가장자리 안티에일리어싱 정도). 넘으면 이유 분석.
- perflab 벤치로 cpu/gpu 의 `msPerRider`·`posePct` 비교(헤드리스 SwiftShader — 경향만).
- PowerShell `apps/web`: tsc, 변경 파일 eslint, **루트 `node scripts/check-dep-direction.mjs --check` "lib 파일 전원 도메인 지정 PASS(미지정 0)"**, `npm run test:quick`(worktree `functions/lib` 부재 3건 외 0), `npm run test:rider-preserve`, `npm run build`.

## 금지

리그 수학(IK·DQ 계산식·가중치·관절 좌표) 변경, 기본값을 gpu 로 바꾸는 것(다음 단계 Chief 확인 후), LOD2·s5 변경, commit · push · 배포, 백그라운드 잔류.
