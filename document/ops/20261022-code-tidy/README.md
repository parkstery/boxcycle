# 20261022-code-tidy — 코드 정련

**상태:** IN_PROGRESS · P1 진행 (Chief 2026-10-22 「권장대로」 승인)

반복 코드·안 쓰이는 코드·비대 파일을 동작 변경 없이 정리한다. 실행은 opencode GLM-5.3-Flash·MiniMax M3.1 Flash(기계적)·Cursor(구조), 계획·검증·감리는 Claude. opencode 가 토큰 한도에 걸리면 Cursor·Claude 가 이어받는다.

- 계획: [01-plan.md](01-plan.md)
- Chief 결정(10-22): 정련 끝날 때까지 UI 수정 작업은 멈춘다 · P4 는 적정 시점에 · 끝난 실험 스크립트 삭제 · functions CLI 는 목록만 · 단계마다 묶어 배포
- P0 완료: `apps/web/knip.config.mjs`(시험·dev-tools 등록 스크립트를 진입점으로) · 기준선 v2 [knip](evidence/01-knip-baseline-v2.json) · 재분류 [classified](evidence/01-classified.json)
  - knip 은 시험의 `await import()`+`mod.X` 사용을 못 본다. 그래서 후보 이름마다 저장소 전체(web·functions·scripts·blender)를 단어 검색해 다시 나눴다: **DELETE 77 · UNEXPORT 261 · KEEP 181**(외부 사용 있음 — 손대지 않음)
- P1 지시: [규칙](02-task-rules.md) · [01](02-task-01.md) GLM · [02](02-task-02.md) MiniMax · [03](02-task-03.md) GLM · [04](02-task-04.md) MiniMax. 01·02 동시 → 03·04 동시
- 감리 몫: 파일 삭제 후 `dep-layers.json` 배정 정리, 같은 것 두 이름 10건(의미가 다른 별칭인지 판단 필요)

**지금 할 일:** 지시01·02 실행 중 → 감리.
