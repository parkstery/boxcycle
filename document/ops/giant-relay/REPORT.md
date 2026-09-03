# G-3 보고 — giant 20배 제품 채택

| 항목 | 내용 |
|---|---|
| 작업 ID | `GIANT-ADOPT-20X-G3` |
| 지시서 | [260903-giant-20배-제품채택-G3-작업지시서.md](260903-giant-20배-제품채택-G3-작업지시서.md) |
| 작성 | 2026-09-03 |
| 브랜치 | `feat/giant-20x` (worktree `C:\20.HDev\boxcycle-giant`) |
| base | `main2` `6f87a9e` (지시서의 `fb9a6a7` 보다 앞섬 — 현재 `main2` 끝에서 분기) |
| 결론 | **BLOCK — §4.2 화면 확인 실패. 병합하지 말 것.** |

## 한 줄

줌은 §1 계산대로 완전히 동일하지만, **`RIDER_LOOK_AT_HEIGHT_M` 도 `RIDER_GLB_MODEL_SCALE` 을 곱한다** — `spanM` 과 달리 `Math.max` 보호가 없어 카메라 center 가 라이더에서 **5.51 m → 110.16 m(19.99배)** 로 밀려나고, 3D 후방 추적에서 **라이더가 화면 밖으로 나간다.**

---

## 1. §1 계산 검산 — 감리 값은 맞다. 단 전환점은 틀렸다

`RIDER_HEAD_C_Y_M` 은 상수가 아니라 파생값이다. `rideCameraFraming.ts:23` → `riderRig.ts:17` → `riderRig.geometry.mjs:227` 에서 목·머리 각도로 계산된다. 실제 값을 node 로 평가했다.

```
HEAD_C            = [0.2270633283343957, 1.3860226376955769]
RIDER_HEAD_C_Y_M  = 1.3860226376955769   ← 감리가 쓴 ≈1.387 과 일치
PELVIS_ROOT[1]    = 0.84452
RIDE_CAMERA_DISTANCE_DEFAULT_M = 40 (mapGlobeView.ts:32), MIN 1 / MAX 40
```

| factor | model-scale | 전고 | heightSpan(×1.12) | `max(span, 40)` | 지배 |
|---:|---:|---:|---:|---:|---|
| 1 | 1.15 | 1.59 m | 1.79 m | 40.00 | 거리 |
| 10 | 11.50 | 15.94 m | 17.85 m | 40.00 | 거리 |
| **20** | **23** | **31.88 m** | **35.70 m** | **40.00** | **거리** |
| 50 | 57.50 | 79.70 m | 89.26 m | 89.26 | 전고 |
| 400 | 460 | 637.57 m | 714.08 m | 714.08 | 전고 |

**감리 값(전고 31.9 m · heightSpan 35.7 m < 40 m)과 일치한다.** 20배에서 `Math.max` 는 여전히 `distanceM` 을 고른다 — 이 부분은 참이며 실측으로도 확인됐다(§4.2).

### 정정 1 — 전환점은 36배가 아니라 **22.41배**다

```
전환 factor = 40 / (1.12 × 1.3860226 × 1.15) = 22.406…
```

지시서 §1 의 「전환점은 약 36배」는 틀렸다(표의 36배 행을 계산하면 span 64.27 m 로 이미 40 m 를 넘는다). 20배는 여전히 전환점 아래이므로 **채택 근거 자체는 무너지지 않지만, 여유는 감리가 생각한 80% 가 아니라 12%** 다.

### 정정 2 — 카메라 거리 슬라이더가 사실상 무력해진다

`heightSpan` 은 기본 거리 40 m 만이 아니라 **슬라이더로 고른 모든 거리**와 겨룬다. 슬라이더 범위는 1~40 m(`MapViewSheet.tsx:257-263`)다.

- 현재(1.15): 하한 1.79 m → 1 m 까지 당기는 조작이 거의 그대로 먹는다.
- 20배(23): 하한 35.70 m → **35.7 m 미만으로 당기는 조작이 전부 무효**가 된다.

「카메라 동작이 수치상 완전히 동일하다」는 기본값 40 m 에서만 참이다.

---

## 2. cherry-pick 결과

```
489a188  feat(rider): 260825-gient — 라이더 GLB 를 기준의 20배로 표시한다   (2cca566 회수, 충돌 없음)
435c991  docs(rider): giant 상수 주석의 옛 오타 gient 를 정정한다
17838fe  test(giant): G-3 화면 확인 증거 …
```

