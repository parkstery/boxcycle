# 20261103-cost-squeeze — 운영 비용 짜내기

| 항목 | 내용 |
|---|---|
| 상태 | L1·L2·L3·L6 임시 **배포됨(c97eac84)**, L4 설계(Chief 확인 C1·C2), G3-1 구현 중 |
| Supervisor | Claude Code (Opus 5.5) |
| 점검 | [01-audit.md](01-audit.md) · L4 설계 [02-design-l4.md](02-design-l4.md) |

## 요약

사용자 수의 제곱으로 커지는 비용 원천 셋을 찾았다: 순위 전체 훑기(L6), 세계 사람 점 전체 구독(L1), 첫 화면 collectionGroup 구독(L2). 1만 명 규모 추정 월 수천 달러. RTDB 동행(L8)은 비례형이고 이미 줄여 둔 상태다.

## 다음

1. L4: Chief 확인 C1(관전 12초·30초 숨김)·C2(수신 측만 RTDB 끊김 시 폴백 품질) → 구현·peer-sync 재생 검증
2. G3-1 누적 점수: impl-standard 구현 중([지시서](../20261103-global-geo-data/02-task-g3-leaderboard-scores.md)) → 감리 → 운영 채우기·배포 승인 → L6 임시 캐시 해제
3. G2 요약 목록(L7), G4 Trail 목록 지역 필드 → L3 화면 안 필터

## 기록

- 2026-11-03 Chief: 비용 절감 여지 짜내기가 1순위. 유럽 RTDB는 미루지 말고 여유 있을 때 설정해 사용자 만족도 저하를 예방.
- 2026-11-03 Chief: 제안한 절감 방안 승인·진행, 적용 후 예상 비용 비교 요청 → [01-audit §적용 결과](01-audit.md). 1만 명 추정 월 $13,000~26,000 → $1,500~2,900.
- 2026-11-03 Chief: 커밋·푸시·배포, L4 설계, 유럽 RTDB 생성 승인 → c97eac84 배포(Hosting·Functions·Rules), `boxcycle-dc2df-eu-rtdb` 생성, L4 설계 작성, G3-1 착수.
