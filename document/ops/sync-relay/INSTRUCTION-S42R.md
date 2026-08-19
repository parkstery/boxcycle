# 감리 → 개발팀장 지시서 (활성) — S4-2R 잔결함 2건

> S4-2 는 `INSTRUCTION-S42.md` 로 보존했다(감리가 복사해 둠. 문서 커밋에 담아라).
> 결과는 §6 형식으로 이 파일 아래에 덧붙이고 `상태` → `보고완료`.

- **지시번호**: S4-2R (S4-2 잔결함 2건 — 최소 수정)
- **발신**: 클로드감리0816 · **일시**: 2026-08-16 · **상태**: 보고완료
- **브랜치**: `fix/multiplayer-read-amplification` · worktree `C:/20.HDev/rtw-sync-s4-2/repo`
- **기준 HEAD**: `224dba7` (= origin)

---

## 0. 먼저 알아둘 것

**S4-2 의 핵심 결과는 유효하다.** collectionGroup 상시 구독 2 → 1 은 실측으로 증명됐고
그대로 간다. **처음부터 다시 만들지 마라.** 아래 2 건만 고친다.
reset·rebase·amend·force 금지. `224dba7` 위에 새 커밋으로 쌓아라.

---

## 1. BLOCK — 첫 스냅샷 전의 빈 목록이 확정 데이터로 흘러간다

`apps/web/src/lib/activeLiveRideTrailIdsSubscriptionHub.ts:64`

```ts
ensureCollectionGroupSubscription();
onIds(trailIds);          // ← 첫 acquire 때 trailIds = []
```

hub 가 **아직 스냅샷을 한 번도 받지 않은 상태**에서도 `[]` 를 즉시 흘린다.
받는 쪽에서 이것이 「주행 중 Trail 없음」과 구별되지 않는다.

### 1-1. 실제로 무슨 일이 벌어지나 (감리 추적)

`useOpenTrails.ts:122` 의 consumer 가 이 `[]` 를 받으면 동기적으로 이렇게 흐른다.

```
onIds([])
  → activeTrailIds = []
  → syncEnrichedFromActiveRides()
       toLoad.length === 0  →  emit(); return;      ← await 전에 동기 반환
  → emit()
       setRows([])
       setLoading(false)        ← **로딩이 여기서 끝난다**
       firstSnapshot = false    ← **첫 스냅샷 플래그가 소진된다**
```

**수정 전에는 이 경로가 없었다.** `subscribeTrailIdsWithActiveLiveRides` 는 동기 콜백이
없어서, 로딩은 실제 Firestore 첫 스냅샷까지 유지됐다.

즉 지금은 **Trail 목록이 아직 오지도 않았는데 로딩이 끝나고 「열린 Trail 없음」이
확정 상태처럼 먼저 렌더링된다.** 첫 스냅샷이 도착하면 목록이 뒤늦게 채워진다.
연결이 느릴수록 이 빈 화면이 길어진다.

### 1-2. 오해 방지 — 이건 문제가 **아니다**

```
enrichedById 가 지워지는 것    effect-local Map 이라 mount 시점엔 이미 비어 있다. 무해
캐시 재생 자체                 hub 가 스냅샷을 이미 받은 뒤라면 캐시 재생은 **옳다**.
                              늦게 붙는 consumer 가 다음 스냅샷까지 기다리지 않아도 된다
다른 consumer 오염             onIds 는 **acquire 한 consumer 에게만** 간다. fan-out 아님
```

**그러므로 캐시 재생을 없애지 마라.** 「스냅샷을 받은 적이 있는가」만 구분하면 된다.

### 1-3. 해결 방향

```
hub 에 hasSnapshot 플래그를 둔다
  underlying onChange 가 처음 도착할 때 true
  releaseIfIdle 에서 trailIds 를 비울 때 **함께 false 로 되돌린다**
  resetForTests 에서도 false 로
acquire 시  hasSnapshot 일 때만 onIds(trailIds) 를 호출한다
```

consumer 쪽 코드는 바꾸지 마라. 계약을 hub 안에서 지켜라.

---

## 2. WARNING — 신규 hub 시험 2건의 시험명이 깨졌다

`apps/web/scripts/s42/read-meters-and-hubs.test.ts` 마지막 describe(신규 hub) 2 케이스.

```
it("consumer 2??? underlyingOpen 1, ??? release ??? unsubCallTotal +1", …)
it("?? ??? injectedFanoutHits ? ??? ? consumer ??? ?? consumer ? ?? ???", …)
```

U+FFFD 가 아니라 **실제 `?` 바이트**다 — 표시 문제가 아니라 **글자가 소실됐다.**
시험 자체는 통과하지만(11 passed), M0 증거의 시험명을 읽을 수 없다.

UTF-8 로 다시 써라. **단정문(what it asserts)을 그대로 살려라.** 시험 본문·단언은 바꾸지 마라.
같은 파일의 다른 describe 블록은 멀쩡하니 건드리지 마라.

---

## 3. 시험 (§1 재발 방지)

기존 시험을 지우지 말고 **추가**하라. `apps/web/scripts/s42/read-meters-and-hubs.test.ts`.

```
T1  스냅샷 전 acquire → consumer 콜백이 **한 번도 불리지 않는다**
T2  첫 스냅샷 도착 → 그때 콜백이 불린다
T3  스냅샷 이후 두 번째 acquire → 즉시 캐시(비어있지 않은 목록)를 받는다
T4  전원 release → 재acquire 시 콜백이 다시 불리지 않는다 (hasSnapshot 초기화 확인)
```

