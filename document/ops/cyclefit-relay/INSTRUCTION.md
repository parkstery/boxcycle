# 감리 → 개발팀장 지시서 (활성)

> **개발팀장0731 읽는 법**: 이 파일이 현재 유효한 지시다. 작업을 마치면 기존 `REPORT.md`를
> `REPORT-<이전지시번호>.md`로 보존한 뒤 새 `REPORT.md`를 쓰고, 이 파일 맨 위 `상태`를
> `보고완료`로 바꿔라.

- **지시번호**: F7 (프레임 회귀 교정 + 커밋)
- **발신**: 클로드감리0731
- **수신**: 개발팀장0731
- **일시**: 2026-08-01
- **상태**: 지시중

---

## 0. 【중대】 F6 전체 반려 — 구프레임으로 렌더했다

사용자가 F6 렌더를 보고 **"내가 힘들여 고쳐 놓은 자전거를 또 건드려서 탑튜브를 위로 올려
놓았다"** 고 지적했다. 감리가 검증한 결과 **사용자 지적이 정확하다.**

### 0-1. 증거 (감리 실측)

| | F5-AFTER (사용자 최종 승인) | F6-AFTER / F6-LEMOND |
|---|---|---|
| 헤드튜브 | 짧다 — 탑튜브·다운튜브 거의 맞닿음 | **길다 — 세로로 뚜렷** |
| 탑튜브 | 낮고 슬로핑 | **높고 수평에 가깝다** |
| 앞삼각 | 닫힌 삼각형 | **사각형에 가까움** |

**원인 — 렌더가 읽은 cycle GLB가 F1 이전 구프레임이다:**

```
C:/Users/kdrea/OneDrive/Documents/img/v2_4_cyclefit/cycle-only.glb
  수정시각 2026-07-30 01:40   ← F1(7/31)보다 이전
  MD5      78e61ce777d66a9dabfddb108b53716d
```

이 해시는 F1 후보의 `cycle-only-before.glb`(**헤드튜브 165 구프레임**)와 **완전 일치**한다.
신프레임은 `3d9625112fa69af1bbeb1fdd6053aaff` 로 해시가 다르다.

즉 F1~F4에서 고친 프레임은 **후보 폴더 안에만 있고**, `render-all.py`가 기본으로 읽는
OneDrive 파일은 **7월 30일 구프레임 그대로**다. `CYCLE_PATH`(7번째 인자)를 넘기지 않으면
구프레임이 로드된다. **F6에서 그 인자가 빠졌다.**

### 0-2. 반려 범위

**F6 결과 전체가 무효다.** 역계산 999.3도, LeMond 724.1 비교도 **구프레임 위에서 계산된
값**이라 신뢰할 수 없다. 재실행해야 한다.

### 0-3. 감리 자신의 실패도 기록한다

감리는 `geometry.json`의 `headTubeLength 85`만 확인하고 "프레임 불변"으로 판정했다.
**SSoT 수치가 맞아도 렌더에 쓰인 GLB가 그 수치로 구워졌는지는 별개다.** 이것은 F1에서
감리가 직접 찾아낸 버그와 **똑같은 구조**인데 다시 놓쳤다. 아래 §1-3 assert는 감리 자신을
포함해 누구도 같은 실수를 못 하게 하려는 것이다.

---

## 1. F7-A 【최우선】 프레임 회귀 차단 — 구조적으로 막아라

### 1-1. 신프레임 GLB를 정본으로 확정

OneDrive `cycle-only.glb`(구프레임)를 **F4 결과 신프레임으로 교체**하라.

- 교체 전 구프레임을 `cycle-only.glb.pre-F7.bak` 으로 백업
- 교체 후 MD5를 보고서에 기록
- 신프레임 = F4에서 생성한 최신 자전거 GLB(헤드튜브 85·시트튜브 junction 단축·
  시트포스트 축 정렬·스페이서 프레임색 전부 반영된 것)
- **없으면 지금 재생성하라** — `RTW_GLB_OUT`으로 굽고, 그것을 정본으로 삼는다

### 1-2. manifest에 cycle GLB 출처 기록 의무화

현재 `render-manifest.json`의 `params`에 **cycle GLB 경로·해시가 없다.** 그래서 어떤
자전거로 렌더했는지 사후 감리가 불가능하다. **하네스 설계 결함이다.**

- `params`에 `cycleGlbPath`(절대경로) · `cycleGlbSha256` · `cycleGlbMtime` 추가
- rider GLB도 동일하게 기록

### 1-3. 렌더 직후 프레임 검증 assert 추가 (핵심)

크랭크 위상 `_assert_crank_phase()`를 만든 것과 **같은 방식**으로 프레임도 막아라.

- 로드된 cycle GLB 메시에서 **헤드튜브 길이를 실측**
- `geometry.json`의 `headTubeLength`(85)와 **±1mm** 넘게 다르면 `RuntimeError`로 렌더 중단
- 같은 방식으로 **탑튜브 후단 y**(= `seatTubeJunction` 393.1)도 검증
- 결과를 manifest `frameAssertions`에 기록

**이 assert가 있었다면 F6은 렌더 시작도 못 했을 것이다.** 이것이 이번 작업의 핵심이다.

---

## 2. F7-B 커밋 — 사용자 지시

사용자: **"혼선이 생기지 않도록 커밋이 필요한 부분까지 진행해."**

현재 HEAD `a2706ab`, 미커밋 34개. F1~F4의 프레임 수정이 워킹트리에만 있어 이번 같은
혼선이 반복된다. **감리가 분류를 확정했다. 아래대로 커밋하라.**

