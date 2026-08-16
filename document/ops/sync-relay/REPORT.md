# S4 진행 상황 REPORT — route·motion 발행 수명주기 종결 · 위치 동기화는 미종결

주행을 끝내거나 탭을 숨기거나 Trail을 바꿔도, 늦게 도착하는 진행률·위치 쓰기가 지워진 행과
노드를 다시 살리지 않는다. 같은 Trail을 곧바로 다시 시작해도 앞 세션의 뒤늦은 정리가
새 행을 지워버리지 않는다.

평소 달릴 때 쓰기량과 동행 위치 감각은 S4-1에서 맞춘 수준을 유지한다. **종결된 것은
발행 수명주기(route + motion)다.** 목록·저줌 구독이 만드는 읽기 비용은 아직 남아 있다.
「멀티라이더 위치 동기화 결함 종결」이 아니다.

- **지시번호**: S4-2 (읽기 증폭 — 계측 먼저, 증명된 중복만 정리)
- **일시**: 2026-08-16
- **브랜치**: `fix/multiplayer-read-amplification` (base `main2@4249809`) · HEAD `407b56a`
- **활성 지시**: **S4-2 보고완료** (`INSTRUCTION.md`)
- **원격**: origin 첫 push `fix/multiplayer-read-amplification`
- **워킹트리**: `C:/20.HDev/rtw-sync-s4-2/repo`
- **보존**: `INSTRUCTION-S4M1R.md` · `S4M1-lifecycle.json` · `S41M1-summary.json` · `REPORT-S41R2.md` · `S41R-lifecycle.json`

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
| S4-3 | `touchTrailInstanceActivity` · heartbeat | **대기** (S4-2 뒤) |

---

## 기술

### 지금 기준점

| 항목 | 값 |
|---|---|
| HEAD | `407b56a` (S4-2 제품; 증거·문서는 후속 커밋) |
| S4-1R2 제품 | `b3336ed` |
| S4-M1R 제품 | `71669a1` (motion 수명주기 · F-2) |
| S4-M1R 시험·도구 | `41c2ea2` |
| S4-M1R 증거·문서 | `a2b58ff` |
| stash | 2 건 — `orchestrator-docs: CLAUDE.md + 결정로그 (S4-1R2-D 정리)` · `wip before god-file-split` |

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
S4-3   touch · heartbeat (S4-2 뒤)
F-1    peer visibility 초기 시각 0
```

F-2 는 종결(`onMotionError`). motion 발행 수명주기 공백은 해소(`71669a1`).

### 이견 · 실패

실패 없음. 이견: `S41R2-summary.json` · `S41M1-summary.json` 최상위 `instruction` 필드는 `"S4-1"`
(요약기 고정 문자열). 인용은 파일명으로 한다.

S4-2 는 collectionGroup 중복 1건을 정리하고 보고완료. S4-M2 문서화 라운드의 제품 무수정 기록은 위에 그대로 둔다.
