# 감리 → 개발팀장 지시서 (활성) — S4-5 송신 격자 보간 + 하네스 두 층 (A안)

> S4-4R7 은 `INSTRUCTION-S44R7.md` 로 보존했다(감리가 옮겨 둠. 문서 커밋에 담아라).
> 결과는 §7 형식으로 이 파일 아래에 덧붙이고 `상태` → `보고완료`.

- **지시번호**: S4-5 (보간 축 교체 · 지터 시나리오 · gap_px 게이트 — 원인 가리기)
- **발신**: 클로드감리0820 · **일시**: 2026-08-20 · **상태**: 착수대기
- **브랜치**: `fix/multiplayer-read-amplification` · worktree `C:/20.HDev/rtw-sync-s4-2/repo` (현재 `49661d9`)

---

## 0. Chief 결정 — A안 채택

너의 재설계 보고는 진단이 대체로 옳았다. **다만 지금 하는 것은 ①②③ 뿐이다.**

```
채택   ① 보간 축을 수신 시각 → 송신 격자로
       ② replay 에 수신 지터 시나리오
       ③ replay 에 gap_px(화면 층) 게이트
보류   ④ pose 함수 통합 (로컬·peer·카메라 한 틱)   — ①~③ 결과를 보고 판단
보류   ⑤ merge 제품 경로 제거                       — 정리이지 수정이 아니다. 별건
```

**원인은 아직 확정되지 않았다.** 구조가 그 증상을 허용한다는 것과 그 구조가 그 증상을 만들었다는 것은 다르다.
R7 이 확인한 것은 「화면에서 왕복한다」까지다. ①~③ 은 **원인을 가리기 위한 것**이지 수정이 아니다.

### 0-1. 네 보고의 수치 하나를 정정한다

> 「±0.07 m 는 R7 의 10.8 px 와 같은 스케일이다」

산수 앞부분은 맞다. 뒷부분이 틀렸다. 그 창의 축척은 94 px / 3.22 m = **29.2 px/m** 다.

```
±0.07 m  →  ±2.0 px  →  진폭 4.1 px
R7 실측 진폭                    10.8 px        2.6 배 차이
```

**같은 스케일이 아니라 관측 진폭의 약 1/3 을 설명한다.** 이 문장을 인용하지 마라.

### 0-2. 네가 과소평가한 것 — 작업이 싸다

```ts
// types.ts — 이미 있다
serverAtMs: number;
seq?: number;
```

**패킷은 이미 송신 시각과 시퀀스를 나른다.** ①은 프로토콜 변경이 아니라
`integrator` 가 그것을 쓰게 하는 일이다.

---

## 1. ① 보간 축 교체 — 여기가 본체다

`integrator.ts:171-173` 이 현재다.

```ts
const span = s1.recvAtMs - s0.recvAtMs;
const t = span > 0 ? (renderTime - s0.recvAtMs) / span : 0;
```

송신은 100 ms 격자인데 보간 dt 가 도착 시각이다. **네트워크 지터가 움직임으로 주입된다.**

### 1-1. 이렇게 바꿔라

```
offset = EMA(recvAtMs − serverAtMs)          수신·송신 시계 차 추정
renderTime_send = (now − offset) − PEER_INTERP_DELAY_MS
보간 span·t 를 **serverAtMs** 로 계산한다
```

**상수를 바꾸지 마라.** `PEER_INTERP_DELAY_MS=160` · `BUFFER_MAX=16` · `MAX_EXTRAP=1200` 그대로다.
이번에 바꾸는 것은 **축 하나**다.

### 1-2. 【위험】 시계 혼용 — 코드가 이미 경고하고 있다

`integrator.ts:67-69` 주석이다.

```
dedup 은 distM 전진 기준 — RTDB t 와 Firestore lastSeenAt 의 clock 혼용을 피한다.
(serverAtMs 로 dedup 하면 Firestore 시각이 앞설 때 5Hz RTDB 위치가 통째로 버려져…)
```

그리고 `rowToPacket.ts:28` 은 이렇다.

