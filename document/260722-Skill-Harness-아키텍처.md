# RTW Skill / Harness 아키텍처

| 항목 | 내용 |
|------|------|
| 문서 유형 | **meta** — Skill·Harness의 경계·폴더 구조·작성 표준의 **단일 진실(SoT)**. 신규 Skill/Harness는 본 문서를 따른다 |
| 최초 작성 | 2026-07-22 |
| 상태 | **채택** |
| 연결 문서 | [개발 워크플로](260719-개발-워크플로-브랜치-커밋-게이트.md) · [결정 로그](260707-RTW-결정-로그.md) · [상태보드](260707-RTW-기능-인벤토리-상태보드.md) · 예시: [rider-preview SKILL](../.claude/skills/rider-preview/SKILL.md) |

---

## 0. 왜 이 문서가 먼저인가

Skill을 더 만들기 전에 **Skill과 Harness의 경계를 프로젝트 전체에서 확정**한다. 표준 없이 스킬을 늘리면, rider-preview가 그랬듯 매번 "규율과 사용법이 섞였다가 나중에 분리"를 반복한다. 이 문서를 먼저 세워, 이후 만드는 모든 Skill/Harness가 같은 형태를 따르게 한다.

## 1. 세 계층 — 무엇이 무엇인가

한 작업 영역(rider, camera, peer-sync…)은 **세 계층**으로 나뉜다. 사용자는 이 순서로 읽으면 된다:

| 계층 | 질문 | 형태 | 위치 |
|---|---|---|---|
| **Skill** | **왜·언제 쓰나** (규율) | `SKILL.md` (읽는 문서) | `.claude/skills/<name>/SKILL.md` |
| **HARNESS.md** | **어떻게 쓰나** (연결·절차) | 설명 문서 | `apps/web/scripts/<name>/HARNESS.md` |
| **실행 코드** | 실제로 도는 것 | `.mjs`/`.html`/`.ts` | `apps/web/scripts/<name>/` |

읽는 흐름: **SKILL(왜) → HARNESS(어떻게) → 실행 코드(무엇이 도는가)**.

### 왜 Harness 실행 코드가 `apps/web/scripts/` 안인가 (루트 `harness/`가 아니라)

하네스 스크립트는 `apps/web`에 **물리적으로 묶여 있다**: three·playwright·vite 의존이 `apps/web/node_modules`에 있고, 검증 대상(`src/lib/*.ts`·`public/*.glb`)도 apps/web 안이며, vite dev root도 apps/web이다(npm 워크스페이스 = apps/web 하나). 루트로 빼면 import·node_modules 해석이 깨진다. **개념적 3계층은 지키되 물리 위치는 워크스페이스 현실을 따른다**(2026-07-22 결정).

## 2. 경계 규칙 — 무엇을 어디에 쓰나

**SKILL.md 에만 쓴다** (규율·판단):
- 왜 이 스킬이 존재하는가, 언제 발동하는가
- **철칙**(따라야 할 순서)
- **PASS/FAIL 기준** — YES/NO로 판정 가능하게 기계적으로(예: "정면에서 눈이 가려지면 FAIL"). "잘 보인다" 같은 주관 표현 금지
- 실패 히스토리 · **Anti-pattern**(실제 겪은 실패의 재발 금지 목록)

**HARNESS.md 에만 쓴다** (사용법):
- 이 스킬이 쓰는 하네스 파일 목록·역할
- 실행 순서 · CLI 옵션 · 산출물 위치
- 재생성 절차 · 미구현(확장 TODO)

**둘 다 금지**: 좌표 불변식·튜닝 상수 같은 도메인 정본 — 그건 도메인 SoT(예: 인수인계 문서)에 두고 링크만 한다. **SoT 충돌 시 도메인 SoT가 우선**임을 SKILL 상단에 명시한다.

## 3. 신규 Skill/Harness 작성 표준 (템플릿)

```
.claude/skills/<name>/
    SKILL.md              ← 왜·언제·PASS/FAIL·anti-pattern (frontmatter: name·description·user-invocable·allowed-tools)
apps/web/scripts/<name>/
    HARNESS.md            ← 사용법·CLI·산출물·확장TODO
    <tool>.mjs            ← 실행 코드
    .out/                 ← 산출물(gitignore)
```

**SKILL.md 필수 섹션**: 헤더(WHY 한 줄 + SoT 우선순위 명시) · 철칙(순서) · PASS/FAIL 표 · **Anti-pattern**.
**HARNESS.md 필수 섹션**: 파일 표 · 각 도구 CLI · 재생성 · 미구현.

