# 지시 P3 — 앱 리그 동등성 시험 (s5 ↔ rider14, 8위상)

| 항목 | 내용 |
|---|---|
| 발행 | 2026-10-15 · Supervisor (Claude) |
| 대상 | Developer — OpenCode Muse Spark |
| 선행 | P2a 감리 통과 (프로필·Float32 bake 가 들어간 리그) |
| 계획 | [01-plan.md §6 P3 · G3](01-plan.md) |
| 작업 위치 | `C:\20.HDev\boxcycle-rider14` |
| 결과 파일 | `C:\20.HDev\boxcycle\document\ops\20261015-rider14-replace\03-result-p3.md` |

## 0. P2b 보정 (먼저 처리 — [04-review-p2b.md](04-review-p2b.md))

1. `riderPaletteKit.ts` `dispose()`: 키트 텍스처를 해제하기 **전에** `this.material.map = this.originalMap` 으로 되돌린다(원본 map 은 계속 rig 의 머티리얼 sweep 이 해제).
2. `rider-palette-kit.test.ts` 에 시험 추가: rider14 rig(시험 로더 + stub map) 에서 `setVisualKind("pacer")` → `rig.dispose()` 후 원본 map 과 pacer 키트 텍스처가 각각 `dispose` 이벤트를 정확히 1회 받는다. (`DataTexture` 키트 생성은 브라우저 캔버스가 필요하므로, 시험에서는 `RiderPaletteKit` 의 키트 생성 부분만 주입 가능한 형태로 두거나 `kits` 맵에 미리 만든 텍스처를 넣어 검증한다 — 앱 동작은 바꾸지 않는다.)
3. 이 두 파일 외의 `src` 수정은 여전히 금지.

## Supervisor 사전 실측 (2026-10-15)

Node 에서 `GLTFLoader.parse` + `MeshoptDecoder`(rider14 는 JSON 청크에서 `images/textures/samplers` 와 텍스처 참조를 지운 사본)로 두 GLB 를 열어 다리 메시 월드 좌표를 같은 인덱스끼리 비교했다.

| s5 | rider14 | 정점 수 | 같은 인덱스 일치 | 최대 차 |
|---|---|---:|---:|---:|
| Right continuous knee skin | legR__Material_5 | 940 | 940 | 7.96e-6 m |
| Mesh_153 | legR__Rider_black_shorts | 1097 | 1097 | 4.46e-6 m |
| Mesh_156 | legR__Rider_black_socks | 48 | 48 | 1.34e-6 m |
| Left continuous knee skin | legL__Material_5 | 867 | 867 | 5.76e-6 m |
| Mesh_163 | legL__Rider_black_shorts | 1097 | 1097 | 4.25e-6 m |
| Mesh_166 | legL__Rider_black_socks | 48 | 48 | 1.64e-6 m |

→ **정점 순서가 같다.** 최근접 탐색 없이 인덱스로 비교한다.

## 계획서 G3 정정

강체 그룹(정적·바퀴·크랭크·페달·발)은 rider14 에서 **단순화된 형상**이라 정점 비교가 성립하지 않는다. 강체는 **그룹 변환 행렬**을 비교한다. 다리는 정점을 비교한다.

## 만들 것

`apps/web/scripts/rider-preserve/rider14-equivalence.test.ts` — `node --experimental-strip-types --test` 로 실행.

1. 두 GLB 로드(위 방식, 로더 도우미는 P2a 시험의 것을 재사용·공유 모듈로 빼도 된다). `guide-weights.json` 은 각 후보 폴더의 것을 읽는다(바이트 동일함도 단언).
2. `new PreservedRiderRig(scene, guides, getRiderModelProfile("s5"|"rider14"))` — **앱 코드 그대로**. 근사 좌표·하드코딩 크랭크 반경 금지.
3. 위상 `phaseRev ∈ {0, 0.125, …, 0.875}` 8개마다 두 리그에 `setPhase` 후:
   - **다리 6쌍**: 위 표의 쌍을 이름으로 찾아 `geometry.position` 같은 인덱스 비교 → 최대 차 ≤ **1.0e-5 m**. 법선은 각도 차 ≤ 0.5°.
   - **강체 7그룹** `preserved-crank / pedalR / pedalL / footR / footL / wheelFront / wheelRear`(`rig.object.getObjectByName`) 의 `matrix.elements` 원소별 최대 차 ≤ **1.0e-5**.
   - 각 그룹의 메시가 실제로 그 그룹 노드 아래 있는지: rider14 는 그룹당 기대 메시 수(static 1, legR/legL 각 3 은 rig.object 직속, 나머지 각 1).
4. 위상 무관 단언: 두 리그의 `pedalBind`·`crankPhase`·`crankRadius` 차 ≤ 1e-5 (private 이면 시험에서 `as unknown as {...}` 로 읽는다. 앱 코드에 getter 를 추가하지 않는다). 좌우 위상차 = π (±1e-9).
5. 가이드 미매칭 0 — 생성자가 예외 없이 끝나면 충족(코드가 미매칭 시 예외). 이 사실을 시험 이름에 명시.
6. 위상별 최대 차를 표로 `console.log` 하고, 같은 값을 `.out/rider14/p3/equivalence.json` 으로 저장.

## 검증

- 위 시험 실행 시간 기록. 10초 이하면 `test:rider-preserve` 스크립트에 추가, 넘으면 `test:rider14-equivalence` 별도 스크립트로 두고 결과에 적는다. 시험 실행은 **PowerShell** 에서 `npm run …` 으로 한다(Git Bash 는 npm 스크립트 경로 오류).
- 모든 명령 포그라운드, 백그라운드 잔류 금지. 브라우저·dev 서버는 이번 단계에서 쓰지 않는다(메모리 절약).
- `npx tsc --noEmit -p tsconfig.app.json`, `npx eslint scripts/rider-preserve/rider14-equivalence.test.ts`.
- **음성 대조 1회**: 시험 안에서 rider14 리그의 `pedalBind.R[0]` 을 +1 mm 바꾼 리그를 따로 만들어(생성 후 private 필드 수정 → `setPhase`) 단언이 실패하는지 확인하는 하위 시험. 시험이 실제로 차이를 잡는다는 증거.

## 결과 파일 `03-result-p3.md`

위상 × {다리 최대 차, 법선 최대 각, 강체 행렬 최대 차} 표, 위상 무관 값, 음성 대조 결과, 실행 시간, 명령 exit code, 변경 파일.

## 금지

§0 외 앱 코드(`src/**`) 수정 금지 — 동등성 시험이 실패하면 고치지 말고 실패 내용을 보고. commit · push · `npm install` 금지.
