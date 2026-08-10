# 멀티라이더 위치 동기화 — 인수인계 (SoT)

- **브랜치**: `fix/multiplayer-position-sync` (base `main2`)
- **릴레이**: 이 디렉터리. `cyclefit-relay`와 **별개 작업선** — 서로의 `INSTRUCTION.md`를 덮지 마라.
- **작성**: 클로드감리 2026-08-10 (조사 단계 결과 이관)

---

## 1. 현재 구조 요약

**이중 전송**

| 경로 | 주기 | 타임스탬프 | 용도 |
|---|---|---|---|
| RTDB `trails/{tid}/motion/{uid}` | 100ms 발행 / **실효 5Hz** | **송신 기기 시계** `Date.now()` | 보간용 주 경로 |
| Firestore `trails/{tid}/livePublicationRides/{uid}` | 1s | `serverTimestamp()` | 목록·저줌·폴백 |

**렌더** — peer는 `now − PEER_INTERP_DELAY_MS(160)` 시점으로 보간(`integrator.ts stepPeerMotionEntity`),
버퍼 밖이면 `PEER_INTERP_MAX_EXTRAP_MS(1200)`까지 외삽 후 고정.

**구독 허브** — `livePublicationRidesSubscriptionHub.ts` / `rtdbMotionSubscriptionHub.ts`가
trailId당 구독 1개로 refcount 관리한다. **consumer 중복 구독은 이미 제거되어 있다** — 다시 손대지 마라.
남은 증폭은 (a) Firestore 컬렉션 전체 구독 → 클라 N × 문서 N = **N²**, (b) RTDB 부모 노드 `onValue` →
자식 1건 변경마다 노드 전체 다운로드, (c) `subscribeTrailIdsWithActiveLiveRides`
(`firestoreTrailLivePublicationRides.ts:230`) 전역 collectionGroup 실시간 구독.

---

## 2. 확정된 원인 (코드 근거 있음)

| # | 원인 | 위치 |
|---|---|---|
| **D-0** | 200ms 샘플 vs 100ms 발행 → 중복 패킷이 dedup에서 폐기. **10Hz 상향 실효 0, write만 2배** | `useVirtualRideSession.ts:22` · `useLiveLocationPublishSession.ts:26` · `integrator.ts:64` |
| **D-1** | 발행 속도가 **목표속도**(슬라이더)라 램프 중 실제와 불일치 → 외삽 과대 | `App.tsx:1438` ← `App.tsx:201` |
| **D-2** | zoom ≤ 14에서 peer 적분 중단, spectator는 **고정 5km/h** 외삽 | `MapView.tsx:2258` · `useTrailLivePublicationRideSpectatorOverlay.ts:151-161` |
| **D-3** | 구조적 지연 예산 ≈ 326ms 평균 / 476ms 최악 (네트워크 제외) | 위 경로 합산 |
| **D-4** | dedup **이전에** `speed`·`phase`를 갱신 → 폐기될 패킷도 상태 오염 | `integrator.ts:46-54` |
| **D-5** | publish in-flight 미방지 + Trail 활동 갱신 1Hz | `useLiveLocationPublishSession.ts:237-248` · `publishLiveLocationFanout.ts:45` |

**추정 (미확인)** — D-6 RTDB row staleness 미검사(`syncFromPresence.ts:62`),
D-7 송수신 geometry 불일치 가능성.

### D-0 · D-1 실측 확정 (S1 실패킷 91건 — `s2-z15-cruise-scenario.json`)

```
연속 중복 distM      38 / 90 = 42%                      ← D-0 현장 확정
첫 6 s 실제 진행속도  6.23 m/s  vs 발행 speedMps 8.05    ← D-1 (+29% 과대)
depart 구간 발행 spd  1.39 m/s 고정(=5km/h 초기 슬라이더) ← D-1 (A 는 8 m/s 로 가속 중)
```

### 체인 진단 전에 알아둘 것 (감리 확인 완료 — 재조사 금지)

- **S1 의 `self` 로그는 ① 이 아니라 ② 다.** `useLiveLocationPublishSession.ts:209` 가
  `setPeerSyncSelfDistM(snapshot.distMetersAlongRoute)` 이다.
  → **① authoritative(rAF 원본)는 아직 한 번도 계측된 적이 없다.**
  ①→② 변환은 `rideDistanceAlongRoute`(`liveLocationSnapshot.ts:42-52`)이고
  `min(routeDistanceMeters, geometryLengthMeters)` 로 **clamp** 한다 — 항등이 아니다.
- **발행 게이트는 속도를 억제하지 않는다.** `shouldPublishPeerMotion`
  (`liveLocationSnapshot.ts:179-195`)은 시간 기반 100 ms + 속도 델타 우회다.
  "속도가 낮아서 발행이 막혔다"는 가설은 **이미 반증됐다.**
- 따라서 최초 이탈 지점은 **② 스냅샷 → ③ RTDB 기록 → ④ B 수신·ingest** 사이에 있다.

---

## 3. 단계 계획

