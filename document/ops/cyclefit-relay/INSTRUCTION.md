# 감리 → 개발팀장 지시서 (활성)

> **개발팀장 읽는 법**: 이 파일이 현재 유효한 지시다. 작업을 마치면 기존 `REPORT.md`를
> `REPORT-<이전지시번호>.md`로 보존한 뒤 새 `REPORT.md`를 쓰고, 이 파일 맨 위 `상태`를
> `보고완료`로 바꿔라.

- **지시번호**: F10 (커밋 + IK 해 불일치 해결)
- **발신**: 클로드감리0731
- **수신**: 개발팀장 (새 창)
- **일시**: 2026-08-01
- **상태**: 지시중

---

## 0. 새 창이라면 먼저 읽어라

**`document/ops/cyclefit-relay/HANDOFF.md` 를 반드시 먼저 읽어라.**
확정값·작업 규율·금지사항·주요 파일이 전부 거기 있다. 그 다음 이 지시서를 수행한다.

---

## 1. F9 감리 결과 — **미완이나 처신은 옳았다**

| 항목 | 결과 |
|---|---|
| 감리 709.2 독립 검산 | 전 구간 소수점까지 일치 ✔ |
| 값 적용 | `saddleHeight` 709.2 · AB 217.9 · AU 37.0 · hipDrop 88.0 ✔ |
| `jointsFreshness` assert | 신설·PASS ✔ |
| `footContactAssertions` assert | 신설. **실제로 렌더를 막았다** ✔ |
| **발이 페달에 닿았는가** | **아니다** — 좌 29.2mm · 우 12.2mm (허용 5.0) |

**assert를 완화하지 않고 FAIL로 보고한 것이 정확한 처신이다.** 그동안 "발이 안 닿는데
렌더는 성공"이 세 번 반복됐는데, 이번에 처음으로 파이프라인이 스스로 막았다.
원인 규명(관절별 추적으로 무릎 32mm 어긋남 특정)도 정확하다.

---

## 2. F10-A 【먼저】 커밋

미커밋 8건이 있다. **F9 산출물은 보존 가치가 높다** — assert 2종은 앞으로 모든 사고를
막는 장치이고, 실측 가정값은 다시 재기 어렵다.

### 2-1. 커밋 대상

**커밋 1 — 렌더 검증 assert 2종 신설**
```
apps/web/scripts/rider-cycle-fit/render-all.py          발접촉·joints신선도 assert
apps/web/scripts/rider-cycle-fit/measure-assumptions.py 발·골반 메시 실측 도구(신규)
```
메시지 예: `feat(cyclefit): 발접촉·joints신선도 assert — 안 닿으면 렌더를 실패시킨다`

**커밋 2 — 실측 가정값 + 안장 높이 역계산**
```
apps/web/scripts/rider-preview/export-ik-joints-v2.mjs  AB 217.9·AU 37.0 실측값
apps/web/src/lib/riderPrototype/geometry.json           saddleHeight 709.2
```
메시지 예: `fix(rider): 발목·hipDrop 을 메시 실측값으로 교체, 안장 709.2 역계산`

**커밋 3 — 중계 채널 문서**
```
document/ops/cyclefit-relay/*.md   (HANDOFF·INSTRUCTION·REPORT·REPORT-F7·F8)
```
메시지 예: `docs(ops): Cycle-Fit 감리 중계 채널 — 인수인계·지시·보고`

### 2-2. 커밋 규칙

- pre-commit 훅이 파일 전체 lint로 막으면, **내 변경분이 오류를 늘리지 않았음을 확인 후 보고.**
  `--no-verify`는 **감리 승인 없이 쓰지 마라**
- **push 하지 마라.** 로컬 커밋까지만
- 제품 GLB는 건드리지 않는다

---

## 3. F10-B 【핵심】 IK 해 불일치 해결

### 3-1. 문제 (F9에서 규명 완료 — 재조사 불필요)

joints 계산은 발 오차 0mm인데 Blender 실측은 좌 29.2mm.

| 관절 | joints | Blender | 차이 |
|---|---|---|---|
| HIP | −206.4, 81.4, 862.5 | 동일 | 1.0mm ✔ |
| **무릎** | −180.6, **−77.6**, 485.0 | −182.6, **−65.2**, 514.4 | **32.0mm** ✘ |
| 발목 | −217.9, −74.0, 135.0 | −215.2, −73.3, 164.1 | 29.2mm ✘ |
| 본 길이 | 378.4 / 352.0 | 동일 | ✔ |

