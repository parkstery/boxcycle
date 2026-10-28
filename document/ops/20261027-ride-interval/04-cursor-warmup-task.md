# Cursor — 준비/마무리 시간 core 확장

Chief 최신 지시: 준비 운동·마무리 시간도 직접 조절. Codex는 UI·주행 설정 폭·e2e·배포 담당. 당신은 다른 작업자와 병행하므로 아래 세 파일만 수정하고 타인 변경/기존dirty를 보존한다. 커밋/푸시/배포 금지. 관련 없는 파일 탐색·브라우저·전체 시험 금지.

담당: `apps/web/src/lib/ride/rideInterval.ts`, `apps/web/src/hooks/useRideInterval.ts`, `apps/web/scripts/ride-interval/ride-interval.test.ts`.

계약:
1. `RideIntervalConfig`에 **optional** `warmupSec?:number`, `cooldownSec?:number` 추가. 기존3필드 호출·기존 v1 localStorage 저장값은 각300초를 기본으로 완전히 보존. DEFAULT와8종PRESETS의config는 새필드도 각300초 명시.
2. 준비/마무리는 정수0~1800초. 0은 건너뛰기. 고/저5~600초·반복1~30회 기존 범위 유지. `isRideIntervalConfig`는 유효한 legacy3필드도 계속true, 새필드가undefined이면기본, null/문자열/소수/범위외/NaN/Infinity면false. `normalizeRideIntervalConfig(value:unknown): Required<RideIntervalConfig>|null` export: 유효legacy/new를5필드복사로 반환, invalid는null.
3. total/view는 normalize 사용. total=(warmup+cooldown+(high+low)*repeats)*1000. 0초 단계는 steps에서 제외해 첫 단계/다음 안내에도 나타나지 않게 한다. 두단계0이면 처음부터운동, 마지막회복 후바로완료. 기본900000ms와기존단위기대보존. arbitraryseconds라 nextLabel에정확한설정반영.
4. hook은 lazy initializer 유지. storage key v1 유지, parse→normalize로 legacyhigh/low/repeats 보존+warm/cool300. config 반환/복사/저장에5개필드모두포함. 같은config 비교에서warm/cool도비교(default300와명시300은동일), 새필드변경적용이면기존원칙대로현재elapsed기준처음부터. onEnabled/idle/newride/paused 의미유지. 저장실패fallback유지. onConfiglegacy입력도normalize해기본300보존.
5. 단위시험: 기존9개유지+새시간총합/분표시/첫·마지막경계/각각0/양쪽0/legacy정규화/잘못된준비마무리값을검증. `node --experimental-strip-types --test scripts/ride-interval/ride-interval.test.ts`만실행. UI/App/preview/e2e/문서 건드리지 말고 완료후파일과통과수만짧게한국어보고.
