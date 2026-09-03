# S4 진행 상황 REPORT — S4-1~S4-3 채택·main2 병합 · S4-4(동행 라이더 튐) 미해결 일단락

**현재 활성 지시 없음.** S4-4 는 재개 보류 상태다. S4-5~S4-15 는 main2 에 병합하지 않는다.

공유 Trail 문서 `lastActivityAt` 쓰기를 60초 창에서 셌다. `trails/{id}`
구독은 **코드 검사로 부재**(③ N/A 미배선, 관측치 아님). 라이더 1→2 의 updateDoc 은
2배(선형)였다. 한 명이 route 1Hz 로 같은 필드를 중복으로 치는 것만 heartbeat 간격으로 합쳤다.

주행을 끝내거나 탭을 숨기거나 Trail을 바꿔도, 늦게 도착하는 진행률·위치 쓰기가 지워진 행과
노드를 다시 살리지 않는다. 같은 Trail을 곧바로 다시 시작해도 앞 세션의 뒤늦은 정리가
새 행을 지워버리지 않는다.

평소 달릴 때 쓰기량과 동행 위치 감각은 S4-1에서 맞춘 수준을 유지한다. **종결된 것은
발행 수명주기(route + motion)다.** 목록·저줌 구독이 만드는 읽기 비용은 아직 남아 있다.
「멀티라이더 위치 동기화 결함 종결」이 아니다. **동행 라이더 앞뒤 튐(S4-4)도 미해결이다.**

---

## 현재 상태 (2026-08-25)

| 항목 | 값 |
|---|---|
| 활성 지시 | **없음** — `INSTRUCTION.md` 는 작업 없음·재개 보류 표시 |
| S4-4 (동행 라이더 튐) | **미해결 일단락**. 원인 구간 특정 진행 중 중단 |
| main2 | `66c9a5d` — 제품 코드는 **S4-1 · S4-2 · S4-2R · S4-3 까지만** 병합(`d879588`). 이후는 문서 커밋뿐 |
| feature HEAD | `fix/multiplayer-read-amplification` @ **`0f5d35a`** (origin 동기) |
| S4-4 ~ S4-15 | **main2 병합 금지.** feature 브랜치에만 존재 |
| 현황 보고서 | [260825-동행-라이더-튐-S4-4-현황-보고서](../../archive/260825-동행-라이더-튐-S4-4-현황-보고서.md) |
| S4-15 결과 정본 | `INSTRUCTION-S415.md` |

### feature 브랜치에 남은 것의 성격 — 「계측기 전용」이 아니다

`main2..0f5d35a` 의 `apps/web/src` 변경 12 파일 2,064 줄에는 **채택되지 않은 제품 실험이 섞여 있다.**

| 성격 | 파일 | 비고 |
|---|---|---|
| **채택되지 않은 제품 동작 변경** | `peerMotion/integrator.ts` · `syncFromPresence.ts` · `types.ts` · `PeerMotionRegistry.ts` 일부 | **S4-5** — 보간 시간축을 `recvAtMs` → `serverAtMs` + clock offset EMA 로 바꾼다. **DEV 게이트가 없어 상시 동작**한다. Chief 실주행에서 증상을 해결하지 못해 **미채택** |
| **채택되지 않은 제품 실험 (DEV 전용)** | `peerMotion/peerDisplayMode.ts` · `peerDisplayAbsorb.ts` · `PeerMotionRegistry.ts` 배선 | **S4-13 A/B** — 적응 발행 임계 E + 흡수 τ. `readPeerDispMode()` 가 `import.meta.env.DEV` 아니면 `off` 를 돌려주므로 프로덕션은 항상 off. Chief 실주행에서 OFF 와 구분 불가 → **탈락** |
| **계측기·판정기** | `peerMotion/peerJitterCapture.ts` · `peerChainCapture.ts` · `installPeerJitterDebug.ts` · `installPeerChainDebug.ts` · `MapView.tsx` DEV 호출 | S4-4~S4-15 캡처·판정 도구 |