**HIP도 본 길이도 같은데 무릎만 어긋난다.** 두 층이 다른 IK를 쓰기 때문이다:
- `export-ik-joints-v2.mjs` → `solveIk3D` (pole vector 해석해)
- `fit_ik.py` → `aim_bone` 2단계 (THIGH를 무릎으로 조준 → SHIN을 발목으로 조준)

### 3-2. 해결 방향

**joints를 단일 진실로 삼아라.** `fit_ik.py`가 IK를 다시 풀지 말고, joints가 이미 계산한
**무릎·발목 좌표를 그대로 재현**하게 한다.

구체적으로는 당신이 판단하라. 감리가 보는 선택지:

- (A) `fit_ik.py`에서 THIGH·SHIN을 **joints의 무릎·발목 world 좌표에 직접 정렬** —
  `aim_bone` 누적 오차를 없앤다. 롤(축 회전)이 남으면 무릎 z가 어긋나므로 그 처리도 필요
- (B) 두 층이 **같은 solver**를 쓰게 통일 — `solveIk3D`를 Python으로 이식
- (C) Blender IK 컨스트레인트 + pole target 사용

**(A)를 권하나 확정 지시는 아니다.** 당신이 코드를 보고 판단해 근거와 함께 보고하라.
어느 쪽이든 **본 길이(378.4 / 352.0)는 유지**되어야 한다.

### 3-3. 합격 기준

- **`footContactAssertions` PASS** — 좌·우 모두 5mm 이내
- 나머지 assert 3종도 PASS
- 본 길이 불변, 프레임 불변

---

## 4. 렌더 (사용자 승인용)

1. **`FULL_BDC_R.png`** — 오른발 BDC·왼발 TDC. **보고서 최상단**
   → **발이 페달에 실제로 얹혀 있어야 한다.** 이것이 사용자가 다섯 번 요구한 그림이다
2. `BDC_R_LOWPOINT.png` — 발 최저점 vs 페달 최저점 + 수직거리 수치
3. 안장–엉덩이 접합부 확대 (팬츠 RED)
4. Before/After — Before = F7-AFTER, After = F10
5. **assert 4종 전부 PASS**

후보 경로: `.out/candidates/20260801-F10-*/`

---

## 5. 절대 금지

`HANDOFF.md` §2 확정값 전부 + §4-7 기본 금지. 특히:

- **프레임 변경 금지**: headTube 85 · stack 496.5 · reach 411.3 · seatTubeLength 560 ·
  seatTubeAngle 73.5 · headBot · 헤드각 73° — **사용자 최종 승인 형태다**
- **`crankLength` 172.5 · 허벅지 430 · 정강이 400 · scale 0.88 변경 금지**
- **`saddleHeight` 709.2 변경 금지** — 검산 완료된 역계산값
- **assert 허용치 완화 금지** — 안 닿으면 안 닿는다고 보고하라
- **push 금지** / 제품 GLB 덮어쓰기 금지 / `RTW_GLB_OUT` 사용
- SSoT → 메시 단방향. 메시에 맞춰 `geometry.json` 고치지 마라

---

## 6. 보고 방법

기존 `REPORT.md` → `REPORT-F9.md` 보존 후 새 `REPORT.md` 작성.

- **모델 사용 내역** (`HANDOFF.md` §4-6)
- **커밋 3건 해시** + `git log --oneline`
- **§3-2 어느 방향을 택했고 왜인가**
- **`footContactAssertions` 실측 — 좌·우 몇 mm.** 이것이 합격 판정이다
- assert 4종 전부의 실측값
- BDC 무릎 실측 각도 (목표 10°)
- **`FULL_BDC_R.png` 절대경로 — 최상단**
- 생성 이미지 절대경로 전체 목록 (선별 금지)
- 실패·미완·막힌 항목 (숨기지 말 것)
- **이견이 있으면 쓰라.** 감리도 틀린다 — F6~F8에서 혼합좌표로 큰 실수를 했다.
  감리 수치를 검산하는 것이 당신 일의 일부다
