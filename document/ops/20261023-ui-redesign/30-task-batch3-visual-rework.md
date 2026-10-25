# 재지시30 — 묶음3 화면 품질 감리 FAIL 보완

2026-10-24 Codex → Cursor. [지시28](28-task-batch3-summary-next.md)·[결과29](29-result-batch3-summary-next.md) 후속. 결과 `31-result-batch3-visual-rework.md`. 기존28 결과는 보존하고 새 캡처는 `evidence/batch3-final/`에 남긴다.

## 감리 FAIL 근거 — 캡처 직접 확인

- `evidence/batch3/after-summary-800x360.png`: 폭740만 확보하고 실제 높이는224, 제목이 약10px, 보조지표가 오른쪽 한가운데 작은 글씨로 모였다. 왼쪽에는 중첩된 작은 박스2개가 남고 숫자22px, 넓은 빈 공간. 시안10의 정보 위계와 다르다.
- 원인: `RideSummarySheet.css` 상단의 새 가로 @media가 뒤에 있는 기존 `.heroes-main`, `.conquest-hero`, `.substats`, `.substat` 등 동일 선택자에 덮인다. **선언했다는 사실이 아니라 computed style·실제 캡처로 검수**한다.
- `after-nextride-resume-800x360.png`: 카드폭 약210px, 버튼 두 줄, 제목/상단 이름표 중복, 예전 작은 글자 유지. 새 카드 max-width만 지정해서 intrinsic width가 줄어든다. 프리뷰는 idle 전용 NextRide와 Go/RouteDock을 동시에 보여 현실과 다른 겹침도 발생.
- 새로운 e2e는 폭·높이만 검사해 위 품질 실패를 놓쳤다. callback은 noop이고 클릭 후 보인다는 단언은 동작 보존 증거가 아니다.

## 보완 — 화면 먼저

1. **결과 CSS cascade 정리**: 가로 판 규칙이 기존 규칙 뒤에서 최종 적용되도록 옮기거나 기존과 통합. 임시 `!important` 쌓기 금지. 800×360은 실제 높이324px 내외, 667×300은 바깥 여백을 제외한 높이. 내용이 있는 영역을 읽기 좋게 쓰되 불필요한 상자·센터 정렬된 빈 공간을 만들지 않는다.
2. 왼쪽: 이야기 제목13px 어두운 글자·보조11~13px, 중간 새 도로 숫자64~72px+km22px(확정 양수일 때), 하단 진행26px/보조11~13px와 진행 막대. 로딩·0·실패는 기존 사실 상태를 유지하고 수치를 날조하지 않는다. 중첩된 .conquest-hero/.progress 바탕·테두리·카드모양 제거. 새 도로가 먼저, 진행은 하단. 확인 중 상태도 작은 박스 안에서 잘리지 않게 한다. km은 값 옆에 명확히(기존 data/aria 및 실제 도메인값 유지).
3. 오른쪽: 제목17px, 각 지표는 판 폭을 쓰는 한 줄(라벨13px 왼쪽 / 숫자17~26px 오른쪽), 줄 사이 얇은 구분. 기존 · 구분자 의사요소는 줄형 목록에서 제거. 하단 입력/행동은36~40px 높이, 글자13px, 입력은 필요하면 한 줄·버튼 별도 한 줄. Guest등록/저장/안함의 기존 동작·확인 조건을 유지하며 시안 버튼 위계에 맞춤. 낮은 높이에 수치·저장중·실패·닫기 접근 가능.
4. **다음 주행 실제폭320px 내외**(가로667에서도 맞음), title17px, 설명11~13px 어두운 보조색, 멈춘곳13px·남은거리26px. kicker와 제목의 같은 말 중복 제거. 행동 버튼은 한 줄, 기존 resume/extend/map/dismiss 조건 보존. `멈춘 곳`에 지명 대신 경로명을 사실인 것처럼 넣지 않는다(지명 없으면 「마지막 종료 지점」). 경로 이름은 필요하면 별도 명확한 라벨로 보존.
5. 프리뷰 NextRide는 **실제 App의 idle 상태·센서-only 주행바 배치**를 재현하고 stage.ready의 Go와 공존시키지 않는다. App 제품 코드·주행바 제품 코드 변경 금지. fixture callback을 메모리 카운터/관측 가능한 상태로 연결해 resume/extend/map/dismiss가 정확한 인자로 한 번 호출되는지 검증. 운영 Firebase 금지.
6. 기존 e2e 기대값/게이트 완화 금지. 새 batch3 시험은 title/보조지표 실제 읽기 크기·오른쪽 지표 전체 폭·카드 폭/버튼 한 줄·컴포넌트 action callback을 의미 있게 단언. `evidence 경로 존재` 같은 형식 시험 삭제. 허위 +N을 넣지 말고 확정 양수 상태가 fixture로 불가능하면 그 상태의 수치 검증 한계를 적되 스타일 검증을 누락하지 않는다. props나 제품용 디버그 주입을 만들지 않는다.
7. 캡처를 직접 열어 시안10/11과 비교한 뒤 결과를 작성한다. 통과했다고 바로 멈추지 말고 읽기 크기·정렬·중첩박스·잘림·행동 위계가 실제로 맞는지 확인. `comparison-batch3.html`은 최종 캡처로 갱신하고 최초 실패 캡처는 기록으로 보존.

## 범위·검증

지시28 소유 범위·고정1~10·보존파일/기존서버/브랜치/배포 금지 그대로. 다른 작업자 변경 되돌리기 금지. git commit/push/restore/clean/stash/worktree·build/dist·App·도메인·인터페이스 변경 금지.

`C:\20.HDev\boxcycle\apps\web`: 타입·변경lint·selector19·새batch3 e2e(1worker). 전체 quick·실앱 시험은 Supervisor 소유. 자신이 띄운5020만 종료. 최종 결과31은 실제 변경파일만 적고 코드에 없는 변경/검증은 적지 않는다.
