# 감리 F3 — 주행 틱 다이어트

| 항목 | 내용 |
|---|---|
| 감리 | 2026-10-16 · Supervisor (Claude) · Developer Cursor |
| 판정 | **APPROVED** — 목표 2 ms 대비 2.29 ms(남은 몫은 카메라 `jumpTo`·움직이는 페이서 마커로 화면 동작 변경 없이는 축소 불가) |

- 진짜 원인: 매 프레임 `map.getStyle()`(레이어 순위 확인)과 LOD2 표시 중에도 `setSpecs` 가 부르던 `rig.setPhase`(다리 IK). 경로 O(N) 검색(H1)은 사실이나 몫은 작음(폰델파크 0.43 ms/프레임).
- 수정: 레이어 순위 1회 확인 + `styledata`/`remove` 무효화, 같은 desired 참조면 `setSpecs` 생략, LOD2 가 실제로 보일 때만 IK 생략(리그 표시·LOD2 미준비 시 종전), 마커는 값이 같으면 DOM 미기록, 경로 누적거리 색인(WeakMap, 이진 탐색, 4슬롯 캐시, 선형 구현과 1e-9 일치 시험).
- 헤드리스 틱 6.64 → 2.29 ms(sync 2.00→0.01, spec 1.43→0.10, markers 1.48→0.70). 화면 위치·방위·카메라·동기화 정책 무변경.
- 검증: tsc 0, check-dep 미지정 0, test:quick(worktree `functions/lib` 3건 외) 통과, pacer 14, rider-preserve 44+6, peer-spacing PASS, build 0.
- 배포 후 Chief PC·폰 perflab 로 운영 수치 확인.
