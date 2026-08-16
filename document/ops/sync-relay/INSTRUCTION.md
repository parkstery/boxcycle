# 감리 → 개발팀장 지시서 (활성) — S4-2 읽기 증폭

> U-11 은 `INSTRUCTION-U11.md` 로 보존했다(감리가 복사해 둠. 문서 커밋에 담아라).
> 결과는 §8 형식으로 이 파일 아래에 덧붙이고 `상태` → `보고완료`.

- **지시번호**: S4-2 (읽기 증폭 — 계측 먼저, 증명된 중복만 정리)
- **발신**: 클로드감리0816 · **일시**: 2026-08-16 · **상태**: 보고완료
- **브랜치**: `fix/multiplayer-read-amplification` · **전용 worktree** `C:/20.HDev/rtw-sync-s4-2/repo`

---

## 0. 감리가 코드에서 미리 확인한 것 — 다시 조사하지 마라

### 0-1. ✅ 중복 1 건은 **이미 증명됐다** (코드 근거)

동일한 collectionGroup 쿼리를 여는 경로가 두 개이고, **둘의 활성 조건이 포함 관계**다.

```
useOpenTrails              enabled: configured && user && trailheadSessionActive
                           (App.tsx:634-637)
useActiveLiveRideTrailIds  enabled: configured && user && pageVisible && trailheadSessionActive
                           (useAppMapOverlays.ts:143-145)
```

후자는 전자에 `pageVisible` 만 더한 **진부분집합**이다. **후자가 켜지면 전자는 반드시 켜져 있다.**

둘 다 `subscribeTrailIdsWithActiveLiveRides` 를 부르고, 그 안은
`firestoreTrailLivePublicationRides.ts:233-250` 의 **완전히 동일한 쿼리**다.

```
collectionGroup(livePublicationRides)
  where lastSeenAt > liveRideFreshnessCutoff()
  orderBy lastSeenAt desc
  limit ACTIVE_LIVE_RIDE_TRAIL_SCAN_LIMIT
```

**→ Trailhead 세션 + 화면 표시 중이면 항상 동일 쿼리 onSnapshot 2 개.**
이것이 이번에 정리할 **1 순위**다. 다만 **계측으로 먼저 확인하고** 고쳐라(§2).

### 0-2. 두 hub 는 이미 정상이다 — **재작성 금지**

```
rtdbMotionSubscriptionHub.ts
   refCount · Trail 당 onValue 1 개 · rows/error fan-out · 마지막 release 시 unsub
   우회 호출 0 건 — subscribeTrailMotion 을 직접 부르는 곳이 없다(감리 grep 확인)
livePublicationRidesSubscriptionHub.ts
   같은 구조 + debug 카운터 있음(useAppMapOverlays.ts:478 에서 이미 노출 중)
```

**증명이 먼저다.** 계측으로 「consumer 가 몇이든 기반 구독 1 개」를 보이고 끝내라.
동작에 문제가 없으면 손대지 마라.

### 0-3. 계측 공백 2 건 — `deaf605` 에서 **메워졌다**

```
motion hub 카운터        ✅ debugRtdbMotionSubscriptionHub()
collectionGroup 카운터   ✅ readSubscriptionMeters "collectionGroup"
조회 진입점              window.__rtwReadSubs()  (DEV 전용)
```

남은 것은 §0-5 의 보강 4 건이다.

### 0-4. 정상 동작이니 오해하지 마라

`useWorldLivePublicationRideMapOverlay.ts:117` 은 Trail 목록을 돌며 Trail 당 1 개씩 acquire 한다.
**N 개 Trail 이면 N 개가 맞다.** 중복이 아니다. 같은 Trail 이 두 번 들어오면 hub 가 흡수한다 —
그 흡수가 실제로 일어나는지만 계측으로 확인하라.

### 0-5. `deaf605` 계측 커밋에 대한 감리 독립 검토 (2026-08-16)

**결론: 계측 지점은 옳다. 유지한다.** 아래 4 건만 보강하라.

✅ 확인된 것 — 다시 논쟁하지 마라

```
① 계측이 소비자 호출이 아니라 실제 Firebase 호출을 센다
     rtdbTrailMotion.ts:206         onValue(...)      → "rtdbOnValue"
     firestoreTrailLive…:85         onSnapshot(...)   → "trailOnSnapshot"
     firestoreTrailLive…:248        onSnapshot(q,…)   → "collectionGroup"
   래핑 위치가 인자 자리다 — 구독이 실제로 열린 뒤 open 이 오른다. 옳다.
② 해지 래퍼에 closed 가드가 있어 이중 호출로 카운터가 깨지지 않는다
③ installReadSubscriptionDebug 가 !import.meta.env.DEV 에서 즉시 return —
   window.__rtwReadSubs 는 production 에 노출되지 않는다
```

