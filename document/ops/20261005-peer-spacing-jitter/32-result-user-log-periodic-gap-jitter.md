# RESULT-32 — 사용자 로그 초당 상대간격 소진동 · capture(20)

담당: Cursor CLI · 지시: [31-task-user-log-periodic-gap-jitter.md](31-task-user-log-periodic-gap-jitter.md) · 시각: 2026-10-05  
상태: **DEVELOPMENT_DONE_PENDING_REVIEW** · commit/push/배포 **없음** · 제품 motion/트래픽 **미변경**

입력 로그 `붙여넣은 텍스트.txt`(78줄) + Chief 요약(rider-B smooth avg0.94→1.27, max28.83 누적, back0%, gap130–272ms, D600, 5km/h). 브라우저 실주행 없음. 조사·가상재생 **약 5분**.

## 판정 요약

| 항목 | 결과 |
|------|------|
| 증상 해석 | **드문 수 m snap이 아니라** 패킷·프레임 주기로 **≤1m 상대간격 톱니**가 유력 |
| FS 4초 공백 | 이번 붙여넣기 구간에서 증상 원인으로 **확정하지 않음** |
| max28.83 | **누적 max** — 매 5초 새 spike로 해석 **금지**(지시 준수) |
| back≈0 → camera만 | **단정 금지** — raw gap 톱니와 화면 점프를 분리해야 함 |
| pt10 nowMs 고정 | **spectator 진단 경로**(1Hz tick) — PeerMotionRegistry 렌더 시계 아님 |
| 제품 알고리즘 | **이번 지시에서 smoothness 수정 없음** |
| DEV 수집 | `window.__rtwPeerIngestDiag.capture(20)` + `download()` |

## 1. 로그 구간 요약 (붙여넣기)

수신측만 보임. **sender capture/write(pt1–3)·tSrv·frameRender 누락 → 미확정**.

| 구간 | 관찰 |
|------|------|
| pt4 recv | seq 411452613–615, d=159.4→159.7, recvAt 간격 ~130–250ms, **동일 seq 다중 재수신**(first=0, repeatSeenCount↑) |
| pt5 ingest | `dup-same-dist` 다수 · `accepted` 159.4→159.7(**+0.3m**, wire 0.1m 양자와 정합) · 이후 `discard-retrograde` d=158.9(구표본) |
| pt6/7 | `mode=paused` · displayDistM=159.7 · entitySpeedMps=**0** · route finish |
| peerSync | gap(newest-self)=0 · age 131ms→수초 · spd 1.39→**0** |
| pt10 | spectatorExtrap 진단. 초반 `recvLocalMs≈…631166` vs `nowMs≈…514034` **고정**(elapsed=0) → 이후 nowMs 정상 전진 |
| peerSmooth(첨부) | avg≈1.15–1.24 · max=5.18 · back=0.2% · gap≈289ms · delay=600 · 수천 프레임 누적 |
| Chief 별도 | avg0.94→1.27 · **max28.83 누적고정** · back0% · arrivalGap130–272ms |

## 2. 코드 대조 — 후보

| 후보 | 코드 | 로그/재생과의 관계 |
|------|------|-------------------|
| **A. wire 0.1m 양자 + self 연속** | `motionWireQuantize` · self도 canonical 양자(`selfDisplayBuffer`)이나 **MapView self 좌표는 `sampleLiveLngLat`/raw 경로** | 5km/h·200ms → 패킷당 ~0.28m → **0.3m 계단**. 가상재생: stepped gap **pp 0.30–0.40m**, dGap 고주파 |
| **B. 동일거리 패킷도 속도 갱신** | `applyPeerMotionIngest` — dedup 전에 `entity.speedMps` 갱신 | 첨부에서 spd 1.39→0(paused) 전환 관측. 연속 소진동의 **주원인으로 미확정** |
| **C. self/peer 호출시각** | MapView rAF: self 샘플→camera→`registry.step` 순 | 상대간격 = peer display − self sample. **raw React `liveLngLat` 덮어쓰기 경로는 sample 소유 시 우회**(주석) |
| **D. pt10 고정 nowMs** | `useTrailLivePublicationRideSpectatorOverlay` — `spectatorTickMs` **1초 setInterval**; row 갱신 시 useMemo가 **낡은 nowMs**로 pt10 찍음 | **진단 아티팩트**. 동행 GLB는 `PeerMotionRegistry.step`/`commonDisplayClock` |
| **E. frameGap clamp / camera** | `clampedDt≤0.12` · camera follow 동일 rAF | back≈0만으로 camera 원인이라 단정 **금지** |
| FS 4s | 첨부 버스트 후 silent≈5s·paused | 공백 **잔여**는 가능하나 **초당 툭툭**의 1차 설명으로 억지확정하지 않음 |

