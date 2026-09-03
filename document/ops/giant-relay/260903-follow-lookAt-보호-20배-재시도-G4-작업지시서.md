# follow look-at 보호 · 20배 재시도 G-4 작업지시서

| 항목 | 내용 |
|---|---|
| 문서 유형 | **실행 — 카메라 결함 수정 후 20배 재시도** |
| 최초 작성 | 2026-09-03 |
| 상태 | **즉시 실행** |
| 작업 ID | `GIANT-LOOKAT-CLAMP-G4` |
| worktree | `C:\20.HDev\boxcycle-giant` |
| 브랜치 | `feat/giant-20x` (`c3f13eb`) — 이어서 작업 |
| 선행 | [G-3](260903-giant-20배-제품채택-G3-작업지시서.md) · [G-3 REPORT](REPORT.md) — **BLOCK 판정 승인** |

## 1. G-3 검수 결과 — BLOCK 은 정당하다

보고의 세 주장을 감리가 독립 검산했고 **전부 사실**이다.

| 주장 | 검산 |
|---|---|
| `lookAtAlongViewM` 에 `Math.max` 보호가 없다 | 사실 — `rideCameraFraming.ts:78`. 보호는 84행 `spanM` 에만 있다 |
| before 5.51 m → after 110.16 m | 사실 — `0.84452×1.15/tan10° = 5.51`, `×23 = 110.16`. 실측과 소수점까지 일치 |
| 전환점은 22.41배 | 사실 — `40/(1.12×1.3860226×1.15) = 22.406` |

### 1.1 감리 오류 2건 — 기록으로 남긴다

1. **전환점을 36배로 적었다. 실제는 22.41배다.** 산수 실수다. 20배는 여전히 아래지만 여유는 80% 가 아니라 **12%** 다.
2. **`RIDER_GLB_MODEL_SCALE` 소비처를 4곳으로 세어 놓고 27행 하나만 분석했다.** 30행 `RIDER_LOOK_AT_HEIGHT_M` 이 진짜 원인이었다. 「20배는 카메라 공식을 건드릴 필요가 없다」는 채택 근거는 **절반만 맞았다** — 줌은 그대로였지만(실측 Δ 1.6e-7) 카메라 center 가 달아났다.

G-3 의 실측이 아니었으면 이 오류는 병합 뒤에 발견됐을 것이다. 보고 품질이 이 작업을 구했다.

## 2. 진짜 결함 — giant 와 무관하게 잠재해 있다

```ts
// 27행 — Math.max 가 막아 준다
export const RIDER_DISPLAY_HEIGHT_M = RIDER_HEAD_C_Y_M * RIDER_GLB_MODEL_SCALE;

// 30행 — 보호 없음
export const RIDER_LOOK_AT_HEIGHT_M = RIDER_PELVIS_Y_M * RIDER_GLB_MODEL_SCALE;

// 78행
const lookAtAlongViewM = RIDER_LOOK_AT_HEIGHT_M / tanDep;   // 배율에 선형 비례
// 84행
const spanM = Math.max(heightSpanM, distanceM);             // 여기만 보호
```

**두 항이 서로 다른 규칙을 따른다.** 화면에 담는 범위(`spanM`)는 40 m 로 고정되는데, 카메라가 겨누는 지점(`lookAtAlongViewM`)은 110 m 로 달아난다. 40 m 짜리 창으로 110 m 떨어진 곳을 보니 라이더가 화면 밖으로 나간다.

이건 **giant 전용 문제가 아니다.** 라이더 GLB 를 교체해 `RIDER_GLB_MODEL_SCALE` 이 커지면 언제든 재발한다. 2배에서도 11 m 로 이미 어긋난다.

### 2.1 왜 지금까지 안 드러났나 — 시험이 0건이다

`rideCameraFraming.ts` 에 대한 **순수 함수 시험이 하나도 없다.** `apps/web/scripts/` 전체를 뒤져도 이 파일을 참조하는 시험이 없다. 상수 하나를 바꾸면 프레이밍이 조용히 깨지는 상태였다. §5 에서 이것부터 세운다.

