// 실주행 진입 시퀀스(게스트→경로 로드→주행 시작)가 의존하는 셀렉터 계약.
// verify-selectors.mjs 가 이 목록의 셀렉터 앵커가 소스에 실재하는지 검사한다.
// e2e spec(entry.spec.ts)과 이 계약이 같은 셀렉터를 쓰므로, UI 가 바뀌어 앵커가 사라지면
// spec 을 돌리기 전에(=Firebase 없이) 여기서 먼저 깨진다.
//
// 앵커 = 소스에 반드시 존재해야 하는 정규식. file 은 apps/web 기준 상대경로.
// 셀렉터를 바꿀 땐 여기와 entry.spec.ts 를 함께 고친다.

export const ENTRY_STEPS = [
  {
    step: "location-choice",
    desc: "최초 위치 컨트롤 클릭은 브라우저 위치 허용으로 직접 연결. 앱 중간 확인 없음.",
    file: "src/components/auth/EntryLocationDialog.tsx",
    anchors: [
      { name: "질문", re: /어디에서 시작할까요/ },
      { name: "현재 위치", re: /내 위치/ },
      { name: "기본 위치 문구", re: /const ROME_LABEL = "기본 위치"/ },
      { name: "현재 위치 직접 요청", re: /onClick=\{onChooseCurrent\}/ },
      { name: "기본 위치", re: /onClick=\{onChooseRome\}/ },
      { name: "현재 위치 아이콘", re: /className="entry-location__icon"/ },
    ],
    also: [
      {
        file: "src/App.tsx",
        anchors: [
          { name: "phase 연결", re: /phase=\{entryLocation\.phase\}/ },
          { name: "permission 연결", re: /permission=\{entryLocation\.permission\}/ },
          { name: "기본 위치 콜백", re: /onChooseRome=\{entryLocation\.chooseRome\}/ },
          { name: "내 위치 콜백", re: /onChooseCurrent=\{entryLocation\.chooseCurrent\}/ },
          { name: "위치결과 연결", re: /onPosition=\{entryLocation\.acceptPosition\}/ },
        ],
      },
    ],
    selector: `getByRole('dialog',{name:'어디에서 시작할까요?'}) → getByRole('button',{name:'내 위치'} → 브라우저 허용`,
  },
  {
    step: "app-intro",
    desc:
      "최초 인증 전 앱 소개 — onStartGuest·onLogin 두 콜백과 「게스트로 시작」「로그인」 버튼. " +
      "이 화면은 인증·타이머를 하지 않는다.",
    file: "src/components/auth/AppIntroScreen.tsx",
    anchors: [
      { name: "소개 region", re: /aria-label="앱 소개"/ },
      { name: "소개 제목", re: /땀으로 그리는,/ },
      { name: "게스트 시작 콜백", re: /onStartGuest: \(\) => void/ },
      { name: "로그인 콜백", re: /onLogin: \(\) => void/ },
      { name: "게스트로 시작", re: /게스트로 시작/ },
      { name: "로그인 버튼", re: />\s*로그인\s*</ },
      { name: "게스트 클릭", re: /onClick=\{onStartGuest\}/ },
      { name: "로그인 클릭", re: /onClick=\{onLogin\}/ },
    ],
    selector: `getByRole('region',{name:'앱 소개'}) → getByRole('button',{name:'게스트로 시작'}) · getByRole('button',{name:'로그인'})`,
  },
  {
    step: "app-intro-gate",
    desc:
      "소개는 최초 진입 또는 이용 종료 후 표시하며 메모리 dismiss 전일 때만. 2초 자동 전환은 없다. " +
      "게스트·로그인 버튼은 인트로를 닫고 기존 인증을 바로 호출한다. " +
      "정상 첫 진입은 게스트 카드를 다시 띄우지 않는다. " +
      "탈퇴·로그아웃·설정 없음·오류 회복은 위치 안내와 겹치지 않는다.",
    file: "src/App.tsx",
    anchors: [
      { name: "메모리 dismiss", re: /const \[introDismissed, setIntroDismissed\] = useState\(false\)/ },
      { name: "버튼 진입", re: /const \[entryRequested, setEntryRequested\] = useState\(false\)/ },
      {
        name: "소개 조건",
        re: /const showAppIntro =\s*\(needsGuestEntry \|\| \(configured && authInitialized && !user && appUseEnded && !authOffline\)\) &&\s*!introDismissed &&\s*startScreenNotice !== "account-deleted" &&\s*expiryKind == null &&\s*!authSigningIn &&\s*!busy &&\s*!error/,
      },
      { name: "위치 hook", re: /useEntryLocation\(entryLocationEnabled\)/ },
      { name: "부트 목적지", re: /bootFlyTarget: entryLocation\.target/ },
      { name: "소개에 게스트 콜백", re: /<AppIntroScreen\b[^>]*\bonStartGuest=/ },
      { name: "소개에 로그인 콜백", re: /<AppIntroScreen\b[^>]*\bonLogin=/ },
      {
        name: "게스트 카드는 소개·진입 요청·위치 안내 밖",
        re: /\{needsGuestEntry && !showAppIntro && !entryRequested && !entryLocationPrompt \? \(/,
      },
    ],
    selector: `getByRole('region',{name:'앱 소개'}) → getByRole('button',{name:'게스트로 시작'})`,
  },
  {
    step: "guest-entry",
    desc: "게스트 진입 카드 — 익명 인증 '시작' 버튼",
    file: "src/components/auth/GuestEntryCard.tsx",
    anchors: [
      { name: "dialog aria-label 시작", re: /aria-label="시작"/ },
      { name: "시작 버튼 텍스트", re: /busy \? "연결 중…" : "시작"/ },
    ],
    selector: `getByRole('dialog',{name:'시작'}) → getByRole('button',{name:'시작',exact:true})`,
  },
  {
    step: "auth-session-state",
    desc:
      "인증 세션 게이트 — 설정 없음, 부트·서명·busy 대기(실패/선택 버튼 없음, stale error 숨김), " +
      "이용 종료 뒤와 실제 실패 모두 로그인·게스트로 시작, 복원 전 오프라인만 재시도, idle 선택. App 은 이 컴포넌트에 같은 상태를 연결한다.",
    file: "src/components/auth/AuthSessionGate.tsx",
    anchors: [
      {
        name: "대기 조건(부트·서명·busy)",
        re: /const pending = configured && \(!authInitialized \|\| authSigningIn \|\| busy\)/,
      },
      { name: "대기 status", re: /role="status"/ },
      { name: "로그인 중 또는 연결 중", re: /authSigningIn \|\| busy \? "로그인 중…" : "연결 중…"/ },
      { name: "설정 없음", re: /Firebase 설정 필요/ },
      { name: "시작 메뉴 로그인", re: /AuthGoogleMark \/>\s*로그인/ },
      { name: "실패 문구", re: /서비스에 연결할 수 없습니다\./ },
      { name: "복원 전 재시도", re: /재시도/ },
      { name: "게스트로 시작", re: /게스트로 시작/ },
      { name: "idle 선택", re: /시작 방법을 선택해 주세요\./ },
      {
        name: "비대기에서만 error 상세",
        re: /!pending && error && \(userSignedOut \|\| !configured\)/,
      },
    ],
    also: [
      {
        file: "src/App.tsx",
        anchors: [
          { name: "세션 게이트 컴포넌트", re: /<AuthSessionGate/ },
          { name: "configured 연결", re: /configured=\{configured\}/ },
          { name: "authInitialized 연결", re: /authInitialized=\{authInitialized\}/ },
          { name: "authSigningIn 연결", re: /authSigningIn=\{authSigningIn\}/ },
          { name: "userSignedOut 연결", re: /userSignedOut=\{userSignedOut\}/ },
          { name: "busy 연결", re: /busy=\{busy\}/ },
          { name: "error 연결", re: /error=\{error\}/ },
          {
            name: "게스트 콜백",
            re: /onStartGuest=\{\(\) => void beginAuthenticatedSession\(\)\}/,
          },
          {
            name: "Google 콜백",
            re: /onGoogleSignIn=\{\(\) => void handleGoogleSignIn\(\)\}/,
          },
        ],
      },
    ],
    selector: `pending getByRole('status'); idle getByText('시작 방법을 선택해 주세요.'); failure getByText('서비스에 연결할 수 없습니다.')`,
  },
  {
    step: "cadence-chip",
    desc:
      "케이던스 센서 칩 — 센서 상세 설정 트리거. 자리는 stage 에 따라 둘 중 하나다(6A): " +
      "ready·setup 은 RouteDock, idle·주행·일시정지는 주행바의 센서 설정 버튼. " +
      "셀렉터는 자리에 의존하지 않는 역할·접근성 이름이므로 이동해도 그대로 쓴다.",
    file: "src/components/maphud/CadenceHudChip.tsx",
    anchors: [
      { name: "칩 접근성 이름", re: /aria-label=\{view\.ariaLabel\}/ },
      { name: "열림 상태 aria-expanded", re: /aria-expanded=\{open\}/ },
      { name: "자리 변형(hud|dock)", re: /placement\?: "hud" \| "dock"/ },
    ],
    selector: `getByRole('button',{name:/케이던스 센서/})`,
  },
  {
    step: "cadence-chip-slot",
    desc:
      "센서 칩 자리 판정 — dock 과 우상단에 동시에 뜨면 getByRole 이 strict 위반으로 깨진다. " +
      "어디에도 안 뜨면 「센서 없음」에 닿지 못해 Go 가 영영 잠긴다.",
    file: "src/lib/route/sensorChipSlot.ts",
    anchors: [
      { name: "슬롯 판정 함수", re: /export function sensorChipSlot\(/ },
      // 2026-09-26(Phase 6-A): 2갈래(route-dock|none) → **3갈래**. 접힘이면 칩 대신 캐럿 LED.
      { name: "슬롯 3갈래", re: /"route-dock" \| "ride-control-bar" \| "none"/ },
      { name: "게이트 및 결과 제외", re: /stage === "summary"/ },
    ],
    selector: `(렌더 자리 판정 — 셀렉터 없음)`,
  },
  {
    step: "input-readiness",
    desc: "주행 입력 준비 — 센서 상세 설정에서 '센서 없음' (Go 사전조건)",
    file: "src/components/sensor/CadenceSensorSheet.tsx",
    anchors: [
      { name: "센서 시트 dialog", re: /role="dialog"/ },
      { name: "시트 aria-label", re: /aria-label="케이던스 센서"/ },
      { name: "센서 없음 버튼", re: /센서 없음/ },
      { name: "시트 닫기 버튼", re: /aria-label="센서 설정 닫기"/ },
    ],
    selector: `getByRole('dialog',{name:'케이던스 센서'}) → getByRole('button',{name:'센서 없음'})`,
  },
  {
    /*
     * 2026-09-27 추가 — 이 둘을 안 보고 있어서 동행 e2e 12개가 **한 달 넘게** red 였다.
     * 앵커가 「그 파일에 그 문자열이 있나」만 보면, 컨트롤이 **다른 컴포넌트로 옮겨 갈 때**
     * 원래 파일에서는 사라지는데도 아무도 모른다. 그래서 **자리까지** 계약에 적는다.
     */
    step: "session-speed-slider",
    desc:
      "세션 속도 슬라이더 — **센서 시트 안**에 있다. 2026-08 경에 경로 도크에서 옮겨 왔고, " +
      "스펙은 도크를 계속 뒤지다 죽었다. 자리가 또 바뀌면 여기서 먼저 깨져야 한다.",
    file: "src/components/sensor/CadenceSensorSheet.tsx",
    anchors: [
      // ⚠️ 접두사만 보면 안 된다 — `<SessionSpeedControlMoved` 에도 걸려 **이름을 바꿔도 통과한다.**
      //    2026-09-27 에 이 앵커를 깨뜨려 보다 직접 걸렸다. 경계(``)까지 본다.
      { name: "시트가 속도 컨트롤을 품는다", re: /<SessionSpeedControl[\s/>]/ },
      { name: "속도 컨트롤 import", re: /import \{ SessionSpeedControl \}/ },
    ],
    selector: `getByRole('dialog',{name:'케이던스 센서'}).getByRole('slider',{name:'세션 속도 km/h'})`,
  },
  {
    step: "session-speed-control",
    desc: "세션 속도 컨트롤 — 슬라이더·숫자 입력의 접근성 이름",
    file: "src/components/sensor/SessionSpeedControl.tsx",
    anchors: [
      { name: "슬라이더 이름", re: /aria-label="세션 속도 km\/h"/ },
      { name: "숫자 입력 이름", re: /aria-label="속도 km\/h"/ },
    ],
    selector: `getByRole('slider',{name:'세션 속도 km/h'}) & getByRole('spinbutton',{name:'속도 km/h'})`,
  },
  {
    step: "go-precondition",
    desc:
      "Go 사전조건 — 센서 연결 **또는** 수동 속도 입력이 준비돼야 눌린다(2026-08-27). " +
      "이것을 모르면 「버튼이 보이는데 안 눌린다」로 죽는데, 원인이 잘 안 보인다.",
    file: "src/App.tsx",
    anchors: [
      { name: "준비 판정", re: /const rideInputReady = isRideInputReady\(/ },
      { name: "Go 가 그것에 걸린다", re: /canStartRideWithInput = [^;]*rideInputReady/ },
    ],
    selector: `(사전조건 — e2e 는 '센서 없음'을 골라 충족시킨다)`,
  },
  {
    step: "open-menu",
    desc: "HUD Trail 메뉴 — 포커스 시 드러나는 대안(지도 알약·에지 탭 없음)",
    file: "src/components/maphud/MapHud.tsx",
    anchors: [
      { name: "Trail 메뉴 aria-label", re: /aria-label="Trail 메뉴"/ },
      { name: "포커스 대안 클래스", re: /map-hud__a11y-trigger--menu/ },
    ],
    selector: `getByRole('button',{name:'Trail 메뉴'})`,
  },
  {
    step: "open-basic-courses",
    desc: "RideRoutePanel '입문' 버튼 → 입문 코스 모달",
    file: "src/components/ride/RideRoutePanel.tsx",
    anchors: [
      { name: "입문 title", re: /title="입문 경로 목록"/ },
      { name: "입문 버튼 텍스트", re: /입문/ },
    ],
    selector: `getByRole('button',{name:'입문'})`,
  },
  {
    step: "course-modal",
    desc: "입문 코스 모달 — dialog + 코스 항목 버튼(Load course)",
    file: "src/components/ride/OfficialCourseListModal.tsx",
    anchors: [
      // dialog role·aria-labelledby 는 공용 껍데기(RouteListModalShell)로 옮겨 갔다.
      // 이 파일이 지켜야 할 것은 **그 껍데기에 같은 title id 를 넘기는 것**이다.
      { name: "공용 모달 껍데기", re: /RouteListModalShell/ },
      { name: "모달 title id 전달", re: /titleId="oc-modal-title"/ },
      { name: "코스 항목 Load course", re: /Load course/ },
      // 거리 표기 — e2e 가 「가장 긴 코스」를 이 숫자로 고른다(2026-09-27).
      { name: "항목 거리 표기", re: /formatPublicationListMeta/ },
    ],
    selector: `getByRole('dialog').getByRole('button',{name:/<코스제목>/})`,
  },
  {
    step: "start-ride",
    desc: "우하단 주행바·경로창 재생 — 동일한 준비 조건과 콜백으로 주행 시작",
    file: "src/components/ride/RideControlBar.tsx",
    anchors: [
      // 2026-09-28: 일시정지 후 같은 버튼이 「재개」로 바뀐다 — 고정 문자열 앵커는 실종로 오탐.
      // Chief 261024: 녹색 ride-media-button--play, ready·paused 공용 분기 aria-label.
      { name: "주행 시작·재개 aria-label", re: /aria-label=\{paused \? "재개" : "주행 시작"\}/ },
      { name: "시작 콜백", re: /props\.onStartRide\(restartFromZero\)/ },
      { name: "ready-to-start 게이트", re: /stage === "ready-to-start"/ },
      { name: "주행 제어 그룹", re: /aria-label="주행 제어"/ },
    ],
    also: [
      { file: "src/components/map/mapPopupElements.ts", anchors: [
        { name: "경로창 시작 접근성 이름", re: /startRideBtn\.setAttribute\("aria-label", "주행 시작"\)/ },
        { name: "경로창 시작 준비 확인", re: /if \(!deps\.getCanStartRide\?\.\(\)\) return/ },
      ] },
      { file: "src/components/map/MapView.tsx", anchors: [
        { name: "열린 창 준비상태 동기화", re: /pickPopupAutoRouteUiRef\.current\?\.syncRideStart\(\)/ },
      ] },
      { file: "src/App.tsx", anchors: [
        { name: "경로창 시작 게이트", re: /canStartRide: stage === "ready-to-start" && canStartRideWithInput && !routeMenuLockedForProd/ },
        { name: "경로창 시작 콜백", re: /onStartRide: \(\) => handleStartRide\(\)/ },
      ] },
    ],
    selector: `getByRole('group',{name:'주행 제어'}).getByRole('button',{name:'주행 시작'}) or .map-view__pick.getByRole('button',{name:'주행 시작'})`,
  },
  {
    step: "next-ride-card",
    desc: "지도 위 「다음 주행」 카드 — 이어 달리기·새 경로 연결 CTA(RIDE-CONTINUE-1 §3.1)",
    file: "src/components/ride/NextRideCard.tsx",
    anchors: [
      { name: "카드 aria-label", re: /aria-label="다음 주행"/ },
      { name: "이어 달리기 CTA", re: /%에서 이어 달리기/ },
      { name: "새 경로 CTA", re: /여기에서 계속/ },
      { name: "지도에서 보기 CTA", re: /지도에서 보기/ },
      { name: "숨기기 버튼", re: /aria-label="다음 주행 숨기기"/ },
    ],
    selector: `getByLabel('다음 주행') → getByRole('button',{name:/%에서 이어 달리기/}) | getByRole('button',{name:'여기에서 계속'})`,
  },
  {
    step: "ride-result-progress",
    desc: "주행 결과 시트 — 오늘 거리 + 전체 진행(이전→신규) + 완주/진행률 배지(RIDE-CONTINUE-1 §3.5)",
    file: "src/components/ride/RideSummarySheet.tsx",
    anchors: [
      { name: "결과 시트 region", re: /aria-label="주행 결과"/ },
      // 2026-09-17 Chief: 「오늘」·「거리」 라벨과 「완주/도착」 배지를 뺐다 — 숫자가 스스로 말한다.
      // 남은 표면은 「주행거리 / 총거리」 쌍이다.
      { name: "주행거리/총거리 쌍", re: /aria-label="주행 거리 \/ 경로 전체거리"/ },
      { name: "전체 진행 라인", re: /aria-label="전체 진행"/ },
      // 2026-09-17 컴팩트 재설계(Chief 지시)로 「다음 출발점이 저장되었습니다」 문구와
      // 「끝점에서 새 경로」/「지금 새 경로 연결」 버튼은 시트에서 제거됐다 — 이어가기 기능
      // 자체(handleStartRouteFromAnchor, App.tsx)는 살아있고 진입점만 UserInfoSheet 최근
      // 주행 「여기서 새 경로」로 옮겨졌다. 시트가 새로 내놓는 표면(2열 히어로·완주/진행률
      // 배지)으로 앵커를 옮긴다.
      { name: "2열 히어로 컨테이너", re: /ride-summary__heroes"/ },
      { name: "완주/진행률 배지", re: /ride-summary__heroes-badge/ },
    ],
    selector: `getByRole('region',{name:'주행 결과'}) → getByLabel('전체 진행')`,
  },
  {
    step: "ride-running-proof",
    desc: "주행 중 확정 — HUD 주행 지표 그룹 + 누적 거리",
    file: "src/components/maphud/MapHud.tsx",
    anchors: [
      { name: "주행 지표 group", re: /aria-label="주행 지표"/ },
      // 2026-09-27 정정: 「오늘 거리」·「누적 진행」 라벨은 사라지고 하나로 합쳐졌다.
      { name: "누적 거리 aria-label", re: /aria-label="주행 누적 거리"/ },
    ],
    selector: `getByRole('group',{name:'주행 지표'}) & getByLabel('주행 누적 거리')`,
  },
  {
    // 2026-09-28 Chief/main: 종료·일시정지는 MapHud FAB 가 아니라 RouteDock transport.
    // traffic 계약은 지표(MapHud)와 종료 제어(RouteDock)를 단계로 분리한다.
    step: "ride-end-control",
    desc: "주행 종료 — 독립 주행바(Stop/Pause)",
    file: "src/components/ride/RideControlBar.tsx",
    anchors: [
      { name: "주행 제어 group", re: /aria-label="주행 제어"/ },
      { name: "주행 종료 aria-label", re: /aria-label="주행 종료"/ },
      { name: "일시정지 aria-label", re: /aria-label="일시정지"/ },
    ],
    selector: `getByRole('button',{name:'주행 종료'})`,
  },
];
