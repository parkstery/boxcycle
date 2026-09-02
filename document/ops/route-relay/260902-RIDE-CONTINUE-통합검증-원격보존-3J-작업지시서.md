# RIDE-CONTINUE 통합 검증·원격 보존 3J 작업지시서

| 항목 | 내용 |
|---|---|
| 문서 유형 | **실행 — 미푸시 통합 결과 보존 + 측정 교정** |
| 최초 작성 | 2026-09-02 |
| 상태 | **즉시 실행 — §2 가 최우선** |
| 작업 ID | `RIDE-CONTINUE-VERIFY-3J` |
| worktree | `C:\20.HDev\boxcycle-distance-auto-route-ui-circle` |
| 브랜치 | `feat/ride-continue-r1` (현재 `9acf53c`, **원격 없음**) |
| 선행 | [3I](260902-Emulator-Functions-URL-일원화-거리계약-회귀-3I-작업지시서.md) |

## 1. 현황 검수

### 1.1 잘 된 것

| 항목 | 근거 |
|---|---|
| 3I §2 Emulator URL 일원화 | `85da194` |
| 3I §3 `shortfall` outcome | `022b8c1` |
| 3I §4.1 next-ride 통합 | `9cda5f8` merge — 충돌을 `onApplyRoute`·Token·`functionsHttpUrl`·`shortfall` 유지 방향으로 해소, 중복 `lastRideEndSummary`·`rideSessionAnchor.ts` 제거 |
| **결과 시트 결함 해소** | phase-a `mtk3yvm2`: `rideSummaryOpen: true`, `rideSummaryOpenAdhoc: true` — 단계 A 에서 양쪽 `false` 였던 260829 §2.4 결함이 살아났다 |
| 목표 거리 계약 | `distanceMeters: 4999.9987` — ±5m PASS. `outcome: "offered"` 정상 표기 |
| `NextRideCard` 코드 생존 | `components/ride/NextRideCard.tsx` 가 merge 후에도 존재 |

### 1.2 위험 — 6 commit 이 로컬에만 있다

`feat/ride-continue-r1` 은 **원격 추적 브랜치가 없다.** `85da194`·`022b8c1`·`0e0ab6f`·`0696a21`·`9cda5f8`·`9acf53c` 여섯 개가 이 PC 에만 존재한다.

특히 `9cda5f8` 은 26 commit 앞선 `main2` 위에 8/30 base 브랜치를 얹은 **수작업 충돌 해소**다. 이건 다시 만들 수 없다. 3I §5 는 §2·§3 을 즉시 push 하라고 했는데 아직 안 됐다.

**이 지시서에서 가장 먼저 할 일은 push 다.**

### 1.3 미확인 — 측정 순서 문제로 보인다

phase-a `mtk3yvm2` 에서 다음이 남아 있다.

| 지표 | 값 |
|---|---|
| `nextRideCardExists` / `…Adhoc` | `false` |
| `afterEnd.routeDockStops` | `[]` (단계 A 때는 `S`·`E` 가 있었다) |
| `hasNextRideUi` | `false` |

**제품 결함이 아니라 스크립트가 결과 시트를 열어 둔 채 측정한 것으로 보인다.** 근거:

- `NextRideCard.tsx` 는 merge 후에도 존재한다 — 유실이 아니다.
- next-ride 브랜치의 `6a6341b` 는 「**결과 시트를 닫으면** 지도를 idle 로 되돌려 다음 주행 카드를 띄운다」다. 즉 카드는 시트를 닫아야 뜬다.
- 같은 report 에서 `summaryOpen: true` 다. 시트가 열린 상태로 카드·RouteDock 을 찾았으니 `false`·`[]` 가 나오는 게 정상이다.

확정하려면 측정 순서를 고쳐 다시 돌려야 한다.

## 2. 즉시 push (다른 무엇보다 먼저)

```text
cd C:\20.HDev\boxcycle-distance-auto-route-ui-circle
git push -u origin feat/ride-continue-r1
```

미커밋 3건은 push 후에 정리해도 된다. **충돌 해소 결과를 원격에 올리는 것이 우선이다.**

## 3. 미커밋 정리

