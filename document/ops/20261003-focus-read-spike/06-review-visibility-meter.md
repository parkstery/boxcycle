# Supervisor review — TASK-02 visibility meter

| 항목 | 내용 |
|---|---|
| 대상 | [04 지시](04-task-visibility-meter.md) · [05 결과](05-result-visibility-meter.md) · 실제 diff |
| 판정 | **REWORK_REQUIRED** |
| 날짜 | 2026-10-03 |

## 인정하는 결과

- Emulator E2E에서 hidden→visible 10회가 `trailMembers` 10/10 재구독, Activity World summary/global 경로 각 +10, catalog publications +10, presence write +10을 만든다는 operation proxy는 유효하다.
- listing/CG/users/economy/conquest의 앱 open/close delta 0도 현재 visibility 배선과 일치한다.
- focused tests, 기존 s42 meter, dep check, TypeScript, lint 및 포트 5015 E2E PASS 기록을 확인했다.

## 재작업 결함

1. `fetchRouteActivitiesBatch()` 진입에서 `activityWorldBatch`를 올려 실제 Firestore `getDoc`가 0인 cache-hit도 read proxy로 센다. 결과의 “one-shot 합 30+”와 “batch +10”은 실제 network operation으로 해석될 위험이 있다. cache miss에서 실행되는 `getDoc` 바로 앞을 계수하거나, 명칭을 `batchInvocation`으로 분리하고 실제 routeActivity getDoc 계수를 추가하라.
2. `subscribeDocumentVisibilityOverride()`는 production에서도 listener Set에 등록한다. set override가 DEV에서 no-op이더라도 production 경로가 완전 no-op이라는 결과 주장과 다르다. production에서는 즉시 `() => {}`를 반환하도록 고치고 테스트하라.
3. world `trailLiveRides × N`은 순수 harness 모델만 있고 Emulator E2E N=0이다. 가능하면 local emulator에 N=3이 되도록 seed해 10회에서 30/30을 실제 subscription meter로 확인하라. 기존 앱 discovery 경로로 seed가 과도하거나 불안정하면 이유를 증거와 함께 적고, 결과 문구를 “모델”로 제한하라.
4. `noteVisibilityOneShot`의 각 위치가 실제 `getDoc/getDocs` 직전인지, cache guard 뒤인지 전수 점검하고 표에 `actual network call proxy`와 `invocation proxy`를 분리하라.

계측이 실제 Firebase 호출을 추가하면 안 된다. 제품 최적화는 아직 하지 말라.