## 3. 불변식 — 이미 코드에 있다

`rideCameraFraming.ts:148` `measureRiderScreenDiag()` 가 **`inSafeArea: boolean`** 을 반환한다. 머리·바퀴·좌우 어깨를 투영해 HUD 안전 여백 안에 있는지 판정한다.

> **모든 follow 모드·pitch·카메라 거리에서 `inSafeArea === true` 여야 한다.**

이것이 이번 작업의 단일 수용 기준이다. 눈으로 판단하지 않는다.

## 4. 수정

### 4.1 look-at 오프셋을 프레이밍과 묶는다

`lookAtAlongViewM` 이 `spanM` 과 무관하게 커지는 것이 원인이므로 **둘을 같은 규칙 아래 둔다.** 권장 방향:

```ts
const spanM = Math.max(heightSpanM, distanceM);            // 먼저 계산
const maxLookAtAlongM = spanM * RIDE_LOOKAT_SPAN_RATIO;    // 새 상수
const lookAtAlongViewM = Math.min(RIDER_LOOK_AT_HEIGHT_M / tanDep, maxLookAtAlongM);
```

- 비율값은 **실측으로 정한다.** `inSafeArea` 가 factor 1·10·20 에서 모두 참이 되는 최대값을 찾아 그 근거를 REPORT 에 남긴다. 감리가 숫자를 지정하지 않는다.
- 다른 접근이 더 낫다고 판단하면 그것을 써도 된다. **§3 불변식을 만족하고 §4.3 을 깨지 않으면 방법은 자유다.** 고른 이유를 적는다.

### 4.2 카메라 거리 슬라이더 하한도 함께 본다

G-3 이 찾은 부수 결함: `heightSpan` 이 35.7 m 가 되면 1~40 m 슬라이더에서 **35.7 m 미만 조작이 전부 무효**가 된다. 20배를 채택하면 사용자가 카메라를 당길 수 없다.

- `spanM = Math.max(heightSpanM, distanceM)` 에서 `heightSpanM` 이 하한으로 작동하기 때문이다.
- **슬라이더 조작이 화면에 반영되어야 한다.** 20배에서 1 m·10 m·20 m·40 m 를 골랐을 때 각각 다른 줌이 나오는지 실측하고, 안 되면 이 항도 함께 고친다.
- 다만 **줌을 크게 빼는 방향으로 풀지 않는다.** 400배 거절 사유(라이더가 지도를 가림 / 줌이 빠짐)를 재현하면 안 된다.

### 4.3 깨지 말아야 할 것

- **`RIDER_GIANT_SCALE_FACTOR = 20` 유지.** 400 은 미채택 그대로다.
- **factor 1(현재 제품)에서 카메라 동작이 변하면 안 된다.** 이번 수정은 큰 배율을 구제하는 것이지 현재 화면을 바꾸는 것이 아니다. before/after 비교로 증명한다.
- 네임태그·HUD·경로선·지도 UI 는 이 상수를 읽지 않는다. 함께 커지면 안 된다.
- 접지(G4 접지점)가 어긋나면 GLB 원점 문제이며 범위 밖이다. 고치지 말고 보고한다.

## 5. 시험 — 순수 함수부터 세운다

`apps/web/scripts/giant-relay/` (또는 적절한 기능명 디렉터리)에 `rideCameraFraming` 순수 함수 시험을 **신설**한다. 지금 0건이다.

1. **불변식 시험** — factor `1` · `10` · `20` 각각에서, pitch `0`·`45`·`80`, 거리 `1`·`10`·`40` m 조합 전수로 `lookAtAlongViewM ≤ spanM × 비율` 을 assert.
2. **현재 제품 보존** — factor 1 에서 수정 전후 `zoom`·`center` 가 **동일**함을 assert. 회귀 방지의 핵심이다.
3. **경계** — 전환점 22.41배 부근(`22`·`23`)에서 `spanM` 지배가 바뀌는 지점이 계산과 맞는지 assert.
4. `RIDER_HEAD_C_Y_M`·`RIDER_PELVIS_Y_M` 은 rig 파생값이다. **하드코딩하지 말고** 실제 import 해서 쓴다.