| 단계 | 내용 | 상태 |
|---|---|---|
| **S1** | 증상 정량화 (`D_eff` / `residual`, 8케이스) | **보고완료 — ⚠ 절반만 유효** (아래) |
| **S2** | S1 재분석 + replay 하네스(`truth(t)` · 지연 모델 · 시나리오 5종 · 불변식) | **보고완료** (`REPORT.md`) |
| **S3-DIAG** | **패킷 단위 체인 진단** — A authoritative → snapshot → RTDB payload → B 수신 payload 중 최초로 값이 벌어지는 구간 확정 | **배포** |
| **S3** | 정확도 1차 — 적용속도 발행(D-1) → 저줌 실제속도(D-2) → 저줌 시 registry 적분 유지 | **보류** (S3-DIAG 결과 대기) |
| **S4** | **안정성 2차** (in-flight 방지·stale·시계 정리) + **비용 3차** (heartbeat·Trail touch·RTDB child listener·전역 목록) | 대기 |

### ⚠⚠ 기준선 무효 — 인용 금지 (감리0811 판정)

```
[무효 1] z13 4케이스 = 합성       extrapolateSpectator() 가 5km/h 로 표본을 찍어냈다
                                  「최대 residual 392.80m」은 관측이 아니다
[무효 2] D_eff 7140ms · residual 54.9m  ← S2 가 "S3 목표 기준선"으로 올린 값. **무효**
[무효 3] z15-depart D_eff ≥10000ms                                          **무효**
```

**무효 사유** — `D_eff`는 *하나의 전역 시간 이동*을 가정한다. depart·cruise 는 그 가정이 성립하지 않는다.

| case | A.self 이동 | B.newest 이동 | 같은 창 | 판정 |
|---|---:|---:|---:|---|
| z15-depart | **89.8 m** | **14.0 m** | 16.5 s | 스트림 사실상 정지 — `age` 중앙 2,741 · 최대 15,121 ms, 외삽캡 초과 59%, `disp` 정지 55% |
| z15-cruise | 178.7 m | **264.4 m** | 22.1 s | 81 m 뒤에서 시작해 따라잡는 구간 — 정상 주행 아님 |
| z15-decel | 26.8 m | 29.3 m | 7.1 s | 정확도 예산 PASS · **스케일 판정 유보**(저속·짧은 창) |
| z15-pause | 8.0 m | 8.0 m | 12.5 s | 정확도 예산 PASS · **스케일 판정 유보**(저속·짧은 창) |

교차 증거: cruise 의 `age` 중앙값은 **171 ms** 다. 실제 파이프라인 지연은 ~330 ms 이지 7.1 초가 아니다.
40배 어긋나는 것 자체가 적합 실패의 증거다. 옵티마이저가 **거리 오프셋을 시간으로 환산**했다
(81 m ÷ 8.33 m/s ≈ 9.7 s).

> **현재 「상당한 차이」는 미터 단위로 정량화되지 않았다.** 유효 케이스 2건은 모두 PASS,
> 나머지 6건은 무효다. 이 상태에서 정확도 수정에 착수하면 목표 없이 코드를 고치는 것이다.

**유효성 게이트 — `newest − self` 중앙값 0 을 쓰지 마라.**
정상 파이프라인도 샘플링·전송 지연만큼 **음수**여야 하고, 저속에서는 그 값이 0 으로 수렴해
스케일 오류를 가린다. 올바른 게이트는 **구간 이동량 일치**다(시간 이동에 불변).

```
판정 전제   Δ(A.self) ≥ 100 m   AND   창 ≥ 20 s      ← 미달이면 「판정 유보」, PASS 아님
게이트      |Δ(A.self) − Δ(B.newest)| / Δ(A.self) ≤ 0.1
```

**이 전제를 적용하면 위 표 4건 중 판정 가능한 것은 z15-cruise 뿐이고, 48% 이탈로 FAIL 이다.**
z15-decel(7.1 s · 26.8 m)·z15-pause(12.5 s · 8.0 m)는 **정확도 예산은 통과했으나 저속·짧은 창이라
스케일 검증에는 쓸 수 없다** — 「PASS」로 인용하지 마라.

원본 S1 보고는 `REPORT-S1.md`, S2 보고는 `REPORT-S2.md` 에 보존.

**순서 의존 2건 (위반 금지)**

1. S3의 「저줌 실제속도」는 「적용속도 발행」 **뒤에** 온다. spectator가 읽는 `speedMps`는 Firestore 값이고
   그 값 자체가 목표속도 버그를 갖는다(`publishLiveLocationFanout.ts:41`). 순서가 바뀌면 **틀린 속도로
   외삽만 정교해진다.**
2. 「숨김 중 적분 유지」는 **zoom 저줌에만** 적용한다. 탭 숨김(`pageVisible=false`)에서는 구독이 통째로
   해제되므로(`PublicationSharedPresence.tsx:156,197,230`) 적분을 유지하면 **데이터 없이 외삽이 폭주**한다.

---

## 4. 승인된 판정 예산

`D_eff ≤ 350ms` · `residual RMSE ≤ 1.0m` @30km/h · `residual max ≤ 2.5m` (zoom 13 동일)

---

## 5. 알려진 정리 대상 (별건, 지금 손대지 말 것)

- `hooks/useTrailLivePublicationRidePublisher.ts` — 호출처 없음
- `lib/peerMotion/mergePackets.ts` `mergePeerMotionPackets` — `syncFromPresence`가 쓰지 않음
