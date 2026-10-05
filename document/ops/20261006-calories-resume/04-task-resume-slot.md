# 단일 이어달리기 슬롯 구현 — Supervisor 확정 지시

담당 Cursor CLI. README/02-audit/본 지시와 필요한 소스만 읽는다. 03 칼로리 제안은 코드 변경 범위가 아니다. 토큰 절약. 다른 변경 보존. 커밋/push/배포/production데이터변경 금지. 결과05-result-resume-slot.md, stdout 10줄 이내.

## 승인 판단 및 범위

Chief가 명시한 '포기하지 않으면 지속·한 개만 제공'을 구현한다. Supervisor는 이를 위한 기존 users 문서 optional 슬롯·해당 SavedRoute TTL 보호의 최소 데이터 변경을 요청된 범위로 판정한다. 기존 Rules의 owner write 범위를 넓히지 않고 새 collection/API/CF 없이 한다. 칼로리 미구현, 기존 max progress/인정/완주/쿼터 값은 유지. 아래 구현이 기존 보안규칙상 불가능할 때 원인 보고하고 임의 Rules완화 금지.

## 확정 정책

1. 사용자별 active routeId 최대 1개. A가활성이면 B로드/주행/끝내기/경로새로고르기/카드일시숨기기/앱재시작은 A를 교체·해제하지 않는다. B를 재개 후보로 추가하지 않는다. A는 SavedRoute.lastProgressRatio 서버max에서 재개. history50에서 A Ride가 밀려도 카드/Go가 가능하다.
2. active A 해제는 '이어달리기 종료'(명시행동), A완주, A삭제, 실제불능(깨진geometry/소유불일치)만. 로딩중/서버읽기실패를삭제로오인해해제 금지. 최초 bootstrap은 적재된 본인 미완주 progress>0<.98 SavedRoute에서 최근 relevant 주행→updatedAt 순 최신 한개, geometry유효. 1회 initialized/tombstone로 관리하여 명시포기한 과거A가 새로고침뒤 다시bootstrap되지 않게 한다. 슬롯이 비면 이후 새 유효 미완주 주행으로 자동1개를 확보할 수 있다. 과거 포기 이전 주행 반복재평가로 확보 금지(종료 rideId/시각 marker 등 최소근거 저장).
3. A확보중 B의 내경로로드/최근기록/공용재개/Go 어디에서도 B진행률을이어달리기 offset으로 쓰지 않는다. B는처음부터주행 가능. A해제전 B재개선택은 비활성/짧은안내 '이어달리기는 한 경로만 유지합니다' + A를 확인할 수 있는 진입으로처리. 슬롯 교체 UI/동시목록 금지.
4. '처음부터'는 이번 회차restart이며 슬롯포기 아님. X=이번화면숨기기 역시포기 아님. 별도 작은 '이어달리기 종료' 보조액션으로 active slot만 해제, 경로삭제/진행률0화 금지. 명시종료는 되돌릴수있는 안내슬롯선택으로 간주, 확인모달은 불필요. 다른지도경로가로드돼 카드숨겨져도 내경로A로드로재개가능하고 지도가idle로돌아오면 A안내복원. hide state가다음주행동안영원히유지되면reset하여매주행뒤 다시기회제공.
5. active A를90일TTL로자동삭제하면Chief요구에반하므로 확보transaction에서 A.expiresAt=null로보호(기존쿼터에는포함). A명시포기시미완주이면 포기시각+기존90일로TTL복귀, 완주는null유지, 삭제는문서새로만들지않음. local Guest route도동일필드정책. 저장비용에영향있는무한복제/quotabypass금지, 보호는단일A만.

## 저장/구현 형태

- registered: users/{uid} optional rideResumeSlot 필드(작은 versioned 객체; activeRouteId/initialized/lastProcessedEnd 또는 동등). 기존 users merge의닉네임/계정/토큰/tier필드보존. 단일slot 확보·명시포기·TTL route변경은transaction으로 owner/existence/completed 확인후원자적갱신. 최신다른탭A는자동B로덮지않음. 조건부clear는요청routeId==현재active일때만. 인증변경중 uid guard 필수.
- Guest(익명인증완료): 기존savedRoutesLocal정책에맞춰 uid별local slot과storage event동기, Firebase영속경로쿼리로우회하지않음. unauth는불가. local route/slot 로드순서/계정전환·다른uid tombstone분리. registered서버실패는준비중/짧은에러, 성공처럼포기/확보보고하지않음. 로컬fallback을서버슬롯보다우선하여다른기기2슬롯생성금지.
- 작은policy pure module+repo+hook으로App배선, 핵심pure transition과fake tx/repo 검증. 등록사용자users doc 구독은UID당1개만(작은상태), 별도폴링/전체목록상시구독확대금지. history최신하나자동대체되는resolveNextRideView를active slot우선으로, nonresume연장기능은유지. 히스토리가없으면SavedRoute의lastRideId/updatedAt와geometry로최소정합한resume view를생성하되실측운동거리/시간을조작하지않음; 카드resume표면은route진행만표시할수있음.
- 공용재개유틸/Go까지slotguard가 진실. 최신View/card만고치고내경로/최근기록에서다슬롯허용하는우회금지. 기존resolveRecentRideActions 호출별탐색 및Update필요. old no-slot input API를유지하는테스트폴백이제품경로2슬롯을허용하지않게.

## 검증·보고

반드시회귀: A20%→B주행종료→A유지·A재개20%; 카드hide·새로고침·history50eviction·같은UID2탭; activeA중Boffset0; A다시처음부터→max유지/slot유지; 명시포기→reload/낡은Ride로A복원안됨; 이후새B미완주→B1개; A완주/삭제clear; TTL보호/해제복귀; false loading/fetch error로해제없음; user切替격리/Gueststorage; competingacquire동시2개/낡은clear가newslot삭제하지않음. puretests실행명령및pass/fail. 기존ride-result/framing/type/lint/selectors필요한범위. 작은UI740×300캡처/실화면가능하면기존5010단일worker. production실데이터변경/인증우회금지; emulator/fake repo경로로저장transaction검증, 실Firestore미검증표시. 브라우저5분무진전시중단/다른검증. 실제불가한필수검증은BLOCK보고.

결과는policy·새필드schema·원자성/오프라인·TTL·Guest·실제변경·명령exit·한계. 지시/조사/칼로리제안파일덮어쓰기금지. 상태보드/결정로그/opsindex는Supervisor마무리.