### 2-1. 먼저 되돌릴 것 — `saddleHeight`

`geometry.json`의 `saddleHeight`가 **999.3으로 남아 있다.** 이는 F6에서 폐기된 탐색값이며
구프레임 기준이라 무효다. **커밋 전에 725로 되돌려라.**

- `saddleHeight` 999.3 → **725** (F4 시점 값, LeMond 724.1과 ±1mm)
- `coords.saddle` 은 파생 재계산 → [-226, 695]
- `$note_saddleF5` 주석은 **이력으로 남기되** 현재 값이 725임을 명시하도록 갱신
- 최종 안장 높이는 F8에서 신프레임 기준으로 재역산한다

### 2-2. 커밋 대상 (감리 확정)

**커밋 1 — 검증 하네스** (신규 파일 27개)

```
apps/web/scripts/rider-cycle-fit/*.mjs, *.py   (13개)
blender/rider-cycle-fit/*.py                    (13개)
document/ops/                                   (중계 채널 + 지시서·보고서)
```
메시지 예: `feat(cyclefit): 결합 피팅 검증 하네스 — 렌더·계측·게이트`

**커밋 2 — 프레임 구조 교정** (사용자 승인분)

```
apps/web/scripts/generate-rider-prototype-glb.mjs   프레임 SSoT 파생·시트튜브 분할·스페이서 색
apps/web/src/lib/riderPrototype/riderRig.geometry.mjs  HEAD_TOP/BOT·시트튜브 export
apps/web/src/lib/riderPrototype/geometry.json       headTubeLength 85·stack·reach (saddleHeight는 725 복원 상태)
apps/web/scripts/rider-cycle-fit/HARNESS.md
apps/web/scripts/rider-cycle-fit/verify-fit.mjs
```
메시지 예: `feat(bike): 프레임 삼각 완성 — 헤드튜브 85·시트튜브 junction 단축·시트포스트 축 정렬`

**커밋 3 — F7-A 프레임 회귀 차단** (이번 작업분)
`render-all.py` assert + manifest 기록 + 정본 GLB 교체

### 2-3. 커밋에서 제외할 것

- `apps/web/scripts/rider-preview/export-ik-joints-v2.mjs`
  → `ANKLE_BACK 149.4` · `ANKLE_UP 81`은 **미확정 가정값**이며 F8에서 실측 대체 예정.
  **커밋하지 말고 워킹트리에 남겨라.**
- `.out/` 산출물 — 이미 `apps/web/.gitignore:22`로 제외됨(감리 확인). 추가 조치 불필요

### 2-4. 커밋 규칙

- **pre-commit 훅이 파일 전체에 lint를 돌려 기존 baseline 때문에 막힐 수 있다.**
  그 경우 **내 변경분이 오류를 늘리지 않았음을 확인한 뒤** 보고하라.
  `--no-verify`는 **감리 승인 없이 쓰지 마라.**
- 커밋 메시지 끝에 `Co-Authored-By` 라인은 프로젝트 관례를 따르라
- **push 하지 마라.** 로컬 커밋까지만.

---

## 3. 절대 금지 (F7)

- **프레임 지오메트리 변경 금지**: `headTubeLength` 85 · `stack` 496.5 · `reach` 411.3 ·
  `seatTubeLength` 560 · `seatTubeAngle` 73.5 · `headBot` · 헤드각 73°
  **사용자 최종 승인 형태다. 이번에 회귀한 바로 그 값들이다.**
- **`ANKLE_BACK`·`ANKLE_UP`·`hipDrop` 변경 금지** — F8에서 실측 대체
- **`crankLength` 172.5 · 허벅지 rest 430 변경 금지**
- **정강이는 rest 400 유지** (사용자 확정, 인자로 전달)
- 제품 GLB(`apps/web/public/rider/prototype/rider-lowpoly.glb`) 덮어쓰기 금지
- **push 금지**
- `geometry.json`을 메시에 맞추는 역방향 수정 금지 — 방향은 항상 **SSoT → 메시**
- 새 숫자 리터럴 하드코딩 금지 / 실패 우회 금지

---

## 4. 렌더 (검증용)

커밋 후, **신프레임 정본**으로 F5 조건(`saddleHeight` 725·정강이 400)을 재렌더해
프레임이 사용자 승인 형태로 돌아왔는지 확인하라.

1. **`FULL_BDC_R`** — 오른발 BDC. 사용자 승인 프레임(헤드튜브 짧고 탑튜브 낮음)이어야 한다
2. **F5-AFTER `PHASE_180_FULL.png`와 동일 카메라 비교** — 프레임 형태가 같은지
3. `frameAssertions` · `crankPhaseAssertions` 둘 다 PASS
4. manifest에 cycle GLB 해시 기록 확인

후보 경로: `.out/candidates/20260801-F7-*/`

---

## 5. 보고 방법

기존 `REPORT.md` → `REPORT-F6.md`로 보존 후 새 `REPORT.md` 작성.

- **모델 사용 내역**
- **§1-1 정본 GLB 교체 전/후 MD5**
- **§1-3 frameAssertions 실측값** — 헤드튜브 85±1 · 탑튜브 후단 393.1 통과 증명
- **§2 커밋 3건의 해시와 파일 목록** — `git log --oneline` 출력 포함
- §2-1 `saddleHeight` 725 복원 확인
- **§4 렌더** — 프레임이 F5와 동일 형태인지 육안 + 수치
- 생성 이미지 절대경로 전체 목록
- 실패·미완·막힌 항목 (숨기지 말 것)
- 이견이 있으면 쓰라.
