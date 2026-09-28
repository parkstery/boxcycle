# 작업지시 — 단계 P2 (B4 재조사) · 읽기 전용

발행: 수퍼바이저 세션 · 2026-09-19
집행: Claude Code @ `C:\20.HDev\boxcycle` (브랜치 `rider/20260919-natural-joint-skin`)
선행: `STEP-P.md` 완료 (`P-precheck.json` 판정 READY WITH CONDITIONS)

---

## 왜 이 지시가 나왔는가 — 네 B4 는 틀렸다

`P-precheck.json` 의 `stripNodeRest.alternativeChecked` 에 이렇게 적었다:

> "리포 안에 세그먼트별 강체 정점 회전(un-pose)을 수행하는 도구는 없다."

**틀렸다. 있다.** 수퍼바이저가 직접 확인했다:

```
blender/rider-cycle-fit/decompose-v2-rider.py:169
    rot = d.normalized().rotation_difference(DOWN_BLENDER).to_matrix()
blender/rider-cycle-fit/decompose-v2-rider.py:218-220
    M = xf["rot"].to_4x4() @ Matrix.Translation(-xf["origin"]) @ BASE_MW
    o.data.transform(M)          # ← 세그먼트별 정점을 강체 회전
    o.matrix_world = Matrix.Identity(4)
```

본 방향을 `-Y` 로 정렬하는 회전을 구해 **정점에 직접 적용**한다. 정확히 un-pose 다.
게다가 F16 에서 **외부 스킨드 GLB 를 앱 계약 노드로 분해하는 데 실제로 성공한 선례**의 본체다.

**원인 분석 — 책임은 절반이 지시서에 있다.** `STEP-P.md` P-7 의 도구 목록이 `apps/web/scripts/` 이하만 열거했고, 리포 루트의 `blender/` 를 넣지 않았다. 너는 그 목록을 충실히 따랐다.

**그러나 네 잘못도 있다.** 너는 목록 범위를 확인했을 뿐인데 `"리포 안에 … 도구는 없다"` 라는 **전역 부정**을 단정했다. 근거 범위를 넘는 주장이다. 앞으로 부재(不在)를 주장할 때는 **어디를 찾아봤는지 범위를 함께 적어라.** 범위를 밝히지 않은 전역 부정은 감사에서 기각한다.

---

## 이번 지시의 범위

**읽기 전용이다.** 코드·GLB·BLEND 를 **수정하지 않는다.** 끝나면 STOP.

절대 하지 않는 것:
- `.blend` 파일 저장·덮어쓰기 (Blender 는 `--background --factory-startup` 으로 열고 **저장하지 않는다**)
- 제품 GLB·입력 GLB 변경
- `decompose-v2-rider.py` 등 기존 스크립트 수정
- 후보 GLB 생성 · 단계 0 실행
- `--no-verify`

---

## P2-1. BLEND 에 아마추어가 있는가 — 이게 핵심이다

```
C:\Users\kdrea\OneDrive\Documents\img\helmet_fix\revision\20260919-natural_joint_skin\roadcyclist_natural_joint_skin.blend
```

`decompose-v2-rider.py` 는 **스킨드 메시를 전제한다**:
- `rider.vertex_groups` (96행)
- pose bone 의 `eval_head`/`eval_tail` (146·167행)
- `Armature modifier apply` (179행)

그런데 **입력 GLB 는 `skins 0` · 210개 평면 노드 · 아마추어 없음**이다. 따라서 GLB 를 이 스크립트에 먹일 수 없다.
**BLEND 에 아마추어가 살아 있다면 경로가 열린다.**

Blender 를 headless 로 띄워 **읽기만** 하고 아래를 조사하라. 조사 스크립트는 `.out/audit/` 아래에 두고 커밋하지 않는다.

- 아마추어 오브젝트 존재 여부 · 이름 · **본 개수**와 **본 이름 전체 목록**
- 스킨드 메시 오브젝트 목록 · 각각의 정점 수 · `vertex_groups` 이름 목록
- Armature modifier 가 실제로 걸려 있는가
- 각 본의 head/tail 월드 좌표 (최소한 다리·팔·골반·어깨 계열)
- 씬 단위(unit scale) · 오브젝트 transform (scale 이 1 이 아닌 것이 있는가)
- 현재 포즈 상태 — rest pose 인가 페달링 포즈인가. pose bone 중 rotation 이 identity 가 아닌 것의 개수
- 액션/드라이버/셰이프키 존재 여부 (과거 교훈: 외부 자산이 애니메이션을 몰래 들고 온다)

## P2-2. BLEND ↔ GLB 차이를 수치로 확정하라

계획서 §0 은 "BLEND 는 wheel_fix 미반영 — GLB 와 동일 소스가 아니다" 라고만 적었다. **얼마나 다른지**가 경로 선택을 가른다.