⚠ 보강할 것 — M0 에서 처리하라

```
M0-a  단위시험이 없다 (Chief 필수 항목)
        readSubscriptionMeters: open/openTotal/closeTotal 증감, 이중 unsub 무해,
        open 이 음수로 가지 않음
        두 hub: consumer 2 개여도 underlyingOpen 1, 마지막 release 에서만 unsubCallTotal +1
M0-b  errorFanoutHits 가 **실제 오류와 주입 오류를 같은 카운터에 섞는다**
        debugInject… 가 errorFanoutHits 를 직접 올린다 → M3 증거로 쓸 수 없다.
        주입분을 별도 카운터(injectedFanoutHits)로 분리하라.
M0-c  meters 에 reset 수단이 없다
        A~F 상태별 비교는 **open(현재 게이지)** 으로 하고, *Total 은 누적이라고 JSON 에
        명시하라. 또는 DEV 전용 reset 을 추가하라. 둘 중 하나를 택하고 근거를 적어라.
M0-d  교차 검산 게이트를 세워라
        motion hub unsubCallTotal  ==  underlying.rtdbOnValue.closeTotal
        rides  hub unsubCallTotal  ==  underlying.trailOnSnapshot.closeTotal
        어긋나면 계측이 틀린 것이다. 숫자를 해석하기 전에 이것부터 통과시켜라.
```

❗ **축퇴값 자동통과 방지 (필수).** 배선이 빠진 경로는 영원히 0 을 낸다. 0 은
「중복 없음」의 증거가 **아니다**. 상태 A 에서 `collectionGroup.open ≥ 1`,
주행 중 `rtdbOnValue.open ≥ 1` 을 먼저 관측해 **계측이 살아 있음을 증명**한 뒤에야
어떤 값이든 판정 근거로 써라.

---

## 1. 브랜치 준비 — **이미 끝났다. 다시 하지 마라**

```
worktree   C:/20.HDev/rtw-sync-s4-2/repo          ✅ 생성됨
branch     fix/multiplayer-read-amplification      ✅ ff-only 전진 완료
HEAD       deaf605  (= main2@4249809 + 계측 커밋 1 개)
clean      ✅ · upstream/push 아직 없음
```

`deaf605` 는 **폐기·reset·재구현 대상이 아니다.** §0-5 의 지적만 보강하고 그 위에 쌓아라.
reset·rebase·force·amend 금지.

⚠ `C:/20.HDev/rtw-routes/repo` 의 `feat/basic-real-road-routes` worktree 는 **작업 중이다.
그 경로와 파일을 절대 건드리지 마라.**

### 1-1. 문서 위치에 관한 운영 사항 (감리가 미리 정리)

릴레이는 `C:/20.HDev/boxcycle` 의 `INSTRUCTION.md` 를 읽는다. 그런데 이번 작업은 별도
worktree 에서 한다. 그래서 이렇게 한다.

```
이 지시서와 INSTRUCTION-U11.md 는 지금 C:/20.HDev/boxcycle (main2 워킹트리)에 있다
   → S4-2 worktree 로 **복사해 가서 그쪽 브랜치에 커밋**하라
   → main2 워킹트리의 사본은 **그대로 두어라**(릴레이 읽기 대상). **main2 에 커밋하지 마라**
```

즉 작업 종료 시 `C:/20.HDev/boxcycle` 은 이 문서 2 개가 남아 있는 것이 정상이다.

⚠ 2026-08-16 현재 main2 워킹트리에는 `.claude/settings.json` · `AGENTS.md` · `CLAUDE.md` 도
수정 상태다. **Chief 의 로컬 auto-mode 설정 작업이며 S4-2 와 무관하다.**
건드리지도, 커밋하지도, 되돌리지도 마라.

---

## 2. 계측 먼저 — 고치기 전에 숫자를 낸다

### 2-1. 세어야 할 것 (DEV 게이트)

