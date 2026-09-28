# 작업지시 — 단계 P3 (joint_layout 권위 검증) · 읽기 전용 · **마지막 사전 점검**

발행: 수퍼바이저 세션 · 2026-09-19
집행: Claude Code @ `C:\20.HDev\boxcycle` (브랜치 `rider/20260919-natural-joint-skin`)
선행: `STEP-P.md` · `STEP-P2.md` 완료

---

## P2 감사 결과 — 수용한다

`P2-blend-inspect.json` 의 주장을 수퍼바이저가 재현했다. Guide 정점그룹 9개, `joint_layout.json` 실재(13,391 B), 좌우 규칙(앱 `_l` ← 모델 Right), BLEND↔s5 AABB 일치 — 전부 확인했다. 좌우 규칙을 장갑·엄지·무릎피부·브레이크후드 4쌍의 z 부호로 교차 확인한 것은 특히 좋은 검증이다. B6~B9 도 타당하다.

**다만 하나를 놓쳤다. 그게 이번 지시의 전부다.**

---

## 놓친 것 — `joint_layout.json` 이 현재 모델의 것이라는 근거가 없다

너는 `joint_layout.json` 의 pivot·axis 를 **권위값**으로 채택하고 계획서의 팔꿈치 추정치를 기각했다(B7 `"계획서 값과 약 15mm 차 — joint_layout 값을 쓴다"`). 그런데 그 파일 자체의 출처를 확인하지 않았다.

```
joint_layout.json:"source"
  C:\Users\kdrea\OneDrive\Documents\img\helmet_fix\revision\
      appearance_preserved_lod\roadcyclist_appearance_preserved.blend
                                ↑ 네가 조사한 roadcyclist_natural_joint_skin.blend 가 아니다
파일 날짜: 2026-09-13 22:26
```

그런데 같은 릴리스 폴더에는 **그 이후 날짜의 관절 변경 작업**이 줄줄이 있다:

```
20260916_02-hip-knee-joint-recalc      ← 고관절·무릎 재계산
20260916_03-hip-position-fix           ← 고관절 위치 수정
20260916_04-hip-position-user-spec
20260916_08-left-leg-length-fix        ← 왼다리 길이 수정
20260916_11-knee-shift-fix             ← 무릎 이동
20260916_13-left-leg-only-fix
```

**`joint_layout.json` 이 이 변경들보다 앞선다.** 즉 유물일 수 있다.

수퍼바이저가 계획서 §단계A 앵커와 대조한 결과 실제로 어긋난다 (glTF y-up, mm):

| 관절 | joint_layout → glTF | 계획서 §단계A 앵커 | 차 |
|---|---|---|---|
| Right knee | (38.3, 688.2, +95.4) | (36.5, 683.5, +95.3) | **Δy 4.7** |
| Left knee | (128.7, 754.1, −108.0) | (121.4, 755.9, −107.3) | **Δx 7.3** |

5~7mm 다. 정의 차이(회전 피벗 vs 메시 중심)일 수도 있고, 유물이라서일 수도 있다. **지금은 구분이 안 된다.**

이건 이 리포에서 이미 두 번 당한 함정이다 — `rig_data_v8.json` 의 `femur` 필드가 실좌표와 불일치했던 건, `coords.seatTop` 이 실제 메시에 쓰이지 않는 유물 필드라 5단계를 오판한 건. **판정에 쓰기 전에 그 값이 정말 현재 형상의 것인지 확인하라.**

---

## 범위

**읽기 전용.** BLEND 저장 금지, 코드·GLB 수정 금지, 후보 생성 금지, 단계 0 실행 금지. 끝나면 STOP.

---

## P3-1. `joint_layout.json` 이 현재 형상과 맞는지 **기하로** 판정하라 — 핵심

출처 문자열을 믿지 말고, **현재 메시로 직접 검산**하라. `joint_layout.json` 은 검산에 쓸 재료를 스스로 갖고 있다:

- `proximal_cut_center` · `distal_cut_center` — 절단면 중심
- `upper_cut_radius_m` / `cut_radii_m` — 절단면 반경
- `rings` — 링 수
- `*_axis` — 세그먼트 축

검산 방법 (4관절 전부):

1. `proximal_cut_center` 를 지나고 해당 축에 수직인 평면으로 **현재 메시**(s5 GLB 와 BLEND 양쪽)를 자른다.
2. 그 단면의 **실제 반경**을 구해 `cut_radius` 와 비교한다.
3. 단면 중심(교차 정점 무게중심)이 `cut_center` 와 얼마나 떨어져 있는지 mm 로 낸다.
4. `*_axis` 가 실제 세그먼트 방향(절단면 중심 → 다음 절단면 중심)과 이루는 각을 도(°)로 낸다.
5. `rings` 값이 실제 그 구간의 엣지 링 수와 맞는가.

