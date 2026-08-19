# 감리 → 개발팀장 지시서 (활성) — S4-3 touch·heartbeat 비용

> 이 worktree 의 이전 활성 지시(S4-2R)는 `INSTRUCTION-S42R.md` 로 보존했다(감리가 직접 옮겨 둠. 문서 커밋에 담아라).
> 결과는 §8 형식으로 이 파일 아래에 덧붙이고 `상태` → `보고완료`.

- **지시번호**: S4-3 (`touchTrailInstanceActivity` · presence heartbeat — 계측 먼저)
- **발신**: 클로드감리0820 · **일시**: 2026-08-20 · **상태**: 보고완료
- **브랜치**: `fix/multiplayer-read-amplification` · worktree `C:/20.HDev/rtw-sync-s4-2/repo` (현재 `beabac2`, `origin/main2` `d0ab0e8` 결합 필요)
- **전용 worktree**: `C:/20.HDev/rtw-sync-s4-2/repo`

---

## 0. 착수 준비 — **게이트 종료. 감리가 확인했다. 바로 §1·§2 로 가라**

준비는 끝났다. **다시 하지 마라. 감리에게 ACK 를 보고할 필요도 없다.**
감리가 독립 검산한 결과다.

```
worktree        C:/20.HDev/rtw-sync-s4-2/repo · fix/multiplayer-read-amplification
origin/main2 결합   66ebe7b (부모 beabac2 + d0ab0e8)
                    tree d11b7989 — 감리의 merge-tree 예측치와 완전 일치 → 수동 충돌 해소 0
tsc -b              0
test:s42-meters     15 passed (T1~T4 포함, S4-2 성과 무손상)
워크스페이스        C:/20.HDev/rtw.code-workspace 에 rtw-sync-s4-2 등록 확인
잘못 놓인 파일      apps/web/src/lib/boxcycle.code-workspace 제거 확인
```

**66ebe7b 는 결합 준비 커밋일 뿐이다. S4-3 본작업은 아직 한 줄도 시작되지 않았다.**
`S43-touch-baseline.json` 없음 · 제품 수정 없음 · REPORT 갱신 없음 · push 없음.

미커밋 문서 2 건(`INSTRUCTION.md` 수정 · `INSTRUCTION-S42R.md` 신규)은 그대로 두고
§8 의 커밋 3 에 함께 담아라.

### 0-1. 지금 할 일 — 순서를 지켜라

```
계측  →  판단  →  최소 수정  →  기능 회귀  →  보고
§2       §3       §3           §4           §8
```

**계측 없이 코드를 고치지 마라.** 숫자가 먼저다.

### 0-2. H-1R 에서 누락된 것 — 이번에 반드시 채워라

H-1R 보고의 검증표에서 **V6 칸에 스크린샷 해시가 적혀 있었다.** V6 는 회귀 검증이었다.
회귀 결과가 보고되지 않았다. 이번에는 §6 의 M6 을 **항목명 그대로** 적어라.
검증 항목을 다른 내용으로 채우지 마라.

---

⚠ `C:/20.HDev/rtw-routes/repo` · `C:/20.HDev/rtw-hud-h1/repo` 는 다른 작업선이다. **접촉 금지.**
---

## 1. 감리가 코드에서 미리 확인한 것 — 다시 조사하지 마라

### 1-1. `touchTrailInstanceActivity` 는 **공유 문서**를 친다

`apps/web/src/lib/firestoreTrailInstance.ts:173`

```ts
export async function touchTrailInstanceActivity(trailId: string) {
  await updateDoc(doc(db, TRAILS_COLLECTION, trailId), { lastActivityAt: serverTimestamp() });
  scheduleOpenTrailListingRefresh(trailId);
}
```

**Trail 문서 하나를 그 Trail 의 모든 참가자가 함께 쓴다.** 그리고 그 문서를 구독하는
모든 클라이언트에게 매 쓰기가 스냅샷으로 퍼진다.

```
쓰는 사람 N 명 × 읽는 사람 M 명  →  N × M 읽기
```

**이것이 S4-3 이 노리는 증폭이다.** S4-1 이 route 쓰기 폭주를 잡은 것과 같은 계열이다.

### 1-2. 호출 지점 5 곳 — 주기가 서로 다르다

