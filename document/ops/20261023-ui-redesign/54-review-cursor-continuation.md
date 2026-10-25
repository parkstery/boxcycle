# 감리 54 — 지시52 연속 주행 하네스 (Cursor, 읽기 전용)

| 항목 | 값 |
|---|---|
| 일시 | 2026-10-24 KST |
| 감리자 | Cursor Developer (읽기 전용, 시험·제품·git 미실행) |
| 기준 | [지시52](52-task-ride-continuation.md)·[결과53](53-result-ride-continuation.md)·`AGENTS.md` |
| 검토 자료 | `evidence/instruction52/final-implementation.diff`, `apps/web/e2e/ride-continuation.spec.ts`, `apps/web/scripts/ride-verify/entry-contract.mjs`, `evidence/instruction52/continuation-final.log` |

## 종합 판정

**PASS** — 지시52 범위(하네스·셀렉터 계약·전체 7건 재검증)에 대해, 증거 로그상 **7/7 통과·watchdog exit 0**(약 439s)와 diff·스펙 내용이 일치한다. **시험 기대값 완화(진행률·주행 거리·폴링·개별 300s·global 560s/600s 한도 삭제·약화)는 보이지 않는다.** RC2~4 변경은 깨진 셀렉터·제품 계약(이어 달리기 UI, Chief 지시29 팝업 재생, 2026-09-27 「저장 안 함」=닫기)에 맞춘 **정합 교정**으로 판단한다.

제품 UI·Chief 고정 1~14·묶음3 미커밋 구현은 지시52·결과53 주장과 같이 diff 범위 밖이다.

---

## 기대값 완화 여부

| 구분 | 판단 | 근거 |
|---|---|---|
| 진행률·stale write | **완화 없음** | RC2 `lastProgressRatio` 폴링 `≥ 0.43`, 카드 `43%에서 이어 달리기` 단언 유지 (`ride-continuation.spec.ts` L486–496). |
| 주행 구간·세션 거리 | **완화 없음** | RC1 `0.2`/`0.17`, RC2 `0.31`, RC13 `0.2`+`150m`, CF-LIVE `0.3` 등 기존 비율·`rideUntilSessionMeters` 폴링(180s) 유지. |
| 타임아웃 | **완화 없음** | `test.setTimeout(300_000)` 유지; `page.setDefaultTimeout(15_000)`는 **기본 대기 상한 축소**(낡은 셀렉터가 300s를 잡아먹지 않게)이며 지시52·결과53 설명과 일치. |
| RC3 「주행 시작」 | **완화 아님·범위 정밀화** | 전역 `주행 시작` 0개 → **주행바** Go 0개 + **팝업 재생 비활성** + 거리·방향 탭 `aria-selected` + checkbox `checked` 유지. R1 §4·지시29 의도에 더 가깝다. |
| RC4 닫기 | **완화 아님** | 두 번째 「닫기」 클릭 제거는 단언 삭제가 아니라 **이미 닫힌 판**에 대한 오동작 제거; `저장 안 함` 후 `summary` hidden 단언은 유지(L574–576). |
| CF-LIVE | **완화 없음** | conquest 주입·fake PASS 없음(결과53·스펙 주석 L685–694). `newMeters > 0`, tier `t0|t1`만 검사 — 원래 스펙 수준. |

**결론:** 지시52 금지 항목 「시험 기대값 완화」에 해당하는 변경은 **없음**.

---

## RC2~RC4 교정 근거 (요약)

| 시나리오 | 원인(첫 실행 4/7, `continuation-all.log` — 결과53) | 교정 요지 | 제품/계약 근거 |
|---|---|---|---|
| **RC2** | 진행률 있는 경로에서도 메뉴 「열기」만 찾음; 「처음부터」 라디오 접근 전 팝오버 미오픈 | `loadSavedRouteFromMenu(..., '이어 달리기')`, 모달·툴바 범위, `이어 달리기 선택` 후 radio | 지시52: RC2는 「이어 달리기 선택」 팝오버 선행 |
| **RC3** | 완주 후 전역 `주행 시작` 0개 — 팝업에 **비활성** 재생 버튼이 DOM에 존재 | 주행바·extendDock 분리, `toBeDisabled()` on 팝업 재생, 탭·checkbox 보강 | Chief 지시29 — 경로 전 팝업 재생 비활성 |
| **RC4** | 「저장 안 함」이 이미 닫은 뒤 scrim/닫기 재클릭 | 한 클릭 후 hidden만 확인; reload·카드·연장 dock 검증 유지 | 2026-09-27 저장 안 함 = 닫기 포함 |

공통: `enterAsGuest` / `reloadAtDefaultLocation` + `closeRideResult`(`.ride-summary__close`, scrim `.first()` 회피) — 지시52 위치 안내·결과판 닫기 계약.

---

## entry-contract.mjs

**PASS** — `ride-result-progress` 단계에 `ride-summary__close` 앵커 추가(L300). e2e `closeRideResult`와 동일 구분(내부 닫기 vs 배경 scrim). 기존 단계·잠금 단언 삭제 없음.

---

## 증거·로그 교차검증

| 항목 | Cursor 확인 |
|---|---|
| `continuation-final.log` | 7 passed (6.7m), `Script exited successfully (code 0)`, `[e2e-deadline] done exit=0` (L871–884) |
| CF-LIVE | 로그에 `newMeters=299`, `tier=t0`, conquest 페이로드·CF 트리거 실행 흔적 (L150–153, L862–867) |
| diff vs 현재 스펙 | `final-implementation.diff` 내용이 현행 `ride-continuation.spec.ts`와 핵심 교정부 일치(독립 재실행 없음) |

---

## 한계·유의

1. **읽기 전용 감리** — Cursor는 시험을 재실행하지 않았다. 판정은 결과53·`continuation-final.log`·diff·스펙 정독에 따른다.
2. **Chief 직접 화면 확인** — 결과53: 이번 하네스 교정 범위에서는 불필요로 기록. RC1 재개 캡처는 Codex 직접 확인(결과53).
3. **환경** — Firebase **에뮬레이터**·worker 1·retries 0; 운영 Firebase·실기기 회귀는 이 PASS 범위 밖.
4. **RC3/RC4** — disabled 재생·탭 selected는 UI 패턴 변경에 취약한 하네스; 의미(준비 전 Go 불가·거리·방향 모드)는 유지되나 구현 세부(class/role) 변경 시 다시 깨질 수 있다.
5. **보호 파일·해시·포트** — 결과53 최종 확인(22:32 KST)은 Cursor가 독립 재검증하지 않음.

---

## 지시52 금지·범위 체크리스트

| 항목 | 판정 |
|---|---|
| 제품·고정 목록 변경 | **해당 없음**(하네스·contract 앵커만) |
| 시험 기대값 완화 | **없음** (상단) |
| 커밋·푸시·서버 종료 등 | 감리 세션에서 **미수행**(지시 준수) |

**최종: PASS** (지시52 하네스·7/7 로컬 검증 증거에 대한 Cursor 읽기 전용 감리).
