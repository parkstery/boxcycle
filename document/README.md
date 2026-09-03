# RTW `document/` — 살아있는 문서 색인

| 항목 | 내용 |
|------|------|
| 문서 유형 | **메타** — 살아있는 문서만 등재하는 색인. 기록은 `archive/` |
| 최초 작성 | 2026-05-23 (2026-07-07 아카이브 분리 개편) |
| 상태 | **검토됨** |
| 연결 문서 | [문서 생성·수정 지침](260509-BOXCYCLE-문서-생성-및-수정-지침.md) |

> **어디서부터 볼까?** → [**기능 인벤토리·상태보드**](260707-RTW-기능-인벤토리-상태보드.md) 하나만 열면 됩니다. 전체 그림·상태·충돌·링크가 다 있습니다.

## 질문 → 문서 라우팅

| 질문 | 문서 |
|------|------|
| "X가 **무엇인가**·뭐라고 부르나" | [RTW Ontology](260714-RTW-Ontology.md) |
| "**왜** 그렇게 결정했나" | [결정 로그](260707-RTW-결정-로그.md) |
| "어디까지 **구현**됐나·전체 그림" | [상태보드](260707-RTW-기능-인벤토리-상태보드.md) |
| "문서·용어를 **바꾸려면**" | [문서 지침](260509-BOXCYCLE-문서-생성-및-수정-지침.md) §6·§6.1 |
| "**어떻게 동작**하나 (메커닉·수치)" | 각 도메인 SoT (아래 표) |

## 문서 수명 규칙 (폴더가 다시 비대해지지 않게)

1. **이 폴더(톱레벨)에는 살아있는 문서만** — 현재 의사결정에 쓰이는 SoT·정책·상태보드.
2. **보고서·`(cycle)`·완료된 체크리스트는 태어날 때부터 `archive/`에 작성** — 참조가 필요하면 상태보드에 한 줄 링크만 남긴다.
3. 살아있던 문서도 역할이 끝나 "기록"이 되는 순간 `archive/`로 이동한다(링크는 이동 시 함께 수정).
4. **`archive/`는 색인하지 않는다** — 날짜 접두어(`YYMMDD-`)로 폴더에서 훑거나 `git grep`으로 찾는다.
5. 새 살아있는 문서를 추가하면 아래 표에 한 줄 등재한다. 상세 규칙은 [지침](260509-BOXCYCLE-문서-생성-및-수정-지침.md).

### 신뢰도(의사결정용)

| 기호 | 의미 |
|------|------|
| **SoT** | 단일 진실 — 갈등 시 이 문서 우선 |
| **반영중** | 코드·배포와 동기화 중 |
| **초안** | 정책 합의본 — 구현 전 |

---

## 살아있는 문서 (전부)

### 진입점·비전

| 문서 | 역할 | 신뢰도 |
|------|------|--------|
| [**260707-RTW-기능-인벤토리-상태보드**](260707-RTW-기능-인벤토리-상태보드.md) | **전 기능 상태(✅🔶💭⚠️)·충돌·미결 — 단일 진입점** | 반영중 |
| [260714-RTW-Ontology](260714-RTW-Ontology.md) | 용어·개념·관계·금지어 — "X가 무엇인가"의 답 | SoT |
| [260707-RTW-결정-로그](260707-RTW-결정-로그.md) | 주요 결정·이유 append-only 로그(태그 필터) — "왜 이렇게 갔더라?" | 반영중 |
| [260511-RTW-마스터-비전-및-종합계획](260511-RTW-마스터-비전-및-종합계획.md) | 비전·전략·타겟·장기 계획 | SoT |
| [260703-Conquest-정복-레이어-설계](260703-Conquest-정복-레이어-설계.md) | 「Ride = Claim」 메커닉·데이터 모델 | SoT |
| [260509-BOXCYCLE-현재단계-범위-스택-및-1차마일스톤](260509-BOXCYCLE-현재단계-범위-스택-및-1차마일스톤.md) | 스택·마일스톤·진행 표(§2.1만 갱신) | SoT |

### 정책