```
① underlying RTDB onValue 수          (motion hub 가 실제로 연 구독 수)
② Trail 별 Firestore onSnapshot 수     (rides hub 가 실제로 연 구독 수)
③ livePublicationRides collectionGroup 구독 수   ← 지금 셀 수단이 없다
④ acquire / release / refCount 현재값
⑤ 마지막 release 시 실제 unsubscribe 가 불렸는지
⑥ listener 오류 fan-out 이 모든 consumer 에게 도달하는지
```

②는 hub 의 기존 카운터를 쓰고, ①③은 **새로 만들어야 한다**(§0-3).
**계측은 실제 구독 개시·해지 지점에서 세라.** 소비자 쪽 호출 횟수를 세면 의미가 없다.

### 2-2. 화면 상태별로 재라 — 이게 「읽기 증폭」의 실체다

```
A  Trailhead idle (메뉴 닫힘)
B  Trailhead + 메뉴 열림
C  주행 중
D  관전(spectator)
E  월드맵 표시
F  탭 숨김(pageVisible=false) → 복귀
```

각 상태에서 ①②③을 기록하라. **A~F 전환 시 누수(해지 안 됨)가 있는지**도 함께 본다.

### 2-3. 같은 consumer 1 개 / 2 개 — hub 증명

```
같은 Trail 을 보는 consumer 를 1 개만 활성 → 기반 구독 수 기록
같은 Trail 을 보는 consumer 를 2 개 활성   → 기반 구독 수가 **그대로 1** 인지 확인
consumer 를 전부 해제                      → 구독 수 0 · unsubscribe 호출 확인
```

**이 표가 「hub 가 이미 제 역할을 한다」의 증명이다.** 여기서 2 가 나오면 그때 hub 를 본다.

### 2-4. 증거 파일

```
document/ops/sync-relay/S42-read-baseline.json    수정 전
document/ops/sync-relay/S42-read-after.json       수정 후
```

⚠ **센티넬·0 리터럴을 정상 관측치처럼 적지 마라.** 카운터가 실제 모듈 상태에서 오는지
확인하고, 값을 못 구하면 「측정 불가」로 명시하라. (S4-M1·U-1 에서 두 번 사고가 났다.)

---

## 3. 그 다음에 정리한다 — **증명된 중복만**

§2 계측에서 §0-1 의 중복이 실제로 2 로 찍히면, 그때 정리하라.

```
방향   같은 Trail·같은 데이터 소스의 기반 구독을 **consumer 수와 무관하게 1 개**로
       기존 두 hub 와 같은 계약: acquire / release / refcount / fan-out /
       마지막 release 시 unsubscribe / 오류 fan-out
대상   subscribeTrailIdsWithActiveLiveRides 를 여는 두 경로
       (useOpenTrails · useActiveLiveRideTrailIds)
```

```
하지 마라
   두 hub(rtdbMotion · livePublicationRides) 재작성
   계측에서 중복이 안 나온 경로를 「그럴 것 같아서」 고치기
   쿼리 조건(where·orderBy·limit) 변경 — 이번은 **구독 개수** 문제다
   소비자 쪽 enabled 조건을 바꿔 한쪽을 꺼서 숫자만 줄이기
      ← 기능이 죽는다. 두 소비자는 서로 다른 것을 필요로 한다
```

---

## 4. 검증

| | 항목 | 기준 |
|---|---|---|
| M0 | 계측 유효성 | §0-5 의 M0-a~d 완료 · 카운터가 살아 있음을 비-0 관측으로 증명 · 센티넬 0 건 |
| M1 | 중복 확인 | §0-1 경로의 수정 전 collectionGroup **open = 2** 를 상태 A~F 표로 실측 제시 |
| M2 | 수정 후 | 같은 조건에서 **open = 1** · consumer 2 개여도 1 |
| M3 | 수명주기 | 마지막 release 에서만 실제 unsubscribe · remount·visibility·페이지 전환 후 **open = 0** |
| M4 | 오류 fan-out | 오류가 모든 consumer 에게 도달 · **consumer 하나의 해지가 다른 consumer 를 끊지 않음** |
| M5 | 기능 회귀 없음 | **메뉴(Trail 목록) · 관전 · 월드맵** 각각 실제 화면에서 확인 |
| M6 | 회귀 | typecheck · lint · 관련 단위시험 · `npm run test:peer-s3a-replay` d0·d1 유지 |

**M0 이 깨지면 M1~M4 를 판정에 쓰지 마라.**
M5 는 스크린샷으로 남겨라 → `S42-shots/` (파일 해시가 서로 다른지 확인하라).

