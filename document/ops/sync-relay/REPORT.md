# S4 진행 상황 REPORT — route·motion 발행 수명주기 종결 · 위치 동기화는 미종결

S4-4R2: S44 의 진행축 반전 38회·최대 46.7px 가 카메라인지 peer인지만 갈랐다.
로컬 좌표를 켠 채 S44 조건 C-A 25/25 · C-B 32/10 을 다시 찍었다. 수십 px 급이
다시 나왔고(C-A 35.4 · C-B 65.0) K1(①−②=③) 은 통과했다. 판정은 **혼합**.
제품 보간·merge·카메라는 그대로다.

S4-4R: S4-4 의 「재현되지 않음」은 판정기가 앞뒤를 화면 Y 로 고정해서 BLOCK 됐다.
기존 캡처를 진행축 투영으로 다시 읽으면 42.6px 반전 6회는 전부 진행축 부호 반전이다.
제품 보간·merge·카메라는 그대로다. 앞뒤 튐은 아직 못 고쳤다.

S4-4: 상대 라이더 앞뒤 튐을 에뮬레이터 2인 슬라이더로 다섯 축 동시에 남겼다.
displayDistM 역행은 최대 0.257 m 이고 화면 앞뒤(Y) 반전은 0회다. 이 조건에서
앞뒤 튐은 재현되지 않았고, merge·보간·카메라는 건드리지 않았다.

공유 Trail 문서 `lastActivityAt` 쓰기를 60초 창에서 셌다. `trails/{id}`
구독은 **코드 검사로 부재**(③ N/A 미배선, 관측치 아님). 라이더 1→2 의 updateDoc 은
2배(선형)였다. 한 명이 route 1Hz 로 같은 필드를 중복으로 치는 것만 heartbeat 간격으로 합쳤다.

주행을 끝내거나 탭을 숨기거나 Trail을 바꿔도, 늦게 도착하는 진행률·위치 쓰기가 지워진 행과
노드를 다시 살리지 않는다. 같은 Trail을 곧바로 다시 시작해도 앞 세션의 뒤늦은 정리가
새 행을 지워버리지 않는다.

평소 달릴 때 쓰기량과 동행 위치 감각은 S4-1에서 맞춘 수준을 유지한다. **종결된 것은
발행 수명주기(route + motion)다.** 목록·저줌 구독이 만드는 읽기 비용은 아직 남아 있다.
「멀티라이더 위치 동기화 결함 종결」이 아니다.

- **지시번호**: S4-4R2 (46.7px 반전 — 카메라인가 peer인가)
- **일시**: 2026-08-20
- **브랜치**: `fix/multiplayer-read-amplification` (origin/main2 결합 완료 `66ebe7b`) · 판정 `e45e9ec` · 캡처 `9b6c309`
- **활성 지시**: **S4-4R2 보고완료** (`INSTRUCTION.md`)
- **원격**: origin `fix/multiplayer-read-amplification`
- **워킹트리**: `C:/20.HDev/rtw-sync-s4-2/repo`
- **보존**: `INSTRUCTION-S44.md` · `INSTRUCTION-S44R.md` · `S44-jitter-capture.json` · `S44R-rejudge.json` · `S44R-C1-left-5kmh.json` · `S44R2-A-25-25.json` · `S44R2-B-32-10.json`

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
| S4-4 | 상대 라이더 앞뒤 튐 | **BLOCK** `b545ffa` — Y 고정 판정. 캡처 `9f3d5e9` 는 유지 |
| S4-4R | 진행축 판정 · 재판정 | **WARNING 채택** 판정기 `cd640d3`. 42.6px 6회=진행축. 제품 미수정 |
| S4-4R2 | 카메라 vs peer | **보고완료** 판정 `e45e9ec`. 46.7급 재현. K1 통과. **혼합**. 제품 미수정 |

---

## 기술

### 지금 기준점

| 항목 | 값 |
|---|---|
| HEAD | 판정 `e45e9ec` · S4-4R 판정기 `cd640d3` · 재판정 `ea39f6e` · S4-4 캡처 `9f3d5e9` · S4-3 제품 `cb5f1c2` |
| S4-1R2 제품 | `b3336ed` |
| S4-M1R 제품 | `71669a1` (motion 수명주기 · F-2) |
| S4-M1R 시험·도구 | `41c2ea2` |
| S4-M1R 증거·문서 | `a2b58ff` |
| stash | 2 건 — `orchestrator-docs: CLAUDE.md + 결정로그 (S4-1R2-D 정리)` · `wip before god-file-split` |

### S4-4R2 수용 요약 (2026-08-20)

S44 조건을 로컬 화면 좌표 켠 채로 다시 찍었다. ① peer 절대 · ② local 절대 ·
③ (peer−local) 을 같은 û 에 투영. K1 잔차 ≈ 0.
C-A 35.4 px · C-B 65.0 px 로 S44급 재현. 판정 **혼합** — 카메라만도 peer만도 아님.
제품 미수정. 증거: `S44R2-A-25-25.json` · `S44R2-B-32-10.json` · `S44R2-shots/`.