```
useTrailLivePublicationRidePublisher.ts:89   주행 중 tick 마다 (PROGRESS_POLL_MS = 3.5 s)
useTrailSession.ts:75                        presence heartbeat (30 s)
App.tsx:1242                                 Trail 합류 시 1 회
rideJoinPresenceBurst.ts:38                  합류 버스트
peerMotion/routePublishFlight.ts:331         route 발행 성공 시
```

**주행 중에는 라이더 1 명이 3.5 초마다 공유 문서를 친다.** 이것이 1 순위 의심 지점이다.
다만 **계측으로 먼저 확인하고** 고쳐라(§2).

### 1-3. listing 재계산은 이미 30 초로 묶여 있다 — 다만 클라이언트마다 따로 돈다

`firestoreOpenTrailListings.ts:241` 은 debounce 2.5 s · `REFRESH_MIN_INTERVAL_MS` 30 s 로
호출 폭주를 막고 있다. **여기는 이미 방어가 있다. 주기를 건드리지 마라.**

문제는 그 안이다. `refreshOpenTrailListingFromTrail`(181행) 한 번이
`loadTrailForListing` + `countTrailActiveParticipantsForTrail` + `getDoc(listing)` + 쓰기의
연쇄다. 그리고 **같은 Trail 을 보는 클라이언트가 각자 독립적으로 이 연쇄를 돈다.**

```
같은 Trail · 클라이언트 M 개  →  같은 재계산이 M 번
```

이것이 2 순위다. 계측에서 실제로 중복되는지 먼저 보여라.

### 1-4. 오해하지 마라

```
presence heartbeat 자체(30 s)          정상이다. 주기를 늘려 숫자만 줄이지 마라
1Hz 진행률 쓰기(TRAIL_LIVE_PROGRESS)   S4-1 에서 실측으로 맞춘 값이다. 건드리지 마라
route·motion 발행 수명주기             S4-1R2·S4-M1R 에서 종결됐다. 재설계 금지
```

---

## 2. 먼저 계측 — 고치기 전에 숫자를 낸다

S4-2 의 `readSubscriptionMeters` 와 **같은 방식**으로 세라. 실제 호출 지점에서 센다.

```
① touchTrailInstanceActivity 호출 수 — **호출 지점별로 나눠서**
② Trail 문서 updateDoc 실제 수행 수
③ Trail 문서 onSnapshot 수신 수 (내가 받은 스냅샷)
④ refreshOpenTrailListingFromTrail 실제 실행 수 · 그 안의 read 수
⑤ presence heartbeat 쓰기 수
⑥ 라이더 수 · 관전자 수 (분모)
```

**소비자 쪽 의도가 아니라 실제 네트워크 동작을 세라.**
`scheduleOpenTrailListingRefresh` 는 debounce 로 삼켜지는 호출이 많다 —
**예약 수와 실행 수를 반드시 분리해서** 세라. 예약 수를 비용으로 적으면 과대 보고다.

### 2-1. 화면 상태별로 재라 — 60 초 고정 구간

```
A  혼자 주행                 (라이더 1)
B  둘이 같은 Trail 주행       (라이더 2)   ← 증폭이 보이는 구간
C  한 명 주행 + 한 명 관전    (라이더 1 · 관전 1)
D  Trailhead idle
```

**B 를 A 와 비교하라.** 라이더가 1 → 2 로 늘 때 ②③이 **선형인지 제곱인지**가 핵심이다.
`N × M` 이라는 말을 쓰려면 이 표로 증명하라. 실측 없이 「N² 해결」을 선언하지 마라.

증거: `S43-touch-baseline.json` (수정 전) · `S43-touch-after.json` (수정 후)

⚠ 센티넬·0 리터럴을 관측치처럼 적지 마라. 계측이 살아 있음을 **비-0 관측으로 먼저 증명**하라
(A 구간에서 ①②가 0 이면 배선이 빠진 것이다). S4-M1·U-1 에서 두 번 사고가 났다.

---

## 3. 그 다음에 고친다 — 실측된 것만

계측에서 실제로 과다한 지점만 손대라. 방향은 아래 범위 안에서 고르되 **근거를 적어라.**

```
가능한 방향 (구현 판단은 개발팀장)
   같은 Trail 에 대한 touch 를 **클라이언트 안에서 합친다** — 최소 간격·최신값 우선
   주행 중 touch 를 진행률 쓰기와 묶어 **중복 호출을 없앤다**
   listing 재계산을 클라이언트마다 돌리지 말고 **한 번만** 돌게 한다
      (S4-2 의 hub 계약과 같은 형태: acquire/release/refcount/fan-out)
```

