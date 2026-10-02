# TASK-04 — foreground 전환 listener churn·presence write 저감

Owner: Cursor CLI Developer. Supervisor: Codex. [12 검수](12-review-resume-cache.md)를 읽고 구현하라.

## 목표

짧은 앱 전환에서 Firestore listener를 즉시 닫았다 다시 열지 않도록 **10초 read grace**를 두고, heartbeat 기간 안의 foreground 복귀 presence write를 반복하지 않는다.

## 요구사항

### A. Read visibility grace

- 실제 `pageVisible=false`가 되면 다음 두 read 구독만 최대 **10초** warm 상태로 유지한다.
  1. Trail members `onSnapshot`.
  2. Trailhead world `trailLivePublicationRides × N` overlay.
- 10초 안에 visible로 돌아오면 timeout을 취소하고 underlying listener를 유지한다.
- 10초 이상 hidden이면 listener를 닫는다. 이후 visible이면 즉시 다시 연다.
- logout, Trail 변경, ride 상태 전환, eligibility 상실은 grace 없이 즉시 cleanup한다.
- Activity World poll, catalog, writes에는 read grace를 적용하지 않는다.

### B. Presence write resume throttle

- Trail presence write/heartbeat 수명주기를 members listener와 분리한다.
- 같은 uid+Trail에서 마지막 성공 presence write 후 heartbeat 간격 안에 hidden→visible이면 즉시 upsert/touch를 반복하지 않고 남은 시간 뒤에 heartbeat를 재개한다.
- 새 uid/Trail, heartbeat interval 경과, 첫 진입은 즉시 upsert한다.
- hidden 중 heartbeat는 계속 돌지 않는다. long hidden 후 복귀는 즉시 갱신한다.
- delete-on-session-exit 의미는 유지한다.

## 비목표

- listener query/schema/hub 의미 변경, SDK network 토글, Rules/Functions/RTDB 변경.
- 10초 grace 상수의 동적 튜닝, production deploy.

## 검증

- 순수 정책/타이머 테스트: short hide 유지, visible cancel, long hide cleanup, eligibility immediate cleanup, 새 Trail immediate presence, fresh resume delay, stale resume immediate.
- 기존 Emulator E2E hidden→visible ×10(각 hidden 200ms) 목표:
  - N=3 `trailLiveRides` open/close **30/30 → 0/0**.
  - `trailMembers` **10/10 → 0/0**.
  - `trailPresenceWrites` **10 → 0**.
  - TASK-03 one-shot network proxy 0 유지.
- long-hidden 또는 순수 타이머 검증에서 grace 만료 후 close 1, 복귀 open 1을 증명한다.
- 기존 listener hub/refcount·s42 meters 회귀 없음.
- focused tests, dep check, tsc, changed-file lint, focused Emulator E2E. 5분 무진전 시 브라우저 반복을 중단하고 대체 검증으로 전환한다.

결과는 `14-result-listener-grace.md`에 작성한다. commit/push/deploy/production 접속 금지.

