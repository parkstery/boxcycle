> 보관 기록 — 초기 후보 작업. 아래 상태·정책·실행 명령은 당시 기록이며 현재 작업 지시가 아니다. 최종 구현은 [21 승인](21-review-final-approval.md)·[23 통합](23-result-merge-main2.md), 초기 코드 보관은 [보관 색인](../../archive/ops/20261003-focus-read-spike-initial-candidate/README.md)을 따른다.

# Brief — 포커스 복귀 read 급증

## Chief 관측 (L, 원인 확정 아님)

- boxcycle 브라우저를 앞에 가져온 뒤, 주행 조작 없이 Firestore 읽기 약 600회 이상 피크가 보였고 쓰기는 거의 없었다.
- Firebase Console 스크린샷의 구독 측정항목은 대략 리스너 20→35, 활성 연결 4→7로 상승했다.
- 그래프는 프로젝트 전체·분 단위이며 여러 열린 앱/탭과 다른 세션이 포함될 수 있다. 이 숫자만으로 특정 창의 중복 구독이나 SDK 재연결·초기 스냅샷 과금을 확정하지 않는다.
- Chief가 보낸 2차 측정의 동일 Trail 2인 피크는 reads 278 / writes 113, 독립 Trail 2개 피크는 reads 712 / writes 90. 시간·phase 정렬과 청구 귀속은 미검증. 이전 후속 병합분은 측정 도구/문서만이며 앱 런타임 변경이 없어 이 피크 감소를 그 병합에 귀속하지 않는다.

## 확인해야 할 후보 (결론 아님)

1. 숨김→표시 전환에 의해 의도적으로 해제된 리스너의 재구독과 initial query.
2. 포커스/가시성 복귀 때 단발 조회(`refreshPublishedPublicCourseCatalog` 등) 반복.
3. React effect/hub cleanup 문제로 동일 쿼리의 실제 underlying listener 중복.
4. 다른 열린 클라이언트 또는 프로젝트 전체 집계의 동시 변화.

공식 Firebase 문서: Firestore usage dashboard는 billed operations의 정확한 값이 아니며 분 단위로 표본화된다. web SDK의 활성 연결 하나가 여러 리스너를 공유한다. 리스너 재연결의 read 청구 조건은 offline persistence 설정과 연결 끊김 시간에 따라 달라진다. 따라서 첨부 설명의 "포커스만으로 모든 리스너가 전체 문서를 재청구"는 가설이다.

- https://firebase.google.com/docs/firestore/monitor-usage
- https://firebase.google.com/docs/firestore/pricing