```
하지 마라
   presence heartbeat 주기 연장 · 진행률 쓰기 주기 변경으로 숫자만 줄이기
      ← 동행 감각이 죽는다. 그건 고친 게 아니라 기능을 깎은 것이다
   lastActivityAt 의 의미·스키마 변경 · 서버 규칙 변경
   Trail 문서 구독을 끊어서 읽기를 줄이기 — 목록·상태가 멈춘다
   계측에서 과다가 안 나온 지점을 「그럴 것 같아서」 고치기
```

**touch 를 아예 없애지 마라.** `lastActivityAt` 은 Trail 목록의 생존 판정에 쓰인다.
없애면 유령 Trail 이 남거나 살아 있는 Trail 이 사라진다.

---

## 4. 기능 회귀 — 이번에 반드시 지킬 것

읽기를 줄이다가 아래가 깨지면 **BLOCK 이다.**

```
F1  MENU Trail 목록에 주행 중 Trail 이 제때 뜨고, 끝나면 사라진다
F2  같은 Trail 합류가 동작한다
F3  접속자 목록이 양쪽에서 갱신된다
F4  관전 화면이 동작한다
F5  presence freshness — 접속자의 살아있음 판정이 늦어지거나 조기 만료되지 않는다
```

F1 은 특히 조심하라 — `lastActivityAt` 갱신을 줄이면 **살아 있는 Trail 이 목록에서 사라진다.**

---

## 5. 즉시 정지 조건

```
peerMotion 알고리즘(보간·외삽·dedup·reconcile)을 건드려야 하면 즉시 멈추고 보고하라
계측에서 증폭이 안 나오면 고치지 말고 §2 숫자만 보고하라 — **「추가 감축 불채택」도 정상 결론이다**
재현·검증이 5 분 넘게 진전 없으면 즉시 중단하고 다른 경로로 전환하라
   같은 접속을 반복하지 마라. 그래도 불가능하면 BLOCK 으로 보고
```

---

## 6. 검증

| | 항목 | 기준 |
|---|---|---|
| M0 | 계측 유효성 | 실제 동작 지점에서 셈 · 예약/실행 분리 · 비-0 관측으로 생존 증명 · 센티넬 0 건 |
| M1 | 증폭 확인 | A(라이더 1) vs B(라이더 2) **동일 60 초 구간** 표 · ②③의 **확장률(B/A 배수)** 제시 |
| M2 | 수정 후 | 같은 조건에서 감소량 제시 · **어느 지점이 줄었는지** 지목 |
| M3 | 기능 회귀 없음 | §4 F1~F5 를 실제 화면에서 확인 · `S43-shots/` (해시 상이) |
| M4 | 예산 무변화 | presence heartbeat 주기 · 진행률 쓰기 주기 **무변경** 확인 |
| M5 | S4-2 유지 | `npm run test:s42-meters` 전부 pass · collectionGroup consumer 2 → underlying 1 |
| M6 | 회귀 | `tsc -b` · 변경 파일 eslint 0 · `npm run test:peer-s3a-replay` d0·d1 유지 |

**M0 이 깨지면 M1·M2 를 판정에 쓰지 마라.**
**M6 을 항목명 그대로 적어라**(§0-1).

---

## 7. 금지

- presence heartbeat 주기 연장 · 진행률 쓰기 주기 변경 · `TRAIL_LIVE_PROGRESS_*` 상수 변경
- `lastActivityAt` 스키마·의미 변경 · Firestore 규칙 변경 · 서버 집계 변경
- Trail 문서 구독 자체를 끊기 · `touchTrailInstanceActivity` 전면 제거
- `scheduleOpenTrailListingRefresh` 의 debounce·최소 간격 변경
- route·motion 발행 수명주기 재설계 (S4-1R2·S4-M1R 결과 유지)
- peerMotion 알고리즘 접촉 · F-1 혼입 · 미세 싱크 조사
- **주행 인원 집계(routeActivity activeRiderCount) 조사·수정** — Chief 가 S4-3 뒤로 미뤘다
- HUD 동행 표시 재수정 (H-1R 결과 유지)
- 실측 없이 「N² 해결」 선언
- `git add -A` · `commit -a` · `--no-verify` · force · rebase · reset · amend · `python -c`·`sed` 우회 편집
- `C:/20.HDev/rtw-routes/repo` · `C:/20.HDev/rtw-hud-h1/repo` 접촉

---

## 8. 커밋 · 보고

