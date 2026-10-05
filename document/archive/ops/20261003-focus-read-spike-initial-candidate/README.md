# Foreground read spike 초기 후보 코드 보관

2026-10-06 보관. 제품 최종 구현은 [최종 승인](../../../ops/20261003-focus-read-spike/21-review-final-approval.md)과 [통합 결과](../../../ops/20261003-focus-read-spike/23-result-merge-main2.md)를 따른다. 본 후보는 실행·채택 대상이 아니다.

초기 소스·시험 5개를 원래 경로 구조 아래 `.ts.txt`로 보존했다. 앱 타입·의존·Playwright 시험 탐색에서 제외하며 내용을 변경하지 않았다. [manifest.json](manifest.json)에 원래 경로·보관 경로·SHA256을 기록했다. 복구하려면 별도 작업에서 원래 경로와 확장자로 복사하고 현행 정책과 다시 대조한다. 자동 복원하지 않는다.

- 초기 visibilityResumePolicy는 최종 activityWorldResumePolicy/publishedCatalogRefreshPolicy로 대체됐다. 초기 catalog 60초 가드를 현행 5분 TTL로 되돌리지 않는다.
- 초기 fetch 계측은 현행 visibilityReadMeters와 다르며 현재 앱에서 사용하지 않는다.
- 초기 계약의 최초·fresh·stale·force·오류 후 조회 조건은 최종 resume-cache-policy 시험에 있다. 초기 코드 식별자와 배선에 고정된 정규식 시험은 최종 구현에 이식하지 않았다.
- 초기 e2e는 현행 focus-read-spike.spec.ts로 대체됐다.

초기 ops 6개는 [기존 묶음](../../../ops/20261003-focus-read-spike/README.md)에 당시 본문과 상대 링크를 보존한다. 초기 코드의 내부 import·명령은 역사적 자료이며 실행 가능한 패키지가 아니다.
