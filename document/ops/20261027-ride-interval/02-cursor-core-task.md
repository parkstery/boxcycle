# Cursor — 운동 프리셋/사용자 설정 core 구현·단위시험

Chief가 한 화면 조절형을 승인하고 구현·시험·배포를 지시했다. 창을 내용보다 키우지 않고 지도를 덜 가리는 것이 추가 지시다. Supervisor(Codex)가 UI/App 결선·e2e·배포를 직접 맡는다. **당신은 다른 작업자와 동시에 일한다. 타인 변경·기존 dirty는 보존하고 자신의 담당 파일만 수정한다. 커밋·푸시·배포 금지.**

담당 파일은 `apps/web/src/lib/ride/rideInterval.ts`, `apps/web/src/hooks/useRideInterval.ts`, `apps/web/scripts/ride-interval/ride-interval.test.ts` 세 개다. 필요한 지침과 이 세 파일만 우선 읽고 바로 구현하라. 다른 UI/App/preview/e2e/문서는 수정하지 않는다. 광범위한 조사·전체 시험·브라우저는 하지 않는다.

확정 계약:
- 기존 `getRideIntervalView(elapsedMs)`와 `RIDE_INTERVAL_TOTAL_MS=900000`는 호환 보존. `getRideIntervalView(elapsedMs, config?)`로 일반화.
- 같은 core 파일에서 `RideIntervalConfig = { highSec:number; lowSec:number; repeats:number }`, `DEFAULT_RIDE_INTERVAL_CONFIG`, `RIDE_INTERVAL_PRESETS` (readonly 8개 `{id:string, config:RideIntervalConfig}`), `isRideIntervalConfig(value:unknown): value is RideIntervalConfig`, `getRideIntervalTotalMs(config?)`를 export한다.
- 8종 조합 high/low초×횟수: 30/30×5,30/60×5,20/40×8,40/20×8,45/45×8,60/60×5,60/30×8,90/60×6. id는 `30-30-5` 같은 고정 문자열.
- highSec/lowSec는 정수5~600(직접 입력은5배수 제한 없음), repeats는 정수1~30. NaN/Infinity/문자열/소수/누락은 거부. 준비·마무리 각300초 유지, `(high+low)*repeats+600`으로 총시간. 단계label은 기존 준비/운동/회복/마무리/인터벌 완료 유지, nextLabel은 실제 설정 시간을 반영(30초 고정 금지). 잘못된 config 인자는 기본 루틴으로 안전하게 복귀.
- `useRideInterval(status, elapsedMs, initiallyEnabled=false, initialConfig?)`의 기존3인자 호출 보존. 반환에 `config`, `onConfig(config):boolean` 추가. existing enabled/onEnabled/view 유지. 설정은 브라우저 localStorage `spinatlas.rideInterval.config.v1`에만 보존(Cloud/Firestore 변경 없음). initialConfig가 명시되면 fixture 초기값 우선. storage 파손·미지원·접근예외는 기본값 및 메모리 fallback으로 처리. localStorage는 hook의 초기화/적용 콜백만 담당하고 pure core에 브라우저 의존을 넣지 않는다.
- onConfig는 invalid일 때 false+변경 없음, valid일 때 true. 변경된 설정은 즉시 선택 config에 반영. 주행 중 enabled=true이면 **현재 accumulatedMs를 새 기준으로 준비부터 재시작**. 같은 값 적용은 불필요하게 타이머를 재시작하지 않는다. paused도 현재elapsed 기준으로 준비부터 맞추고 재개 때 이어 간다. disabled면 다음켜기부터 해당config 사용. 종료/새주행은 기존처럼 준비부터.
- UI는 draft 편집→설정 적용 전 실제 운동에 영향 없음. 적용 시 재시작 안내는 Supervisor UI가 담당. 기본 enabled=false, 로컬 저장은 config만(켜짐 상태 자동영속화 없음).

검증은 변경한 pure core 단위시험으로 한정한다. 8종의 총시간/모든 경계/1·30회/최대시간/분 표시/invalid/기존15분호환/지연 복귀를 의미 있게 확인. 기존 시험 기대를 약화하지 않는다.

실행 폴더 `C:\20.HDev\boxcycle\apps\web`. `node --experimental-strip-types --test scripts/ride-interval/ride-interval.test.ts`. 완료 후 세 파일과 단위시험 통과 수만 짧게 한국어로 보고. core/hook 인터페이스가 위 계약과 다르게 필요하면 임의 변경하지 말고 보고한다. Supervisor의 UI 작업을 기다리지 않는다.
