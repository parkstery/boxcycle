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
    desc: "HUD 우상단 케이던스 센서 칩 — 계정 칩 왼쪽, 센서 상세 설정 트리거",
    file: "src/components/maphud/CadenceHudChip.tsx",
    anchors: [
      { name: "칩 접근성 이름", re: /aria-label=\{view\.ariaLabel\}/ },
      { name: "열림 상태 aria-expanded", re: /aria-expanded=\{open\}/ },
    ],
    selector: `getByRole('button',{name:/케이던스 센서/})`,
  },
  {
    step: "input-readiness",
    desc: "주행 입력 준비 — 센서 상세 설정에서 '체험 속도로 준비' (Go 사전조건)",
    file: "src/components/sensor/CadenceSensorSheet.tsx",
    anchors: [
      { name: "센서 시트 dialog", re: /role="dialog"/ },
      { name: "시트 aria-label", re: /aria-label="케이던스 센서"/ },
      { name: "체험 속도로 준비 버튼", re: /체험 속도로 준비/ },
      { name: "시트 닫기 버튼", re: /aria-label="센서 설정 닫기"/ },
    ],
    selector: `getByRole('dialog',{name:'케이던스 센서'}) → getByRole('button',{name:'체험 속도로 준비'})`,
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
      { name: "모달 dialog", re: /role="dialog"/ },
      { name: "모달 title id", re: /aria-labelledby="oc-modal-title"/ },
      { name: "코스 항목 Load course", re: /Load course/ },
    ],
    selector: `getByRole('dialog').getByRole('button',{name:/<코스제목>/})`,
  },
  {
    step: "start-ride",
    desc: "RouteDock 'Go'(ready-to-start) — 주행 시작",
    file: "src/components/route-dock/RouteDock.tsx",
    anchors: [
      { name: "Go aria-label", re: /aria-label="주행 시작"/ },
      { name: "Go 텍스트", re: /\bGo\b/ },
      { name: "ready-to-start 게이트", re: /stage === "ready-to-start"/ },
    ],
    selector: `getByRole('button',{name:'주행 시작'})`,
  },
  {
    step: "ride-running-proof",
    desc: "주행 중 확정 — 주행 지표 그룹 + 주행 종료 버튼",
    file: "src/components/maphud/MapHud.tsx",
    anchors: [
      { name: "주행 지표 group", re: /aria-label="주행 지표"/ },
      { name: "주행 종료 aria-label", re: /aria-label="주행 종료"/ },
    ],
    selector: `getByRole('group',{name:'주행 지표'}) & getByRole('button',{name:'주행 종료'})`,
  },
];
