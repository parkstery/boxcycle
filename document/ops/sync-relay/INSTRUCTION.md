# 감리 → 개발팀장 지시서 (활성) — 멀티라이더 위치 동기화

> S2 보고서는 **감리가 이미 `REPORT-S2.md` 로 보존**했다. 너는 **새 `REPORT.md` 만 작성**하고
> 기존 보고서를 옮기거나 덮지 마라. 마치면 이 파일 `상태` → `보고완료`.
> 보고 형식은 `../cyclefit-relay/SUPERVISOR-PROTOCOL.md` §1-3 **UAG**.

- **지시번호**: S3-DIAG (패킷 단위 체인 진단)
- **발신**: 클로드감리0811 · **일시**: 2026-08-11 · **상태**: 보고완료
- **브랜치**: `fix/multiplayer-position-sync` (base `main2`)
- ⚠ **S2 가 올린 `D_eff=7140 ms · residual 54.9 m` 기준선은 무효 처리됐다.** 사유는 `HANDOFF.md` §3.
  **S3(정확도 1차 구현)은 보류다.** 이번 지시는 구현이 아니라 진단이다.

---

## 0. S2 판정 — 방법은 채택, 결론은 반려

**잘한 것**: 앱 미구동 재계산 · z13 합성 판정 · 원시 로그 보존 · 수용 게이트 구성.
수용 게이트는 **하네스 배선이 옳다는 증거**로 유효하니 fixture 로 유지하라.

**반려**: `D_eff` 는 *하나의 전역 시간 이동* 을 가정하는데 depart·cruise 는 그 가정이 깨진 구간이다.
같은 창에서 A 는 89.8 m 갔는데 B.newest 는 14.0 m 갔다(depart). cruise 는 81 m 뒤에서 출발해
따라잡는다. 옵티마이저가 **거리 오프셋을 시간으로 환산**했을 뿐이다 — cruise 의 `age` 중앙값은
**171 ms** 이고, 이는 7,140 ms 와 40 배 어긋난다.

→ **현재 「상당한 차이」는 미터로 정량화되지 않았다.** 목표 없이 코드를 고치지 마라.

---

## 1. 지시 — 최초로 값이 벌어지는 구간을 찾는다

체인을 **동일 패킷 단위로** 연결한다. 시계열 통계가 아니라 **1:1 조인**이다.
**사용자가 실제로 보는 지도 위 좌표(⑦)까지 간다.** ⑤에서 끝내지 마라.

```
① A authoritative   virtualDistanceRef.current      useVirtualRideSession.ts:47  ★ rAF 원본
       ↓ rideDistanceAlongRoute()  ← liveLocationSnapshot.ts:42-52  min(routeDist, geoLen) 로 clamp
② A snapshot        snapshot.distMetersAlongRoute   liveLocationSnapshot.ts:88
③ RTDB payload      encodePayload() 의 d            rtdbTrailMotion.ts:58
④ B 수신 payload    decodeRow() 의 distM            rtdbTrailMotion.ts:68
⑤ B ingest          buffer 수용 / 폐기               integrator.ts:64
⑥ B displayDistM    stepPeerMotionEntity() 결과      integrator.ts
       ↓ clampRouteDist() + getPointOnRouteByDistance()  ← **B 의** routeGeometry
⑦ 지도 위 좌표      buildRenderFeatures()           PeerMotionRegistry.ts:82-91
```

**①과 ②는 반드시 분리 계측한다.** ①은 rAF 원본이고 ②는 clamp 를 거친 값이다. 항등이 아니다.
**⑥→⑦은 수신 측 geometry 를 쓴다.** A 와 B 의 `lineStringLengthMeters` 가 다르면 같은 `distM`
이 다른 좌표로 떨어지고 수신 측 길이로 다시 clamp 된다 — D-7 이 여기서 드러난다.
**A 와 B 각각의 `routeLen` 을 1 회씩 기록하라.**

### 1-1. 상관 ID — DEV 전용 `s` 필드

