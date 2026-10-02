# Supervisor review — TASK-02 phase-aligned measurement

| 항목 | 내용 |
|---|---|
| 대상 | [04 지시](04-task-phase-aligned-measurement.md) · [05 결과](05-result-phase-aligned-measurement.md) · 실제 코드/테스트 diff |
| 판정 | **REWORK_REQUIRED** |
| 범위 | 측정 도구 정확성 보완. 제품 런타임·production 변경 없음 |

## 확인한 것

- 측정 전용 스크립트/테스트/fixture와 package script 외 제품 런타임·Functions·주기 변경은 없다. Cursor 보고의 `test:traffic-meters` 23/23은 기록상 PASS이며, production P/billed 1v2는 Ø로 유지했다.
- 완전 포함 bin만 채택하고 부분 겹침은 배분하지 않는 기본 방향은 맞다.

## 재작업 사유

1. `phaseAlignedMeasurement.ts`는 **binCount 동일**만 비교한다. steady interval 안의 중간 분이 누락되어도 양쪽 누락 수가 같으면 `ok`가 될 수 있다. `00:00–00:03`에 `00:00,00:02` 두 bin만 넣는 사례가 예다. 빈 bin을 0으로 추정하면 안 되며 `insufficient`여야 한다.
2. 같은 `minuteStartIso`가 중복되면 두 번 합산한다. 중복은 `insufficient`여야 한다.
3. 음수·비정수·누락 `reads`/`writes`를 현재는 음수로 합산하거나 null rate로 두고 `ok`를 반환할 수 있다. 계측 비교 대상 메트릭은 유효한 0 이상의 정수여야 한다. 선택적으로 한 메트릭만 쓰는 입력은 그 사실을 명확히 표시하고 결측 메트릭 ratio를 만들지 말아야 한다.
4. `phase-align-predeploy-misaligned.json`의 10/800 read 및 여러 write 값은 원문 [이전 보고](../../archive/261001-Public-Trail-동행-트래픽-개선-결과보고.md) §1.2의 권위 관측이 아니다. 역사적 Console 값처럼 보이는 fixture에는 출처 없는 수치를 넣지 말 것. 순수 합성 fixture로 분리하거나, 문서에 있는 실제 값만 사용하고 결측을 명시해야 한다.

## 완료 조건

위 네 항목을 테스트로 고정하고 코드/fixture/05 결과를 정정한다. `npm run test:traffic-meters`와 도구 CLI를 재실행해 결과를 새 결과 파일에 기록한다. 이번 판정은 도구 재작업이며 A/B/D 구현·배포·운영 write를 허용하지 않는다.
