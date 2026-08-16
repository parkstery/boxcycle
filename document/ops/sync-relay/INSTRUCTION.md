# 감리 → 개발팀장 지시서 (활성) — H-1R HUD 동행 빈 문장

> U-11 은 `INSTRUCTION-U11.md` 로 보존했다.
> 결과는 §6 형식으로 이 파일 아래에 덧붙이고 `상태` → `보고완료`.

- **지시번호**: H-1R (HUD 「다른 라이더 없음」 — live ride 행 근거)
- **발신**: 클로드감리0817 · **일시**: 2026-08-17 · **상태**: 보고완료
- **기준**: `edf6f96` · `c0f2831` 유지. 폐기·reset·재구현 금지. 그 위에 쌓는다.
- **브랜치**: `fix/hud-companion-consistency`

---

## 1. 불변 — 기존 커밋

```
edf6f96  feat(hud): DEV 게이트로 동행 HUD 진단 ①~⑥ 을 노출한다
c0f2831  fix(activity): routeActivity 세션 캐시에 폴링 주기와 같은 TTL 을 둔다
```

폐기·reset·재구현하지 마라. 그 위에 쌓아라.

---

## 2. BLOCK — §3-2 표시 규칙

H-1 첫 패스는 증상 두 개 중 TTL(집계)만 고쳤다. `MapHud.tsx` 빈 문장과 `App.tsx` 이름 dedup 은 그대로였다.

```
「다른 라이더 없음」은 정말로 다른 라이더가 하나도 없을 때만 쓴다.
근거는 이미 구독 중인 live ride 행이다 — 나를 제외한 행이 하나라도 있으면 쓰지 마라.
```

계측에서 A·B 원인이 달랐다. A 는 `coursePeerHud` 가 애초에 비어 있었다. `coursePeerHud` 를 근거로 삼으면 A 가 안 고쳐진다. live ride 행을 근거로 삼아라. 단순 접속자를 근거로 삼지 마라 — 접속만 하고 안 달리는 사람이 있다. **dedup 필터 자체는 유지**한다. 이름 중복을 막는 원래 목적은 옳다.

---

## 3. 조사·수정 금지

- **publicationId 불일치** — 실측으로 배제 확정(A·B 모두 동일). 조사도 수정도 하지 마라.
- **미세 싱크 오차** — Chief 가 범위 밖으로 확정. 조사·수정·계측 모두 금지.

---

## 4. WARNING — 기록만, 이번엔 고치지 마라

원인을 단정하지 마라.

- A 가 접속자를 1명으로 본 것
- 집계가 A·B 로 갈린 것
- 재현 코스가 Chief 조건과 다른 것

다음 재현은 가능하면 Chief 조건(Trail 403)에 맞춰라. 안 되면 그 사실을 적어라.

---

## 5. 검증 V2~V6

- **V3** 는 A 화면에서도 통과해야 한다 — B 만 맞추면 절반이다.
- **V4** 혼자 주행 시 「다른 라이더 없음」이 정상적으로 뜬다. 반드시 넣어라.
- V2·V3·V4 스크린샷을 `H1-shots/` 에, 수정 후 계측을 `H1-hud-diag-after.json` 에 남겨라.
- 재현이 5분 안에 안 되면 즉시 멈추고 보고하라.

---

## 6. 커밋 · push · 보고

```
커밋 1  제품
커밋 2  증거·문서
첫 push 는 git push -u origin fix/hud-companion-consistency
REPORT.md 에 H-1 을 한 줄 추가하되 기존 S4 이력은 고쳐 쓰지 마라
경로 지정 stage. git add -A · force · rebase · amend 금지
BLOCK 만 재작업, WARNING 은 기록 후 진행
```

```
문서에 적는다
  - 첫머리 2~3 줄: 무엇이 달라졌는지 평문으로
  - 브랜치 · edf6f96·c0f2831 유지 확인
  - V2~V6 결과 (A 의 V3 포함)
  - H1-shots/ 경로
  - WARNING 3건 기록 (원인 단정 없음) · Trail 403 재현 여부
  - 이견·실패 전수 — 없으면 「없음」

최종 응답에만 적는다
  - 커밋 해시 2 개 · 브랜치명 · push 결과 · 최종 git status --short · git stash list
```

---

## 결과 (H-1R)

동행 HUD 빈 문장 「다른 라이더 없음」을 `coursePeerHud` 가 아니라 구독 중인 live ride 행(나 제외)으로 판정하게 바꿨다. 이름 목록의 Trail 접속자 dedup 은 그대로 둔다. 접속만 하고 안 달리는 사람이 있어도 빈 문장은 live ride 행만 본다.

작업 브랜치 `fix/hud-companion-consistency`. HEAD 가 `c0f2831` 위에 쌓였고 `edf6f96`·`c0f2831` 은 유지했다.

표시: Presence 가 live ride 스냅샷을 받는 즉시 `publishHasOtherLiveRiders` 로 올리고, MapHud 가 `useSyncExternalStore` 로 읽는다. 가시성 필터를 탄 `coursePeerHud` 가 비어 있는 A 화면에서도 행이 있으면 빈 문장을 쓰지 않는다.

검증 (`H1_PHASE=after`, `RTW_DEV_PORT=5001`, 경과 120 s < 5분):

| 항목 | 결과 |
|---|---|
| V2 | PASS — TTL 후 집계 A=13 B=13 |
| V3 A | PASS — `emptyCopyA=[]` (「다른 라이더 없음」 없음) |
| V3 B | PASS — `emptyCopyB=[]` |
| V4 | PASS — 혼자 주행 시 「다른 라이더 없음」 |
| V5 | PASS — getDoc A=3 B=2, 경과/60s 상한 안 |
| V6 | PASS — 샷 해시 5개 모두 다름 |

샷: `document/ops/sync-relay/H1-shots/v4-solo-a.png` · `v3-dual-a.png` · `v3-dual-b.png` · `v2-dual-a.png` · `v2-dual-b.png`. 계측: `H1-hud-diag-after.json`.

WARNING 기록(고치지 않음, 원인 단정 없음):

- 혼자 주행 샷에서 접속 목록에 나 아닌 게스트가 보인 적 있음(안 달리는 접속자).
- 동행 직후 집계가 A·B 로 갈린 적 있음(TTL 전에는 13 vs 12). TTL 후 V2 는 일치.
- 재현은 Trailhead 입문 코스 시작으로 새 Trail 이 생긴다. 저장소에 Chief Trail 403 trailId 가 없어 맞추지 못함. 이번 라벨은 Trail 749.

이견·실패: 포트 5000 은 다른 워크트리(`boxcycle`) vite 가 잡고 있어 5001 로 재현했다. 입문 코스 0.45 km 를 20 km/h 로 두면 TTL 대기 중 완주하므로 검증 속도는 8 km/h. 그 외 없음.