## 3. 가상재생 (증거만 · 제품 미수정)

명령: inline node 시뮬(~수초). 조건 5km/h · pkt 200–300ms · fps 15/20/60.

| 모델 | gap pp | 해석 |
|------|--------|------|
| peer **계단**(wire) vs self 연속 | **0.30–0.40 m** | 초당 수회 **서브미터 상대 톱니** 재현 |
| peer **보간** + D600 | pp~0.8m(지연 편향) · dGap 완만 | 「툭툭」보다 고정 지연 쪽 |
| speedFlip(동일거리 0↔v) | 계단 모델과 유사 | 이 로그만으로 인과 분리 부족 |

**인과 구분:** raw peer 속도 0↔빠름 반복은 첨부 후반 paused에서 보이나, **주기적 ≤1m 진동**은 A(양자 계단 vs self)가 재현됨. 화면 점프 = raw gap 미분과 camera/GLB를 `capture`의 `relativeGapM`·`jumpM`으로 나란히 봐야 함.

## 4. DEV 단일 수집 API (diagnostics only)

파일: `apps/web/src/lib/debug/peerIngestDiag.ts` (+ `main.tsx` 기존 install).

```text
# DEV 콘솔 — 멀티단계 전제 없음
const r = await window.__rtwPeerIngestDiag.capture(20)
window.__rtwPeerIngestDiag.download()   // 또는 r / .export() / .status()
```

| 계약 | 내용 |
|------|------|
| 단일 호출 | `capture(sec≤20)` — 이전 timer 정리 후 재시작 |
| 빈 수집 | `status().hint` · `capture.emptyReason` · `download()` ok:false |
| 덮어쓰기 방지 | capture 전용 cap: frame≤500 · ingest≤200 · minFrameInterval 40ms (레거시 ring240과 분리) |
| 기록 | source · tSrvQuality · 선택 표본 dist/speed · frameRenderMs · self+peer dist · relativeGapM · dtMs |
| 금지 | 새 subscribe/RTDB 쓰기 · 콘솔 스팸 |
| missing | firebase 원본 콜백시각 · publish 큐 · clock offset · camera 상태 |

unit: `node --test scripts/peer-sync/peer-ingest-diag-capture.test.mjs` → **2/2 PASS** (~6.5s).  
`npx tsc -b` (apps/web) → **0**.

## 5. 좁은 후속 구현안 (아직 하지 않음)

1. **관측:** 양창에서 `capture(20)` JSON — `relativeGapM` 고주파 pp vs `jumpM` / `source`·`tSrvQuality` 대조.
2. **가설 A가 남으면:** self 표시를 peer와 같은 canonical 버퍼 표본으로만 상대간격 계산(제품 HUD 즉시성 보존 범위에서) — **송신주기·D600·FS4s 불변**.
3. **가설 B:** 동일거리 ingest의 speed=0 갱신이 extrap/표시에 미치는 조건만 좁혀 재생 시나리오 고정 후 수정.
4. **하지 말 것:** snap 완화·송신 빈도↑·전체 smoothness 재작성·camera를 back0만으로 확정.

## 6. 검증·시간

| 명령 | 결과 | 벽시간 |
|------|------|--------|
| 로그 전량 독해 + 코드 추적 | 완료 | ~조사 5분 내 |
| node 가상재생(양자/보간) | gap pp 증거 | ~수초 |
| `node --test …/peer-ingest-diag-capture.test.mjs` | **2/2** | ~6.5s |
| `npx tsc -b` | **0** | ~22s |
| 브라우저 실주행 | **미실행**(지시) | — |

## 7. 변경 파일

- `apps/web/src/lib/debug/peerIngestDiag.ts` — capture/download/status · frame 필드 확장
- `apps/web/scripts/peer-sync/peer-ingest-diag-capture.test.mjs` — unit
- `apps/web/scripts/peer-sync/HARNESS.md` — 진단 한 줄
- 본 결과 · 묶음 README · ops PROGRESS/색인 한 줄

제품 peerMotion integrator/policy/송신·구독 **미수정**.
