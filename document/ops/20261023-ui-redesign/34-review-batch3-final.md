# 감리 34 — 묶음3 주행 결과·다음 주행 최종

2026-10-24 KST · Supervisor Codex · 지시28 → 결과29 FAIL → 재지시30 → 결과31 → DeepSeek32·Cursor33

## 최종 판정

**LOCAL_VERIFIED / AWAITING_CHIEF.** 800×360 폰 가로에서 주행 결과를 중앙 2열 판으로 정리하고, `새 도로 +N km`를 첫 시선으로 올렸다. 시간·평균·칼로리는 한 줄 지표로 정리했고, 다음 주행 카드는 320px 안에서 멈춘 곳·남은 거리·두 행동을 한 줄로 읽게 했다. 주행 기록은 Chief 고정10에 따라 계정 패널 안 기존 인라인을 유지한다.

커밋·푸시·배포는 하지 않았다. 비교 화면 확인 뒤 별도 승인 단위로 진행한다.

## 감리 과정

- 최초 결과29는 자동 시험 통과와 별개로 작은 글자, 중첩 박스, 과도한 빈 공간, 210px 다음 주행 카드, 버튼 두 줄 때문에 **FAIL** 처리했다.
- 재지시30으로 CSS cascade를 바로잡고 화면을 다시 구성했다.
- Cursor 감리33: **PASS**, 기능·Chief 고정 항목 침해 없음.
- OpenCode DeepSeek v4.1 감리32: 독립 DOM 실측, 화면13/13·기존 화면2/2 **PASS**. 사용 한도 종료 전 출력과 측정을 Supervisor가 문서화했다.
- Supervisor 눈검: `batch3-final` 800×360·667×300·844×390 및 양수 새 도로·resume/extend 상태 확인.

## 최종 수정

- `RideSummarySheet`: 가로 판 740×324 상한, 좌측 스토리/새 도로/진행, 우측 결과 지표/저장. 로딩·확정0·오류는 양수 숫자를 만들지 않는다.
- `NextRideCard`: 실제 카드 약291px(320px anchor), 짧은 제목, 지명 기반 멈춘 곳, 계산된 남은 거리, 두 행동 한 줄.
- Guest 문구: 사실과 어긋난 `로그아웃하면 사라집니다`를 회원 등록 시 이번 주행·내 도로망이 다른 기기에서도 이어진다는 안내로 교체.
- 접근성 회귀 수정: 보이는 제목을 `이어 가기`로 줄이면서 바뀐 group 이름을 기존 계약 `다음 주행`으로 복원하고 e2e 단언 추가.
- RC13 하네스: 인증→위치 전환 race, Trail 메뉴의 포커스+Enter 계약, reload 뒤 위치 안내, 결과 scrim/실제 닫기 구분을 현재 UI 계약에 맞췄다. 모든 클릭을 좁은 대상과 제한 시간으로 고정했다.

## 검증

| 검증 | 결과 |
|---|---|
| 타입 + 변경 파일 ESLint | PASS |
| 묶음3 화면·conquest | **13/13 PASS**, 43.6초 |
| Supervisor 화면 전체 묶음 | **37/37 PASS**, 76.5초 |
| 진입 selector 계약 | **19/19 PASS** |
| 전체 빠른 단위 | **1,354/1,354 PASS**, 102.1초 |
| code tidy | 기준선 이내 |
| 실앱 RC13 | **1/1 PASS**, 1.2분 — 첫 종료→결과→다음 주행→이어 달리기→두 번째 종료 |
| `git diff --check` | PASS |
| 보호 파일 | SHA256 `4CAFA2A22CEAC8547D7EDB44D22A09082D0710EBDD71B6BDC34D59D57378179F` 유지 |

RC13의 앞선 실패는 각 로그에 그대로 보존했다. 네 건은 오래된 하네스 셀렉터·진입 race였고, 한 건은 NextRide group 접근성 이름 회귀였다. 회귀를 수정한 마지막 실행 로그 `evidence/entry-card-history/supervisor-batch3-rc13-live-contract-pass.log`가 exit0 증거다.

## Chief 확인

- 최종 비교: `C:\20.HDev\boxcycle\document\ops\20261023-ui-redesign\comparison-batch3-final.html`
- 주행 결과: `evidence/batch3-final/after-summary-positive-800x360.png`
- 다음 주행: `evidence/batch3-final/after-nextride-resume-800x360.png`

로컬 실행:

```powershell
cd C:\20.HDev\boxcycle\apps\web
$env:RTW_DEV_PORT='5020'
npm run dev:localhost -- --mode harness --strictPort
```

접속:

- `http://127.0.0.1:5020/scripts/ui-800x360/preview.html?state=summary`
- `http://127.0.0.1:5020/scripts/ui-800x360/preview.html?state=nextride-resume`