상호 링크(SKILL↔HARNESS↔도메인 SoT)는 상대경로로 걸고, 만든 뒤 경로가 실제 파일을 가리키는지 검증한다.

`.claude/`는 gitignore되지만 `agents/`·`skills/`·`settings.json`은 화이트리스트로 추적된다(`settings.local.json`은 로컬 전용). 스킬은 커밋되어야 팀이 공유한다.

## 4. 프로젝트 철학 — "3번 규칙"

> **한 세션에서 같은 것을 3번 이상 고치고 있다면 — 그 영역의 Harness가 없는 것이다.**

rider-preview에서 나온 규칙을 프로젝트 전체로 확장한다. 반복은 "실력 부족"이 아니라 **"구현 전 검증 단계(Harness)의 부재"**라는 신호다:

| 3번 이상 고치는 것 | 없는 것 |
|---|---|
| 라이더 형태·헬멧 | 프리뷰 Harness ← ✅ 있음(rider-preview) |
| 카메라 프리셋 | 카메라 프리뷰 Harness |
| peer sync 알고리즘 | Replay Harness (패킷 로그→재생→그래프) |
| Firestore write 정책 | Mock/Cost Harness |
| 맵 스타일 | 스타일 프리뷰 + 레이어 검증 Harness |

3번째 수정을 하고 있다면 멈추고 **먼저 Harness부터** 만든다.

## 5. Capability Matrix (현황 — 상태 바뀌면 이 표만 갱신)

작업 영역별로 **규율(Skill)만 있는지, 검증 도구(Harness)까지 있는지** 한눈에.

| 영역 | Skill | Harness | 상태 | 비고 |
|---|:---:|:---:|---|---|
| Rider Preview | ✅ | ✅ | **완료** | verify-rider-glb·render-views. 8위상 페달 렌더는 미구현 |
| Ride Verify (실주행) | ✅ | ✅ | **완료** | 셀렉터 계약 검증(verify-selectors) + 에뮬레이터 배선(`test:e2e:ride`) · **e2e green(1 passed, 2026-07-22)** — 6단계 진입 전체 검증 · peer 2인 진입·종료 저장은 미구현 |
| Peer Sync | ✅ | ✅ | **완료** | replay 하네스(재생·불변식·그래프). 정지 오버슛은 known-fail 고정 · merge 이중스트림·reconcile 재생은 미구현 |
| Camera | ❌ | ❌ | 필요 | 프리셋 프리뷰 없음 |
| Ontology (용어) | 🔶 | 🔶 | 필요 | 금지어 정의(Ontology)·audit CLI는 있으나 신규 diff 검사 스킬 없음 |
| Firestore Cost | ❌ | ❌ | 필요 | write 전 mock/cost 검증 없음 |
| Deploy | 🔶 | 🔶 | 필요 | 체크리스트 문서만, 실행 점검 스킬 없음 |
| Config Seed | ❌ | 🔶 | 후순위 | seed.json 3종 있음, 주입 스킬 없음 |

**범례**: ✅ 완비 · 🔶 일부/문서만 · ❌ 없음.

기존 테스트 하네스: Playwright e2e(`apps/web/e2e/`, `test:e2e`), functions audit CLI 5종(`admin:audit-*`). 이들은 위 표의 Harness 열에 흡수되거나 재사용된다.

## 6. 다음 우선순위 (철학 §4 기준)

1. ~~**ride-verify** — 실주행 진입 시퀀스를 하네스화.~~ ✅ 셀렉터 계약 완비.
2. ~~**peer-sync Replay** — 패킷 로그→재생→보간→그래프.~~ ✅ 완료. 정지 오버슛 버그를 known-fail 로 노출·고정.
3. ~~**Firebase 배선(에뮬레이터)**~~ ✅ **완료**(2026-07-22, 경로 (b)). `test:e2e:ride` 로 에뮬레이터 자동 기동.
4. ~~**ride-entry spec 3→4단계 수정**~~ ✅ **완료**(2026-07-22). 원인은 3겹(배선·입문경로 빈배열·spec 이 '닫기' 버튼 클릭) — 코스 아이템 셀렉터로 수정해 **e2e green(1 passed)**.
5. 그 후 deploy-check·config-seed·ontology-audit·camera 를 **같은 3계층 패턴**으로 확장.