## 6. 검증

### 6.1 자동 (빠른 것만)

```text
npm -w boxcycle-web run test:next-ride
npm -w boxcycle-web run test:distance-auto-route
npm --prefix functions run build
npm -w boxcycle-web run build
git diff --check
```

**worktree 함정**: 루트 `npm install` 은 workspaces(`apps/web`)만 설치한다. `npm --prefix functions install` 을 따로 하지 않으면 functions 빌드가 `Cannot find module` 로 무더기 실패한다 — 코드 문제가 아니다(G-3 REPORT §3).

### 6.2 화면 확인 — `g3-measure.mjs` 를 재사용한다

G-3 이 만든 `document/ops/giant-relay/g3-measure.mjs` 가 이미 before/after 를 재고 `g3-metrics-*.json` 을 남긴다. 그대로 쓰되 **`inSafeArea` 를 판정 항목에 추가**한다.

| 항목 | 기대 |
|---|---|
| **`inSafeArea`** | **factor 1·20 · 모든 follow 모드에서 `true`** |
| 라이더 화면 좌표 | 투영 가능하고 안전 영역 안 |
| model-scale | 23 (= 1.15 × 20) |
| 접지 | 노면 위, 뜨거나 묻히지 않음 |
| 네임태그 fontSize | 변하지 않음 |
| factor 1 회귀 | 수정 전 `main2` 와 zoom·center 동일 |
| 카메라 거리 슬라이더 | 1·10·20·40 m 가 서로 다른 줌을 낸다 |

`g4-metrics-{before,after}.json` 과 `shots/g4-*.png` 로 남긴다.

## 7. 문서

- **[결정 로그](../../260707-RTW-결정-로그.md)** — 2026-09-03 「giant 20배 채택」 행에 **조건을 덧붙인다**: 「follow look-at 보호(G-4) 선행 필요 — 무보호 상태에서는 20배에서 라이더가 화면 밖으로 나간다(G-3 실측)」. 채택 자체를 취소하지는 않는다.
- **[G-3 REPORT](REPORT.md)** 는 그대로 둔다. G-4 REPORT 를 새로 쓴다.
- 감리 오류 2건(§1.1)을 G-4 REPORT 에 인용해 둔다. 같은 실수를 반복하지 않기 위한 기록이다.

## 8. 금지·경계

- **`inSafeArea` 를 느슨하게 고쳐 통과시키지 않는다.** 안전 여백을 줄이는 것도 같다.
- **400배로 올리지 않는다.** 미채택 유지다.
- factor 1 에서 화면이 바뀌면 실패다. 현재 제품을 건드리는 작업이 아니다.
- 줌을 크게 빼서 프레이밍을 푸는 방식 금지 — 400배 거절 사유 재현이다.
- 브라우저 e2e 는 수용 게이트에서 1회(3K-R2 §4 정책). 순수 함수 시험으로 먼저 좁힌 뒤 화면으로 확인한다.
- 기존 commit(`489a188`·`435c991`·`17838fe`·`c3f13eb`)을 amend·reset·rebase 하지 않는다.
- `main2` 병합은 감리가 `C:\20.HDev\boxcycle` 에서 한다. 보고 후 멈춘다.

## 9. 보고

- §4.1 채택한 방식과 비율값, 그 값을 정한 실측 근거
- §4.2 슬라이더 하한 처리 결과 (1·10·20·40 m 줌 실측표)
- §5 순수 함수 시험 목록과 통과 수
- §6.1 자동 시험 결과
- §6.2 `inSafeArea` 판정표 + `g4-metrics-*.json` + 스크린샷
- factor 1 회귀 증명(zoom·center 동일)
- 감리 지시 중 틀린 것이 있으면 **수치와 함께** 지적할 것. G-3 에서 그렇게 해서 병합 사고를 막았다.