`encodePayload` 에 단조 증가 seq `s` 를 추가한다. `decodeRow` 는 **없어도 동작해야 한다**(하위 호환).
이 seq 로 ①~⑤ 를 조인한다. seq 없이 시각으로 맞추려 하지 마라 — 두 기기 시계가 다르다.

### 1-2. ① 계측 — DEV 전용 sampler

`virtualDistanceRef.current` 는 훅 내부 ref 다. React 상태(`metrics.virtualDistanceMeters`)를 쓰면
**200 ms 낡은 값**이라 ①이 아니다. `sampleLiveLngLat`(`useVirtualRideSession.ts:180-187`)과 **같은 패턴**으로
`sampleVirtualDistanceM()` 를 추가해 rAF 원본을 그대로 반환하라. 새 상태·새 훅 만들지 마라.

### 1-3. 각 지점 로그 (DEV·`?peerSyncLogMs` 와 동일한 게이트)

| 지점 | 남길 값 |
|---|---|
| ① | `seq` · `sampleVirtualDistanceM()` · `appliedSpeedKmh` · `speedKmh(target)` |
| ② | `seq` · `distMetersAlongRoute` · `routeReady` · A `routeLen` · A `geoLen` |
| ③ | `seq` · `d` · `v` · set() **성공/실패 · 왕복 소요 ms** |
| ④ | `seq` · `d` · `t` · 수신 시각 |
| ⑤ | `seq` · **수용 / 동일거리중복 폐기 / 전진 폐기** · `newest.distM` |
| ⑥ | `seq` 로 조인된 시점의 `displayDistM` · `buf` · `age` |
| ⑦ | 그 시점 지도 좌표 · B `routeLen` · clamp 발생 여부 |

### 1-4. 산출 — 최초 이탈 지점 1개

seq 조인 표에서 **①→②→③→④→⑤→⑥→⑦ 중 값이 처음 벌어지는 링크**를 지목하고 근거를 표로 제시한다.
가설 나열 금지. **링크 하나를 지목**하라.

### 1-5. 이미 확인된 것 (재조사 금지 — 여기서 시간 쓰지 마라)

- **S1 로그의 `self` 는 ② 다.** `useLiveLocationPublishSession.ts:209` 가
  `setPeerSyncSelfDistM(snapshot.distMetersAlongRoute)` 이다.
  → **① 은 이번에 처음 계측된다.** S1·S2 의 어떤 수치도 ① 을 담고 있지 않다.
- **발행 게이트는 속도를 억제하지 않는다.** `shouldPublishPeerMotion`
  (`liveLocationSnapshot.ts:179-195`)은 시간 100 ms + 속도 델타 우회. "느려서 안 나갔다" 가설은 반증됨.

**반증 조건**: *"seq 조인에서 ②③④ 의 `d` 가 전부 일치하고 전진 packet 폐기도 0 이면, 문제는 전송이
아니라 ①→② clamp 또는 ⑥⑦ 렌더 쪽이다."* → 그 경우 즉시 보고하고 멈춰라.

---

## 2. 정정 — `s1-metrics.mjs`

```
interpolateSelf : 범위 밖에서 양끝값 클램프 → null 반환
computeDeff…    : 최소 겹침 비율(기본 0.7) 미달 D 는 후보에서 제외
```

⚠ **이 수정으로 기존 무효 로그에서 새 기준 수치를 만들지 마라.** depart·cruise 는 겹침을 채워도
무효다(가정 자체가 깨진 구간). 재계산 결과를 `REPORT.md` 지표표에 올리지 말 것.
정정의 목적은 **앞으로의 측정이 경계에서 이기지 못하게** 하는 것뿐이다.

---

## 3. Fixture 고정

