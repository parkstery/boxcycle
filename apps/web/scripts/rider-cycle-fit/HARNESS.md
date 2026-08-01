# rider-cycle-fit — 하네스 사용법 (HOW)

[SKILL.md](../../../../.claude/skills/rider-cycle-fit/SKILL.md)(왜·언제·PASS/FAIL)를 먼저 읽어라. 이 문서는 **도구를 어떻게 쓰는가**만 다룬다.

별도 제작된 rider GLB와 cycle GLB를 결합·피팅하는 작업의 실행 하네스. 절차 생성 라이더용
[rider-preview](../rider-preview/HARNESS.md)와 별개 — 여기선 **이미 만들어진 두 자산을 고정 입력으로 등록→결합→검증**한다.

## 파일

| 파일 | 역할 | 상태 |
|---|---|---|
| `register-inputs.mjs` | **단계 0** — 입력 6종 해시·경로 + Blender 메타(AABB·노드/본·프리뷰) manifest 등록 | ✅ |
| `register-anchors.mjs` | **단계 A** — extract-anchors.py로 두 GLB 실제 접점 앵커 추출·저장 + 다리 정본(reconcile) | ✅ |
| `verify-fit.mjs` | 결합 피팅 **불변식 정적 검사**(안장 파생식·페달 위상 대칭·ETT≠reach·IK오차 필드) | ✅ |
| `render-all.py` | Rider Only 4장 + 결합/접점/4위상 29장, 변환행렬·AABB·접점 좌표 manifest | ✅ |
| `render-saddle-evidence.py` | 0.88 안장 게이트: HIP/좌골 메시점/안장 표면 분리 계측 + 일반/반투명 표식 6장 | ✅ |
| `make-saddle-contact-sheet.py` | 안장 증거 6장 전수 contact sheet | ✅ |
| `verify-renders.mjs` | 필수 렌더 해시·해상도·중복 및 동일 inputHash Before/After 검사 | ✅ |
| `verify-saddle-evidence.mjs` | 좌골 정의·3D 오차 성분·BDC/TDC 무릎/고관절각·증거 6장 검사 | ✅ |
| `../../../../blender/rider-cycle-fit/extract-glb-meta.py` | (Blender) GLB AABB·노드/본·단위·축·프리뷰 추출 → register-inputs가 호출 | ✅ |
| `../../../../blender/rider-cycle-fit/extract-anchors.py` | (Blender) rider 본 rest world·cycle 메시 클러스터에서 앵커 추출 → register-anchors가 호출 | ✅ |
| `verify-inputs.mjs` | manifest 입력 해시가 현재 파일과 일치하는지(입력 drift) 검사 | ⬜ 미구현 |
| `render-fit.py` | (Blender) 결합 후보 Static/Pedal 렌더. apps/web 밖(`blender/rider-cycle-fit/`). **승인 요청 전제조건** | ⬜ 미구현 · 현재는 OneDrive `fit_ik.py` |
| `promote-candidate.mjs` | 승인된 결합 GLB를 제품 경로로 byte-for-byte 복사 | ⬜ 미구현 |
| `.out/inputs/manifest-<hash>.json` `anchors-<hash>.json` `preview-<hash>/` | 단계 0·A 산출물(gitignore) | ✅ |
| `.out/candidates/<id>/` | 후보 산출물(gitignore) | — |

## CLI

### register-inputs (단계 0)
```
node scripts/rider-cycle-fit/register-inputs.mjs [--blender 5.2.0] \
  [--rider <path>] [--cycle <path>] [--fitik <path>] [--joints <path>] [--geometry <path>] [--exporter <path>]
```
- 기본 입력 경로는 `DEFAULT_INPUTS`. `--blenderExe <path>` 로 Blender 실행파일(기본 5.2). `--skipMeta` 로 메타 추출 생략(빠른 해시만).
- 산출: `manifest-<inputHash>.json` + `manifest-latest.json` + `preview-<inputHash>/{rider,cycle}-preview.png`.
- `--blender <version>` 로 버전 기록(재현성·해시 반영). AABB·노드/본은 `extract-glb-meta.py`가 채운다.
- **입력 중 하나라도 바뀌면 inputHash가 바뀐다 = 새 결합 후보로 취급.**

### register-anchors (단계 A)
```
node scripts/rider-cycle-fit/register-anchors.mjs [--blenderExe <path>] [--inputHash <hash>]
```
- `manifest-latest.json` 의 inputHash 사용(또는 `--inputHash`). extract-anchors.py 로 두 GLB 실제 앵커 추출.
- 산출: `anchors-<inputHash>.json` — rider 본 rest world 앵커·본길이·cycle 메시 클러스터·reconcile(다리 정본).
- **결합 다리 정본 = GLB 실측 430/350**(reconcile.chosen, 2026-07-29 결정).

