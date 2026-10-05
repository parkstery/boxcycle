# 결과창과 독립적인 이어달리기 저장

Cursor CLI 담당. 04 정책과 15 결과 유지. 커밋·push·배포 금지. 다른 Cursor가 칼로리 검수 중이므로 App/useRideEndAndPersistence는 최신 내용에 부분 패치하고 칼로리 영역을 보존한다. 결과는 17-result-result-independent-resume.md.

Supervisor 발견: App 슬롯 획득이 lastRideResult의 progress success에 의존한다. 사용자가 결과창을 닫거나 다음 주행을 시작하여 lastRideResult를 null로 만든 뒤 비동기 progress 저장이 끝나면 결과 state updater가 null을 유지하고 슬롯 확보가 영원히 누락된다. 또한 UID 변경 첫 effect가 ref를 새 UID로 바꾼 동일 commit에서 다음 effect는 구 lastRideResult를 새 UID 소유로 처리할 수 있다.

저장 완료 이벤트를 UI state와 분리하라. persistRideEndCore deps 및 useRideEndAndPersistence options에 UID·recordId·routeId·실제 적용 completed를 담은 progress 성공 callback을 최소 추가하고 App은 이 독립 이벤트를 처리한다. 서버 실제 progress 저장 성공·local 실제 저장 성공 뒤에만 호출한다. UI 닫기/다음 주행과 무관하게 유지, UID가 다르면 무시, pending slot 로드 완료 후 처리, bounded retry 유지. Guest의 별도 local branch도 배선. save 실패/진도 실패에는 호출 금지. UI state updater 내 부수효과 금지. 이벤트 여러 개가 기다릴 수 있는 경우 마지막 덮어쓰기로 누락하지 않게 최소 queue 또는 동등한 처리. 기존 max progress·단일 슬롯·TTL 정책 유지.

실제 controlled Promise 핵심 시험: 결과 null로 닫힌 뒤 progress resolve해도 이벤트 발생→슬롯 보존, progress reject이면 획득 안 함, UID 전환 늦은 성공은 다른 UID에 적용 안 됨. 기존 persistence 회귀+resume+selectors+tsc+변경 TS lint. 문자열 검사만으로 위 lifecycle 검증을 대체하지 말 것.

NextRideCard의 '이어달리기 종료'도 740×300에서 세 번째 전체 폭 주요 버튼처럼 되지 않도록 작은 보조 동작으로 배치하고 기존 fixture 재캡처. 변경 내용과 실행 명령·미실행 범위를 결과에 기록. 완료 후 반드시 즉시 CLI 종료.