| 문서 | 역할 | 신뢰도 |
|------|------|--------|
| [260519-사용자-tier-및-진입-정책](260519-사용자-tier-및-진입-정책.md) | identity·tier·진입 (tier 계층 상단) | SoT |
| [260717-퍼블릭-경로-자동등록-정책](260717-퍼블릭-경로-자동등록-정책.md) | 퍼블릭 경로 등록 조건·자동 심사(수동 검수 폐기·완주 조건 폐기) | SoT |
| [260519-tier-quota-정책](260519-tier-quota-정책.md) | tier별 생성·저장 한도 | 부록 |
| [260519-tier-subscription-정책](260519-tier-subscription-정책.md) | Stripe → `registered_paid` | 부록 |
| [260518-Route-Token-경제-설계](260518-Route-Token-경제-설계.md) | Route Token 경제 (⚠️ quota와 이중 체계 — 상태보드 §4-1) | 초안 |
| [260517-제품-용어-Trailhead-Trail](260517-제품-용어-Trailhead-Trail.md) | Trail·Trailhead 도메인 상세(시청 컨텍스트·MENU 목록·레이어 매핑) — 용어 정의는 [Ontology](260714-RTW-Ontology.md)로 이관 | SoT(범위 축소) |
| [260511-코스-수명-UGC-품질-정책 → archive] | UGC 수명·품질 — 필요 시 [archive](archive/260511-코스-수명-UGC-품질-정책.md) 참조 | 기록 |

### 아키텍처·운영

