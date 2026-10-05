# RESULT-29 — FS 추정 시각 vs 권위 capture · anchor 오염 방지

담당: Cursor CLI · 지시: [28-task-review-estimated-fallback-time.md](28-task-review-estimated-fallback-time.md) · 시각: 2026-10-05  
상태: **DEVELOPMENT_DONE_PENDING_REVIEW** · commit/push/배포 **없음**

27의 축 clear 재현(jump 3.18→0.058m)은 유지. 이번은 추정 fallback 시각이 권위 `tSrv` capture 를 오염시키지 않게 구별하고, 정지/가속/복구를 게이트에 넣었다.

## 판정

| 항목 | 결과 |
|------|------|
| 추정 vs capture 구별 | **`tSrvQuality: "capture" \| "estimated"`** (수신 내부만, wire/FS 필드 추가 없음) |
| capture anchor 오염 | **차단** — estimated 는 display tip 만 갱신 · `publicationId\|uid` 키 |
| 늦은 RTDB rewind | **차단** — capture/tip 과거 되돌림 거부 · 복구 tip 단조 |
| 정지/가속/복구 시험 | **PASS** — `stallStopResume` · `stallAccelResume` |
| residual gate 설명 | residualPp 만 stall 제외 · **jump/back/axis 는 전체 구간** · 상한 완화 없음 |
| DEV 무트래픽 진단 | `__rtwPeerIngestDiag` ring/export |
| D600 / RTDB200 / FS4s | **불변** |
| 사용자 잔여튐 완료 주장 | **아님** — 정상 dual 은 PRE도 PASS; 사진 당시 RTDB 공백 미측정 |

원시: [after-estimated](residual-peer-jitter-metrics-after-estimated.json) · [mutation](residual-peer-jitter-mutation-compare.json) · [metrics](residual-peer-jitter-metrics.json)

## 1. 수정 요약

| 파일 | 내용 |
|------|------|
| `types.ts` | `PeerMotionTimeQuality` · 패킷 `tSrvQuality?` |
| `rtdbToPacket.ts` | wire `tSrv` → `tSrvQuality: "capture"` |
| `syncFromPresence.ts` | capture map vs display tip 분리 · bridge 결과는 항상 `estimated` · 0속도 +1ms 제거 · 가속은 평균속도 · 8s advance clamp · pub\|uid 경계 · late rewind 거부 · 복구 tip 단조 |
| `peerIngestDiag.ts` + `main.tsx` | DEV in-memory ring · `window.__rtwPeerIngestDiag` |
| `PeerMotionRegistry.ts` | frame raw jump → diag |
| residual harness / mutation / unit | stop·accel 시나리오 · gate 주석 · mutation 3시나리오 · capture 오염 단위시험 |
| `HARNESS.md` | 추정 quality · diag 명령 |

보존: 송신 주기·구독 횟수·FS schema·D600·HUD 즉시·solo0·snap 완화 없음·타 작업(focus-read 등) 미수정.

## 2. 추정 time 구별 (계약)

| | capture | estimated |
|--|---------|-----------|
| 출처 | RTDB wire `tSrv` (캡처 순간) | FS 폴백 수신 `dDist/speed` 연속 |
| `tSrvQuality` | `"capture"` | `"estimated"` |
| `lastCapture` | 갱신 | **갱신 안 함** |
| `lastDisplayTip` | 갱신(복구 시 tip 단조 유지) | tip 만 갱신 |
| 정상 공통동기화 | 예 | **아니오** — 연속 fallback 전용 |
| 한계 | — | 거리/속도로 캡처시각 정확 복원 불가 |

## 3. 전후 숫자 (동일 상한)

게이트: residualPp≤0.8m(정상 구간) · peerJump≤0.45m(**전체**) · back≤0.35m(**전체**) · axisFlip=0(**전체**).