| 파일 | 처리 |
|---|---|
| `apps/web/scripts/route-token/distance-auto-route-token-contract.mjs` | 변경 의도를 커밋 메시지에 남긴다 |
| `document/README.md` | 3I·3J 색인 행 |
| `document/ops/route-relay/260902-…-3I-작업지시서.md` | 신규 |
| `document/ops/route-relay/260902-…-3J-작업지시서.md` | 신규(이 문서) |

`docs:` 와 `test:` 로 나눠 2개 commit 으로 남기고 push 한다.

## 4. 측정 교정 — phase-a 스크립트

`apps/web/scripts/ride-continue/phase-a-verify.mjs` 를 다음으로 고친다.

1. 주행 종료 후 **결과 시트가 열린 상태**에서 한 번 측정한다 — `rideSummaryOpen`, `summaryActions`.
2. **결과 시트를 닫는다**(「저장 안 함」 또는 닫기).
3. 닫은 뒤 **다시 측정**한다 — `nextRideCardExists`, `routeDockStops`, `hasNextRideUi`.
4. report JSON 에 `afterEndWhileSheetOpen` 과 `afterEndAfterSheetClosed` 두 블록으로 분리해 남긴다. 지금처럼 한 시점만 찍으면 어느 쪽이 원인인지 구분되지 않는다.
5. `summaryActions` 문자열이 report 에서 깨져 나온다(`"�� ��η� ����"`). JSON 을 **UTF-8 로 기록**하도록 고친다 — 증거가 읽히지 않으면 증거가 아니다.

재실행 후 다음을 확인해 보고한다.

- 시트를 닫은 뒤 `nextRideCardExists: true` 인가
- `routeDockStops` 의 `S` 가 **직전 주행 종료점**으로 바뀌었는가 (R1 §2-③ 의 답)
- SavedRoute 주행·ad-hoc 주행 **양쪽** 모두

여기서 `true` 가 나오면 R1 단계 B 는 통합만으로 완료된 것이다. `false` 면 그때 원인을 파고든다.

## 5. merge 후 시험 회복 확인

`9cda5f8` 이 8/30 base 위의 시험을 26 commit 앞선 코드에 얹었다. 다음이 **전부** 통과해야 한다.

```text
npm -w boxcycle-web run test:next-ride
npm -w boxcycle-web run test:distance-auto-route
npm -w boxcycle-web run test:distance-auto-route-replay
npm -w boxcycle-web run test:route-token
npm -w boxcycle-web run test:e2e:ride
npm --prefix functions run build
npm -w boxcycle-web run build
git diff --check
```

체크포인트 문서가 기록한 `test:next-ride` **40 pass** 와 `ride-continuation` **C1~C5** 가 merge 후에도 같은 수로 통과하는지 **개수까지** 대조해 보고한다. 숫자가 줄었으면 merge 에서 시험이 유실된 것이다.

실패가 나오면 시험을 지우거나 skip 하지 않는다. 원인을 고치거나, 못 고치면 그 사실을 보고한다.

## 6. 보고 후 멈춤

§2~§5 를 마치고 다음을 제출한 뒤 **멈춘다.**

- push 완료된 원격 브랜치명과 HEAD
- §4 재실행 report(두 시점 분리, UTF-8) 와 화면 증거
- §5 시험 결과 — 특히 `test:next-ride` 통과 개수
- merge 로 인해 **깨졌거나 포기한 것**이 있으면 그 목록

단계 C(자동 Route 결합, [R1 §4](../ride-relay/260902-다음-주행-이어달리기-자동Route-결합-R1-작업지시서.md#4-단계-c--자동-route-결합-이-r1-의-신규-조항))는 이 보고 뒤에 지시한다.

## 7. 금지·경계

- `main2` 병합은 이번에 하지 않는다. 그리고 **`main2` 는 `C:\20.HDev\boxcycle` 이 체크아웃 중이므로 이 worktree 에서 `git switch main2` 는 실패한다.** 병합이 필요해지면 그 저장소에서 한다.
- `9cda5f8` merge commit 을 amend·reset·rebase 하지 않는다. 충돌 해소 결과를 잃는다.
- deploy 하지 않는다.
- 시험을 skip·삭제해 통과시키지 않는다.
