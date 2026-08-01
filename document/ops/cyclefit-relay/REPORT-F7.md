# 개발팀장 → 감리 보고서

- **지시번호**: F7 (프레임 회귀 교정 + 커밋)
- **발신**: 개발팀장0731
- **수신**: 클로드감리0731
- **일시**: 2026-08-01
- **모델 사용 내역**: **전부 Opus 직접. 위임 없음**
  (사유: §1-3 assert 는 메시 기하로 헤드튜브를 식별해야 해 좌표계 판단이 필요했고,
  §2 커밋은 분류 오류 시 되돌리기 비용이 크다. 코드 변경 1파일·약 90줄.)

---

## 0. 결론 요약

| 항목 | 결과 |
|---|---|
| **§0 반려 사유 확인** | **감리 지적이 정확했다.** OneDrive `cycle-only.glb` = 7/30 01:40 · MD5 `78e61ce7…` (구프레임) |
| **§1-1 정본 교체** | 완료. `78e61ce7…`(구) → **`95ae074a…`**(F4 신프레임). 백업 `cycle-only.glb.pre-F7.bak` |
| **§1-3 프레임 assert** | **완료. 반증까지 확인.** 구프레임 투입 시 "실측 55.9 ≠ SSoT 85.0" 으로 **실제 차단** |
| **§1-2 GLB 출처 기록** | 완료. `inputAssets` 에 경로·SHA-256·MD5·크기·수정시각 |
| **§2-1 saddleHeight** | 999.3 → **725** 복원, `coords.saddle` 파생 재계산 [-226, 695] |
| **§2-2 커밋 3건** | `2bbbc05`(34파일) · `ed923d7`(5파일) · `a561a98`(1파일). **pre-commit 전부 통과, push 안 함** |
| **§4 렌더** | 프레임이 사용자 승인 형태로 복귀 확인. `frameAssertions` · `crankPhaseAssertions` 둘 다 PASS |

---

## 1. F7-A 프레임 회귀 차단

### 1-1. 정본 GLB 교체 — MD5 전/후

| | MD5 | 크기 | 수정시각 |
|---|---|---|---|
| **교체 전(구프레임)** | `78e61ce777d66a9dabfddb108b53716d` | 586,400 | 2026-07-30 01:40 |
| **교체 후(F4 신프레임)** | **`95ae074ae700f51069f32e929dc29c75`** | 586,464 | 2026-08-01 10:54 |

백업: `C:\Users\kdrea\OneDrive\Documents\img\v2_4_cyclefit\cycle-only.glb.pre-F7.bak`
(구프레임 원본. MD5 `78e61ce7…` 로 보존 확인)

**정본 선정 근거 — F4 를 골랐다.**
후보 폴더의 cycle GLB 전수 해시를 떠서 계보를 확인했다.

| 해시 | 출처 | 프레임 | 안장 |
|---|---|---|---|
| `78e61ce7…` | F1R `cycle-only-before.glb` | 구(HT 165) | 725 |
| `3d962511…` | F1R `cycle-only-after.glb` | 신 | 725 |
| `fd13966b…` | F3-AFTER | 신 | 725 |
| **`95ae074a…`** | **F4-AFTER** | **신(최신)** | **725** |
| `3f067873…` | F5-AFTER | 신(F4와 동일 프레임) | 625 |

F4 와 F5 의 **프레임 형상은 동일**하다(헤드튜브 실측 동일, 차이는 안장 z 980.2 vs 886.5).
F7 §2-1 이 `saddleHeight` 725 복원을 지시했으므로 **F4 가 정본**이다.

### 1-2. manifest GLB 출처 기록 (하네스 결함 교정)

`params` 대신 최상위 `inputAssets` 키로 넣었다 — cycle·rider·joints 를 한 곳에 모아
사후 감리가 한 번에 읽도록 했다.

```json
"inputAssets": {
  "cycleGlb": {
    "path": "C:\\Users\\kdrea\\OneDrive\\Documents\\img\\v2_4_cyclefit\\cycle-only.glb",
    "md5": "95ae074ae700f51069f32e929dc29c75",
    "sha256": "…", "bytes": 586464,
    "mtime": "2026-08-01T10:54:50"
  },
  "riderGlb": { … }, "jointsJson": { … }
}
```

### 1-3. **프레임 assert — 반증 테스트로 작동 증명**

`_assert_frame()` 을 렌더 루프 **시작 전**에 배치했다.

**식별 방법**: 헤드튜브는 `geometry.json` 의 headBot→headTop 축 위에 놓이고,
축 중심이 L/2 부근이며, 축 방향 길이가 L 인 관이다. 이 세 조건으로 메시를 특정한다.
(이름 의존이 아니라 기하 의존이라 GLB 재생성 시 메시 번호가 바뀌어도 동작한다.)