| 시나리오 | jump / axis / residualPp / residualPpAll | 비고 |
|----------|------------------------------------------|------|
| rtdbStallFs (27 AFTER) | 0.058 / 0 / 0 / **1.238** | stall 10–16s residual 제외 유지 |
| rtdbStallFs (mutation PRE) | **3.181 / 2** / 0 / 3.156 | bridge off → FAIL |
| stallStopResume | 0.076 / 0 / 0.1 / 2.136 | 신규 · 전체 jump PASS |
| stallAccelResume | 0.174 / 0 / 0.111 / **10.965** | 신규 · All은 FS 성김+가속 한계 보고 |
| stall* mutation PRE | jump 2.9–10.4 · axis=2 | gateAlive |
| low5v6 등 정상 dual | 이전과 동일 PASS | 「잔여튐 완료」 아님 |

## 4. 검증

| 명령 | exit | 벽시간 |
|------|------|--------|
| `node scripts/peer-sync/residual-peer-jitter-harness.mjs` | **0** | ~4.5s |
| `node scripts/peer-sync/residual-peer-jitter-mutation-failcheck.mjs` | **0** | PRE fail→POST pass (~3시나리오) |
| `node --test …/rtdb-fs-fallback-source-select.test.mjs` | **0** 10/10 | ~4s |
| `npm run test:peer-spacing` | **0** | ~gate+transitions+residual |
| `npm run test:peer-common-display` | **0** | ~8s |
| `npx tsc -b` (`apps/web`) | **0** | (묶음) |
| eslint 변경 파일 | **0** | |
| `npm run test:rtdb-rules` | **0** 13/13 | |

가상재생 명령 120s 상한 준수. 전체 브라우저 실주행 재확인은 범위 밖(좁은 수정).

## 5. DEV 진단 (트래픽 없음)

패킷마다 콘솔 스팸·새 네트워크 쓰기 없음. 짧은 ring + 한 번 export.

```text
# 콘솔 (DEV, 두 창 각각)
window.__rtwPeerIngestDiag.reset()
# 10–20초 관측(저속·끊김/복구 의심 구간)
copy(JSON.stringify(window.__rtwPeerIngestDiag.export(), null, 2))
# 요약만: window.__rtwPeerIngestDiag.read()
# 병행: window.__rtwPeerSmooth.read()  — backPct·maxMps (카메라 의심 시)
```

읽을 때:

- `lastIngestByUid.*.source === "fs"` + `tSrvQuality === "estimated"` → FS 폴백 축
- `source === "rtdb"` + `capture` 인데 `maxJumpByUid` 큼 → GLB/camera·렌더 쪽 의심
- `estimatedCount` 증가 없이 jump만 크면 동기화 source 전환이 아님

## 6. 한계

1. stall 중 residualPpAll(가속 ~11m)은 FS 4s 성김 한계 — 정상 smoothness 로 주장하지 않음. 게이트는 jump/axis.
2. 사용자 사진 잔여튐의 RTDB 공백 여부는 이번에도 미측정 — diag export 로 다음 관측.
3. oneWayStall·clockJump 기존 한계 보존.
4. commit/push/deploy 없음.

## 7. 사용자 재시험 (path 동일)

| 항목 | 값 |
|------|-----|
| path | `C:\20.HDev\boxcycle` · branch `fix/peer-spacing-jitter` |
| 시작 | `cd apps/web; npm run dev` → `http://127.0.0.1:5000/` (또는 기존 포트) |
| 절차 | 두 독립 프로필 · 같은 Trail · 저속 10–20초 + 한쪽 일시 끊김/정지/가속 구간 |
| 진단 | 위 `__rtwPeerIngestDiag` + `__rtwPeerSmooth` |
| 기대 | 축 전환 수 m 급 튐 없음 · FS estimated 구간은 성김 residual 가능(완료 주장 아님) |

오프라인: `cd apps/web && npm run test:peer-residual-jitter`
