# 감리 → 개발팀장 지시서 (활성) — H-1 동행 표시 모순

> S4-2R 은 `INSTRUCTION-S42R.md` 로 보존했다(감리가 복사해 둠. 문서 커밋에 담아라).
> 결과는 §7 형식으로 이 파일 아래에 덧붙이고 `상태` → `보고완료`.

- **지시번호**: H-1 (같은 Trail 2인 주행 시 HUD 동행 표시가 서로 모순)
- **발신**: 클로드감리0817 · **일시**: 2026-08-17 · **상태**: 착수대기
- **기준**: `main2@22f5566` 에서 **새 브랜치** `fix/hud-companion-consistency`
- **전용 worktree**: `C:/20.HDev/rtw-hud-h1/repo`

---

## 0. Chief 실사용 재현 — 이것이 사실이다

`a111111`(Trail 개설자) 과 `guest-ENnhxG`(합류자) 가 **같은 Trail 403** 에서 동시 주행했다.

```
양쪽 공통    접속 Trail 403 · 접속자 목록에 2명 모두 표시   ← 정상
guest 화면   동행 → 「지금 2명 주행」
a111111 화면 동행 → 「지금 1명 주행」                       ← 서로 다르다
양쪽 공통    동행 → 「다른 라이더 없음」                     ← 목록엔 2명인데 없다고 한다
```

**한 화면 안에서 자기모순이다.** 접속자 2명을 나열해 놓고 바로 아래에서
「1명 주행」·「다른 라이더 없음」이라고 쓴다. 사용자는 무엇을 믿어야 할지 알 수 없다.

**지도에는 두 라이더가 모두 그려지고 있다.** Chief 가 추격 상황을 반복 재현해
둘이 약간의 거리차를 두고 각각 보이는 것을 확인했다(2026-08-17).
따라서 이번 결함은 **지도가 아니라 HUD 문자열 쪽**이다. 지도 렌더를 의심하지 마라.

---

## 1. 감리가 코드에서 이미 확정한 것 — 다시 조사하지 마라

### 1-1. ✅ 「지금 N명 주행」이 갱신되지 않는다 (확정)

`apps/web/src/lib/firestoreRouteActivity.ts:91-98`

```ts
const memoryCache = new Map<string, RouteActivitySnapshot | null>();

export async function fetchRouteActivity(publicationId: string) {
  ...
  if (memoryCache.has(id)) return memoryCache.get(id)!;   // ← TTL 이 없다
```

**세션 캐시에 만료가 없다.** 한 번 읽으면 명시적 invalidate 전까지 영원히 같은 값이다.

그리고 폴링이 그 invalidate 를 하지 않는다. `apps/web/src/hooks/useRouteActivity.ts`

```ts
onTick: () => reloadRef.current({ forceInvalidate: isPostRideActivityWatchActive() })
```

주행 중에는 `isPostRideActivityWatchActive()` 가 false → invalidate 없음 →
`fetchRouteActivity` 가 **자기 캐시를 다시 읽어** 같은 값을 setState 한다.

```
결론  주행 중 routeActivity 폴링은 읽기 0 회짜리 공회전이다.
      타이머 비용만 내고 값은 절대 안 바뀐다.
a111111  자기 혼자일 때 읽어서 1 로 고정
guest    나중에 합류해 읽어서 2 로 고정
→ 두 화면이 영원히 다른 숫자를 보여준다
```

**이것이 증상 2 의 원인이다. 재조사하지 마라.**

### 1-2. ✅ 「다른 라이더 없음」의 표시 규칙이 틀렸다 (확정)

`apps/web/src/App.tsx:1675-1682`

```ts
// 동행 블록은 접속(Trail) 블록에 이미 뜬 사람을 다시 보여주지 않는다
const activeTrailMemberUids = new Set(trailMembers.filter((m) => m.active).map((m) => m.key));
const coursePeerNames = peerHudLabels(
  coursePeerHud.filter((p) => !activeTrailMemberUids.has(p.id)),
);
```

`apps/web/src/components/maphud/MapHud.tsx:295-303`

```tsx
{ridePresence.coursePeerNames.length > 0 ? ( …목록… ) : (
  <p className="hud-ride-presence__empty">다른 라이더 없음</p>
)}
```

중복 제거 자체는 옳은 의도다. 문제는 **「중복 제거로 비었다」와 「정말 아무도 없다」를
구분하지 않고** 둘 다 「다른 라이더 없음」으로 쓴다는 것이다.

같은 Trail 에서 함께 타면 상대는 반드시 접속 목록에 있다 → 반드시 걸러진다 →
**같은 Trail 동행은 구조적으로 항상 「다른 라이더 없음」이 뜬다.**

### 1-3. ✅ publicationId 불일치는 **배제됐다** (Chief 2026-08-17 관찰)

당초 의심했던 경로다. `PublicationSharedPresence.tsx:249`

```ts
const peers = next.filter((r) => r.uid !== userRef.current.uid && r.publicationId.trim() === pid);
```