| fixture | 성격 | 기대 |
|---|---|---|
| `s1-z15-depart` · `s1-z15-cruise` | **무효 fixture** | 「D_eff 산출 불가」로 표시되어야 한다. 숫자가 나오면 §2 정정이 덜 된 것 |
| `s1-z15-decel` · `s1-z15-pause` | 정확도 예산 회귀 고정 | 예산은 PASS 유지. 단 §3-2 전제 미달이라 **스케일은 「판정 유보」로 출력** |
| **known-fail** `d0-duplicate-distm` | D-0 | 연속 중복 `distM` 비율 ≥ 40% 를 **현재 동작으로 고정**. 고쳐지면 이 테스트가 깨지고, 그때 기대값을 뒤집는다 |
| **known-fail** `d1-target-vs-applied` | D-1 | 발행 `speedMps` 가 실제 진행속도와 ≥ 20% 어긋남을 고정 |

known-fail 은 **skip 이 아니라 "현재값을 단언하는 통과 테스트"** 로 만들어라. 수정이 들어오면 즉시 붉어져야 한다.

### 3-1. ⑤ dedup — 전체 폐기율을 합격 기준으로 쓰지 마라

`integrator.ts:64` 의 폐기를 **두 종류로 분리해 집계**한다.

| 종류 | 조건 | 성격 |
|---|---|---|
| **동일거리 중복 폐기** | `packet.distM ≈ newest.distM` (≤ 0.05 m) | **정상** — D-0 의 결과일 뿐. 비율이 높아도 합격 |
| **전진 packet 폐기** | `packet.distM > newest.distM` 인데 버려짐 | **유해** — 위치 정보 손실 |

```
게이트   전진 packet 폐기 = 0        ← 1건이라도 나오면 FAIL, seq 와 사유를 그대로 보고
```

역행 packet(`distM < newest.distM`)은 별도 3번째 항목으로 세되 게이트에 넣지 않는다 — 원인 규명 대상이다.

### 3-2. 유효성 게이트 — 저속·짧은 창에서는 판정하지 않는다

**`newest − self` 중앙값 0 을 쓰지 마라.** 정상 파이프라인도 샘플링·전송 지연만큼 음수이고,
저속에서는 0 으로 수렴해 스케일 오류를 가린다. 대신 **구간 이동량 일치**를 쓰되 전제를 반드시 검사한다.

```
판정 전제   Δ(A.self) ≥ 100 m   AND   창 ≥ 20 s
            미달이면 결과는 「판정 유보」 — PASS 로 기록하지 마라
게이트      |Δ(A.self) − Δ(B.newest)| / Δ(A.self) ≤ 0.1     (시간 이동에 불변)
```

이 전제를 S1 에 적용하면 판정 가능한 것은 z15-cruise 뿐이고 48% 이탈로 FAIL 이다.
z15-decel·z15-pause 의 기존 「PASS」는 **스케일 판정 유보**로 내려간다.

---

## 4. 금지

- **최초 이탈 구간이 확정되기 전까지** 보간 상수(`rideSyncPolicy.ts`) · 발행 주기 · 비용 최적화 코드 수정
- 적용속도 발행(D-1) · 저줌(D-2) 수정 — **S3 사안이며 현재 보류**
- 알고리즘 반복을 2-브라우저 e2e 로 검증 — replay 로만. e2e 는 증상 계측에만
- `main2` 병합 · PR · `--no-verify`

---

## 5. 보고

**새 `REPORT.md` 만 작성한다.** `REPORT-S1.md` · `REPORT-S2.md` 는 감리가 보존해 둔 것이니 손대지 마라.

```
반증  §1-5 반증 조건 해당 여부   ← 먼저
UAG   **최초 이탈 링크 1개** (①~⑦ 중) + seq 조인 표 근거
기술  ① vs ② 비교(clamp 발생 여부) · A/B `routeLen` 대조 · ⑥ displayDistM · ⑦ 좌표 이탈
      ⑤ 폐기 3분류(동일거리중복 / **전진** / 역행) · fixture 4 + known-fail 2 결과
      실패·미완 전수 · 이견 · 커밋
```

**e2e 를 돌렸다면 실행 시간을 분 단위로 적어라.**