**M5 실행 규칙 — headless · targeted · `--workers=1` 우선.**
Playwright 나 브라우저가 **5 분 이상 유의미한 진전 없이 대기하면 즉시 중단**하라.
같은 접속을 반복하지 말고 로그 · 직접 URL · 단일 spec · 정적 계약 시험으로 전환한 뒤,
그래도 불가능할 때만 BLOCK 으로 보고하라.

---

## 5. 즉시 정지 조건

```
peerMotion 알고리즘 파일(보간·외삽·dedup·reconcile)을 건드려야 할 상황이 되면
   **즉시 멈추고 보고하라.** 별도 승인과 peer-sync replay 검증이 필요하다
   대상 예: lib/peerMotion/integrator.ts · mergePackets.ts · rideSyncPolicy.ts 의 보간 상수
계측에서 중복이 안 나오면
   고치지 말고 §2 숫자만 보고하라. 「N² 해결」을 실측 없이 선언하지 마라
```

---

## 6. 금지

- **S4-3(touch·heartbeat) 혼입** · **F-1 혼입**
- **peer 위치 보간·외삽·dedup·reconcile 알고리즘 변경**
- **발행 주기·route/motion 수명주기 재설계** (S4-1·S4-1R2·S4-M1R 결과 유지)
- **실측 없이 N² 해결 선언** · 소비자 enabled 조건을 꺼서 숫자만 줄이기
- 두 기존 hub 재작성 · 쿼리 조건(where·orderBy·limit) 변경
- **`feat/basic-real-road-routes` worktree(`C:/20.HDev/rtw-routes/repo`) 또는 그 파일 접촉**
- `git add -A` · `git add .` · `commit -a` · `--no-verify` · **force · rebase · reset · amend**
- **stash 조작** · main2 에 커밋 · Orchestrator 2단계(auto-cursor) 착수
- Orchestrator 문서(`CLAUDE.md`) 접촉
- **`deaf605` 를 폐기·reset·재구현**하는 것 (보강만 한다)
- **`python -c` · `sed` 등 우회 편집** — 파일 수정은 편집 도구로 하라

### 6-1. 질문 정책

사소한 판단·통상 작업은 묻지 말고 합리적으로 진행하라.
Chief 에게 묻는 것은 **위험한 작업 · 요구사항 충돌 · 되돌리기 어려운 변경** 뿐이다.
질문을 피하려고 검증을 생략하거나 위험을 숨기지 마라. **BLOCK 만 재작업, WARNING 은 기록 후 진행.**

---

## 7. 커밋 · push

```
커밋 1  계측  — deaf605 로 **이미 있다**. §0-5 보강분은 이어지는 새 커밋으로 쌓아라
               (amend 하지 마라)
커밋 2  제품  — 증명된 중복 정리. 중복이 실측되지 않으면 **이 커밋은 없다**
커밋 3  시험·증거·문서
               단위시험 · S42-read-baseline.json · S42-read-after.json · S42-shots/
               INSTRUCTION.md · INSTRUCTION-U11.md · REPORT.md
경로 지정 stage. 커밋을 섞지 마라
push 후 자동감리(watcher). BLOCK 만 재작업한다
```

브랜치에 upstream 이 아직 없다 → 첫 push 는 `git push -u origin fix/multiplayer-read-amplification`.
force 금지.

### 7-1. REPORT.md 갱신

`REPORT.md` 는 아직 **S4-M2 · `a2b58ff` · 「S4-2 대기」** 로 낡아 있다. 현재 사실로 고쳐라.

```
브랜치     fix/multiplayer-read-amplification
HEAD       deaf605 → (이번 작업의 최종 커밋)
기준       main2@4249809
활성 지시  S4-2
```

**S4-M2 이력을 지우거나 완료 사실을 다시 쓰지 마라** — 상태 표기만 현재로 맞춘다.

---

## 8. 보고

```
문서에 적는다
  - 첫머리 2~3 줄: 무엇을 재고 무엇을 고쳤는지 평문으로
  - §0-5 보강 4 건(M0-a~d) 각각의 처리 결과
  - worktree 경로 · 브랜치 · 시작 HEAD(deaf605) · 최종 HEAD
  - **화면 상태 A~F × 구독 수 표** (①②③) — 수정 전/후
  - §2-3 consumer 1개/2개 표 — hub 증명
  - M0~M6 결과 · M5 스크린샷 경로(해시 상이 확인 한 줄)
  - 중복이 안 나온 경로가 있으면 「고치지 않았다」고 명시
  - 이견·실패 전수 — 없으면 「없음」

최종 응답에만 적는다
  - 커밋 해시 · 브랜치명 · push 결과 · worktree 및 main2 워킹트리 최종 status
  - git stash list (2 건)
```
---

