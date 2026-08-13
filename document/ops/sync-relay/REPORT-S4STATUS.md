# S4 진행 상황 REPORT — route 큐 수명주기 종결 · 위치 동기화는 미종결

주행을 끝내거나 탭을 숨기거나 Trail을 바꿔도, 늦게 도착하는 진행률 쓰기가 지워진 행을 다시 살려
목록에 「아직 달리는 사람」처럼 남는 일은 막았다. 같은 코스를 곧바로 다시 시작해도 앞 세션의
뒤늦은 정리가 새 행을 지워버리지 않는다.

평소 달릴 때 쓰기량과 동행 위치 감각은 S4-1에서 맞춘 수준을 유지한다. 목록·저줌 구독이 만드는
읽기 비용과, motion 경로의 같은 수명주기 공백은 아직 손대지 않았다.

- **지시번호**: S4-STATUS (진행 상황 보고 · 신규 구현 없음)
- **일시**: 2026-08-14
- **브랜치**: `fix/multiplayer-position-sync` (base `main2`) · HEAD `b6aa635`
- **활성 지시**: 없음 — `INSTRUCTION.md` 는 S4-1R2-D **보고완료**
- **원격**: origin보다 **ahead 4** (미푸시 · Codex 검토 대기)
- **워킹트리**: 이 보고 작성 시점 기준, 본 파일만 갱신
- **보존**: `REPORT-S41R2.md` · `INSTRUCTION-S41R2C.md` · `S41R-lifecycle.json` · `S41R2-summary.json` · `S41R-summary-s41fmt.json`

---

## 반증

해당 없음. 이번 문서는 신규 수정·재시험이 아니다. S4-1R2 의 「수정 전 T1~T3 행 부활」반례는
`S41R-lifecycle-baseline.json` 에 남아 있고, 수정 후 T1~T5 는 `S41R-lifecycle.json` `allPass=true` 다.

---

## UAG

**S4-1R2 WARNING 채택(route 큐 수명주기 종결) · S4-1 성능 유지 · 위치 동기화 미종결**

「비용 종결」·「멀티라이더 위치 동기화 결함 종결」이 아니다.

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
| S4-1R2-D | 워킹트리 정리 · docs-only | **완료** `b6aa635` · status clean |
| S4-2 | 읽기 증폭 N² · RTDB `onValue` · collectionGroup | **중단** — 재개 조건 미정리 |
| S4-3 | `touchTrailInstanceActivity` · heartbeat | **대기** (S4-2 뒤) |

---

## 기술

### 지금 기준점

| 항목 | 값 |
|---|---|
| HEAD | `b6aa635` `docs(sync): S4-1R2 종결 — 커밋 해시 확정·워킹트리 정리` |
| S4-1R2 제품 | `b3336ed` (2) |
| S4-1R2 시험·도구 | `8b238a8` (3) |
| S4-1R2 증거·문서 | `e14b38f` (12) |
| stash | 2 건 — `orchestrator-docs: CLAUDE.md + 결정로그 (S4-1R2-D 정리)` · `wip before god-file-split` |

### S4-1R2 수용 요약 (재시험 없음 · 기존 산출물)

- T1~T5 전부 PASS (`S41R-lifecycle.json`)
- FS route **0.96**/s · in-flight **[1,1,1]** · z15 depart/cruise `D_eff` **240/240** · afterMax.max **2.317** ≤ 2.5
- spectator p50 **2.55 m** · max **19.6 m** (상한 57 / 87)
- `ROUTE_FLIGHT_DRAIN_TIMEOUT_MS = 2000` 불변

### WARNING 부채 (재개발 아님 · 지금 재시험 금지)

- **W-1** deferred 실행(`run>0`) 경로가 카운터로 직접 증명되지 않음 — 행 부재로 간접 확인. T5 는 skip만 `deferredSkipTotal=2`
- **W-2** 삭제 시각과 늦은 쓰기 완료 시각의 선후를 기록하지 않음 — 최종 상태만 관측

후속은 motion 수명주기 이식 때 같은 하네스에 삭제 시각·run/skip 카운터를 함께 기록하는 쪽으로 넘긴다.

### 남은 것 (다음 지시 대기)

```
S4-2   읽기 증폭 — HANDOFF 문구는 「S4-1R 채택 뒤 재개」이나
       S4-1R 은 보류, 실질 채택은 S4-1R2 WARNING. 감리 지시 없이 착수 금지
S4-3   touch · heartbeat
F-1    peer visibility 초기 시각 0
F-2    RTDB 쓰기 오류가 삼켜짐
motion route 와 같은 epoch·drain·세션 소유권 공백 — S4-2 전에 순서를 정해야 함
```

### 이견 · 실패

실패 없음. 이견: `S41R2-summary.json` 최상위 `instruction` 필드는 `"S4-1"` (요약기 고정 문자열). after 런은 `S41R2-*` 다. 인용은 파일명으로 한다.

신규 구현·e2e 재실행·S4-2 착수 없음.