| 문서 | 역할 | 신뢰도 |
|------|------|--------|
| [260901-거리·방향 자동 Route 클릭 도로 직접 탐색·End 근접 선택 3F-B 작업지시서](ops/route-relay/260901-거리방향-자동Route-클릭도로-직접탐색-End근접선택-3F-B-작업지시서.md) | **다음 알고리즘 `DISTANCE-AUTO-ROUTE-CLICK-INTENT-3F-B`** — raw click을 첫 Directions endpoint로 사용하고 provider snapped road·exact clipped End 오차로 실제 후보 선택 | 3F-A-R1 후 실행 |
| [260901-거리·방향 자동 Route 클릭 의도 관측·Replay 3F-A-R1 작업지시서](ops/route-relay/260901-거리방향-자동Route-클릭의도-관측Replay-3F-A-R1-작업지시서.md) | **현재 Review `DISTANCE-AUTO-ROUTE-CLICK-INTENT-3F-A-R1`** — targetRoadPoint·deterministic replay를 보완하고 raw 클릭점 개발 marker·6자리 좌표 label로 End 이탈을 직접 비교 | 부분 PASS · Review 보완 중 |
| [260901-거리·방향 자동 Route popup 도킹 충돌 판정 3D-2-R2-R1 작업지시서](ops/route-relay/260901-거리방향-자동Route-popup-도킹충돌판정-3D-2-R2-R1-작업지시서.md) | `DISTANCE-AUTO-ROUTE-POPUP-DOCK-3D-2-R2-R1` — 예약 HUD hard collision·실제 slot selector로 도킹 계약 복구 | PASS · `589702b` local commit |
| [260903-폰 실사용 결함 7건 4A 작업지시서](ops/route-relay/260903-폰-실사용-결함3건-4A-작업지시서.md) | **현재 작업 `PHONE-FIELD-DEFECTS-4A`** — 배포 후 폰 검증. 절단 허용오차 구간 `[D−5m, D)` 누락, 거리 조정 후 슬라이더 미갱신, 이어가기 진입점 2개 중 시트 경로가 거리모드·이동수단·End 를 승계 안 함 | 실행 대기 |
| [260903-루프 3 실측 덤프로 원인 확정 3K-R3 작업지시서](ops/route-relay/260903-루프3-실측덤프-3K-R3-작업지시서.md) | **`RIDE-CONTINUE-PHASE-C-3K-R3`** — 덤프로 제품 결함 확정(popup microtask stale pin 재-arm) · 수정 적용 · **phase-c green 미확인** | **부분 PASS** |
| [260903-단계 C 마무리 — 루프 3·취약 시험 3K-R2 작업지시서](ops/route-relay/260903-단계C-마무리-루프3-취약시험-3K-R2-작업지시서.md) | **`RIDE-CONTINUE-PHASE-C-3K-R2`** — 취약 assert 삭제 PASS · **루프 3 미해결** → [3K-R3](ops/route-relay/260903-루프3-실측덤프-3K-R3-작업지시서.md) | **부분 PASS** |
| [260903-단계 C e2e 2건 실패 원인 교정 3K-R1 작업지시서](ops/route-relay/260903-단계C-e2e-2건-실패-원인교정-3K-R1-작업지시서.md) | **`RIDE-CONTINUE-PHASE-C-3K-R1`** — Functions emulator throw·readGuestUid IndexedDB·Start 이동 시 방향 모드 해제 | **PASS** |
| [260902-자동 Route 주행 루프 결합 단계 C 3K 작업지시서](ops/route-relay/260902-자동Route-주행루프-결합-단계C-3K-작업지시서.md) | **현재 작업 `RIDE-CONTINUE-PHASE-C-3K`** — 단계 B 통합 완료 확인. `test:route-token`·`test:e2e:ride` baseline green 을 게이트로 두고, 종료점에서 자동 Route 재진입·직전 값 승계·3회 연속 루프 e2e | baseline green · §2.3 선행 |
| [260902-RIDE-CONTINUE 통합 검증·원격 보존 3J 작업지시서](ops/route-relay/260902-RIDE-CONTINUE-통합검증-원격보존-3J-작업지시서.md) | **현재 작업 `RIDE-CONTINUE-VERIFY-3J`** — merge 충돌 해소 포함 6 commit 이 로컬에만 있어 즉시 push. phase-a 측정을 결과 시트 개폐 두 시점으로 분리하고 `test:next-ride` 통과 개수를 merge 전후 대조 | 실행 대기 |
| [260902-Emulator Functions URL 일원화·목표 거리 계약 회귀 3I 작업지시서](ops/route-relay/260902-Emulator-Functions-URL-일원화-거리계약-회귀-3I-작업지시서.md) | **현재 작업 `EMULATOR-FUNCTIONS-URL-3I`** — Emulator 모드에서 `tierQuota` 등이 프로덕션 Functions 를 호출해 「내 경로로 저장」이 인증 실패. URL 해석을 단일 helper 로 일원화 + 정적 게이트. 목표 거리 ±5m 위반은 `shortfall` outcome 으로 정정 | 실행 대기 |
| [260902-Token config 운영 반영 및 다음 작업 착수 3H 작업지시서](ops/route-relay/260902-Token-config-운영반영-및-다음작업-착수-3H-작업지시서.md) | **현재 작업 `TOKEN-CONFIG-DEPLOY-3H`** — 3G 잔여 §3.2 운영 `config/routeTokenEconomy` 확인·갱신, R1 지시서 worktree 전달, RIDE-CONTINUE-1-R1 단계 A 착수. commit·push 시점 규정 | 실행 대기 |
| [260902-거리·방향 자동 Route 3G 병합·푸시 및 Token 온보딩 기본값 작업지시서](ops/route-relay/260902-거리방향-자동Route-3G-병합푸시-Token온보딩기본값-작업지시서.md) | **현재 작업 `DISTANCE-AUTO-ROUTE-MERGE-3G`** — 검수 통과분 26 commit 을 `main2` 에 `--no-ff` 병합·push. Token 온보딩 Guest 10 / 로그인 15. 차단 결함 3건(harness 하드코딩 3 · config 문서 우선 역전 · isAnonymous 실패 시 과지급) 선수정 | 실행 대기 |
| [260902-거리·방향 자동 Route 실패 없는 도달 제안 3F-C-R1 작업지시서](ops/route-relay/260902-거리방향-자동Route-실패없는-도달제안-3F-C-R1-작업지시서.md) | **현재 알고리즘 `DISTANCE-AUTO-ROUTE-REACH-OFFER-3F-C-R1`** — 사용자 6클릭 실측(성공 1/6) 근거. 도넛 폐기, `road<D` 는 우회로 충족해 End=클릭, `road>D` 는 실패 대신 방향 도로 위 D 지점을 `offered` 로 제시·거리 조정 원클릭 | 실행 대기 |
| [260902-거리·방향 자동 Route 도로거리 도달영역·우회 충족 3F-C 작업지시서](ops/route-relay/260902-거리방향-자동Route-도로거리-도달영역-우회충족-3F-C-작업지시서.md) | `DISTANCE-AUTO-ROUTE-ROADREACH-3F-C` — 직선 도넛 폐기·도로거리 도달영역 최초 설계 | **3F-C-R1 로 대체** |
| [260901-거리·방향 자동 Route 클릭 도로·End 근접 탐색 3F 작업지시서](ops/route-relay/260901-거리방향-자동Route-클릭도로-End근접탐색-3F-작업지시서.md) | **현재 알고리즘 `DISTANCE-AUTO-ROUTE-CLICK-INTENT-3F`** — 클릭 좌표·최근접 주행 도로와 clipped End 오차를 replay로 비교하며 직접/주변/detour 후보를 단계 개선 | 3F-A 관측 진행 중 |
| [260901-거리·방향 자동 Route popup 지도 외곽 도킹·공간 회수 3D-2-R2 작업지시서](ops/route-relay/260901-거리방향-자동Route-popup-지도외곽도킹-공간회수-3D-2-R2-작업지시서.md) | `DISTANCE-AUTO-ROUTE-POPUP-DOCK-3D-2-R2` — 도킹·drag·공간 회수 구현, 예약 HUD 충돌 시험 실패 | 부분 PASS · `4c2fe1f` · R2-R1 필요 |
| [260901-거리·방향 자동 Route 목표 연장 정확 절단 3E 작업지시서](ops/route-relay/260901-거리방향-자동Route-목표연장-정확절단-3E-작업지시서.md) | `DISTANCE-AUTO-ROUTE-EXACT-DISTANCE-3E` — 긴 provider geometry를 목표 누적 연장에서 보간·절단하고 짧은 후보의 성공 반환 금지 | 정적 PASS · `e1d2475` · 실제 5/10km 확인 대기 |
| [260901-거리·방향 자동 Route 선택 모드 checkbox·거리 컨트롤 비율 3D-2-R1 작업지시서](ops/route-relay/260901-거리방향-자동Route-선택모드체크박스-컨트롤비율-3D-2-R1-작업지시서.md) | `DISTANCE-AUTO-ROUTE-3D-2-R1` — checkbox·고정 status slot은 반영됐으나 지도 외곽 도킹·오른쪽 여백 회수·slider 최대화 미완료 | 부분 PASS · R2 보완 필요 |
| [260901-거리·방향 자동 Route popup 공간 최적화·거리 ± 조작 3D-2 작업지시서](ops/route-relay/260901-거리방향-자동Route-popup-공간최적화-3D-2-작업지시서.md) | `DISTANCE-AUTO-ROUTE-3D-2` — Token 단일 행, 이동수단/경로 삭제 단일 행, native spinner 제거와 slider 좌우 ± 터치 조작 | 실행 대기 · 3D-1-R1 커밋 후 |
| [260901-거리·방향 자동 Route 생성 후 재탐색 연속성 3D-1-R1 작업지시서](ops/route-relay/260901-거리방향-자동Route-생성후-재탐색-연속성-3D-1-R1-작업지시서.md) | **현재 작업 DISTANCE-AUTO-ROUTE-3D-1-R1** — Route A 생성 후 같은 popup에서 다른 방향 Route B 탐색, 새 requestId·추가 Token 1개·실패 시 A 유지 | 실행 대기 |
| [260831-거리·방향 자동 Route 단일 설정창·클릭 축소 3D-1 작업지시서](ops/route-relay/260831-거리방향-자동Route-단일설정창-클릭축소-3D-1-작업지시서.md) | `DISTANCE-AUTO-ROUTE-3D-1` — 단일 popup·클릭 축소·임의 거리 입력 구현, 생성 후 재탐색 구형 popup 회귀는 3D-1-R1로 이관 | 부분 PASS · R1 보완 필요 |
| [260831-거리·방향 자동 Route 실동작 체크포인트 3C-R1 작업지시서](ops/route-relay/260831-거리방향-자동Route-실동작-체크포인트-3C-R1-작업지시서.md) | `DISTANCE-AUTO-ROUTE-3C-R1` — 사용자 확인된 작동 상태를 UI 개편 전에 `42ccdf2` local checkpoint로 고정 | PASS · 다음 3D-1 |
| [260831-거리·방향 자동 Route 일반 개발환경 실동작 복구 3C 작업지시서](ops/route-relay/260831-거리방향-자동Route-실동작-복구-3C-작업지시서.md) | `DISTANCE-AUTO-ROUTE-3C` — `getDistanceAutoRoute` 단독 배포 후 일반 `npm run dev`에서 3km Route 생성·Token 차감 확인 | PASS · 3C-R1 체크포인트 이관 |
| [260831-거리·방향 자동 Route 커밋 정리·빨강 원 증거 3B-R2 작업지시서](ops/route-relay/260831-거리방향-자동Route-커밋정리-빨강원증거-3B-R2-작업지시서.md) | `DISTANCE-AUTO-ROUTE-3B-R2` — 기능 외 ESLint 예외 제거, 3km·10km 빨강 원 화면 증거 재생성, local commit 정리 | 보류 · 3C 실동작 복구 우선 |
| [260831-거리·방향 자동 Route 빨강 원·서버 연결 3B-R1 작업지시서](ops/route-relay/260831-거리방향-자동Route-빨강원-서버연결-3B-R1-작업지시서.md) | `DISTANCE-AUTO-ROUTE-3B-R1` — 컴팩트 UI·빨강 원·Emulator 계약은 구현 및 시험 통과, stale 화면 증거와 commit 범위 오염은 3B-R2로 이관 | 부분 PASS · 3B-R2 보완 필요 |
| [260831-거리·방향 자동 Route 컴팩트 UI·목표 거리 원 3B 작업지시서](ops/route-relay/260831-거리방향-자동Route-컴팩트UI-거리원-3B-작업지시서.md) | `DISTANCE-AUTO-ROUTE-3B` — 이동수단 선택 단일화, popup 축소, 거리 선택 즉시 원 표시·화면 맞춤 | 부분 확인 · 서버 연결은 3B-R1 이관 |
| [260831-거리·방향 자동 Route Token 통합 원격 보존 3A-R1 작업지시서](ops/route-relay/260831-거리방향-자동Route-Token-통합-원격보존-3A-R1-작업지시서.md) | `DISTANCE-AUTO-ROUTE-TOKEN-3A-R1` — 검수된 자동 Route 최신 commit과 Token 통합 브랜치를 원격에 일반 push | PASS · push 완료 |
| [260830-거리·방향 자동 Route Token 안전 통합 3A 작업지시서](ops/route-relay/260830-거리방향-자동Route-Token-안전통합-3A-작업지시서.md) | `DISTANCE-AUTO-ROUTE-TOKEN-3A` — 자동 Route popup WIP를 `ad4d776` Token 기준에 통합하고 사용자 행동 1회=Token 1개를 서버 transaction으로 보장 | 독립 검수 PASS · push 대기 |
| [260830-Route Token 경로 설정창 표시 2A-R2 작업지시서](ops/route-relay/260830-Route-Token-검수서버-UI배치-획득문구-2A-R2-작업지시서.md) | `ROUTE-TOKEN-2A-R2` — 전역 Token 카드를 제거해 경로 설정 popup에 통합, 중립 부족 문구·`3→2→1→0` UI 검증 | PASS · `ad4d776` push 완료 |
| [260830-Route Token 기본 Route 세션 격리·전역 피드백 2A-R1 작업지시서](ops/route-relay/260830-Route-Token-기본경로-세션격리-전역피드백-2A-R1-작업지시서.md) | `ROUTE-TOKEN-2A-R1` — UID 전환·Token 재적립 고착, 생성 전 보유량/비용과 1·2·3회 차감, 실제 모듈 시험은 통과; 검수 서버 혼선·HUD 겹침·획득 문구는 2A-R2로 이관 | 부분 통과·2A-R2 보완 필요 |
| [260830-Route Token 기본 Route 우회 차단·차감 피드백 2A 작업지시서](ops/route-relay/260830-Route-Token-기본경로-우회차단-차감피드백-2A-작업지시서.md) | `ROUTE-TOKEN-2A` — direct 우회 제거와 단일 Guest `2→1→0`은 통과, UID/적립 고착·기본 지도 피드백은 2A-R1로 이관 | 부분 통과·2A-R1 보완 필요 |
| [260830-Route Token Harness 실패 복구·UI 재현성 1R2 작업지시서](ops/route-relay/260830-Route-Token-Harness-실패복구-UI-재현성-1R2-작업지시서.md) | `ROUTE-TOKEN-1R2` — runner 실패 원상복구·UI Route 응답 `2→1→0`·backend `0/3/3`·Node 20 연속 재현 증명 | 독립 재검토 PASS·PR 대기 |
| [260830-Route Token Harness 격리 보완 1R 작업지시서](ops/route-relay/260830-Route-Token-Harness-격리-보완-1R-작업지시서.md) | `ROUTE-TOKEN-1R` — 운영 노출·Secret Manager·부정 조건은 개선, UI 재현성·실패 원상복구는 1R2로 이관 | 부분 수행·1R2 보완 필요 |
| [260830-Route Token 정상 호출 경로 검증 1단계 작업지시서](ops/route-relay/260830-Route-Token-정상-호출-경로-검증-1단계-작업지시서.md) | `ROUTE-TOKEN-1` — Emulator Harness로 일반 Route Token `3→2→1→0→거부` 계약은 증명, 격리 결함은 1R로 이관 | 부분 수행·1R 보완 필요 |
| [260902-다음 주행·이어 달리기 자동 Route 결합 R1 작업지시서](ops/ride-relay/260902-다음-주행-이어달리기-자동Route-결합-R1-작업지시서.md) | **다음 작업 `RIDE-CONTINUE-1-R1`** — 주행 종료점을 다음 Start 로 승계해 루프를 닫고, 그 자리에서 거리·방향 자동 Route 로 다음 구간을 잇는다. 260829 §3.3 갱신 | 3G 병합 후 착수 |
| [260829-다음 주행·이어 달리기 작업지시서](ops/ride-relay/260829-다음-주행-이어달리기-작업지시서.md) | **현재 실행 작업 RIDE-CONTINUE-1** — 실제 Ride 종료점을 다음 출발점으로 자동 연결 + 미완주 SavedRoute 재개를 지도 주 표면으로 승격 | 제품 결정 확정·실행 대기 |
| [260828-Activity-World-줌-LOD-복구-작업지시서](ops/map-relay/260828-Activity-World-줌-LOD-복구-작업지시서.md) | **현재 실행 작업 MAP-LOD-1** — 비동기 흔적 dot/line 줌 전환이 2026-06-13부터 화면 미적용(회귀). 배선 복구 + 히스테리시스 복원 | 원인 확정·실행 대기 |
| [260827-BLE-케이던스-HUD-상태칩-작업지시서](ops/sensor-relay/260827-BLE-케이던스-HUD-상태칩-작업지시서.md) | **현재 후속 실행 작업 SENSOR-2** — 계정 옆 전역 센서 LED/RPM 칩 + Go 전 주행 입력 준비 게이트 | 코드 반영 완료·실물 검증 대기 |
| [260827-BLE-케이던스-직결-작업지시서](ops/sensor-relay/260827-BLE-케이던스-직결-작업지시서.md) | **현재 실행 작업 SENSOR-1** — CYCPLUS CSC 연결→RPM 확인→케이던스 기반 가상 주행 수직 기능 | 검토됨·실행 대기 |
| [260523-World-Activity-Presence-설계](260523-World-Activity-Presence-설계.md) | 월드 맵 presence·publication dot | SoT |
| [260523-Firebase-비용-운영-체크리스트](260523-Firebase-비용-운영-체크리스트.md) | 비용 관측·대응 | 반영중 |
| [260719-개발-워크플로-브랜치-커밋-게이트](260719-개발-워크플로-브랜치-커밋-게이트.md) | 브랜치 전략(main2 base)·커밋/푸시 타이밍·pre-commit/pre-push 품질 게이트 | SoT |
| [260722-Skill-Harness-아키텍처](260722-Skill-Harness-아키텍처.md) | Skill(왜)/Harness(어떻게) 3계층 경계·폴더 구조·작성 표준·"3번 규칙"·Capability Matrix | SoT |
| [260719-라이더-GLB-작업-인수인계](260719-라이더-GLB-작업-인수인계.md) | 라이더 GLB 모델·애니메이션 작업 이어가기용 컨텍스트(파일 지도·좌표 불변조건·튜닝 상수·후속 과제) | 진행중 |
| [출시 전 확인사항](출시%20전%20확인사항.md) | 개발 완화 수치 복원 목록 | 반영중 |