```
커밋 1  계측 (DEV 게이트 카운터)
커밋 2  제품 (실측된 지점만) — 과다가 안 나오면 이 커밋은 없다
커밋 3  증거·문서 — S43-*.json · S43-shots/ · INSTRUCTION.md · INSTRUCTION-S42R.md · REPORT.md
경로 지정 stage. push 후 자동감리
```

`REPORT.md` 의 브랜치·HEAD·활성 지시를 현재 사실로 갱신하라.
**기존 S4 이력(S4-2·S4-2R·H-1R)을 고쳐 쓰지 마라** — 상태 표기만 현재로 맞춘다.

보고에 반드시 적을 것:

```
- 첫머리 2~3 줄: 무엇을 재고 무엇을 고쳤는지 평문으로
- §0 게이트 결과 — ACK 4 줄 · 워크스페이스 폴더 목록 · code-workspace 정리 · merge 커밋 해시
- A~D × ①~⑥ 표 (수정 전/후) — 예약 수와 실행 수를 나눠서
- 라이더 1 → 2 일 때 증가 양상 (선형인가 아닌가)
- M0~M6 결과 — **항목명 그대로**. M3 스크린샷 경로(해시 상이 한 줄)
- 고치지 않은 지점이 있으면 「고치지 않았다」고 명시
- 이견·실패 전수. 없으면 「없음」
```

---

## 9. 확정으로 쓰지 말 것

```
주행 인원 집계가 틀린 원인        미확정. 이번 범위 밖(Chief 확정)
로컬 온보딩 HTTP 실패와의 인과    여전히 미증명
미세 싱크 오차                    Chief 가 범위 밖으로 확정
```

---

## 10. 보고 경로 — 이 worktree 안에서만 끝내라

이 파일과 `REPORT.md` 를 **이 worktree 에서** 갱신하고 `상태` 를 `보고완료` 로 바꾼 뒤 push 하면 된다.
`C:/20.HDev/boxcycle`(control tree) 쪽 사본은 **감리가 맞춘다.** 그쪽을 건드리지 마라.
worktree 밖 경로에 파일을 쓰지 마라.

---

## 11. Chief 문제 정의 (2026-08-20 확정) — 이 지시의 상위 전제

싱크 문제는 **세 항목으로 분리**한다. 섞어 다루지 마라.

```
① 큰 위치 오차       Sync 1 단계에서 해결로 채택. 작은 잔차는 인정한다.
                     처음부터 재개발하지 않는다. 이 지시에서 손대지 마라.
② Firebase 비용      현재 최우선. S4-1 쓰기 폭주 감소와 S4-2 중복 구독 2→1 은 유효하다.
                     그러나 **전체 비용 종결이라고 부르지 마라.**
                     S4-3 에서 공유 Trail 문서의 writer×subscriber 증폭을 실측하고,
                     기능 부작용이 없을 때만 더 줄인다.
③ 상대 라이더 튐     **신규 등록된 미해결 항목**(아래 §11-1). S4-3 과 섞어 구현하지 마라.
```

작업 순서: **A** S4-3 비용 → **B** 상대 라이더 튐 → **C** 인원 집계 과다·F-1 재판단.

### 11-1. 신규 미해결 — 상대 라이더가 앞뒤로 조금씩 튄다

큰 위치 오차의 재발이 **아니다.** 화면 안정성 후속 결함으로 별도 등록한다.
**S4-3 종결 뒤 독립 지시로 계획한다. 이번 지시에서 조사·수정하지 마라.**

착수하면 **재현부터** 시작한다(상수를 감으로 조절하는 것을 금지한다).

```
기록할 것   실주행 증상 구간의 RTDB·Firestore 원본 패킷 · 병합 출력 ·
            integrator ingest 결과 · displayDistM · 화면 좌표
고정        원인 수정 전에 위 로그를 replay 시나리오로 고정한다
하네스      이중 스트림 merge·reconcile 을 재생하지 못하면 그 범위를 먼저 확장한다
판정        원본이 단조 전진할 때 displayDistM 역행 ≤ 0.5 m
            이유 없는 순간이동 없음
            화면 좌표 튐과 실제 거리 튐을 구분한다
            1 단계 위치 정확도와 S4 비용 성과를 훼손하지 않는다
```

`REPORT.md` 의 「남은 것」에 이 항목을 **한 줄 등록**하라(§8 커밋 3 에 포함).

---

