# Supervisor review — TASK-04 listener grace

| 항목 | 내용 |
|---|---|
| 대상 | [13 지시](13-task-listener-grace.md) · [14 결과](14-result-listener-grace.md) · 실제 diff·E2E artifact |
| 판정 | **APPROVED** |
| 날짜 | 2026-10-03 |

## 검수

- 10초 read grace는 Trail members와 Trailhead world `livePublicationRides`에만 적용되고 Activity World poll/catalog/write에는 적용되지 않는다.
- eligibility·uid·Trail·ride 상태가 바뀌면 grace 없이 cleanup하고, 단순 short hide만 listener를 유지한다.
- presence write는 members listener와 분리돼 hidden 중 heartbeat를 멈추고, fresh short resume에서는 남은 heartbeat 시간 뒤 재개한다. session exit delete 의미는 유지된다.
- 동일 Emulator short-hide ×10에서 N=3 rides 30/30→0/0, members 10/10→0/0, presence writes 10→0, one-shot 0 유지다.
- long-hide에서는 members 1/1, N=3 rides 3/3, presence 1로 cleanup·복귀가 확인됐다.
- Supervisor 재실행: focus 37/37, listener-scope 17/17, s42 15/15, dependency check, diff check 모두 PASS.

## 남은 한계

Firebase SDK 자체 WebChannel reconnect billed read는 local proxy로 계측할 수 없다. production 배포 후 같은 사용자 시나리오를 Console/분당 원본으로 재관측해야 최종 billed 효과를 확정할 수 있다.