- BLEND 의 메시 총 정점 수 · 총 삼각형 수 ↔ 입력 GLB(정점·렌더 삼각형 53,514 / 고유 52,434)
- BLEND 의 전체 AABB ↔ 입력 GLB AABB
- **휠 부분만** 따로 비교 — wheel_fix 가 무엇을 바꿨는지 좌표로 특정할 수 있는가
- 라이더 본체(휠 제외)는 BLEND 와 GLB 가 **동일한가** — 동일하다면 "BLEND 로 분해하고 휠만 GLB 에서 가져온다" 는 경로가 성립한다. 이 판정이 이번 조사의 목표다.

`휠_흔들림_수정_보고서.md` 가 릴리스 폴더에 있으면 읽고 wheel_fix 가 무엇을 했는지 요약하라.

## P2-3. `decompose-v2-rider.py` 재사용 가능성 평가 (소스 읽기만, 실행 금지)

이 스크립트를 이번 입력에 쓰려면 무엇을 고쳐야 하는지 **구체적으로** 적어라.

1. **본 이름 의존** — `GROUPS`(48행)·`BONE_OF` 가 V2 자산(`THIGH_L` 등)에 하드코딩돼 있다. 신규 BLEND 의 본 이름(P2-1 결과)과 대조해 **매핑 가능한가 / 이름이 달라 재작성이 필요한가**를 본 단위로 판정하라.
2. **노드 수** — 이 스크립트는 **10노드** 시대 산출물이다(헤더 1행). 현재 앱 계약은 **14노드**(`ankle_l/r`·`pedal_l/r` 추가). 어디를 늘려야 하는가.
3. **좌우 규칙** — 헤더 17-20행이 "앱 `_l` 에 V2 `_R` 본을 붙인다" 고 못박았다. 신규 모델은 계획서 §2-1 이 "모델 R(+Z) → 앱 `_l`" 이라 했다. **같은 규칙인가 반대인가**를 좌표로 확인하라(여기서 틀리면 다리가 몸을 가로지른다).
4. **외부 의존** — 2-3행이 `render-all.py` 를 `exec` 로 끌어 쓰고 `JOINTS`·`CYCLE_IN`·`TILT`·`UARM` 인자를 받는다. 이 의존이 신규 입력에서도 성립하는가, 아니면 끊어내야 하는가.
5. **결론** — 다음 중 하나로 판정하고 근거를 대라:
   - `reuse-with-config` (인자·매핑만 바꾸면 됨)
   - `reuse-with-code-change` (코드 수정 필요 — 어느 함수 몇 줄인지 명시)
   - `rewrite` (새로 짜야 함 — 이유)
   - `not-applicable` (BLEND 에 아마추어가 없는 등 — 그 경우 대안을 제시)

## P2-4. `P-precheck.json` 의 B4 를 정정하라

`P-precheck.json` 을 수정해 `stripNodeRest.alternativeChecked` 와 `blockers[B4]` 를 사실에 맞게 고쳐라. **다른 필드는 건드리지 마라.** 고친 자리에 `correctedBy: "STEP-P2"` 를 남겨라.
B4 는 이제 "도구 부재"가 아니라 **"기존 un-pose 도구가 신규 입력을 직접 먹지 못함"** 이다. 심각도를 재평가하라.

---

## 산출물

```
apps/web/scripts/rider-cycle-fit/.out/audit/P2-blend-inspect.json
apps/web/scripts/rider-cycle-fit/.out/audit/P2-blend-inspect.log   (blender stdout 전문)
```

`P2-blend-inspect.json` 에 담을 것 — 스키마는 자유롭게 정하되 아래 키를 반드시 포함:

```
armature            { exists, name, boneCount, boneNames[], posedBoneCount, actions[], drivers, shapeKeys }
skinnedMeshes       [ { name, verts, vertexGroups[], hasArmatureModifier } ]
boneHeadTailWorld   { <bone>: { head:[x,y,z], tail:[x,y,z] } }
blendVsGlb          { blendVerts, glbVerts, blendTris, glbTris, blendAabb, glbAabb,
                      riderBodyIdentical: true|false|null, wheelDiffSummary }
decomposeReuse      { verdict, boneNameMapping{}, nodeCountGap, sideRuleSameAsV2: true|false|null,
                      externalDeps[], changesNeeded[] }
sideRuleEvidence    "좌표로 확인한 근거"
blockers            [ ... ]   ← 새로 발견한 것만
verdict             "..."
```

확인 못 한 항목은 **`null` + `blockers` 에 이유**. 추측값 금지.

---

## 보고

채팅에는 4줄만:
1. BLEND 에 아마추어가 있는가 (본 개수)
2. 라이더 본체가 BLEND ↔ GLB 동일한가
3. `decomposeReuse.verdict`
4. B4 재평가 결과

그리고 **STOP.** 단계 0 은 사용자 승인 전까지 실행하지 않는다.
