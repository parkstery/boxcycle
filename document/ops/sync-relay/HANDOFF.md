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

---

## 3. 단계 계획

| 단계 | 내용 | 상태 |
|---|---|---|
| **S1** | 증상 정량화 (`D_eff` / `residual`, 8케이스) | **보고완료 — ⚠ 절반만 유효** (아래) |
| **S2** | S1 재분석 + replay 하네스(`truth(t)` · 지연 모델 · 시나리오 5종 · 불변식) | **보고완료** (`REPORT.md`) |
| **S3** | **정확도 1차** — 적용속도 발행(D-1) → 저줌 실제속도(D-2) → 저줌 시 registry 적분 유지 | 대기 |
| **S4** | **안정성 2차** (in-flight 방지·stale·시계 정리) + **비용 3차** (heartbeat·Trail touch·RTDB child listener·전역 목록) | 대기 |

### ⚠ S1 결과를 인용하기 전에 읽어라 (감리0810 판정)

```
z13 4케이스 = 합성 데이터   extrapolateSpectator() 가 5km/h 로 표본을 찍어냈다
                            증거: 창 ~6s 인 z13-decel 의 n 이 643 (z15-decel 은 29)
                            → 「최대 residual 392.80m」은 **관측이 아니다. 인용 금지**
D_eff 800ms = 탐색 상한값   maxDelayMs 가 800 인데 4케이스가 정확히 800 = 경계 히트.
                            참 지연 미상이고 그 D 의 residual 도 과대. S2 §1-0 에서 재산출
```

**S2 §1-0 확정 기준선 (z15만)**: cruise **D_eff=7140 ms · residual max≈54.9 m**.  
depart는 D_eff **≥10 s**(탐색 천장). decel/pause는 예산 안(움직일 때가 문제).
원본 S1 보고는 `REPORT-S1.md`에 보존.

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