이 필터를 통과해야만 지도에 상대 아바타가 그려진다.
**Chief 가 두 라이더가 지도에서 약간의 거리차를 두고 각각 보이는 것을 확인했다.**
→ 필터가 통과했다 → 두 사람의 `publicationId` 는 일치한다.

```
따라서  §1-2(dedup) 가 「다른 라이더 없음」의 원인이다. 단독 원인으로 본다
        peer 인정 필터는 정상 동작 중이다. 조사도 수정도 하지 마라
```

### 1-4. ⚠ 남은 좁은 확인 1건 — 계측으로만

`peerHudEntries` 는 **`liveRidesByUid` 의 키만** 순회한다(`PublicationSharedPresence.tsx:412-414`).

```
motion 은 오는데 Firestore live-ride 행이 없는 peer 는
지도에는 그려지지만 coursePeerHud 에는 안 들어간다
```

이 경우라면 dedup 이전에 이미 비어 있던 것이다. §2 의 ①·④ 로 확인만 하라.
**해당하더라도 이번에 구조를 바꾸지 마라** — 관측으로 기록하고 §3-2 는 그대로 진행한다.

---

## 2. 먼저 계측 — 고치기 전에 어느 쪽인지 확정한다

DEV 게이트로 진단 값을 노출하라(기존 `window.__rtwReadSubs` 방식과 동일한 형태로).

```
① coursePeerHud            길이 · 각 항목의 { id, label }
② activeTrailMemberUids    집합 내용
③ dedup 후 coursePeerNames 길이
④ 내 publicationId  ·  liveRideRows 각 행의 { uid, publicationId }
⑤ motion rows 원본 길이  ·  publicationId 필터 통과 후 peers 길이
⑥ routeActivity  { activeRiderCount, liveNow, 최초 fetch 시각, 마지막 실제 getDoc 시각 }
```

**⑥의 「마지막 실제 getDoc 시각」이 핵심이다.** 캐시 히트와 실제 재조회를 구분해서 세라.
setState 횟수를 세면 안 된다 — 공회전도 setState 는 한다.

### 2-1. 재현 조건

같은 Trail 에 2 인(개설자·합류자)이 동시 주행. Chief 재현과 같은 조건이다.
2 탭으로 재현하되, **재현이 5 분 안에 안 되면 즉시 멈추고 보고하라.**
브라우저를 붙들고 반복하지 마라 — S4-2 에서 그렇게 수십 분을 태웠다.

### 2-2. 확인할 것 (§1-4)

```
① 이 비어 있지 않은가?
   비어 있지 않다 → dedup(§1-2)이 지운 것이 확정된다. 예상대로다
   비어 있다      → §1-4 경로다. **관측으로 기록만** 하고 §3-2 는 그대로 진행하라
                     (motion 은 오는데 live-ride 행이 없는 상태) — 구조를 바꾸지 마라
```

④ 에서 두 사람의 `publicationId` 는 **같게 나와야 한다.** 다르게 나오면
§1-3 배제 근거가 무너진 것이니 **즉시 멈추고 보고하라.**

증거 파일: `document/ops/sync-relay/H1-hud-diag.json` (수정 전) · `H1-hud-diag-after.json` (수정 후)

---

## 3. 수정

### 3-1. 「지금 N명 주행」 — 캐시가 늙지 않는 문제 (§1-1)

```
방향  routeActivity 세션 캐시에 **TTL** 을 준다. 만료된 항목은 다음 fetch 에서 재조회한다
      폴링 tick 이 자기 캐시를 다시 읽고 끝나는 공회전을 없앤다
```

TTL 값은 기존 폴링 주기와 맞춰라(`useActivityWorldAdaptivePoll` 의 주행 중 주기).
**주기보다 짧게 잡지 마라** — 읽기가 폭증한다. S4-2 에서 읽기를 줄인 직후다.

```
하지 마라
   invalidate 를 무조건 true 로 바꿔 매 tick getDoc — 읽기 예산을 깬다
   폴링 주기 단축
   routeActivity 문서 스키마·서버 집계 로직 변경
```

### 3-2. 「다른 라이더 없음」 — 표시 규칙 (§1-2)

```
규칙  「다른 라이더 없음」은 **정말로 다른 라이더가 하나도 없을 때만** 쓴다
      중복 제거로 목록이 비었을 뿐이라면 그 문장을 쓰지 마라 —
      상대는 바로 위 접속 목록에 이미 보이고 있다
```

판정 기준은 **주행 중인 사람**이어야 한다. 단순 접속자가 아니다.
Trail 에 접속만 하고 안 달리는 사람이 있을 수 있고, 그때는 「다른 라이더 없음」이 옳다.
이미 구독 중인 live ride 행(§2 ④)을 쓰면 추가 읽기 없이 판정할 수 있다.

