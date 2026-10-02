# TASK-02R — phase-aligned 계측 도구 재작업

| 항목 | 내용 |
|---|---|
| 담당 | Cursor CLI Developer |
| 근거 | [Supervisor 검수 06](06-review-phase-aligned-measurement.md) |
| 상태 | REWORK_REQUIRED |
| 결과 | `08-result-phase-aligned-measurement-rework.md` 새 파일 |

`06-review-phase-aligned-measurement.md`의 네 결함을 범위 안에서 수정하라. 기존 측정 도구와 테스트, 두 fixture, 필요 시 package script, `05-result-phase-aligned-measurement.md`의 틀린 주장만 정정한다. 재작업 사실과 실제 명령/결과는 **새 08 결과**에 적는다. 기존 02/03 감사·검수와 04 지시는 보존한다.

필수 게이트:

1. 각 steady interval이 포함하는 **모든 시계분**에 정확히 하나의 bin이 있는지 검증. 누락·중복 시 `insufficient`; 무관한 분 bin은 허용하되 절대 합산하지 않음. solo/dual의 완전 포함 분 개수 같음을 계속 검사.
2. 비교 대상 reads/writes가 0 이상의 정수인지 검사. 결측/무효 값을 조용히 0이나 null 성공으로 바꾸지 말 것. 메트릭 한쪽만 제공하는 계약을 지원한다면, 그 메트릭만 비교하고 다른 것은 결측으로 명시하며 테스트로 고정.
3. 과거 misaligned fixture의 근거 없는 숫자 삭제 또는 명시적 합성 분리. 역사적 값은 문서와 일치해야 한다.
4. 누락 분·중복 분·음수/비정수·과거 60초 misaligned·정상 창의 단위 테스트. `npm run test:traffic-meters`, CLI 두 fixture, 변경 파일 lint/typecheck 가능 범위를 실행하고 결과를 구분 보고.

금지: production write/실주행 자동화, deploy, commit/push, 제품 런타임 FS/RTDB/CF/Rules/주기 변경, A/B/D 최적화, 3명 이상 확대. 기존 다른 변경은 보존한다.