### 메타

| 문서 | 역할 |
|------|------|
| [260509-BOXCYCLE-문서-생성-및-수정-지침](260509-BOXCYCLE-문서-생성-및-수정-지침.md) | 파일명·메타 블록·링크 규칙 + §6.1 용어 변경 절차 |
| [루트 CLAUDE.md](../CLAUDE.md) | AI 세션 진입점 — 용어 요약·문서 라우팅 |
| 본 파일 (`README.md`) | 살아있는 문서 색인 |
| [루트 README](../README.md) | 실행 방법·배포 |

### 정책 시드 JSON (문서 본문 아님)

| 파일 | 용도 |
|------|------|
| [config-tierQuotas.seed.json](config-tierQuotas.seed.json) | tier 한도 시드 |
| [config-subscription.seed.json](config-subscription.seed.json) | 구독 시드 |
| [config-routeTokenEconomy.seed.json](config-routeTokenEconomy.seed.json) | Route Token 경제 시드 |

---

## `archive/` — 지난 기록 (38편+)

완료된 보고서·`(cycle)` 스냅샷·끝난 체크리스트·구버전 설계. **색인하지 않는다** — 파일명 날짜 접두어로 훑거나 `git grep <키워드> document/archive`로 검색. 아카이브 문서의 내용은 작성 시점 기준이며 현재 코드와 다를 수 있다.