### verify-fit (불변식)
```
node scripts/rider-cycle-fit/verify-fit.mjs [--geometry <path>] [--joints <path>]
```
- 위반 있으면 **종료코드 1**(파이프라인 차단). 경고(⚠)는 렌더로 확인할 항목.
- 검사 항목 ↔ SKILL anti-pattern: 안장 파생식(#4)·페달 위상 대칭(#1·#2)·ETT≠reach(#6)·발/손 0mm 의미(#8·#10).
- **정적 검사만** — 형상·비율·관통은 실제 Blender 렌더로 사람이 판정.

### 안장 접촉 증거 게이트
```
node scripts/rider-cycle-fit/run-saddle-gate.mjs
node scripts/rider-cycle-fit/verify-renders.mjs <afterDir> \
  --before <sameInputBeforeDir> --require-before
node scripts/rider-cycle-fit/verify-saddle-evidence.mjs <afterDir>
```
- `HIP_MID`는 배치/IK 기준이며 `SADDLE_CONTACT`가 아니다.
- GLB에 `SADDLE_CONTACT` 본이 없으므로, cycle/안장을 읽기 전에 평가된
  `RTW_RIDER_LOD0`의 `PELVIS` vertex-group을 rider local 좌표에서 좌우 분리하고,
  후방 percentile·하부 percentile 지지 밴드의 좌표별 median을 좌골점으로 확정한다.
  확정 뒤에만 각 좌골점에서 cycle 안장 표면 최근접점을 구한다.
- weight threshold 3종 × 하부 percentile 3종 민감도를 기록하며, 허용 이동을 넘으면
  게이트 PASS를 금지한다. 반려된 안장-최근접 우선 정의는 `legacy.circularNearest`에만 둔다.
- 일반 좌/우/후방 3장과 반투명 표식 좌/우/후방 3장이 모두 필수다.
- 표식: 좌골 적색, 안장 표면 녹색, HIP 황색, 오차 벡터 청록색.
- 안장 위치를 움직이지 않으며, 이 게이트는 제품 승격을 수행하지 않는다.

## 현재 결합 파이프라인 (OneDrive, 하네스화 전)

실제 결합은 아직 OneDrive 폴더에서 돈다(하네스로 흡수 예정):
- 작업 폴더: `C:/Users/kdrea/OneDrive/Documents/img/v2_4_cyclefit/`
- 관절 재계산: `node scripts/rider-preview/export-ik-joints-v2.mjs <scale> <hipDrop> <hipXoff> <shinRestMm> > ik-joints-v2.json`
- 결합 렌더: `blender --background --python fit_ik.py -- <scale> <lean> [profile] [mode] [gaze]`
- 프레임 후보 계산: `reverse-fit3.mjs`(scratchpad) → HTML 도식

## 재생성

1. 입력 등록(단계 0): `register-inputs.mjs --blender 5.2.0`  → manifest + 프리뷰
2. 앵커 추출(단계 A): `register-anchors.mjs`  → anchors + 다리 정본
3. 불변식: `verify-fit.mjs` (FAIL 없어야 결합 진행)
4. (미구현) 결합 렌더(render-fit.py) → 사용자 승인 → promote

## 미구현 (확장 TODO)

- `render-fit.py` — **다음 우선순위**(승인 요청 전제조건). OneDrive `fit_ik.py`를 `blender/rider-cycle-fit/`로 이관. 결합 다리 정본 430/350 사용, 크랭크-발 위상 일치(anti#1·#2), Static(crank 고정)·Pedal(0/90/180/270°) 렌더. 후보 경로 `.out/candidates/<candidateId>/` + UNAPPROVED 오버레이.
- `verify-inputs.mjs` — 입력 drift 검사(manifest 해시 vs 현재).
- `promote-candidate.mjs` — 결합 GLB 제품 승격(노드 계약 확정 후, byte-for-byte).
- 단계 B/C/D/E 자동화 — Static/Pedal 렌더·결합 GLB 노드 검증.
- verify-fit 확장: 크랭크-발 위상 실제 각도 대조(현재는 좌우 대칭만), 발목-클릿 적용값 코드 스캔, anchors 다리 정본과 ik-joints 대조.
- extract 카메라 개선: 현재 AABB 프리뷰 카메라가 정면 원근으로 전고 과대 표기(rider z_up 2778mm) — 직교/측면 뷰로.
