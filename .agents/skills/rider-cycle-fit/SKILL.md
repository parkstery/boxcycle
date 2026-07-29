---
name: rider-cycle-fit
description: 별도로 제작된 rider GLB(Blender/Codex)와 cycle GLB를 크기·좌표·관절·접점을 맞춰 결합·피팅하고 페달 위상까지 검증하는 워크플로. stylized_cyclist_v2_lod0.glb·cycle-only.glb·fit_ik.py·ik-joints-v2.json·프레임 후보 계산을 만질 때 사용한다. 절차 생성 라이더(rider-preview)와 달리 "이미 만들어진 두 자산을 고정 입력으로 등록→결합→검증"하는 규율을 강제해, 좌표 재발견·위상 어긋남·혼합좌표 같은 반복을 막는다.
user-invocable: true
allowed-tools:
  - Read
  - Edit
  - Write
  - Bash
---

# rider-cycle-fit — Blender rider + 독립 cycle 결합·피팅 규율 (WHY)

이미 **별도로 오래 제작된** rider GLB(Blender/Codex 자산)와 개발팀장이 만든 cycle GLB를,
크기·좌표·관절·접점을 맞춰 결합하고 페달 위상까지 검증하는 작업의 규율이다.

절차 생성 라이더를 다루는 [rider-preview](../rider-preview/SKILL.md)와는 **성격이 다르다**:
rider-preview는 "생성기로 라이더를 굽는" 작업, 이 스킬은 "**이미 만들어진 두 자산을 결합**"하는 작업이다.
라이더를 처음부터 다시 만드는 게 아니다.

- **이 문서 = 왜·언제·합격기준.** 도구를 **어떻게** 쓰는지는 [하네스 사용법](../../../apps/web/scripts/rider-cycle-fit/HARNESS.md)을 보라. [Skill/Harness 아키텍처](../../../document/260722-Skill-Harness-아키텍처.md) 3계층 표준을 따른다.
- **SoT 우선순위**: 자전거 수치의 정본은 [geometry.json](../../../apps/web/src/lib/riderPrototype/geometry.json), 인체 치수 정본은 [riderAnthropometry.json](../../../apps/web/src/lib/riderPrototype/riderAnthropometry.json). **충돌하면 이 도메인 SoT가 우선한다.** 작업 인수인계는 memory `v24-cyclefit-handoff`.
- **범위(현재)**: 단계 0(입력 등록)·A(앵커 정합)·verify-fit(불변식)까지 하네스화됨. Blender 렌더 자동화·promote는 미구현(→HARNESS 확장 TODO).

## 철칙 — 입력을 먼저 고정하고, 판단을 검증한다

이 작업은 "라이더를 다시 굽는" 게 아니라 "**두 고정 입력을 결합**"하는 것이다. 순서:

1. **단계 0 — 입력 기준선 등록.** rider GLB·cycle GLB를 결합의 **고정 입력**으로 선언한다.
   각각 SHA-256·AABB·단위·좌표축·원점·Blender버전·노드/본 목록·경로·프리뷰 PNG를 manifest에 기록.
   이 단계는 라이더를 다시 만드는 게 아니라 **"이 둘이 입력임"을 못박는 것**이다.
2. **단계 A — 앵커 정합.** 두 GLB에서 접점 앵커(라이더 pelvis·좌골·어깨·손grip·고관절·무릎·발목·클릿 / 자전거 saddle·hood·BB·crank·pedal·headTop/Bot·seatTop·hub)를 추출해 단위·축·원점 변환을 하나의 manifest에 저장.
3. **단계 B — Static Fit.** crank 고정·sway/bob 없음으로 측면·정면·상단 렌더. 안장–좌골·손–후드·클릿–페달 접점 확인. **사용자 승인 전 페달 애니메이션으로 넘어가지 않는다.**
4. **단계 C — Pedal Fit.** 0/90/180/270°(가능하면 8위상). **라이더 발과 자전거 크랭크가 같은 phase**·좌우 크랭크 180°차·클릿-페달축 오차·무릎 궤적·신체-프레임 관통.
5. **단계 D — 결합 GLB 검증.** armature·node 보존·머티리얼·AABB·앱 좌표계·Mapbox scale·앱이 요구하는 노드 존재.
6. **단계 E — 앱 이식.** 승인된 후보를 **재생성 없이** 제품 경로로 복사. 그 뒤에만 [ride-verify](../ride-verify/SKILL.md)로 진입·running 확인.

> **한 세션에서 좌표(안장·후드·다리)나 위상을 3번 이상 다시 계산하고 있다면 — 단계 0·A가 빠진 것이다. 멈추고 입력·앵커부터 manifest에 고정하라.**

## 🔒 후보/제품 분리 — 실험 결합 GLB가 제품을 덮지 않는다

- 승인 전 모든 산출물은 **후보 경로에만**: `apps/web/scripts/rider-cycle-fit/.out/candidates/<candidateId>/`.
- 제품 GLB `apps/web/public/rider/prototype/rider-lowpoly.glb`를 승인 전 덮어쓰지 않는다.
- **candidateId** = `YYYYMMDD-HHmmss-<shortInputHash>` (KST). 아래 입력 중 하나라도 바뀌면 **새 candidateId**:
  rider GLB · cycle GLB · fit_ik.py · ik-joints-v2.json · geometry.json · export-ik-joints-v2.mjs · Blender버전/export설정.