**합격 기준을 네가 정하고 근거를 대라.** 대략 중심 오차 ≤2mm · 반경 오차 ≤2mm · 축 오차 ≤2° 면 "현재 형상의 값"으로 볼 만하다. 벗어나면 유물이다.

BLEND 와 s5 에서 각각 돌려 **둘 다** 판정하라 (P2 에서 무릎·팔꿈치 메시는 BLEND↔s5 정점 집합 동일이라 했으니, 결과가 다르면 그 주장부터 틀린 것이다 — 그것도 보고 대상이다).

## P3-2. 릴리스 폴더의 인계 문서를 읽어라

`C:\Users\kdrea\OneDrive\Documents\img\helmet_fix\revision\20260919-natural_joint_skin\` 에 네가 아직 읽지 않은 것들이 있다:

```
handoff_manifest.json      (rig_status 만 인용했다 — 전문을 읽어라)
verification.json
part_axes.json             ← joint_layout 과 어떤 관계인가
인계_수정_검증.md
라이더_추가경량화_방안.md
contact_audit.json · audit.log · verify.log · inspect.log
```

확인할 것:
- `joint_layout.json` 이 `20260916_*` 관절 수정 이후 **재생성·재검증된 기록이 있는가**
- `part_axes.json` 이 `joint_layout.json` 과 같은 값인가 다른가 — 다르면 어느 쪽이 최신인가
- 모델러가 남긴 **고관절·어깨 pivot 값이 어딘가에 있는가** (B7 의 빈칸)
- `qa_right_knee.png` 등 QA 렌더가 어느 시점 형상인가

## P3-3. 고관절·어깨 pivot 후보를 도출하라 (B7)

권위값이 없다면 **현재 메시에서 유도**할 수 있는지 보라. 유도 가능하면 방법과 값을, 불가능하면 왜인지를 적어라.

- 어깨: `Guide_Torso` ↔ `Guide_*_UpperArm` 의 **가중치 경계면**이 곧 어깨 절단면이다. 그 경계 정점들의 무게중심과 반경을 내면 어깨 pivot 후보가 된다.
- 고관절: 허벅지 세그먼트의 근위 끝. `Guide_*_Thigh` 의 위쪽 경계 또는 허벅지 오브젝트 상단 단면에서 유도해 보라.
- 계획서 §단계A 의 hip `(-0.1820, 1.0257, ±0.1013)` 과 비교해 차이를 mm 로 내라.
- 좌우 대칭성을 확인하라 — 페달링 자세라 다리는 비대칭이지만 **고관절·어깨 자체는 대칭이어야 한다.** 비대칭이면 유도가 틀린 것이다.

---

## 산출물

```
apps/web/scripts/rider-cycle-fit/.out/audit/P3-joint-authority.json
apps/web/scripts/rider-cycle-fit/.out/audit/P3-joint-authority.log
```

필수 키:

```
jointLayoutCurrency {
  verdict: "current" | "stale" | "inconclusive",
  passCriteria: "네가 정한 기준과 근거",
  perJoint: { "<joint>": { centerErrMm, radiusErrMm, axisErrDeg, ringsMatch, source: "blend"|"s5", pass } },
  blendVsS5Consistent: true|false
}
releaseDocs      { <파일>: { read: true, findings: "..." } }
partAxesVsJointLayout { same: true|false|null, detail: "..." }
hipShoulderPivot {
  method, derived: { hipL:[x,y,z], hipR:[...], shoulderL:[...], shoulderR:[...] } | null,
  symmetryCheckMm, vsPlanAnchorsMm, confidence: "high"|"medium"|"low"
}
blockers         [ ... ]
verdict          "..."
```

확인 못 한 항목은 `null` + `blockers` 에 이유. 추측값 금지.
**부재를 주장할 때는 탐색 범위를 함께 적어라** (STEP-P2 에서 건 규율).

---

## 보고

채팅에 3줄:
1. `jointLayoutCurrency.verdict` 와 최대 오차 수치
2. 고관절·어깨 pivot 을 확보했는가 (`confidence` 포함)
3. 단계 0 착수를 막는 것이 남아 있는가 — 있으면 무엇

**STOP.** 이것이 마지막 사전 점검이다. 다음은 사용자 승인 후 단계 0 이다.
