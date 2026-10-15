# 스마트폰 디자인·Muse 협업 체계

| 항목 | 내용 |
|---|---|
| 문서 유형 | execution — 작업 묶음 |
| 최초 작성 | 2026-10-09 |
| 상태 | DESIGN_ACCEPTED — 준비·센서 채택, 센서 유지·주행 토글 정정, 별도 워크트리·코드 금지 |
| 독자 | chief · AI |
| 연결 문서 | [협업 계약](../../reference/operations/261009-RTW-개발에이전트-협업-감리.md) · [ops 상태판](../PROGRESS.md) |

## 지금 할 일

Muse 읽기 전용 인계 시험과 Codex 검수를 완료했다. 초기 요약의 폭 규칙 오류 1건은 검수에서 정정했다. 주행 화면 시각 초안 두 안과 공통 규칙 후보를 작성했다. 다음은 방향 검토 후 준비·편집·센서 상태 확장과 읽기 전용 구조 조사다. 앱 코드 작성은 아직 허용되지 않았다.

- Supervisor: Codex.
- Developer: OpenCode / Muse Spark 1.3. Cursor AI/CLI 교대 가능, 동시 쓰기 금지.
- 요구: [00-brief](00-brief.md).
- 최신 지시: [TASK-04 준비·센서 조사](15-task-preparation-sensor.md).
- 최신 결과: [Muse Free 조사](16-result-preparation-sensor.md). 최신 검수·디자인: [확장 05](17-design-preparation-sensor.md). 이전 [인계 검수](04-review-01.md)는 디자인 완료나 구현 승인과 구분한다.
- Chief 결정: 스마트폰 가로·Muse Free 기본·배경 없는 작은 계기·제목 단위·소형 기호 제어 방향 수락. 준비·센서·전체 상태와 치수는 검토 중. 코드 작성 미승인.
- 기존 dirty: document/ops/20261006-account-deletion/shots-15/01-guest-logout-confirm.png (untracked). 소유권 외 파일이므로 수정·커밋 금지.

## 디자인 초안 01

- [대표 화면·배치·공통 규칙 초안](05-design-draft.md)
- [생성 프롬프트·배경 오류 수정 기록](06-image-prompts.md)
- [A 포슬린·청록](previews/ride-a-porcelain-teal.png) · [B 실버·코발트](previews/ride-b-silver-cobalt.png)
- 상태: 시각 방향 검토 대기. 이미지 컨셉이며 실제 렌더·터치·실기기 검증 미실행. 코드·배포 변경 없음.

## 최신 디자인: 수정안 02

[수정안·검수 한계](07-design-revision-02.md) · [프롬프트](08-revision-prompts.md)

Chief 요구에 따라 초안 01의 상단 단색 계기판을 철회한다. 배경 없는 작은 좌측 계기·전방 시야 확보가 기준. [위성](previews/ride-v2-satellite-text-hud.png) · [전방](previews/ride-v2-forward-text-hud.png). 시각 컨셉이며 코드·실기기 검증 없음.

## 최신 디자인: 수정안 03

[제목 단위·최상단 배치·감리](11-design-revision-03.md) · [시안](previews/ride-v3-title-units-forward.png). Muse Free 읽기 전용 검토 exit0. 긴 값·실기기 가독성 미검증, 앱 코드 변경 없음.

## 최신 디자인: 수정안 04

[작은 기호 버튼·통짜 배경 제거·감리](14-design-revision-04.md) · [시안](previews/ride-v4-icon-controls-forward.png). Muse Spark 1.3 Free 읽기 전용 검토 exit0, 실제 앱도 기호 버튼임을 확인. 코드 변경 없음.

## 최신 디자인: 확장 05

[준비·센서 패널·소스 감리](17-design-preparation-sensor.md) · [프롬프트](18-preparation-sensor-prompts.md). Muse Free 조사 exit0, Supervisor 센서·주행 제어 독립 대조. [준비](previews/prepare-v5-route-summary.png) · [센서](previews/prepare-v5-sensor-settings.png). 이미지 컨셉, 실기기·코드 미검증.

## 최신 Chief 결정·분리 작업 공간

[패널 채택·센서 유지·토글 정정·워크트리](19-chief-control-worktree.md)가 이전 3버튼 유지 지침을 대체한다. 준비·센서 패널 방향 채택, 실기기 검증 미실행. 이후 작업은 feat/mobile-ui-redesign 워크트리에서 진행하며 앱 코드 작성 금지는 유지한다.
