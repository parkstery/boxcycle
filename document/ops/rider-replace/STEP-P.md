# 작업지시 — 단계 P (사전 점검) · 읽기 전용 + 브랜치 생성까지

발행: Cowork 감사 세션 (Opus) · 2026-09-19
집행: Claude Code @ `C:\20.HDev\boxcycle`
근거 계획서: `document/260919-RTW-라이더-GLB-교체-작업계획.md` (rev.2) — **먼저 전문을 읽을 것**

---

## 이번 지시의 범위

**단계 P 만 수행한다.** 끝나면 **STOP** 하고 보고한다. 사용자 승인 없이 단계 0 으로 넘어가지 않는다.

### 절대 하지 않는 것

- `apps/web/public/rider/prototype/rider-lowpoly.glb` 를 **읽기 외에 어떤 방식으로도 건드리지 않는다**
- 제품 코드·rig 상수·scale·검증 기준 **수정 금지**
- GLB 생성·메시 절단·joint cap·후보 promote **금지**
- `git reset` / `git stash` / `git checkout <파일>` 로 **사용자의 기존 변경을 건드리지 않는다**
- 계획서와 실제 코드가 다르면 **코드를 고치지 말고 차이를 보고한다**
- `--no-verify` 사용 금지

---

## 수행할 것

### P-1. Git 상태

```powershell
cd C:\20.HDev\boxcycle
git branch --show-current
git status --porcelain
git log --oneline -3
```

- 작업트리에 변경(수정/추가/삭제)이 있으면 **거기서 멈추고 보고**한다. 정리하지 않는다.
  - 예외: `document/260919-RTW-라이더-GLB-교체-작업계획.md` 는 이번 작업을 위해 Cowork 세션이 새로 넣은 파일이다. 이것만 있으면 진행해도 된다.
- 깨끗하면(또는 위 예외뿐이면) 브랜치를 만든다.
  ```powershell
  git checkout -b rider/20260919-natural-joint-skin
  ```
- 같은 이름의 브랜치가 **이미 있으면 새로 만들지 말고** 그 사실과 현재 상태를 보고한다.

### P-2. Blender 가용성 — 이게 단계 0 의 전제다

`apps/web/scripts/rider-cycle-fit/register-modelling-baseline.mjs` 는 시작하자마자
`execFileSync(blender, ['--version'])` 를 부르고, 이어서 `blender --background --python` 을 실행한다.
**Blender 가 없으면 단계 0 은 즉시 실패한다.**

