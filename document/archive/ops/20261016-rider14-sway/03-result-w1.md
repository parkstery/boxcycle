# 결과 W1 — 흔들림 구현 + 시험

| 항목 | 내용 |
|------|------|
| 작성 | 2026-10-16 · Developer (Cursor Agent CLI) |
| 지시 | [02-task-w1.md](02-task-w1.md) |
| 계획 | [01-plan.md](01-plan.md) §0·§2 |
| 작업 위치 | `C:\20.HDev\boxcycle-sway` · 브랜치 `feat/rider14-sway` |
| 판정 | 구현·지정 검증 완료. commit · push · 배포 하지 않음. 브라우저 확인은 W2. |

## 변경 파일

| 파일 | 줄 |
|------|----|
| `apps/web/src/lib/riderPrototype/riderSway.ts` | 신규 101 |
| `apps/web/scripts/rider-preserve/rider-sway.test.ts` | 신규 296 |
| `apps/web/src/lib/riderPrototype/preservedRiderRig.ts` | +72 |
| `apps/web/src/lib/map/riderPreservedLayer.ts` | +28 / −5 |
| `apps/web/src/lib/riderPrototype/config.ts` | +9 |
| `apps/web/src/lib/riderPrototype/riderModelProfile.ts` | +4 (`supportsSway`: rider14 true, s5 false) |
| `apps/web/package.json` | `test:rider-preserve` 에 `rider-sway.test.ts` 추가 (+1 / −1) |

`rider14-equivalence.test.ts` 는 수정하지 않았다. 리그 IK·강체 수식은 그대로다.

## 검증

작업 디렉터리 `apps/web`. PowerShell, 포그라운드.

| 명령 | exit | 요약 |
|------|------|------|
| `npx tsc --noEmit -p tsconfig.app.json` | 0 | 진단 없음 |
| `npx eslint` (아래 6파일) | 0 | 진단 없음 |
| `npm run test:rider-preserve` | 0 | TS 시험 37 통과, 계약 mjs 6 통과. 실패 0 |
| `npm run build` (`tsc -b && vite build`) | 0 | `dist/assets/index-CfxOof0w.js` 생성 |

eslint 대상: `riderSway.ts`, `riderModelProfile.ts`, `preservedRiderRig.ts`, `config.ts`, `riderPreservedLayer.ts`, `scripts/rider-preserve/rider-sway.test.ts`.

시험 개수: 기존 TS 25 + 신규 12 + 계약 6 = **43 통과**. 신규 12는 계산 3, envelope 4, 리그·`_sway` 5.

추가(게이트 밖): `scripts/ride-hierarchy/rider-detail-lod-contract.test.ts` exit 0, 7 통과. `if (animatePose) … setPhase` 한 줄 계약이 유지된다.

`npm run build` 로그에 `riderRig.ts` 의 `SADDLE`·`PELVIS` import 경고가 있다. 이번 변경 파일이 아니다.

## 운영 빌드 검색 (`dist/assets/index-CfxOof0w.js`)

| 문자열 | 횟수 |
|--------|------|
| `get("sway")` · `get('sway')` · `` get(`sway`) `` · `sway=0` | 0 |
| `isRiderSway` · `swayDisabled` | 0 |
| `rider-sway-v1` | 1 |
| `uSwayRoll` · `uSwayBob` · `uSwayPivot` | 각 4 |
| `_sway` | 3 (셰이더 문자열) |

쿼리 함수는 `function oB(){return!1}` 로 접혀 있다. `URLSearchParams` 는 10건 남아 있고, 보이는 키는 `ridePitch`·`camlab`·`rideCam`·`lightlab` 이다.

## 구현 중 판단

**triggerRepaint.** 추가하지 않았다. `MapView` 주행 틱이 `requestAnimationFrame` 으로 매 프레임 `syncRiderPreservedModels` → `setSpecs` → `map.triggerRepaint()` 를 부른다(`MapView.tsx` 2656·2678, `riderPreservedLayer.ts` `setSpecs` 147행). 위상 증가는 `running` 이고 속도 > 0.35 km/h 일 때만이고, sync 는 그 조건 밖에서도 돈다. 그래서 페달이 멈춘 뒤 envelope 이 0 으로 가는 동안에도 `render` 가 계속 호출된다.

**envelope 와 “2 s 후 < 0.01”.** 최근 300 ms 는 목표 1, 시상수 400 ms. 2 s 동안 위상이 바뀌면 **0.993**. 그 직후 위상을 고정하면 300 ms 는 목표 1 이 유지되고, 정지 후 2.0 s 값은 **0.0142** (0.01 과 0.015 사이). 목표 0 구간이 2 s 되는 정지 후 2.3 s 값은 **0.00672**. 시험은 2.0 s 에서 유지 창이 남아 있음을 확인하고, `< 0.01` 은 2.3 s 에서 본다. `enabled=false` 는 유지 창을 쓰지 않으므로 2 s 후 **0.01 미만**.

**envelope 0.** `bob` 식의 앞쪽 부호 때문에 `envelope === 0` 을 곱하면 `bobM` 이 `-0` 이 된다. 그 경우 세 값을 `+0` 으로 반환한다. 화면 값은 같다.

**빈 spec.** `specs.length === 0` 이면 그리기 루프에 들어가지 않으므로, 그 경로에서 `prune(빈 집합)` 으로 id 상태를 지운다.

## 남은 문제

- W2 육안(손·안장·자전거 반대 롤·미러 방향 R1)은 하지 않았다.
- 코너링 lean 과 0.4° 합산(R3), 라이더별 균일 변수(R2)는 그리기 직전 설정으로 연결만 되어 있고 화면 확인은 W2 다.
