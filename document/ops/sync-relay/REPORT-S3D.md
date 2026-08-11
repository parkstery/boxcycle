# S3-DIAG REPORT — 패킷 체인 최초 이탈

- **지시번호**: S3-DIAG
- **일시**: 2026-08-11
- **브랜치**: `fix/multiplayer-position-sync`
- **방법**: DEV `s` seq 조인 · `sampleVirtualDistanceM` ① · Playwright 2-browser (`?peerSyncLogMs=200`) · fixture/known-fail 스크립트
- **e2e 실행 시간**: 약 **1 분** (`S3-chain-join.json` `elapsedMin`)
- **산출물**: `S3-chain-join.json` · `S3-fixture-gate.json`
- ⚠ S2 의 `D_eff=7140` / residual 54.9 m 는 **인용하지 않음** (HANDOFF §3 무효).

---

## 반증 (§1-5)

| 항목 | 결과 |
|---|---|
| ②③④ `d` 일치 (\|Δ\|≤0.15 m) | **245 / 245** (mismatch 0) |
| 전진 packet 폐기 | **0** → 게이트 PASS |
| 반증 조건 | **해당** |

> seq 조인에서 ②③④ 의 `d` 가 전부 일치하고 전진 packet 폐기도 0 이면, 문제는 전송이 아니라 **①→② clamp 또는 ⑥⑦ 렌더** 쪽이다.

→ **전송(②→③→④) · 전진 ingest 폐기는 최초 이탈이 아니다.** 아래 UAG 로 멈춘다.

§1-5 기확인 (재조사 없이 코드 재확인만):

- S1 `self` = ② (`useLiveLocationPublishSession.ts` → `setPeerSyncSelfDistM(snapshot.distMetersAlongRoute)`)
- `shouldPublishPeerMotion` = 100 ms 간격 + 속도 델타 — 저속 억제 없음

---

## UAG — 최초 이탈 링크

**① → ②**

| | |
|---|---|
| **링크** | `virtualDistanceRef`(①) → `snapshot.distMetersAlongRoute`(②) |
| **성격** | 발행 입력이 **rAF 원본이 아니라** React `metrics.virtualDistanceMeters`(METRICS_UI_MS=**200**) 이라 ①보다  systematically 뒤처짐. 초반 거리(≪ geoLen)에서는 `rideDistanceAlongRoute` clamp 가 주원인이 아님. |
| **근거 표본** | ①−② Δ: p50 ≈ **0.25 m** · p90 ≈ **0.55 m** · max ≈ **0.79 m** (조인 표본). 최초 이탈 seq `644805247`: authDist **0.573** vs dist **0.125**. |

### seq 조인 표 (발췌)

| seq | ① auth | ② dist | ③ d | ④ d | ⑤ result | 비고 |
|---:|---:|---:|---:|---:|---|---|
| 644805245 | 0.087 | 0.056 | 0.1 | 0.1 | discard-retrograde | ①>② (UI 지연) · ②③④ 일치(0.1 반올림) |
| 644805247 | **0.573** | **0.125** | 0.1 | 0.1 | discard-retrograde | **최초 이탈 ①→②** |
| 644805253 | 1.328 | 1.173 | 1.2 | 1.2 | dup-same-dist | D-0 동일거리 중복 |
| 644805257 | 1.884 | 1.629 | 1.6 | 1.6 | accepted | ②③④ 일치 · 수용 |

publisherUid=`FcVoSD` · joinN=318 · joinWith4=309 · RTDB RTT 표본 ≈150–360 ms · ok=1.

---

## 기술

### ① vs ② · routeLen

| | A | B |
|---|---|---|
| `routeLen` (Directions / registry) | **1500** | **1029.633** |
| `geoLen` (lineString) | **1029.633** | (= B routeLen) |

- clamp cap = `min(routeDistanceMeters, geoLen)` = **1029.633 m**. 측정 창의 dist ≪ cap → **clamp 미발화**.
- ①→② 괴리의 직접 원인: publish 스냅샷 입력이 `metrics.virtualDistanceMeters`(UI 200ms) 이고, ①만 `sampleVirtualDistanceM()`(rAF) 로 읽음.
- A/B `routeLen` 불일치(1500 vs 1029.6)는 **D-7 후보**로 종점 부근에서 ⑥→⑦ clamp 를 만들 수 있으나, **이번 최초 이탈은 아님**.

### ⑤ 폐기 3분류 (A uid만)

| 종류 | 건수 | 게이트 |
|---|---:|---|
| 동일거리 중복 (`dup-same-dist`) | 530 | 정상(D-0) — 합격 기준 아님 |
| **전진** (`discard-forward`) | **0** | **PASS** |
| 역행 (`discard-retrograde`) | 149 | 게이트 외 · 원인 규명 대상(지연 재수신·버퍼 선행) |

### ⑥ · ⑦

- 반증에 따라 전송 이후는 2순위. 스로틀 표본 1건: displayDistM≈3.27 · B routeLen=1029.633 · clamped=0.
- 최초 이탈이 ①→② 이므로 ⑥⑦ 을 원인으로 지목하지 않음.

### Fixture · known-fail (`S3-fixture-gate.json`)

| fixture | 결과 |
|---|---|
| `s1-z15-depart` · `s1-z15-cruise` | **D_eff 산출 불가** (옛 D 겹침 < 0.7 — §2 정정 확인). 숫자 D_eff 미기재 |
| `s1-z15-decel` · `s1-z15-pause` | 정확도 예산 **PASS** · 스케일 **판정 유보** |
| `d0-duplicate-distm` | 연속 중복 **42.2%** ≥ 40% — 현재 동작 단언 PASS |
| `d1-target-vs-applied` | 실제 6.23 vs 발행 8.33 m/s · rel **25%** ≥ 20% — 현재 동작 단언 PASS |

수용 게이트(`s2-accuracy-gate`) 배선은 ±20% 유지(하네스 증거). 그 수치를 S3 기준선으로 쓰지 않음.

### §2 정정

- `interpolateSelf` 범위 밖 → `null`
- `minOverlapRatio` 기본 0.7
- 무효 로그로 새 D_eff 표를 만들지 않음

### 실패·미완

- 없음 (지시 범위 내). 정확도 수정(S3)·발행 주기/보간 상수 변경은 **금지·보류** — 이번은 진단만.

### 이견

- 작업 전 이견 없음. (§1-5 재확인 일치)
- 진단 중 seq 가 브라우저마다 1부터라 1차 e2e 조인이 오염됨 → 세션 랜덤 대역 + uid 필터로 재측정. **본 보고는 재측정본**.

### 커밋

- 이 보고와 계측·fixture 는 동일 커밋에 포함.