## 결과 — S4-3 (2026-08-20) · 보고완료

공유 Trail 문서 `lastActivityAt` 쓰기를 60초 창에서 셌다. `trails/{id}` onSnapshot 은 제품에 없어 N×M 스냅샷은 나오지 않았다. 라이더 1→2 일 때 updateDoc 은 2.0배(선형)다. 한 클라이언트 안에서 route 1Hz touch 가 30s heartbeat 와 같은 필드를 중복으로 쳐 A 구간 ② 62→3 으로 합쳤다. heartbeat·진행률 주기는 그대로다.

### §0 게이트

```
pwd                     C:/20.HDev/rtw-sync-s4-2/repo
git rev-parse --abbrev-ref HEAD     fix/multiplayer-read-amplification
git rev-parse --short HEAD          66ebe7b   (착수 직전 beabac2, merge 후)
활성 INSTRUCTION 의 지시번호        S4-3
```

워크스페이스 파일 `C:/20.HDev/rtw.code-workspace` 폴더: boxcycle, rtw-hud-h1, rtw-sync-s4-2.
현재 창은 단일 폴더 `C:/20.HDev/rtw-sync-s4-2/repo`.
`apps/web/src/lib/boxcycle.code-workspace` 없음.
merge `66ebe7b` (감리 검산 tree d11b7989, tsc 0, test:s42-meters 15). 재실행 안 함.

### A~D × ①~⑥ (60s)

수정 전 `S43-touch-baseline.json` · 수정 후 `S43-touch-after.json`. 예약≠실행.

| | ① 호출 | ② updateDoc | ③ trail onSnapshot | ④ listing 예약/실행/read | ⑤ presence 쓰기 | ⑥ 분모 |
|---|---|---|---|---|---|---|
| A 전 | 62 | 62 | 0 | 62 / 2 / 8 | 2 | 라이더 1 |
| A 후 | 62 | 3 | 0 | 62 / 2 / 8 | 2 | 라이더 1 |
| B 전 | 124 | 124 | 0 | 124 / 4 / 16 | 4 | 라이더 2 |
| B 후 | 124 | 6 | 0 | 124 / 4 / 16 | 4 | 라이더 2 |
| C 전 | 64 | 64 | 0 | (실행 3) | 4 | 1+관전1 |
| C 후 | 64 | 5 | 0 | | 4 | 1+관전1 |
| D | 0 | 0 | 0 | 0 / 0 / 0 | 0 | idle. A ①② 비-0 이라 배선 생존. D 0 은 idle 관측 |

B/A ② = 2.0 (선형). ③ 제곱 항 없음.

### M0~M6

| | 항목 | 결과 |
|---|---|---|
| M0 | 계측 유효성 | PASS. 실제 touch/updateDoc/schedule·run/getDoc 노트. A ①②=62 비-0. 센티넬 0 없음 |
| M1 | 증폭 확인 | PASS. 동일 60s. ② B/A=2.0 선형. ③=0 |
| M2 | 수정 후 | PASS. 줄어든 지점=Trail `updateDoc`(②). listing 실행·⑤ 불변 |
| M3 | 기능 회귀 없음 | 미완. 실제 화면 F1~F5 · `S43-shots/` 없음 (2인 실주행 미실시) |
| M4 | 예산 무변화 | PASS. heartbeat 30s · 진행률 1Hz 상수 무변경 |
| M5 | S4-2 유지 | PASS. `test:s42-meters` 15. collectionGroup consumer 2 → underlying 1 유지 |
| M6 | 회귀 | PASS. `tsc -b` 0. 변경 파일 eslint 0. `test:peer-s3a-replay` d0·d1 유지 |

### 고치지 않은 것

- presence heartbeat 주기, 진행률 쓰기 주기, listing debounce·30s 최소 간격
- listing 클라이언트 hub (④ 실행은 이미 30s, M당 선형 2회/60s — 과다 미확인)
- `useTrailLivePublicationRidePublisher` (호출처 없음)
- `trails/{id}` 구독 추가하지 않음

### 이견·실패

- M3 실화면 미촬영. F1 논리는 lastActivityAt 30s vs stale 240s 로만 주장. 화면 증가는 없음.
- App.tsx · useTrailSession · useTrailLivePublicationRidePublisher 호출 지점 태그는 pre-commit eslint(선행 오류) 때문에 커밋에 못 넣음. 기본 source=`unspecified`. routePublish·joinBurst 만 태그.
- 없음 그 외.