```ts
serverAtMs: row.lastSeenAtMs ?? 0,      // ← Firestore 경로는 0 이 될 수 있다
```

**보간 축을 serverAtMs 로 옮기면 그 코드가 일부러 피한 함정에 다시 들어간다.**

지켜라.

```
가드 1   serverAtMs 가 0·없음·비단조면 그 스냅샷 쌍은 **recvAtMs 로 폴백**한다
가드 2   dedup 은 **distM 전진 기준 그대로 둔다.** serverAtMs 로 바꾸지 마라
가드 3   폴백이 몇 번 일어났는지 세어 보고하라 (0 이면 RTDB 경로가 깨끗하다는 뜻)
```

제품 ingest 는 `rtdb-only` 425/425 였다(R6 확인). 그래도 가드는 넣어라.

### 1-3. 【위험】 stall 외삽을 되살리지 마라

`integrator.ts:150-160` 의 stall 분기는 `entity.speedMps` 를 쓴다. **버퍼의 `newest.speedMps` 가 아니다.**
그 수정으로 정지 오버슛 7.2 m → 0 m 가 됐다. 축을 바꾸면서 이 분기를 건드려
`newest.speedMps` 로 되돌리면 **신호대기 오버슛이 재발한다.**

`aheadMs` 기준도 `newest.recvAtMs` → 송신 축으로 옮길 때 **홀드 상한이 유지되는지** 시험으로 고정하라.

---

## 2. ② 수신 지터 시나리오

`scenarios.mjs` 에 추가하라. **기존 시나리오를 고치지 마라.**

```
송신은 100 ms 격자로 등속 전진 (distM 은 정확히 등간격)
도착만 흔든다 — 50 ~ 150 ms (±50 %)
불변식:  dist(t) 가 단조이고, 구간 속도가 송신 등속에서 크게 벗어나지 않는다
```

**수정 전에 이 시나리오가 실패해야 한다.** 실패하지 않으면 지터를 충분히 안 넣은 것이다.
수정 후 통과를 확인하라. **수정 전 실패를 먼저 보여라.**

---

## 3. ③ gap_px 게이트 (화면 층)

하네스에 실제 지도 투영을 넣지 마라. **고정 축척 대리값**으로 충분하다.

```
축척   R7 창 실측 29.2 px/m 를 상수로 쓴다 (출처를 주석에 적어라)
gap_px(t) = (peer_dist(t) − self_dist(t)) × 29.2
게이트   gap_px 의 프레임 간 방향 전환 횟수·최대 |Δ|·진폭
```

**이것은 진짜 투영이 아니라 대리값이다.** 그렇게 명시하라. 합격선을 지금 정하지 말고
**수치를 남기는 것**이 목적이다 — 수정 전/후 비교에 쓴다.

---

## 4. 검증 — 예측을 먼저 적고 재라

감리의 예측이다. **맞으면 기여 확정, 빗나가면 원인은 다른 데 있다. 어느 쪽이든 결정적이다.**

```
도착 지터가 기여분이라면
  R7 조건 재측정 시 peer 픽셀 진폭 10.8 px  →  6 ~ 7 px 로 줄어야 한다
줄지 않으면
  도착 지터는 주원인이 아니다. 그 사실을 그대로 적어라
```

**결과를 예측에 맞춰 해석하지 마라.** 숫자를 먼저 내고 예측과 대조하라.

### 4-1. 재측정은 R7 방식 그대로

```
같은 조건   gap ≤ 5 m · 5 km/h · leftFlat · both visible
같은 계측   S4-4R7 픽셀 추출기 · self 정답 자가 검산(S0) 먼저
같은 산출   peer 픽셀 반전 횟수 · 최대 |Δ| · 진폭
```

산출: `S45-after-pixels.json` · `S45-after-summary.json` · `S45-shots/`
**R7 산출물을 덮어쓰지 마라.**

---

## 5. 금지

