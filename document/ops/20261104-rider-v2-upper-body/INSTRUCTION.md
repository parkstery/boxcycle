# rider15 상체 스킨·제스처 — P0 기준선 고정

- 작업 ID: `RIDER15-P0-BASELINE`
- 상태: `IN_PROGRESS`
- 시작: 2026-11-04 KST
- 승인 근거: Chief의 "작업 시작해" 지시
- 범위: 기준선 확인과 작업 환경 고정만 수행
- 금지: 제품 GLB 교체, 원본 Blender 수정, 런타임 구현, 기존 사용자 변경 되돌리기

## 목표

안 C 상체 스킨·손목/엄지 본·3개 프리셋 작업을 시작하기 전에 실제 저장소와 입력 자산의 기준선을 고정한다.

## 실행 순서

1. `node scripts/handoff-check.mjs`
2. `git status --short --branch`
3. `document/ops/HANDOFF.md`와 이 작업 묶음 README 확인
4. rider-preserve 하네스와 기존 상체 IK 재사용 경로 확인
5. 입력 Blender/GLB 해시와 후보 출력 경로 기록
6. 결과를 `REPORT.md`와 `document/ops/HANDOFF.md`에 기록

## 합격 기준

- 저장소 브랜치·HEAD·기존 변경 목록 기록
- 기준 입력 자산 경로와 SHA256 기록
- 제품 경로 직접 수정 없음
- 다음 작업이 P1 메시/리깅 또는 앱 기술검증 중 무엇인지 근거와 함께 결정

## 다음 단계 전환 조건

P0 보고서가 작성되고, 실제 앱의 현재 렌더 경로와 glTF 스킨 지원 여부가 확인된 뒤에만 P1 또는 기술검증 작업을 만든다.

