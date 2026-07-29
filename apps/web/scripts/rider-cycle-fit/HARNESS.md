# rider-cycle-fit — 하네스 사용법 (HOW)

[SKILL.md](../../../../.claude/skills/rider-cycle-fit/SKILL.md)(왜·언제·PASS/FAIL)를 먼저 읽어라. 이 문서는 **도구를 어떻게 쓰는가**만 다룬다.

별도 제작된 rider GLB와 cycle GLB를 결합·피팅하는 작업의 실행 하네스. 절차 생성 라이더용
[rider-preview](../rider-preview/HARNESS.md)와 별개 — 여기선 **이미 만들어진 두 자산을 고정 입력으로 등록→결합→검증**한다.

## 파일

| 파일 | 역할 | 상태 |
|---|---|---|
| `register-inputs.mjs` | **단계 0** — rider·cycle·fit_ik·joints·geometry·exporter를 입력 해시·경로와 함께 manifest 등록 | ✅ |
| `verify-fit.mjs` | 결합 피팅 **불변식 정적 검사**(안장 파생식·페달 위상 대칭·ETT≠reach·IK오차 필드) | ✅ |
| `extract-glb-meta.py` | (Blender) rider/cycle GLB의 AABB·노드/본·단위·축·원점 추출 → manifest 채움 | ⬜ 미구현 |
| `verify-inputs.mjs` | manifest 입력 해시가 현재 파일과 일치하는지(입력이 바뀌었는지) 검사 | ⬜ 미구현 |
| `render-fit.py` | (Blender) 결합 후보 Static/Pedal 렌더. **위치는 apps/web 밖**(Blender는 three 의존 없음) | ⬜ 미구현 · 현재는 OneDrive `fit_ik.py` |
| `promote-candidate.mjs` | 승인된 결합 GLB를 제품 경로로 byte-for-byte 복사 | ⬜ 미구현 |
| `.out/inputs/` | manifest 산출물(gitignore) | — |
| `.out/candidates/<id>/` | 후보 산출물(gitignore) | — |

## CLI

### register-inputs (단계 0)
```
node scripts/rider-cycle-fit/register-inputs.mjs [--blender 5.2.0] \
  [--rider <path>] [--cycle <path>] [--fitik <path>] [--joints <path>] [--geometry <path>] [--exporter <path>]
```
- 기본 입력 경로는 `DEFAULT_INPUTS`(memory `v24-cyclefit-handoff` 기준). 없는 파일이면 오류.
- 산출: `.out/inputs/manifest-<inputHash>.json` + `manifest-latest.json`.
- `--blender` 로 버전 기록(재현성). AABB·노드는 `extract-glb-meta.py`(미구현)가 채운다.
- **입력 중 하나라도 바뀌면 inputHash가 바뀐다 = 새 결합 후보로 취급.**

### verify-fit (불변식)
```
node scripts/rider-cycle-fit/verify-fit.mjs [--geometry <path>] [--joints <path>]
```
- 위반 있으면 **종료코드 1**(파이프라인 차단). 경고(⚠)는 렌더로 확인할 항목.
- 검사 항목 ↔ SKILL anti-pattern: 안장 파생식(#4)·페달 위상 대칭(#1·#2)·ETT≠reach(#6)·발/손 0mm 의미(#8·#10).
- **정적 검사만** — 형상·비율·관통은 실제 Blender 렌더로 사람이 판정.

## 현재 결합 파이프라인 (OneDrive, 하네스화 전)

실제 결합은 아직 OneDrive 폴더에서 돈다(하네스로 흡수 예정):
- 작업 폴더: `C:/Users/kdrea/OneDrive/Documents/img/v2_4_cyclefit/`
- 관절 재계산: `node scripts/rider-preview/export-ik-joints-v2.mjs <scale> <hipDrop> <hipXoff> <shinRestMm> > ik-joints-v2.json`
- 결합 렌더: `blender --background --python fit_ik.py -- <scale> <lean> [profile] [mode] [gaze]`
- 프레임 후보 계산: `reverse-fit3.mjs`(scratchpad) → HTML 도식

## 재생성

1. 입력 등록: `register-inputs.mjs --blender 5.2.0`
2. 불변식: `verify-fit.mjs` (FAIL 없어야 결합 진행)
3. (미구현) 결합 렌더 → 사용자 승인 → promote

## 미구현 (확장 TODO)

- `extract-glb-meta.py` — 단계 0 완결(AABB·노드/본). 현재 manifest의 riderMeta/cycleMeta는 null.
- `render-fit.py` — OneDrive `fit_ik.py`를 리포 내로 이관(경로를 manifest에 등록). apps/web 밖 별도 경로 권장.
- `verify-inputs.mjs` — 입력 drift 검사.
- `promote-candidate.mjs` — 결합 GLB 제품 승격(노드 계약 확정 후).
- 단계 B/C/D/E 자동화 — Static/Pedal 렌더·결합 GLB 노드 검증.
- verify-fit 확장: 크랭크-발 위상 실제 각도 대조(현재는 좌우 대칭만), 발목-클릿 적용값 코드 스캔.
