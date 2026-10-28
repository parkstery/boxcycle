# 주행 UI 정리 · 인터벌 · 응원 연출

현재: **DEPLOYED** — [Hosting 배포·운영 해시 검증](10-deployment.md). 이전 미배포 상태 기록보다 우선한다. 기존 증거10장 원본 복구 미완료는 유지.

최신 후속: [인터벌 검정25% 배경](09-result-interval-background.md).

최신 후속: [계기판 왼쪽20px·한 행](08-result-single-row-hud.md). 기존3열2행 시안보다 이 지시가 우선한다.

상태: 제품 로컬 검증 완료 / 기존 증거 10장 원본 복구 미완료 / 미배포. Supervisor Codex / 구현·관련 시험 Cursor AI. Chief 2026-10-28 v2 시안 구현 승인. 커밋·푸시·배포 지시 없음.

- [구현 지시](01-task.md)
- [승인 시안](mockups/approved-v2.html)
- 실행자 결과: `02-result-cursor.md`
- 감리: `03-review.md`
- 기존 dirty를 포함한 착수 시점 원본: `evidence/baseline.zip` 및 `baseline.json`. HEAD와의 diff만으로 이번 변경을 판정하지 않는다.

기준 실행 폴더 `C:\20.HDev\boxcycle\apps\web`. 확인 서버는 기존 5031을 먼저 확인하고 재사용한다. 3000 등 타 프로젝트 서버를 건드리지 않는다. 새 증거는 이 묶음의 evidence에만 저장한다.

최신 결과와 실행 명령은 [최종 감리](03-review.md)를 먼저 읽는다. 실제 제품 컴포넌트 캡처는 `evidence/final-screen/` (지도·수치는 검수용). 화면54·빌드 PASS. 전체 quick/정련/보존 미해결을 완전 통과로 해석하지 않는다.