| 시나리오 | 실측 | SSoT | 판정 |
|---|---|---|---|
| **구프레임 투입(반증)** | **55.9mm** (`Mesh_57`) | 85.0 | **FAIL → RuntimeError 로 렌더 중단** |
| 신프레임(F7 본렌더) | **85.03mm** (`Mesh_64`) | 85.0 | **PASS** (오차 0.03mm) |

```
RuntimeError: 프레임 회귀 감지: 헤드튜브 실측 55.9 mm ≠ geometry.json 85.0 mm.
구프레임 GLB 로 렌더하고 있다(F6 반려 사유). cycle GLB 를 확인하라.
```

**이 assert 가 있었다면 F6 은 렌더 시작도 못 했다.** 감리 §1-3 의 요구를 그대로 만족한다.

manifest 기록:
```json
"frameAssertions": {"headTubeExpectedMm":85, "headTubeMeasuredMm":85.03,
                    "headTubeMeshName":"Mesh_64", "toleranceMm":1, "pass":true}
```

**미완 1건**: 탑튜브 후단 y(`seatTubeJunction` 393.1) 검증은 `geometry.json` 에 해당 키가
없어 **기대값 기록까지만** 구현했다(키가 생기면 자동 검사되도록 코드는 준비됨).
헤드튜브 검사만으로도 F6 회귀는 100% 차단된다(반증 테스트로 확인).

---

## 2. F7-B 커밋

### 2-1. `saddleHeight` 725 복원

```
saddleHeight  999.3 → 725
coords.saddle 파생 재계산 → [-226, 695]   (= -(725·cos73.5°)-20, 725·sin73.5°)
verify-fit 파생식 검사 PASS
```

`$note_saddleF5` 를 갱신해 **현재 값이 725 임**과 F5(625)·F6(999.3, 구프레임 렌더로 반려)
이력, 그리고 "최종 안장 높이는 F8 에서 신프레임 기준 재역산" 을 명시했다.

### 2-2. 커밋 3건

```
a561a98 fix(cyclefit): 프레임 회귀 차단 assert — 구프레임 렌더를 렌더 시작 전에 막는다
ed923d7 feat(bike): 프레임 삼각 완성 — 헤드튜브 85·시트튜브 junction 단축·시트포스트 축 정렬
2bbbc05 feat(cyclefit): 결합 피팅 검증 하네스 — 렌더·계측·게이트
```

| 커밋 | 파일 | 증감 |
|---|---|---|
| `2bbbc05` 하네스 | **34** (rider-cycle-fit 13 · blender 13 · document/ops 8) | +5,253 |
| `ed923d7` 프레임 | **5** (generate-glb · riderRig · geometry.json · HARNESS · verify-fit) | +139 −40 |
| `a561a98` assert | **1** (render-all.py) | +593 |

**pre-commit 훅 전부 통과** — `--no-verify` 사용하지 않았다(커밋1 eslint 7파일,
커밋2 3파일 검사 통과).

### 2-3. 제외 확인

```
 M apps/web/scripts/rider-preview/export-ik-joints-v2.mjs   ← 워킹트리에 남김
```
`ANKLE_BACK 149.4`·`ANKLE_UP 81` 이 미확정 가정값이므로 지시대로 커밋하지 않았다.

`.out/` 산출물은 `apps/web/.gitignore` 로 제외되어 커밋에 포함되지 않았다(확인).

### 2-4. push

**하지 않았다.** 원격 추적 브랜치가 없어 로컬 커밋만 존재한다.

---

## 3. §4 렌더 — 프레임 복귀 확인

후보: `.out/candidates/20260801-F7-AFTER/` (**39장**)
조건: `saddleHeight` **725** · 정강이 rest **400**(인자) · scale 0.88 · lean 78 · hip

### 3-1. 검증 결과

| 검사 | 결과 |
|---|---|
| `frameAssertions` | **PASS** — 헤드튜브 85.03 / 85.0 (±1) |
| `crankPhaseAssertions` | **전 위상 PASS** — phase 0.500 좌 442.8/443(TDC) · 우 **98.2/98(BDC)** |
| `verify-renders` | **EXIT 0** |
| `verify-fit` | **EXIT 0** |
| manifest cycle GLB 해시 | `95ae074a…` 기록 확인 |

### 3-2. 육안 — 사용자 승인 형태로 복귀

`FULL_BDC_R.png` · `PHASE_180_FULL.png` 에서 **헤드튜브가 짧고 탑튜브가 낮으며 앞삼각이
닫힌 삼각형**이다. F6 의 "세로로 긴 헤드튜브·수평 탑튜브·사각형 앞삼각"과 명확히 다르다.
F5-AFTER `PHASE_180_FULL.png` 와 동일 카메라로 비교했을 때 **프레임 형태가 일치**하며,
차이는 안장 높이(625→725)뿐이다.

### 3-3. IK 참고 수치 (신프레임 기준)

| 지표 | 값 |
|---|---|
| 발 IK 오차 | **0mm** |
| 손 IK 오차 | 25.02mm |
| BDC 무릎 굽힘(우) | **17.9°** |
| 발–페달 최저점 수직거리 | 188.4mm |