- **`RIDER_GIANT_SCALE_FACTOR = 20`** — 400 아님. 런타임 실측 `model-scale = 23` 으로도 확인(= 1.15 × 20).
- 제품 diff 는 `config.ts` 한 파일 (+12/−2). `git diff --check` 통과.
- 커밋 메시지의 `260825-gient` 는 이력 재작성을 피해 그대로 뒀다. **코드 주석**에 남아 있던 `gient` 는 §6 철자 규칙·§2 가 제시한 문구에 맞춰 후속 커밋 `435c991` 로 정정했다(`2cca566` 은 amend 하지 않음).

---

## 3. §4.1 자동 시험 — 전부 통과

| 명령 | 결과 |
|---|---|
| `test:next-ride` | pass 40 / fail 0 |
| `test:distance-auto-route` | pass 97 / fail 0 |
| `npm --prefix functions run build` | 통과 (exit 0) |
| `npm -w boxcycle-web run build` | 통과 (built in 1.83s) |
| `git diff --check` | 통과 |

함정 하나 추가: worktree 에서는 루트 `npm install` 이 workspaces(`apps/web`)만 설치한다. **`npm --prefix functions install` 을 따로 하지 않으면 functions 빌드가 `Cannot find module 'firebase-admin/…'` 로 무더기 실패**한다 — 코드 문제가 아니다. `.env` 복사(§3.1)는 지시대로 수행했다.

---

## 4. §4.2 화면 확인 — **실패**

측정: 실제 앱을 dev 로 띄우고(before = `main2` @5020, after = `feat/giant-20x` @5021) 게스트 진입 → 입문 코스 → 체험 속도 준비 → 주행 시작 → 3D 뷰 + 후방(rear30). 스크립트 `g3-measure.mjs`, 원자료 `g3-metrics-{before,after}.json`.

| 항목 | before (1.15) | after (23) | 판정 |
|---|---|---|---|
| model-scale | 1.15 | **23** | ✅ 정확히 20배 |
| rear30 zoom | 20.573831 | 20.573831 (Δ 1.6e-7) | ✅ **변하지 않음** |
| rear30 pitch | 80.00° | 80.00° | ✅ 동일 |
| 카메라 거리 readout | 40.0 m | 40.0 m | ✅ 동일 |
| 네임태그 fontSize | 12.16 px | 12.16 px | ✅ 변하지 않음 |
| 접지 | 노면 위 | 노면 위 | ✅ 뜨거나 묻히지 않음 |
| **라이더–카메라 center 거리** | **5.51 m** | **110.16 m (19.99배)** | ❌ |
| **라이더 화면 좌표** | (640, 443) 정중앙 | **투영 불가(±MAX_VALUE)** | ❌ **화면 밖** |
| 지도 가림 | — | 라이더가 아예 안 보임 | ❌ |
| 동행 라이더 | 미검증(다른 주행자 없음) | 미검증 | — |

### 원인 — `spanM` 이 아니라 `look-at` 이다

`rideCameraFraming.ts` 는 `RIDER_GLB_MODEL_SCALE` 을 **두 곳**에서 쓴다. §1 이 검토한 것은 앞의 하나뿐이다.

```ts
// 27행 — §1 이 본 곳. 아래 84행의 Math.max 가 막아 준다.
export const RIDER_DISPLAY_HEIGHT_M = RIDER_HEAD_C_Y_M * RIDER_GLB_MODEL_SCALE;

// 30행 — §1 이 보지 못한 곳. 보호 장치가 없다.
export const RIDER_LOOK_AT_HEIGHT_M = RIDER_PELVIS_Y_M * RIDER_GLB_MODEL_SCALE;

// 76-80행
const lookAtAlongViewM = RIDER_LOOK_AT_HEIGHT_M / tanDep;      // ← Math.max 없음
const center = offsetLngLatByBearingMeters(riderLngLat, viewBearing, lookAtAlongViewM);

// 83-84행
const heightSpanM = RIDER_DISPLAY_HEIGHT_M * RIDER_HEIGHT_SPAN_MARGIN;
const spanM = Math.max(heightSpanM, distanceM);                 // ← 여기만 보호된다
```

pitch 80° → `tanDep = tan(10°) = 0.176327` 이므로

