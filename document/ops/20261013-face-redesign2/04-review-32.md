# 감리32 — 펼침에 따른 dock 재배치 통과

2026-10-14 Supervisor Codex. 실제 diff는 MapView.tsx dock lifecycle9선 추가뿐. ResizeObserver는 기존 onDockResize를 재사용하고 dock teardown·effect cleanup에서 해제된다. drag guard·위치 기억·기존 창 resize 유지.

pick-32-live.cjs exit0, 실제 Guest 667×300/740×300/844×390에서 위치→거리→양쪽→위치→drag→drag후펼침18상태 panel rect가 canvas 안에 유지, close/reopen PASS. 초기 내부 스크롤 측정은 panel 기준이라 내용 스크롤까지 증명하지 않음. 따라서 최종33에서 pick 기준 측정으로 교체하고70vh상한 개선. 재배치 APPROVED, 최종감리33 우선.