- 상수 변경 — `PEER_INTERP_DELAY_MS` · `PEER_INTERP_BUFFER_MAX` · `PEER_INTERP_MAX_EXTRAP_MS`
- dedup 을 `serverAtMs` 기준으로 변경 (§1-2 가드 2)
- stall 분기를 `newest.speedMps` 로 되돌리기 (§1-3)
- ④ pose 통합 · ⑤ merge 제거 — 이번 범위 밖 (§0)
- 죽은 상수(`PEER_RECONCILE_*`) 되살리기 · 외삽 상한 통폐합 — 별건
- 기존 시나리오·불변식 수정 · 기존 산출물 삭제·덮어쓰기
- `9f3d5e9` ~ `49661d9` 커밋 reset·revert·amend
- 수정 전 실패를 보이지 않은 채 「통과」를 성과로 보고
- 카메라 코드 수정 · `publish self vs rAF` 불일치 수정 (Chief 판단 사항)
- `git add -A` · `commit -a` · `--no-verify` · force · rebase · reset · amend · `python -c`·`sed` 우회 편집
- `C:/20.HDev/rtw-routes/repo` · `C:/20.HDev/rtw-hud-h1/repo` 접촉

---

## 6. 검증표

| | 항목 | 기준 |
|---|---|---|
| T0 | 축 교체 | 보간 span·t 가 `serverAtMs` 기준 · offset EMA 적용 |
| T1 | 시계 가드 | serverAtMs 0·없음·비단조 시 recvAtMs 폴백 · **폴백 횟수 보고** |
| T2 | dedup 불변 | distM 전진 기준 유지 확인 |
| T3 | stall 불변 | `entity.speedMps` 사용 유지 · 홀드 상한 유지 · 정지 오버슛 시험 |
| T4 | 지터 시나리오 | **수정 전 fail** → 수정 후 pass. 전 실패 로그 제시 |
| T5 | gap_px 게이트 | 대리 축척임을 명시 · 수정 전/후 수치 |
| T6 | 픽셀 재측정 | S0 자가 검산 통과 후 peer 진폭. R7 10.8 px 와 나란히 |
| T7 | 예측 대조 | 6~7 px 로 줄었는가 — 줄었다/안 줄었다 명확히 |
| T8 | 1 단계 무훼손 | `test:peer-s3a-replay` 기존 전 시나리오 · d0·d1 유지 |
| T9 | S4 비용 무훼손 | `test:s42-meters` · `test:s43-meters` · `tsc -b` · 변경 파일 eslint 0 |

**T4 에서 수정 전 실패를 못 보이면 T7 을 증명으로 쓰지 마라.**
**T8 이 깨지면 BLOCK 이다.** 1 단계 위치 정확도는 훼손하지 않는다.
**검증 항목을 항목명 그대로 적어라.**

---

## 7. 커밋 · 보고

```
커밋 1  하네스 — 지터 시나리오 · gap_px 게이트 (수정 전 fail 상태)
커밋 2  제품 — 보간 축 교체 + 가드
커밋 3  재측정 — S45-after-* · 샷
커밋 4  문서 — INSTRUCTION · INSTRUCTION-S44R7.md · REPORT.md
경로 지정 stage. **push 후** 보고. 보고완료 후에는 더 건드리지 마라
```

보고 형식.

```
[S4-5 결과]
- 축 교체 요약 (T0):
- 시계 폴백 횟수 (T1):
- dedup·stall 불변 (T2·T3):
- 지터 시나리오: 수정 전 fail 내용 → 수정 후 —
- gap_px 전/후 (T5):
- 픽셀 재측정: R7 진폭 10.8px → (T6)
- 예측 대조 (T7): 6~7px 로 줄었는가 —
- 1단계·S4 비용 무훼손 (T8·T9):
- 해석: 도착 지터가 기여분이었는가 —
- NEXT:
```

---

## 8. 확정으로 쓰지 말 것

```
도착 지터가 원인             이번에 가린다. 미리 단정하지 마라
±0.07 m = 10.8 px           틀림. 약 1/3 (§0-1)
publish vs rAF 불일치가 원인  미확정
S4-4                        **미해결**
```