빈 문장을 무엇으로 대체할지(문장 생략 / 다른 문구)는 구현 판단으로 정하되,
**접속 목록과 모순되지 않을 것**만 지켜라. 새 용어를 만들지 마라.

### 3-3. peer 인정 필터 — **손대지 마라**

§1-3 에서 배제됐다. 정상 동작 중이다.
`publicationId` 일치 조건은 다른 Trail·다른 코스와의 격리 계약이라,
완화하면 **엉뚱한 사람이 동행으로 섞인다.** 조사도 수정도 하지 마라.

### 3-4. 미세 싱크 — **이번 범위 밖이다 (Chief 확정)**

두 라이더의 위치가 완전히 일치하지 않는 잔여 오차는 **Chief 가 현 시점에서 다루지 않기로
확정했다.** 과거 대비 대폭 개선된 상태다.

```
조사·수정·계측 모두 하지 마라
보간·외삽·dedup·reconcile 상수를 「이왕 하는 김에」 손대지 마라
보고서에 싱크 오차를 결함으로 적지 마라
```

---

## 4. 검증

| | 항목 | 기준 |
|---|---|---|
| V0 | 계측 유효성 | ①~⑥ 이 실제 모듈 상태에서 옴 · 캐시 히트와 실제 getDoc 구분됨 · 센티넬 0 건 |
| V1 | 원인 확정 | §2-2 판정 결과를 증거와 함께 제시 |
| V2 | 숫자 일치 | 2 인 동시 주행에서 **양쪽 화면이 같은 인원수**를 보인다 (TTL 경과 후) |
| V3 | 문장 정합 | 접속 목록에 다른 사람이 주행 중이면 「다른 라이더 없음」이 **뜨지 않는다** |
| V4 | 반대 방향 | 혼자 주행 시에는 「다른 라이더 없음」이 **정상적으로 뜬다** |
| V5 | 읽기 예산 | routeActivity getDoc 이 폴링 주기당 1 회를 넘지 않는다 (실측) |
| V6 | 회귀 | typecheck · 변경 파일 lint · `npm run test:s42-meters` · `npm run test:peer-s3a-replay` d0·d1 |

**V4 를 빠뜨리지 마라.** V3 만 맞추면 「다른 라이더 없음」이 영영 안 뜨게 만들 수 있다.
그건 고친 게 아니라 문장을 죽인 것이다.

**V2·V3·V4 는 2 인 화면 스크린샷으로 남겨라** → `H1-shots/` (해시 상이 확인).
Chief 재현과 같은 구도로 찍어라 — HUD 동행 블록이 읽히게.

---

## 5. 금지

- **§3-3 peer 인정 필터(publicationId 일치) 변경** — 배제됐다. 조사도 하지 마라
- **§3-4 미세 싱크 오차 조사·수정** — Chief 가 범위 밖으로 확정했다
- routeActivity 문서 스키마 · 서버 집계 로직 변경
- 폴링 주기 단축 · 매 tick 무조건 getDoc
- 접속(Trail) presence 블록의 판정·표시 변경 — 이번 증상에서 **정상 동작한 유일한 부분**이다
- peerMotion 알고리즘(보간·외삽·dedup·reconcile) 접촉
- S4-3 · F-1 혼입 · Sync 브랜치(`fix/multiplayer-read-amplification`) 접촉
- 새 용어 신설 — 표기는 Ontology 를 따른다
- `git add -A` · `commit -a` · `--no-verify` · force · rebase · reset · amend
- `python -c` · `sed` 우회 편집
- `feat/basic-real-road-routes` worktree(`C:/20.HDev/rtw-routes/repo`) 접촉

---

## 6. 커밋

```
커밋 1  계측 (DEV 게이트 진단)
커밋 2  제품 — TTL(§3-1)
커밋 3  제품 — 표시 규칙(§3-2)
커밋 4  증거·문서 — H1-hud-diag*.json · H1-shots/ · INSTRUCTION.md · INSTRUCTION-S42R.md
경로 지정 stage. push 후 자동감리
```

§3-1 과 §3-2 는 **원인이 다르므로 커밋을 반드시 분리하라.** 하나가 잘못돼도 되돌릴 수 있어야 한다.

---

## 7. 보고

```
- 첫머리 2~3 줄: 무엇이 왜 어긋났고 무엇을 고쳤는지 평문으로
- §2-2 확인 결과 (① 이 비었나 아닌가 · ④ 의 publicationId 가 일치했나)
- 계측 ①~⑥ 수정 전/후 표
- V0~V6 결과 · H1-shots/ 경로(해시 상이 한 줄)
- §1-4 에 해당했다면: 무엇을 관측했고 **왜 안 고쳤는지**
- 이견·실패 전수. 없으면 「없음」
```

---

## 8. 이번에 확정으로 쓰지 말 것

```
로컬 온보딩 HTTP 실패와의 인과   여전히 미증명. 이번 건과 섞지 마라
미세 싱크 오차                   결함으로 적지 마라. Chief 가 범위 밖으로 확정했다(§3-4)
```