따라서 **「S4-4~S4-15 는 계측·판정기 전용」이라는 서술은 틀렸다.** 이 브랜치를 병합하면
미채택 S4-5 시간축 변경이 제품에 상시로 들어간다. 병합 금지의 이유가 여기에 있다.

---

## 반증

해당 없음. 이번 문서는 신규 수정·재시험이 아니다. route 반례는 `S41R-lifecycle-baseline.json`,
motion 반례는 `S4M1-lifecycle-baseline.json` · `S4M1-lifecycle-baseline-r.json` 에 남아 있다.
수정 후 T1~T5 는 `S41R-lifecycle.json` `allPass=true`, M1~M6 는 `S4M1-lifecycle.json` `allPass=true` 다.

---

## UAG

**S4-1R2·S4-M1R WARNING 채택(route·motion 발행 수명주기 종결) · 위치 동기화 미종결**

「비용 종결」·「멀티라이더 위치 동기화 결함 종결」이 아니다. 종결 범위는 발행 수명주기다.

| 단계 | 한 줄 | 판정 |
|---|---|---|
| H-1R | HUD 「다른 라이더 없음」을 live ride 행(나 제외) 기준으로 | **보고완료** |
| S3A | motion 발행 큐 제거 (single-flight · latest-wins) | **PASS 채택** |
| S3B-1 | D-0 샘플링 낡음 제거 | **PASS 채택** |
| S3B-2 | D-1 적용속도 발행 | **PASS 채택** |
| S3B-3 | D-2 저줌 적분 + spectator 실제속도 | **PASS 채택** |
| S4-1 | route 쓰기 폭주 제거 (in-flight 64→1 · cruise ~0.95/s) | **PASS 채택** |
| S4-1R | epoch · drain · 정리 순서 | **채택 보류** — 시험이 2 s timeout 경로를 안 밟음 |
| S4-1R2 | 지연 정리 + 세션 소유권 · T1~T5 | **WARNING 채택** |
| S4-1R2-C | 17 파일 커밋 고정 | **완료** `b3336ed` · `8b238a8` · `e14b38f` |
| S4-1R2-D | 워킹트리 정리 · docs-only | **완료** `b6aa635` |
| S4-M0 | 기준점 고정 · REPORT 커밋 | **완료** `4089e2c` |
| S4-M1 | motion 수명주기 — §2-1에서 정지 (과대 결론, 구현 없음) | **정정됨** → S4-M1R |
| S4-M1R | motion epoch·배수·소유권·지연삭제·오류전달 · F-2 | **WARNING 채택** `71669a1` · `41c2ea2` · `a2b58ff` |
| S4-2 | 읽기 증폭 — collectionGroup 중복 1건 정리 | **보고완료** `407b56a` |
| S4-2R | 첫 스냅샷 전 빈 목록 유출 차단 (hasSnapshot) | **보고완료** `88c3d14` |
| S4-3 | `touchTrailInstanceActivity` · heartbeat | **보고완료** `cb5f1c2` · 계측 `6294600`. N×M 스냅샷 없음. ② 선형. 1Hz touch 합침. M3 실화면 미완 |
| S4-4 | 동행 라이더 앞뒤 튐 — 최초 재현 시도 | **BLOCK** — 판정기가 화면 앞뒤를 고정 Y축으로 가정해 X축 반전을 버렸다 |
| S4-4R ~ R7 | 판정기를 진행축 투영으로 교정 · 재판정 반복 | 판정기 결함 수정. R3·R4·R5 감리 결론 **철회** |
| S4-5 | 보간 시간축 `recvAtMs` → `serverAtMs` + offset EMA | **미채택** — 제품 동작 변경이나 Chief 실주행에서 증상 미해결. main2 병합 금지 |
| S4-6 ~ S4-11 | 예측·스케일(pxPerM 83.44)·체인 계측 준비 | 도구 정비 |
| S4-12 | 적응 발행 E × 흡수 τ 조합 120 개 탐색 | `passN: 0` · `verdict: "불가"` |
| S4-13 | OFF / A / B 노브 Chief 실주행 | **탈락** — 셋 다 튐, 체감 차이 분간 불가. A/B 제품 실험 코드는 feature 에 남음(DEV 전용) |
| S4-14 | 동일 프레임 전체 체인 계측 | **증상 재현 PASS**. 구간을 `displayDistM` 이후~최종 DOM 으로 좁힘 |
| S4-15 | 좌표 변환 3분기 계측 | **미확정 일단락** — 11.45 Hz trace 에서 `projected` 단계 최초 관측. 원인 파라미터 미특정 |