| 문서 | 역할 |
|------|------|
| [260827-라이더-자이언트-스케일-실험-종결](archive/260827-라이더-자이언트-스케일-실험-종결.md) | G-1 20배·G-2 400배 **미채택**. `main2` 병합 금지. 보존 위치 `260825-gient` · 태그 `experiment/260825-gient` |
| [260825-동행-라이더-튐-S4-4-현황-보고서](archive/260825-동행-라이더-튐-S4-4-현황-보고서.md) | S4-1~S4-15 누적. 동행 peer 튐 **미해결·미확정 일단락** — 확정된 것은 「11.45 Hz S4-15 trace 에서 `projected` 단계 최초 관측」뿐. 철회된 감리 결론 9건·탈락 후보·**S4-4~S4-15 병합 금지 이유(미채택 제품 실험 포함)**·다음 착수 지점. **재개 전 필독** |
| [260816-화면-틱-라이더-진동-해결-보고서](archive/260816-화면-틱-라이더-진동-해결-보고서.md) | U-8~U-10 틱·라이더 진동 원인·배제 목록. U-1R·U-6 은 추가 수정 없이 종결(Chief 실사용 판정) |
| [260816-입문-실도로-경로-교체-보고서](archive/260816-입문-실도로-경로-교체-보고서.md) | 입문 Basic 1/2/3 허구 직선 → 실도로 3경로 교체. ID 신규 발급 근거·정합성·검증·production migration 판단. 증거는 [260816-입문-실도로-경로-증거/](archive/260816-입문-실도로-경로-증거/) |

---

## 개정 이력

| 날짜 | 내용 |
|------|------|
| 2026-05-23 | 최초 작성 — 네 덩어리 색인 |
| 2026-07-07 | **아카이브 분리 개편** — 기록성 38편 `archive/` 이동, 색인을 살아있는 문서만으로 축소, 수명 규칙 신설 |
| 2026-07-14 | **Ontology 신설 반영** — 질문→문서 라우팅 표 추가, [RTW Ontology](260714-RTW-Ontology.md) 등재, 260517 역할 축소, 루트 CLAUDE.md 등재 |
| 2026-08-27 | 자이언트 스케일 실험 종결 보고 등재 — [260827](archive/260827-라이더-자이언트-스케일-실험-종결.md) |
