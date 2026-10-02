# Supervisor review — TASK-01 원인 감사

| 항목 | 내용 |
|---|---|
| 대상 | [01 지시](01-task-root-cause-audit.md) · [02 결과](02-result-root-cause-audit.md) · 실제 코드 |
| 판정 | **APPROVED — 계측 단계로 진행** |
| 날짜 | 2026-10-03 |

## 검수 결론

- `useDocumentVisibility`의 `pageVisible`이 false→true로 바뀔 때 `useTrailSession`, world live overlay, active live Trail consumer, Activity World poll이 다시 열린다는 주장은 코드와 일치한다.
- `App.tsx`의 published catalog effect도 visible 복귀마다 다시 호출된다.
- `useActivityWorldAdaptivePoll`은 enabled effect 시작 시 즉시 `runTick()`하므로 visible 복귀마다 full sync 후보가 생긴다.
- `useOpenTrails`의 listing/CG와 `users/{uid}`·economy·conquest 리스너는 앱 코드상 visibility로 닫지 않는다. 이들의 SDK reconnect 비용은 아직 가설이다.
- 한 화면의 정적 리스너 모델 `7+N`, 4화면에서 Console 최대 41과 같은 자리수라는 비교는 원인 확정이 아닌 우선순위 근거로만 인정한다.

## 보완 요구

다음 구현 전에 hidden→visible 반복에서 아래를 서로 분리해 계수해야 한다.

1. 앱이 명시적으로 재개하는 underlying `onSnapshot` open/close.
2. Activity World immediate tick의 Firestore one-shot 호출.
3. published catalog refresh 호출과 실제 Firestore one-shot 호출.
4. visibility와 무관하게 유지되는 listener.

SDK 내부 billed read는 Emulator/클라이언트 계수로 완전히 재현되지 않을 수 있으므로, 결과는 `operation proxy`로 표기한다. 계측 없는 제품 동작 변경은 아직 금지한다.