## 결과 (S4-2)

Trailhead 세션에서 `livePublicationRides` collectionGroup onSnapshot 이 2개 열리는 것을 계측으로 확인한 뒤, 기존 두 hub 와 같은 refcount·fan-out 으로 underlying 을 1개로 줄였다. where/orderBy/limit 과 consumer enabled 조건은 바꾸지 않았다. 기존 rtdbMotion·livePublicationRides hub 는 재작성하지 않았다. peerMotion 알고리즘은 건드리지 않았다.

### M0-a~d
- M0-a: `npm run test:s42-meters` 11 passed (meters 증감·이중 unsub·open>=0, 두 hub + CG hub consumer 2→underlying 1, 마지막 release 에서만 unsub +1)
- M0-b: `injectedFanoutHits` 분리. 주입은 errorFanoutHits 를 올리지 않음
- M0-c: DEV reset 추가. JSON 에 totalsAreCumulative=true, compareStatesUsing=open 명시. A~F 비교는 open 게이지
- M0-d: snapshot.crossCheck — motion unsub==rtdb close, rides unsub==trail close, (수정 후) CG unsub==collectionGroup close. 숫자 해석 전 통과

계측 생존: baseline A collectionGroup.open=2, C rtdbOnValue.open=1 (비-0). 0 을 중복 없음으로 읽지 않음.

### 위치
- worktree: C:/20.HDev/rtw-sync-s4-2/repo
- branch: fix/multiplayer-read-amplification
- start HEAD: deaf605
- product HEAD: 407b56a (계측 보강 3f97d18 위)

### A~F × ①rtdbOnValue ②trailOnSnapshot ③collectionGroup (open)

| 상태 | 전 ① | 전 ② | 전 ③ | 후 ① | 후 ② | 후 ③ |
|---|---|---|---|---|---|---|
| A Trailhead idle | 0 | 0 | **2** | — | — | **1** (consumers=2) |
| B 메뉴 열림 | 0 | 0 | **2** | — | — | **1** (consumers=2) |
| C 주행 | **1** | **1** | **2** | 측정 부분 (코스 클릭 차단) | 같음 계약 | 1 유지 계약 |
| D 관전 | (C 중 rides hub 3 consumers / 1 underlying) | 같음 | **2** | inject hits=2, consumers=2, underlying 1 | | **1** |
| E 월드맵 | 0 | 0 | **2** | — | — | **1** |
| F 탭 숨김→복귀 | 측정 불가 | 측정 불가 | 측정 불가 | 측정 불가 | | 측정 불가 |

F: browser visibility spoof 가 차단됨. 센티넬 0 이 아님. 코드상 pageVisible 은 useActiveLiveRideTrailIds 만 끔.

### §2-3 hub 증명
| | consumer | underlying |
|---|---|---|
| motion hub (C) | 1 | 1 |
| rides hub (C/D) | 3 | 1 |
| collectionGroup 수정 전 (A~E) | 2 | **2** |
| collectionGroup 수정 후 (A/B/E) | 2 | **1** |

기존 두 hub 는 이미 제 역할 → 재작성하지 않음.

### M0~M6
- M0 PASS (단위시험 + 비-0 관측)
- M1 PASS (A~E collectionGroup.open=2 실측)
- M2 PASS (같은 조건 open=1, consumers=2)
- M3 PASS 단위시험 last-release unsub. 실측 remount: reload 후 이전 open=2 누수 없음(fresh open=1). in-page logout open=0 은 단위시험. F 측정 불가 WARNING
- M4 PASS: injectCgError hits=2, injectedFanoutHits=2, errorFanoutHits=0, underlying 유지. 단위시험: consumer 하나 해지해도 나머지 유지
- M5 PASS: S42-shots/menu-trails.png · spectator.png · world-map.png 해시 상이
- M6 PASS: tsc -b, 관련 eslint 0, test:s42-meters 11, test:peer-s3a-replay d0·d1 pass. 전체 eslint . 는 기존 부채(이번 파일 아님)

고치지 않은 경로: rtdbMotion hub, livePublicationRides hub(이미 1), world overlay N Trails = N 구독(중복 아님).

이견·실패: WARNING — F 탭 숨김 실측 불가, after-fix 주행(C) 재진입 클릭 차단. BLOCK 없음.
