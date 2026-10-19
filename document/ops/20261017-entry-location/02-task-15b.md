# 재지시15b — 즉시 두 줄 버튼 반영

Chief가 지연을 지적하고 작업 진행을 재차 명령했다. 요청한 사용자 정의 두 줄 버튼을 구현한다. 일반 위치 API에서는 기존 차단을 브라우저 설정에서 해제해야 하는 차이를 결과에 명시한다.

Developer Cursor: 다른 작업 변경 보존, 커밋/배포 금지. 아래 작은 변경만 즉시 실행. 광범위 조사 금지. 환경파일/키 접근 금지.

1. `apps/web/src/components/auth/EntryLocationDialog.tsx`: NativeControl 타입과 NativeLocationControl 함수 삭제, createElement/useEffect/useState/isUsableLngLat 불필요 import 삭제. 함수 인자에서 onPosition만 제거(공용 props 타입은 호환 위해 유지). native 변수 제거. phase choice에서 기존 일반 primary 버튼을 항상 표시. 첫 줄 CURRENT_LABEL, 둘째 줄 span CURRENT_HINT. 외부 중복 없음. denied 상태 설명은 `위치가 차단되어 있습니다. 브라우저 사이트 설정에서 위치를 허용한 뒤 다시 시도해 주세요.`. 기존 onChooseCurrent/onChooseRome 연결 유지.
2. `apps/web/scripts/ride-verify/entry-contract.mjs`에서 `최초 native` 정규식 조건만 두 줄 위치 버튼의 `onClick={onChooseCurrent}` 조건으로 변경.
3. CSS 현재 파란 테두리 유지, 다른 소스 수정 금지.
4. `03-result-15b.md`에 변경과 실제 실행 검증 기록. Supervisor가 타입/lint/브라우저 독립 검증 수행. 빠르게 수정 후 종료.