- **입력 해시 대상(경로+내용)**: 위 6개 파일 + Blender 버전 문자열. 하나라도 누락되면 재현 불가 — register-inputs가 강제.
- **동일성**: 사용자가 검토한 Blender scene/결합 GLB와 앱 이식 GLB가 **byte-for-byte 동일**해야 한다. 승인 후 다시 export 금지.

## PASS / FAIL 기준 (렌더에서 YES/NO 판정)

각 단계 렌더를 보고 판정한다. 하나라도 FAIL이면 재작업(새 candidateId).

| 항목 | PASS | FAIL |
|---|---|---|
| **크랭크-발 위상** | 자전거 크랭크와 라이더 발이 **같은 crank 각도** | 페달은 수평인데 발만 수직 등 위상 어긋남 |
| 좌우 크랭크 | 좌우 페달이 180° 대칭 | 두 페달이 같은 쪽/같은 높이 |
| 발–페달 접점 | 클릿이 페달축에 (오차 명시·허용범위 내) | 발이 페달 위/앞으로 뜸, 오차 미표시 |
| 손–후드 접점 | 손 grip이 후드에 | 손이 후드에서 떨어짐 |
| 안장–좌골 | 좌골이 안장 표면에 얹힘 | 골반이 안장 위로 뜨거나 파묻힘 |
| 무릎 방향(정면) | 무릎이 프레임과 평행(주행면) | 무릎이 옆으로 벌어짐/붕괴 |
| BDC 무릎 | 잠기지 않는 굽힘(예 25~35°) | 완전 신전(잠김) 또는 과굴곡 |
| TDC 무릎 | 허벅지가 복부·프레임 안 침범 | 무릎이 몸통을 파고듦 |
| 프레임 관통 | 신체 메시가 프레임·크랭크 관통 안 함 | 관통 |
| 좌표 일관성 | 안장·후드·다리가 **한 파생식/한 입력**에서 | x는 옛값·y는 새값 같은 혼합 |

## Anti-pattern (전부 이번 결합 작업에서 실제로 겪은 실패 — 재발 금지)

1. **크랭크와 발의 위상이 다른 렌더를 승인 자료로 쓰지 말 것.** cycle GLB 크랭크가 수평 정지각인데 라이더 발만 위상 배치 → 발-페달 안 맞아 보임. 자전거 크랭크도 같은 phase로 강체 회전시킨 뒤 렌더한다.
2. **cycle 메시 일부만 좌표 검색으로 회전시키지 말 것.** 크랭크암·페달을 이름 없이 좌표로 골라 개별 이동 → 형태 깨짐. BB 중심 강체 계층(empty parent)으로 회전, 좌우 180° 오프셋 보장.
3. **서로 다른 scale·다리 길이를 혼용하지 말 것.** 외부 Blender 실험값(430/420×0.88)과 앱 rig(493/493)와 anthropometry(415/405)를 섞지 않는다. 인체 정본은 riderAnthropometry.json 하나.
4. **안장 좌표를 x는 이전값·y는 새 값으로 섞지 말 것.** 안장 높이가 바뀌면 `saddleX=-(h·cosSTA)-setback`·`saddleY=h·sinSTA`로 **x·y를 동시** 재계산한다.
5. **후드를 계산식으로 근사하고 실제 GLB 좌표와 다르게 쓰지 말 것.** riderRig의 `SPACER 35 + STEM_CLAMP_H·0.5 + STEM_LENGTH 105 + BAR_REACH·0.6` 실제 계산을 쓴다(임의 계수 금지). 실제 후드 y=641.6.
6. **ETT를 reach로 쓰지 말 것.** `ETT = reach − (−stack/tan STA)` (시트튜브각·stack 반영). reach ≠ ETT.
7. **그림은 현재 seatTop을 그리고 표는 새 seatTop을 쓰는 불일치 금지.** 도식과 계산 데이터는 같은 좌표원을 쓴다.
8. **발목–클릿 선언값과 적용값을 다르게 쓰지 말 것.** 클릿=페달축, 발목=클릿 위 70·뒤 48.3. 하나의 정의로 통일(48.3 = 발길이 기반 161의 측면투영 30%).
9. **"동일 라이더"라 보고하면서 어깨·몸통각을 프레임마다 바꾸지 말 것.** 손 목표점(골반·몸통각·어깨·팔꿈치목표·손)을 고정하고, 후드가 손 목표점에 오도록 프레임을 역산한다. 손을 옮기지 않는다.
10. **HTML 도식만 내고 실제 Blender 렌더 없이 승인 요청하지 말 것.** 스켈레톤 계산 도식은 예상용이고, 형상 판정은 실제 Blender 렌더 PNG로. 그리고 **승인 후 다른 GLB를 다시 export 하지 말 것**(byte 동일).

## Before/After · 승인 규율 (rider-preview와 공유)

- **실제 그림 표시**: 경로·HTML 링크·숫자표만 보고 금지. PNG를 화면에 띄우고 candidateId·단계 설명 후 명시 승인 전 중단.
- **Before/After 동일 조건**: 동일 카메라·배율·crank phase·조명·rider/cycle 입력.
- **단계별 승인**: 각 단계(0/A/B/C/D/E) 그림 승인 후 다음. 수정 발생 시 새 candidateId로 재승인.
- **승인 문구**: "승인"·"진행"·"다음 단계 진행"만 인정. "확인했다"·"나아졌다"·질문·침묵은 불인정. 승인은 candidateId+단계에 종속.
- **스킬 사본 동기화**: `.claude/skills/rider-cycle-fit/SKILL.md`(원본) ↔ `.agents/skills/rider-cycle-fit/SKILL.md` 동일 유지.