T3 가 없으면 §1-2 의 「캐시 재생은 옳다」가 회귀로 지워질 수 있다. 반드시 넣어라.

---

## 4. 검증

| | 항목 | 기준 |
|---|---|---|
| R0 | `npm run test:s42-meters` | 기존 11 + 신규 4 전부 pass · 깨진 시험명 0 |
| R1 | 읽기 수 무변화 | hub 계약 변경이 구독 개수를 바꾸지 않음 — consumer 2 → underlying **1** 유지 |
| R2 | 회귀 | `tsc -b` · 변경 파일 eslint 0 · `npm run test:peer-s3a-replay` d0·d1 유지 |

**R1 을 실측으로 다시 재라.** 단위시험으로 충분하다 — 브라우저를 다시 띄우지 마라.
S4-2 의 A~F 실측은 유효하므로 **재측정하지 마라.** `S42-read-after.json` 도 다시 만들지 마라.

---

## 5. 금지

- S4-2 를 처음부터 재구현 · 기존 3 커밋 reset·rebase·amend
- 캐시 재생 자체를 제거 (§1-2)
- consumer(`useOpenTrails` · `useActiveLiveRideTrailIds`) 로직 변경
- 기존 두 hub(rtdbMotion · livePublicationRides) 접촉
- 쿼리 조건(where·orderBy·limit) · consumer enabled 조건 변경
- peerMotion 알고리즘 접촉 · S4-3 혼입 · F-1 혼입
- **브라우저·dev 서버 재검증** — 이번 건은 단위시험으로 끝난다
- `git add -A` · `commit -a` · `--no-verify` · force · `python -c`·`sed` 우회 편집
- `feat/basic-real-road-routes` worktree(`C:/20.HDev/rtw-routes/repo`) 접촉

---

## 6. 커밋 · 보고

```
커밋 1  제품 — activeLiveRideTrailIdsSubscriptionHub.ts (hasSnapshot)
커밋 2  시험·문서 — read-meters-and-hubs.test.ts(인코딩 + T1~T4) ·
                   INSTRUCTION.md · INSTRUCTION-S42.md · REPORT.md
경로 지정 stage. push 후 자동감리
```

REPORT.md 에 S4-2R 을 **한 줄 추가**하라. S4-2 항목을 고쳐 쓰지 마라 —
S4-2 의 결과(2→1)는 유효하고, S4-2R 은 그 뒤에 붙는 잔결함 수정이다.

보고에 반드시 적을 것:

```
- §1 이 실제로 사용자 화면에서 무엇을 바꿨는지 한 줄 (로딩 조기 종료 · 빈 목록 선노출)
- T1~T4 결과 · R0~R2 결과
- 읽기 수가 그대로 1 임을 확인한 근거
- 이견·실패 전수. 없으면 「없음」
```

---

## 7. 미증명 사항 — 확정으로 쓰지 마라

로컬 온보딩 HTTP 실패(`ensureRouteTokenOnboardingHttp` → `Failed to fetch`)가
S4-2 의 「코스 클릭 차단 → C 미측정」의 **직접 원인이라는 증거는 아직 없다.**

```
확인된 것   dev 콘솔에 Failed to fetch 가 찍힌다 · 코스 클릭이 안 먹었다
확인 안 된 것  둘 사이의 인과
```

이번 지시에서 **조사하지 마라.** 별건이다. 보고서에 원인으로 단정해 적지도 마라.
필요하면 S4-3 이후 별도 지시로 다룬다.

---

## 결과 (S4-2R)

첫 스냅샷 전에 hub 가 `[]` 를 흘려 useOpenTrails 가 로딩을 끝내고 「열린 Trail 없음」을 먼저 그리던 경로를 막았다. 스냅샷을 받은 뒤에만 캐시를 재생하므로, 목록이 오기 전의 빈 화면 선노출이 사라진다. collectionGroup consumer 2 → underlying 1 은 그대로다.

- §1 화면: 로딩 조기 종료·빈 목록 선노출 경로 제거. 첫 Firestore 스냅샷까지 로딩이 유지된다.
- T1 PASS — 스냅샷 전 acquire, consumer 콜백 0회
- T2 PASS — 첫 스냅샷 도착 시 콜백
- T3 PASS — 스냅샷 이후 두 번째 acquire 가 비어 있지 않은 캐시를 즉시 수신. consumers=2, `collectionGroup.open=1`
- T4 PASS — 전원 release 후 재acquire, 콜백 0회 (`hasSnapshot` 초기화)
- R0 PASS — `npm run test:s42-meters` 15 passed (기존 11 + T1~T4), 깨진 시험명 0
- R1 PASS — 단위시험 consumer 2 → underlying **1** 유지
- R2 PASS — `tsc -b` 0, 변경 파일 eslint 0, `npm run test:peer-s3a-replay` d0·d1 pass
- 읽기 수 1 근거: CG hub 기존 시험 「consumer 2개여도 underlyingOpen 1」과 T3 `snapshotUnderlyingReadSubscriptions().collectionGroup.open === 1`
- 제품 커밋: `88c3d14`. S4-2 A~F 실측은 재측정하지 않음. `S42-read-after.json` 재생성 없음.
- 이견·실패: 없음