| | `RIDER_LOOK_AT_HEIGHT_M` | `lookAtAlongViewM` | 실측 |
|---|---:|---:|---:|
| before | 0.84452 × 1.15 = 0.9712 m | 5.51 m | **5.51 m** |
| after | 0.84452 × 23 = 19.424 m | 110.16 m | **110.16 m** |

계산과 실측이 소수점까지 맞는다. `spanM` 과 달리 이 항은 배율에 **선형 비례**하므로 전환점 같은 안전 구간이 없다 — 10배에서도 55 m, 2배에서도 11 m 로 이미 어긋난다.

### 어느 모드에서 깨지나

- **깨진다**: 후방·전방·좌측·우측(전부 pitch 80°). `tanDep` 이 작아 오차가 증폭된다.
- **안 깨진다**: 북향(`distanceM = 0` → 조기 반환), 2D 추적(pitch 0 → `tanDep` 이 커서 `lookAtAlongViewM ≈ 0`), free.

즉 **3D 뷰 토글 하나로 도달하는 기본 주행 시점**에서 라이더가 사라진다. `shots/g3-after-flat.png` 는 2D 추적에서 20배 라이더가 정상으로 보이는 모습이고, `shots/g3-after.png` 는 같은 주행에서 후방으로 바꾼 직후 라이더도 경로선도 없는 화면이다.

### 접지는 정상

후방 시점에서는 라이더가 화면에 없어 접지를 볼 수 없으므로, follow 를 free 로 두고 카메라를 라이더 좌표에 직접 고정해 분리 판정했다(`shots/g3-{before,after}-ground.png`). 20배 라이더도 노면 위에 앉아 있다 — **GLB 원점 문제는 없다.** §6 의 「접지 어긋나면 범위 밖」 조항은 발동하지 않는다.

---

## 5. §3.3 측정 하네스 — 미회수

`origin/260825-giant` 의 `playwright.config.ts` 가 `testMatch: /measure-g2\.spec\.ts/`(400배 G-2 전용)로 못 박혀 있어 `measure.spec.ts`(G-1)를 돌리려면 설정을 고쳐야 하고, 파일 전부가 정정 전 경로 `document/ops/gient-relay/` 에 있어 그대로 가져오면 `gient` 를 새로 들이게 된다(§6 위반). **「손봐야 하면 가져오지 않는다」에 해당**하므로 회수하지 않고, 필요한 계측만 하는 단발 스크립트 `g3-measure.mjs` 를 남겼다.

---

## 6. §5 문서 4곳 — 미실행

네 갱신 모두 「20배 채택」을 전제로 한다. §4.2 본 게이트가 실패했으므로 결정 로그·상태보드에 채택을 적으면 되돌려야 할 기록이 된다. **감리 판단 전까지 보류**한다. 채택을 진행하기로 하면 즉시 반영한다.

---

## 7. 판단이 필요한 지점

`RIDER_LOOK_AT_HEIGHT_M` 을 고치는 것은 곧 `rideCameraFraming.ts` 를 건드리는 일이고, §6 이 명시적으로 금지한다. 세 갈래다.

1. **§6 완화** — `lookAtAlongViewM` 에도 `spanM` 처럼 상한을 둔다(예: 기준 스케일 1.15 로 고정하거나 `Math.min(…, distanceM)`). 카메라 공식을 손대므로 「공식 미변경」이라는 채택 근거는 다시 세워야 한다.
2. **적용 지점 이동** — `RIDER_GIANT_SCALE_FACTOR` 를 `RIDER_GLB_MODEL_SCALE` 이 아니라 `glbModelLayer` 의 paint 에서만 곱해, 카메라가 읽는 상수는 1.15 로 남긴다. `rideCameraFraming.ts` 를 건드리지 않고 카메라를 완전히 무영향으로 만든다. **3줄 원칙에 가장 가깝다.**
3. **재미채택** — 20배도 미채택으로 되돌린다.

권고는 **2번**이다. 카메라 공식을 그대로 두면서 §1 의 채택 근거(카메라 미영향)를 계산이 아니라 구조로 보장한다. 다만 이는 지시서 §2 의 「제품 변경은 3줄」 범위를 벗어나므로 감리 승인 없이 진행하지 않는다.

**병합은 하지 않았다.** `feat/giant-20x` 는 worktree 에 그대로 있다.
