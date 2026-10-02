# TASK-01 — foreground 복귀 Firestore read spike 원인 감사

Owner: Cursor CLI Developer. Supervisor: Codex. 현재 작업은 **read-only 감사**다. 제품 코드, 테스트, 설정, Git 상태를 변경하지 말고 결과만 `document/ops/20261003-focus-read-spike/02-result-root-cause-audit.md`에 작성하라. 다른 작업 변경을 보존하고 commit/push/deploy하지 말라.

## 현상

3개 브라우저의 앱 화면 4개를 foreground/background로 전환하거나 비활성 앱을 클릭해 활성화했을 뿐인데 Firebase Console 지난 60분 화면에서 읽기 약 1.2만, 쓰기 302, 스냅샷 리스너 최대 41, 활성 연결 최대 8이 관측됐다. 앱 내부 조작이나 주행은 없었다. 캡처 숫자는 L/Console 관측이며 코드별 billed 귀속 증거가 아니다.

## 조사 질문

1. Trailhead idle 화면 한 개가 정상 상태에서 여는 모든 Firestore `onSnapshot`, `getDoc`, `getDocs` 경로를 호출 지점→hook/component→repo→컬렉션/query까지 표로 작성하라. RTDB는 구분 표기한다.
2. `visibilitychange`, `focus`, `blur`, `pageshow`, `online`, 인증 상태 갱신, React remount/StrictMode, Firebase SDK network reconnect가 각각 구독을 닫거나 다시 여는 경로가 있는지 확인하라.
3. foreground 복귀 시 기존 onSnapshot이 SDK 수준에서 재연결되어 초기 query 결과를 재전달할 가능성과, 앱 코드가 unsubscribe/resubscribe하는 경우를 명확히 분리하라. 코드로 확정 가능한 것과 Firebase 동작상 가설을 분리한다.
4. 다중 소비자가 같은 query를 중복 구독하는지, 기존 hub/refcount가 어디까지 적용되고 어디서 빠지는지 확인하라.
5. 사용자 시나리오 4화면에서 예상되는 정상 underlying listener 수와 중복 후보를 경로별로 산정하라. 숫자의 근거를 파일/라인과 함께 적는다.
6. 최소 재현/계측 계획을 제안하라. production 접속 없이 가능한 순수 계약 테스트 또는 Emulator 시나리오를 우선한다. hidden→visible N회에 대해 subscribe/open/close/delivery를 계수할 수 있어야 한다.
7. 저감 후보를 위험도·예상 효과 순으로 제시하라. 백그라운드에서 해제해도 되는 discovery/UI 리스너와 유지해야 하는 세션/결과 리스너를 구분하고, 복귀 지연·누락 위험을 적는다.

## 필수 조사 범위

- `apps/web/src`의 모든 Firestore import와 `onSnapshot/getDoc/getDocs` 호출.
- `useDocumentVisibility`, 인증/provider 수명주기, Trailhead/지도 overlay/open Trails/account/conquest/token/tier 관련 hooks.
- `livePublicationRidesSubscriptionHub`, `activeLiveRideTrailIdsSubscriptionHub` 등 기존 공유 hub.
- `document/ops/20260929-public-trail-traffic`의 listener-scope·meter 결과와 새 현상의 차이.
- 현재 브랜치/working tree 상태. 변경은 하지 않는다.

## 결과 형식

- 결론 요약: 가장 가능성 높은 원인 1~3개와 확신도.
- 리스너/조회 인벤토리 표.
- foreground 전환 이벤트 흐름.
- 4화면 예상 listener/read fanout 모델.
- 재현·계측 계획.
- 최소 수정 후보와 금지해야 할 성급한 수정.
- 확인한 명령과 사실, 미확인 항목.

원인이 충분히 좁혀지지 않으면 추측으로 구현하지 말고 어떤 계측이 필요한지 정확히 보고하라.