확인할 것:
- 스크립트가 `--blender` 플래그 없이 쓰는 **기본 경로 문자열**을 소스에서 찾아 그대로 인용한다
- 그 경로에 실제로 실행 파일이 있는가
- 없다면 시스템에 설치된 Blender 의 실제 경로와 버전 (`where blender`, `Get-Command blender`, 또는 `C:\Program Files\Blender Foundation\` 하위 탐색)
- 결과: **사용 가능 / 경로만 다름(실제 경로 명시) / 미설치** 셋 중 하나로 판정

### P-3. 입력 GLB 확인

```
C:\Users\kdrea\OneDrive\Documents\img\helmet_fix\revision\20260919-natural_joint_skin\20260919_03-wheel-wobble-fix\roadcyclist_s5_wheelfix.glb
```

- 파일 존재 여부
- 크기 (bytes)
- SHA-256 — PowerShell: `Get-FileHash -Algorithm SHA256 <경로>`
- **기대값과 대조**: size `1,752,892` · SHA-256 `1108aa3e37615eef037984a0cdf80018b840a043c6e62f6750f828646b6b1ffb`
- 불일치하면 **BLOCKER** 로 보고하고 멈춘다

BLEND 도 존재만 확인 (해시 불필요):
```
C:\Users\kdrea\OneDrive\Documents\img\helmet_fix\revision\20260919-natural_joint_skin\roadcyclist_natural_joint_skin.blend
```

### P-4. 제품 GLB 무결성 확인 (읽기만)

```
apps/web/public/rider/prototype/rider-lowpoly.glb
```
- 크기 · SHA-256
- **기대값**: size `1,252,188` · SHA-256 `a9d0d6716c09a1edcd02bb968a07d16e0cf1f625ced7c33b19a5ef499f5268b8`
- 불일치하면 **BLOCKER** — 제품 GLB 가 이미 변경된 것이므로 멈추고 보고

### P-5. 계획서 §2 노드 계약 검산

계획서 §2 는 제품 GLB 를 파싱해 얻은 실측값이다. **같은 값이 나오는지 독립적으로 확인**한다.
`three` 는 devDependency 로 이미 있으므로 짧은 node 스크립트를 임시로 써도 되고, 기존 도구를 써도 된다.
**임시 스크립트는 리포에 커밋하지 말고 `apps/web/scripts/rider-cycle-fit/.out/audit/` 아래에 둔다.**

확인 항목:

| 항목 | 계획서가 주장하는 값 |
|---|---|
| 14노드 전부 존재 | crank, pedal_l/r, torso, leg_l/r, leg_l/r_shin, ankle_l/r, arm_l/r, arm_l/r_fore |
| 계층 | 전부 `RiderBike` 직속, 단 pedal_* 는 crank 자식, shin 은 leg 자식, ankle 은 shin 자식, *_fore 는 arm 자식 |
| `leg_l.z` | **+0.0814** |
| `leg_r.z` | **−0.0814** |
| `arm_l.z` | **+0.1804** |
| `arm_r.z` | **−0.1804** |
| `leg_l_shin` 로컬 T | **(0, −0.37840, 0)** |
| `ankle_l` 로컬 T | **(0, −0.35200, 0)** |
| `arm_l_fore` 로컬 T | **(0, −0.33483, 0)** |
| 노드 회전 | **crank 만 non-identity, 나머지 13개는 identity** |
| skins / animations | **0 / 0** |

### P-6. rig 상수 ↔ 노드 오프셋 일치 확인

`apps/web/src/lib/riderPrototype/riderRig.geometry.mjs` 에서 다음 값을 읽어 P-5 의 노드 오프셋과 **같은지** 확인한다.

`THIGH_LEN` · `SHIN_LEN` · `UPPER_ARM_LEN` · `FOREARM_LEN` · `PELVIS_HALF_Z` · `SHOULDER_HALF_Z` · `CRANK_ARM_M` · `HIP_GROUND` · `BB`

그리고 **하드코딩 3중 공유**가 실제로 있는지 확인한다:
`verify-rider-glb.mjs` 의 `IK_INVARIANTS` ↔ `riderGlbPedalPose.pose.mjs`(및 그것이 import 하는 geometry) ↔ `generate-rider-prototype-glb.mjs`.
**어느 파일에 어떤 값이 하드코딩돼 있는지 파일·라인 번호로 적는다.**

### P-7. 도구 존재 확인 (실행하지 말고 존재만)

```
apps/web/scripts/rider-cycle-fit/clip-node-mesh.mjs
apps/web/scripts/rider-cycle-fit/add-joint-caps-v2.mjs
apps/web/scripts/rider-cycle-fit/joint-continuity.mjs
apps/web/scripts/rider-cycle-fit/segment-penetration.mjs
apps/web/scripts/rider-cycle-fit/subdivide-mesh.mjs
apps/web/scripts/rider-cycle-fit/strip-node-rest.mjs
apps/web/scripts/rider-cycle-fit/rotate-rider-nodes.mjs
apps/web/scripts/rider-cycle-fit/verify-fit.mjs
apps/web/scripts/rider-cycle-fit/register-modelling-baseline.mjs
apps/web/scripts/rider-preview/verify-rider-glb.mjs
apps/web/scripts/rider-preview/promote-candidate.mjs
```

각각에 대해: 존재 여부 · `--help` 또는 인자 없이 실행했을 때의 usage 문자열(부작용 없는 것만) · **CLI 인자 목록을 소스에서 읽어 정리**.

특히 두 가지를 확정한다:
1. `register-modelling-baseline.mjs` 가 `--release` `--rider-glb` `--rider-blend` `--source-task` `--evidence` 를 실제로 받는가
2. manifest 스키마에 **BLEND 와 GLB 의 불일치를 기록할 필드가 있는가** (없으면 "없음" 으로 명시)

`strip-node-rest.mjs` 는 계획서에서 rest 자세 복원(un-pose)에 쓸 도구로 지목했다. **실제로 그런 일을 하는 스크립트인지 소스를 읽고 판정**한다. 아니면 그렇게 보고한다.

### P-8. 안전 검증 — verify 스크립트가 지금 무엇을 말하는가

**제품 GLB 를 대상으로** 읽기 전용 검증을 돌린다(파일을 바꾸지 않는다).
```powershell
node apps/web/scripts/rider-preview/verify-rider-glb.mjs
node apps/web/scripts/rider-cycle-fit/verify-fit.mjs
```
출력 전문을 그대로 기록한다. 지금은 통과해야 정상이다. 실패하면 그것도 보고 대상이다.

---

## 산출물 — 이게 감사의 대상이다

**반드시** 아래 경로에 파일로 남긴다. 채팅 출력만으로는 감사할 수 없다.

```
apps/web/scripts/rider-cycle-fit/.out/audit/P-precheck.json
apps/web/scripts/rider-cycle-fit/.out/audit/P-verify-output.txt
```

`P-precheck.json` 스키마:

```json
{
  "step": "P",
  "runAtKst": "2026-09-19T00:00:00+09:00",
  "git": {
    "branchBefore": "...",
    "branchAfter": "...",
    "createdBranch": true,
    "dirtyFiles": [],
    "headCommit": "..."
  },
  "blender": {
    "defaultPathInScript": "...",
    "exists": false,
    "resolvedPath": null,
    "version": null,
    "verdict": "available | path-differs | not-installed"
  },
  "inputGlb": {
    "path": "...",
    "exists": true,
    "bytes": 0,
    "sha256": "...",
    "matchesExpected": true
  },
  "productGlb": {
    "path": "...",
    "bytes": 0,
    "sha256": "...",
    "matchesExpected": true,
    "unmodified": true
  },
  "nodeContract": {
    "allFourteenPresent": true,
    "missing": [],
    "hierarchy": { "pedal_l": "crank", "leg_l_shin": "leg_l", "...": "..." },
    "localTranslations": { "leg_l": [0,0,0], "...": [0,0,0] },
    "nonIdentityRotations": ["crank"],
    "skins": 0,
    "animations": 0,
    "planClaimsMatch": true,
    "mismatches": []
  },
  "rigConstants": {
    "THIGH_LEN": 0,
    "SHIN_LEN": 0,
    "UPPER_ARM_LEN": 0,
    "FOREARM_LEN": 0,
    "PELVIS_HALF_Z": 0,
    "SHOULDER_HALF_Z": 0,
    "CRANK_ARM_M": 0,
    "HIP_GROUND": [0,0],
    "BB": [0,0,0],
    "matchesNodeOffsets": true,
    "hardcodeSites": [
      { "file": "...", "line": 0, "symbol": "...", "value": "..." }
    ]
  },
  "tools": [
    { "path": "...", "exists": true, "cliArgs": ["..."], "note": "..." }
  ],
  "registerBaseline": {
    "acceptsRelease": true,
    "acceptsRiderGlb": true,
    "acceptsRiderBlend": true,
    "acceptsSourceTask": true,
    "acceptsEvidence": true,
    "blendGlbDivergenceField": null
  },
  "stripNodeRest": {
    "doesUnpose": true,
    "evidence": "파일:라인 인용"
  },
  "blockers": [
    { "id": "B1", "problem": "...", "evidence": "...", "impact": "...", "recommendation": "..." }
  ],
  "verdict": "READY | READY WITH CONDITIONS | BLOCKED",
  "verdictReason": "..."
}
```

- 확인하지 못한 항목은 **`null` 로 두고 `blockers` 에 이유를 적는다.** 추측값을 넣지 않는다.
- `.out/` 은 gitignore 대상이다. 커밋하지 않아도 된다.

---

## 보고

채팅에는 아래만 간단히 낸다(상세는 JSON 이 담당).

1. Git 상태 (브랜치 생성 여부 포함)
2. 계획서 대비 불일치 항목 표 — 항목 / 계획서 / 실제 / OK·DIFF
3. BLOCKER 목록 (있으면)
4. **`READY` / `READY WITH CONDITIONS` / `BLOCKED`** 중 하나와 그 이유

그리고 **거기서 멈춘다.** 다음 지시를 기다린다.