---

## 기술

### S4-3 시점 기준점 (2026-08-20 기록 · 현재 상태는 맨 위 표를 본다)

| 항목 | 값 |
|---|---|
| HEAD | `cb5f1c2` (S4-3 제품) · 계측 `6294600` · merge `66ebe7b` |
| S4-1R2 제품 | `b3336ed` |
| S4-M1R 제품 | `71669a1` (motion 수명주기 · F-2) |
| S4-M1R 시험·도구 | `41c2ea2` |
| S4-M1R 증거·문서 | `a2b58ff` |
| stash | 2 건 — `orchestrator-docs: CLAUDE.md + 결정로그 (S4-1R2-D 정리)` · `wip before god-file-split` |

### S4-3 수용 요약 (2026-08-20)

공유 Trail 문서 `lastActivityAt` 쓰기를 60초 창에서 셌다. `trails/{id}` onSnapshot 은 **코드 검사로 부재**(③ N/A 미배선, 관측치 아님). 라이더 1→2 에서 ②는 2.0배(선형)다. 한 클라이언트 route 1Hz touch 가 30s heartbeat 와 같은 필드를 중복으로 쳐, 호출은 남기고 updateDoc 만 heartbeat 간격으로 합쳤다. A ② 62→3. heartbeat·진행률 주기 불변.

#### §0 게이트

```
pwd                     C:/20.HDev/rtw-sync-s4-2/repo
git rev-parse --abbrev-ref HEAD     fix/multiplayer-read-amplification
git rev-parse --short HEAD          66ebe7b
활성 INSTRUCTION 의 지시번호        S4-3
```

`rtw.code-workspace` 폴더: boxcycle · rtw-hud-h1 · rtw-sync-s4-2. 현재 창은 단일 폴더 rtw-sync-s4-2/repo.
`apps/web/src/lib/boxcycle.code-workspace` 없음. merge `66ebe7b`.

#### A~D (수정 전/후) — 예약과 실행을 나눔

증거: `S43-touch-baseline.json` · `S43-touch-after.json`

| 구간 | 전 ② | 후 ② | 전 ③ | 후 ③ | listing 실행 전/후 | ⑤ 전/후 |
|---|---|---|---|---|---|---|
| A 라이더1 | 62 | 3 | N/A(미배선) | N/A(미배선) | 2 / 2 | 2 / 2 |
| B 라이더2 | 124 | 6 | N/A(미배선) | N/A(미배선) | 4 / 4 | 4 / 4 |
| C 주행1+관전1 | 64 | 5 | N/A(미배선) | N/A(미배선) | | 4 / 4 |
| D idle | 0 | 0 | N/A(미배선) | N/A(미배선) | 0 / 0 | 0 / 0 |

A ① 는 전후 62 (routePublish 60 + heartbeat 2). 예약 62, 실행 2. B/A ② = 2.0 선형.

#### M0~M6

| | 항목 | 결과 |
|---|---|---|
| M0 | 계측 유효성 | PASS(①②④⑤). ③ N/A(미배선) — 제품 호출처 0건. A ①② 비-0. 예약/실행 분리 |
| M1 | 증폭 확인 | PASS. 60s 표. ② 선형 2.0. ③ N/A(미배선, 관측치 아님) |
| M2 | 수정 후 | PASS. 감소 지점=`touchTrailInstanceActivity` 의 Trail updateDoc |
| M3 | 기능 회귀 없음 | 미완. F1~F5 실화면·`S43-shots/` 없음 |
| M4 | 예산 무변화 | PASS. heartbeat 30s · 진행률 1Hz 무변경 |
| M5 | S4-2 유지 | PASS. `test:s42-meters` 15. CG 2→1 유지 |
| M6 | 회귀 | PASS. `tsc -b` 0 · 변경 파일 eslint 0 · `test:peer-s3a-replay` d0·d1 유지 |