F6 의 LeMond 비교군(구프레임, 18.6°)과 근사하다. 무릎 10° 목표에는 여전히 8° 못 미친다.

---

## 4. 지시 §3 준수 확인

| 금지 항목 | 준수 |
|---|---|
| 프레임 지오메트리(HT 85·stack 496.5·reach 411.3·seatTube 560·STA 73.5·headBot·헤드각 73°) | **불변** |
| `ANKLE_BACK`·`ANKLE_UP`·`hipDrop` | **불변** (149.4 / 81 / 65) |
| `crankLength` 172.5 · 허벅지 rest 430 | 불변 |
| 정강이 rest 400 | 인자로 전달, 유지 |
| 제품 GLB 덮어쓰기 | 없음 |
| **push** | **하지 않음** |
| SSoT → 메시 방향 | 준수 (`coords` 는 파생 재계산만) |
| 새 숫자 하드코딩 | assert 허용오차 1.0mm(지시 명시값) · perp 임계 10mm(관 반경 기준, 주석 기재) |

---

## 5. 실패·미완·막힌 항목

1. **탑튜브 후단 검증 미완** — §1-3 이 요구한 `seatTubeJunction` 393.1 검사는
   `geometry.json` 에 해당 키가 없어 **기대값 기록까지만** 했다. 코드는 키가 추가되면
   자동 검사하도록 준비돼 있다. 헤드튜브 검사만으로 F6 회귀는 차단된다(반증 확인).
2. **초기 측정 창 오류** — 처음 헤드튜브를 z 350~620 구간으로 재려 했으나 실제는
   685.7~767.0 이었다. 구프레임·신프레임이 같은 값으로 나와 오판할 뻔했고,
   축 기하 기반으로 바꿔 해결했다. **assert 최종본은 이 방식이다.**
3. **`git status --short --cached` 오타** — 스테이징 확인 명령이 실패했으나
   `git diff --cached --name-only` 로 재확인해 영향 없다.

---

## 6. 생성 이미지 절대경로 목록

```
C:\20.HDev\boxcycle\apps\web\scripts\rider-cycle-fit\.out\candidates\20260801-F7-AFTER\
```
**39장.** 파일명 구성:

| 분류 | 파일명 |
|---|---|
| BDC | `FULL_BDC_R.png` · `FULL_BDC_R_SIDE_L.png` · `BDC_R_LOWPOINT.png` |
| 위상 4×4 (16) | `PHASE_{0,90,180,270}_{FULL,FOOT_L,FOOT_R,CRANKSYNC}.png` |
| Rider Only (4) | `RIDER_ONLY_{SIDE_L,FRONT,REAR,Q_FRONT}.png` |
| Static 7방향 | `STATIC_{SIDE_L,SIDE_R,FRONT,REAR,TOP,Q_FRONT,Q_REAR}.png` |
| Static 확대 (6) | `STATIC_CU_{SADDLE,HAND_L,HAND_R,FOOT_L,FOOT_R,KNEE_FRONT}.png` |
| 종합판 (3) | `contact-sheet-{rider-only,static,pedal}.png` |

해시·해상도·생성시각은 `render-manifest.json` 의 `images`,
프레임·위상 증명은 `frameAssertions` · `crankPhaseAssertions`,
입력 출처는 `inputAssets` 키에 있다.

---

## 7. 이견

**1. 감리의 자기 기록(§0-3)에 동의하며, 개발팀장 쪽 원인도 명확히 한다.**
F6 에서 `CYCLE_PATH` 인자를 넘기지 않은 것은 개발팀장 잘못이다. F5 는 넘겼는데
F6 에서 빠뜨렸고, 기본값이 OneDrive 구프레임이라는 점을 확인하지 않았다.
"프레임 불변"이라 보고한 것도 `geometry.json` 만 보고 판단한 것이다 — 감리와 같은 오류다.
이번 assert 는 **양쪽 모두를 막는다**는 점에서 옳은 해법이라고 본다.

**2. 기본값 자체를 없애는 것을 F8 에 제안한다.**
지금은 `CYCLE_PATH` 를 안 넘기면 OneDrive 파일이 조용히 쓰인다. assert 가 잡아주긴
하지만, **인자를 필수로 만들어 애초에 암묵 기본값이 없게** 하는 편이 더 안전하다.
다만 이번 지시 범위를 넘어 손대지 않았다.

**3. BDC 무릎 17.9° — F8 의 핵심은 가정값 실측이다.**
신프레임·안장 725 에서도 17.9° 로 목표 10° 와 8° 차이다. F6 의 LeMond 비교(18.6°,
구프레임)와 거의 같으므로, **이 격차는 프레임이 아니라 `ANKLE_BACK`·`hipDrop` 에서
온다**고 본다. F8 에서 실측 대체할 때 목표 무릎각 ↔ 실측 무릎각 대조 절차를 함께
넣기를 다시 제안한다(F6 §7-2 와 동일 의견).
