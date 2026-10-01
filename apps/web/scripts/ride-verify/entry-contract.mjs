// 실주행 진입 시퀀스(게스트→경로 로드→주행 시작)가 의존하는 셀렉터 계약.
// verify-selectors.mjs 가 이 목록의 셀렉터 앵커가 소스에 실재하는지 검사한다.
// e2e spec(entry.spec.ts)과 이 계약이 같은 셀렉터를 쓰므로, UI 가 바뀌어 앵커가 사라지면
// spec 을 돌리기 전에(=Firebase 없이) 여기서 먼저 깨진다.
//
// 앵커 = 소스에 반드시 존재해야 하는 정규식. file 은 apps/web 기준 상대경로.
// 셀렉터를 바꿀 땐 여기와 entry.spec.ts 를 함께 고친다.

export const ENTRY_STEPS = [
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
    step: "cadence-chip",
    desc:
      "케이던스 센서 칩 — 센서 상세 설정 트리거. 자리는 stage 에 따라 둘 중 하나다(6A): " +
      "경로가 있으면 RouteDock 의 항상 보이는 행, 없으면(`idle` 등) HUD 우상단 폴백. " +
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
      { name: "세 갈래 슬롯", re: /"route-dock-chip" \| "route-dock-caret" \| "none"/ },
      { name: "dock 여부로 판정", re: /isRouteDockVisible\(stage\)/ },
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
    desc: "HUD 좌상단 Trail 메뉴 트리거",
    file: "src/components/maphud/MapHud.tsx",
    anchors: [{ name: "Trail 메뉴 aria-label", re: /aria-label="Trail 메뉴"/ }],
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
    desc: "RouteDock 'Go'(ready-to-start) — 주행 시작",
    file: "src/components/route-dock/RouteDock.tsx",
    anchors: [
      // 2026-09-28: 일시정지 후 같은 버튼이 「재개」로 바뀐다 — 고정 문자열 앵커는 실종로 오탐.
      // main RouteDock: 아이콘 버튼 + paused 분기 aria-label (문자 「Go」는 주석/클래스에 잔존).
      { name: "Go aria-label (시작|재개)", re: /aria-label=\{paused \? "재개" : "주행 시작"\}/ },
      { name: "Go 텍스트", re: /\bGo\b/ },
      { name: "ready-to-start 게이트", re: /stage === "ready-to-start"/ },
      { name: "주행 제어 그룹", re: /aria-label="주행 제어"/ },
    ],
    selector: `getByRole('button',{name:'주행 시작'})`,
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
    desc: "주행 종료 — RouteDock 주행 제어(Stop/Pause)",
    file: "src/components/route-dock/RouteDock.tsx",
    anchors: [
      { name: "주행 제어 group", re: /aria-label="주행 제어"/ },
      { name: "주행 종료 aria-label", re: /aria-label="주행 종료"/ },
      { name: "일시정지 aria-label", re: /aria-label="일시정지"/ },
    ],
    selector: `getByRole('button',{name:'주행 종료'})`,
  },
];