| | 항목 | 결과 |
|---|---|---|
| K0 | 계열 3종 | 같은 프레임 ①②③ · hasLocalScreen true |
| K1 | 검산 | ①−②−③ 최대 1.42e-14 px |
| K2 | 반전 재현 | C-A 35.4 · C-B 65.0 |
| K3 | 판정 | 혼합 |
| K4 | 원시 보고 | px 횟수·최대·진폭. 미터 환산 없음 |
| K5 | 제품 무변경 | integrator·merge·카메라 diff 없음 |
| K6 | 무훼손 | s42 15 · s43 11 · peer-s3a d0·d1 · tsc · eslint 0 |

### S4-4R 수용 요약 (2026-08-20)

판정기가 앞뒤를 화면 Y 로 고정한 것이 BLOCK 원인이었다. 진행축 û 는
displayDistM 전진 창 회귀. 기존 `S44-jitter-capture.json` 을 덮지 않고 다시 읽으면
42.6px 반전 6회는 전부 진행축 부호 반전(전체 38회·최대 46.7px). RTDB 원본 역행 0.
C1 좌측 5km/h startGap −7.8m. 제품 미수정. 증거: `S44R-rejudge.json` · `S44R-C1-left-5kmh.json`.

| | 항목 | 결과 |
|---|---|---|
| R0 | 판정기 자가 검산 | X/Y 우세 합성 로그 모두 진행축 반전 |
| R1 | 재판정 | 42.6px 6회 = 진행축 |
| R2 | 원시 보고 | 거리 3·0.257m. 진행축 38·46.7px. 밴드 미만 28 |
| R3 | 8 px 근거 | 라벨만. S44 11.6px/m→8px≈0.69m. 합격선 아님 |
| R4 | 카메라 분리 | C1 로컬 화면 좌표·상대 투영 있음 |
| R5 | Chief 조건 | C1 좌측·5km/h. 나란히 ≤5m 는 미달 |
| R6 | 최초 이상 단계 | 화면. 카메라 단정 아님 |
| R7 | 무훼손 | s42 15 · s43 11 · peer-s3a d0·d1 · tsc · eslint 0 |

### S4-4 수용 요약 (2026-08-20)

에뮬레이터 2인(슬라이더 25/25 근접 → 32/10 추월)에서 다섯 축을 같은 시계로 남겼다.
앞뒤 튐은 재현되지 않았다. 거리축 역행 최대 0.257 m. 화면 앞뒤(Y) 반전 0회.
ingest 425회 전부 `rtdb-only` — `mergePeerMotionPackets` 제품 미호출.
하네스 확장·제품 수정 없음. 증거: `S44-jitter-capture.json` · `S44-jitter-shots/`.

| | 항목 | 결과 |
|---|---|---|
| J0 | 재현 확보 | 로그·근접 샷 있음. **앞뒤 튐이 보이는 샷은 실패** |
| J1 | 축 판정 | 이 창에서 none. 거리축 아님. 화면 앞뒤(Y) 0회. 좌우(X)만 |
| J2 | 하네스 | N/A (거리축 아님). merge 재생 안 넓힘 |
| J3 | 재현 고정 | 없음 |
| J4 | 수정 후 | 판정하지 않음 (J3 없음). 제품 미수정 |
| J5 | 순간이동 없음 | displayDistM 최대 역행 0.257 m |
| J6 | 1 단계 무훼손 | `test:peer-s3a-replay` d0·d1 pass |
| J7 | S4 비용 무훼손 | `test:s42-meters` 15 · CG 2→1 · `test:s43-meters` 11 |
| J8 | 회귀 | `tsc -b` 0 · 변경 파일 eslint 0 |

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
S4-4   상대 라이더 앞뒤 튐 — BLOCK (Y 고정 판정). 캡처 `9f3d5e9` 유지
S4-4R  진행축 판정 — WARNING 채택. 42.6px=진행축. 제품 미수정. 튐 자체는 미해결
S4-4R2 카메라 vs peer — 보고완료. 혼합. 제품 미수정
F-1    peer visibility 초기 시각 0
```

F-2 는 종결(`onMotionError`). motion 발행 수명주기 공백은 해소(`71669a1`).

### 이견 · 실패

- M3: F1~F5 실제 화면 미촬영. `S43-shots/` 없음. 성공으로 포장하지 않음.
- S4-4 J0: 근접 2인 샷은 있으나 Y 고정 판정으로 앞뒤를 놓침. S4-4R 에서 진행축으로 재확인.
- S4-4R: C1 |gap|≤5m 나란히 미달(7.8m). 제품 앞뒤 튐은 못 고침.
- S4-4R2: C-A startGap 21.8 m. 「근접」단정 안 함. 판정은 혼합이라 카메라/peer 단독 수정 금지.
- App.tsx·useTrailSession·useTrailLivePublicationRidePublisher 호출 태그 미커밋 (pre-commit 이 파일 전체 eslint 선행 오류로 거부).
- App.tsx·useTrailSession·useTrailLivePublicationRidePublisher 호출 태그 미커밋 (pre-commit 이 파일 전체 eslint 선행 오류로 거부).
- 이견: `S41R2-summary.json` · `S41M1-summary.json` 최상위 `instruction` 필드는 `"S4-1"`
(요약기 고정 문자열). 인용은 파일명으로 한다.

S4-2 는 collectionGroup 중복 1건을 정리하고 보고완료. S4-M2 문서화 라운드의 제품 무수정 기록은 위에 그대로 둔다.