고치지 않음: listing hub, presence 주기, 진행률 주기, `touchTrailInstanceActivity` 제거, Trail 구독.

### S4-1R2 수용 요약 (재시험 없음 · 기존 산출물)

- T1~T5 전부 PASS (`S41R-lifecycle.json`)
- FS route **0.96**/s · in-flight **[1,1,1]** · z15 depart/cruise `D_eff` **240/240** · afterMax.max **2.317** ≤ 2.5
- spectator p50 **2.55 m** · max **19.6 m** (상한 57 / 87)
- `ROUTE_FLIGHT_DRAIN_TIMEOUT_MS = 2000` 불변

### S4-M1R 수용 요약 (재시험 없음 · 기존 산출물)

- M1~M6 전부 PASS (`S4M1-lifecycle.json`)
- F-2 종결 — pt3 `ok=0=1` · `onMotionError` 도달 (`rtw-motion-write-fault-once`) · 이후 ok=1
- motion `deferredRunTotal=1` · `deferredSkipTotal=2` (M4)
- W-2 motion `lateWriteDoneAt=1786658824472` < `deleteDoneAt=1786658824509` (Δ 37 ms)
- `MOTION_FLIGHT_DRAIN_TIMEOUT_MS = 2000` 불변 · route 배수와 직렬 연결 없음 (`Promise.all`)

### WARNING 부채

- **W-1 종결** — motion `deferredRunTotal=1` · route `routeDeferredRunTotal=1` (실측 카운터)
- **W-2 종결 (motion만)** — `lateWriteDoneAt < deleteDoneAt` Δ 37 ms
- **W-2'** W-2 는 motion 만 종결. route 는 `routeW2=null` 로 미종결
  (「route 제품 로직 무수정」을 지킨 결과이므로 위반이 아니다)
- **W-3** z15-cruise 런1 `residualMax=3.534` — 단일런 꼬리 재발
  S3B-3 2.51 → S4-1 4.93 → S4-1R2 2.317 → S4-M1R 3.534
  Chief 의 3 런 중앙값 규칙상 판정은 중앙값 0.784 로 통과.
  이번 변경 탓인지 런 변동인지 미분리
- **W-4** M4 는 수정 전 반례 미획득 — 회귀 가드로 격하.
  같은 Trail 재시작 경쟁은 after 의 `deferredSkipTotal=2` 로만 증명된다

### 남은 것 (다음 지시 대기)

```
S4-2   읽기 증폭 — 보고완료. collectionGroup consumer 2 → underlying 1
S4-2R  첫 스냅샷 전 [] 유출 차단 — 보고완료. 로딩 조기 종료·빈 목록 선노출 제거. 2→1 유지
S4-3   touch · heartbeat — 보고완료. N×M 스냅샷 없음. ② 선형. 1Hz lastActivityAt 합침. M3 실화면 미완
S4-4   동행 라이더 앞뒤 튐 — **미해결 일단락**. S4-15 까지 진행 후 재개 보류.
       11.45 Hz trace 에서 projected 단계 최초 관측. 원인 파라미터 미확정.
       재개 시 카메라 4파라미터 분기 + 60 fps 단일 브라우저 재검증부터
F-1    peer visibility 초기 시각 0
```

F-2 는 종결(`onMotionError`). motion 발행 수명주기 공백은 해소(`71669a1`).

### 이견 · 실패

- M3: F1~F5 실제 화면 미촬영. `S43-shots/` 없음. 성공으로 포장하지 않음.
- App.tsx·useTrailSession·useTrailLivePublicationRidePublisher 호출 태그 미커밋 (pre-commit 이 파일 전체 eslint 선행 오류로 거부).
- 이견: `S41R2-summary.json` · `S41M1-summary.json` 최상위 `instruction` 필드는 `"S4-1"`
(요약기 고정 문자열). 인용은 파일명으로 한다.

S4-2 는 collectionGroup 중복 1건을 정리하고 보고완료. S4-M2 문서화 라운드의 제품 무수정 기록은 위에 그대로 둔다.
