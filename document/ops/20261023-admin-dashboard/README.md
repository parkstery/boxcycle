# 20261023-admin-dashboard — 관리자 화면 1차

**상태:** DEPLOYED 2026-10-23 · functions(`getAdminDashboard` 신규) + hosting

계획 [01-plan.md](01-plan.md) · 지시 [01 서버](02-task-01.md) · [02 화면](02-task-02.md) · 결과 [01](03-result-01.md) · [02](03-result-02.md)

- 감리 결함 1: Bearer 정규식 `\s` 누락으로 모든 토큰 401 → 수정·회귀 시험(`parseBearerToken`).
- 운영 검증: 토큰 없음·가짜 토큰 401, 접근 로그 2줄(no_token·invalid_token), 운영 번들에 시트 포함.
- 관리자 = `config/routeReviewers`(googiden 1개). 제외 = 관리자만(Chief 10-23: 나머지 Google 3개는 포함 — 방문 자체도 시험 과정). `config/adminDashboard` 문서 없음.
- 미확인: 관리자 계정으로 실제 시트를 연 화면(Chief 확인 대기).
- 후속 후보: Firestore 예약 백업(Chief 결정 대기), liveonsoft 를 프로젝트 두 번째 소유자로(Chief 콘솔 작업).
