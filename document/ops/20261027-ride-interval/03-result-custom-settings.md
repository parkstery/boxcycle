# 프리셋 8종·직접 설정 — 구현·시험·배포 결과

2026-10-27 20:55 KST · **DEPLOYED**

Chief 승인: 「한 화면 조절형」, 프리셋8종과 직접 설정 구현·시험·배포. 추가 디자인 지시: 불필요한 폭·높이·빈 공간을 없애 배경 맵을 덜 가린다.

## 구현과 사용

- MENU → 주행 설정 → 인터벌 옆 **운동 설정**.
- 프리셋8종을 고르거나 고강도/저강도 시간(각5~600초 정수), 반복 수(1~30회 정수)를 직접 입력한다. 5초 배수가 아닌 값도 입력 가능. 총시간·누적 고/저강도·구성 막대를 즉시 갱신한다.
- 준비·마무리 각5분 유지. 총시간 = `(고강도초 + 저강도초) × 반복 수 + 600초`.
- **설정 적용** 전에는 실제 운동에 영향 없음. 닫기·배경·Escape는 초안 취소. 같은 값 적용은 현재 운동을 다시 시작하지 않는다.
- 진행 중 다른 설정을 적용하면 안내 문구대로 준비부터 다시 시작한다. 일시정지 중에는 준비 시간에 멈추고 재개 때 이어진다.
- 선택한 시간·반복만 이 브라우저 localStorage(`spinatlas.rideInterval.config.v1`)에 보존한다. 사용 스위치는 새로고침 후 자동으로 켜지지 않는다. 저장소 파손·접근 불가 시 기본값/메모리 선택으로 동작한다.
- 기존 상단 중앙형 HUD·센서·주행 종료 정책 유지. 함수·Firestore·Rules·외부 API 변경 없음.

프리셋(high/low초×횟수): 30/30×5, 30/60×5, 20/40×8, 40/20×8, 45/45×8, 60/60×5, 60/30×8, 90/60×6. 효과별 운동 처방 명칭은 붙이지 않았다.

## 역할·감리

Cursor: `rideInterval.ts`, `useRideInterval.ts`, core 단위시험9건. Codex: UI·App·프리뷰 결선, 브라우저 시험, 코드/화면 감리, 배포·운영 해시 대조. Cursor 계약/담당 범위는 `02-cursor-core-task.md`.

Codex 감리에서 hook의 저장값 초기화를 lazy initializer로 수정해 매 주행 갱신마다 localStorage를 다시 읽지 않게 했다. 브라우저 시험에서 초기화 이후 읽기 횟수가 늘지 않는 것을 확인했다.

## 공간 밀도

- 패널은 `fit-content`, 최대480px만 제한. 불필요한 최소 높이·고정 화면 채움 없음.
- **699×273 / 667×300 / 800×360 가로: 419×245px**, 내부 스크롤·글자/컨트롤 넘침·필드/요약 겹침 없음.
- 699×273에서 창이 차지하는 지도 면적 **53.8%**. 터치 표적 최소44×44px, 글자11px 이상 유지.
- 320×568은 세로 재배치. 최대값600/600초×30의 총시간610:00과 구성 막대도 경계를 넘지 않는다.
- 승인 참조 이미지, 실제 캡처, 크기 측정 JSON: `evidence/custom-settings/`. 기존 증거 경로는 변경·덮어쓰기하지 않음. 보호 inline-history5장 SHA256 및 보호 flight JSON 해시 일치 확인.

## 검증

실행 폴더 `C:\20.HDev\boxcycle\apps\web`, 이번 개발 서버 `127.0.0.1:5027` 재사용. 기존 서버 종료 없음.

| 명령/범위 | 결과 |
|---|---|
| `node --experimental-strip-types --test scripts/ride-interval/ride-interval.test.ts` | **9/9 PASS**: 8종 모든 경계·최소/최대 반복·분 표시·잘못된 값·기존 루틴·지연 복귀 |
| `npx playwright test ride-interval-settings.spec.ts ride-interval.spec.ts ui-redesign-batch4.spec.ts --workers=1 --retries=0 --reporter=line` | **39/39 PASS**: 새 설정11·기존 인터벌6·설정/센서/프로필22 |
| `npx playwright test ride-interval-settings.spec.ts --grep '지도 가림' --workers=1 --retries=0 --reporter=line` | 최종 터치 높이 보정 후 **4/4 PASS**. 최소44px·패널치수·최대 입력값·지도 가림 검증 |
| `npm run test:quick` | **1393/1393 PASS**, Windows watchdog 포함, 제외3파일은 에뮬레이터/전체 하네스 |
| `node scripts/ride-verify/verify-selectors.mjs` | **19/19 PASS** |
| `npm run build` | **PASS**, TypeScript·Vite523 modules. 기존 큰 번들 경고 |
| 변경 파일 ESLint | **오류0**, 기존 App 의존성 경고7 |
| 루트 `npm run check:dep` · `git diff --check` | **PASS**, 방향 위반/순환0 |

첫 UI 실행37PASS/1FAIL은 검수용 시계의 `setState(value => value + now - previous)`가 나중 실행될 때 변경된 `previous`를 참조해 누락된 누적시간 때문이었다. 실제 주행 시계는 미수정. 프리뷰에서 delta를 먼저 값으로 고정하고, 같은45초 경계 assertion을 그대로 두고 재실행10/10→최종39/39PASS. 실패 증거는 `evidence/custom-settings/initial-timer-failure.md`.

기존 ui-800x360의 다른 화면 실패2건(시작 펄스 측정/결과글자10px)은 이전 결과에 보존, 이번 기능 시험과 혼합하지 않았다. 실센서·실 Firebase 새 루틴 주행은 자동화 범위 밖이며 미실행. 운영 실기기 확인은 후속.

## 배포·운영 확인

- 배포 실행 폴더: `C:\20.HDev\boxcycle\tmp\deploy-interval-settings-20261027`.
- `firebase deploy --only hosting --project boxcycle-dc2df --non-interactive` **exit0**. 웹 빌드52개 파일만 Hosting 반영. 커밋·푸시 없음.
- 운영 `https://boxcycle-dc2df.web.app/` **HTTP200**. 진입 자산5개 SHA256 모두 배포본과 일치.
- JS `index-BvJGMzAk.js`: `1bf14ab2733dd0f5735e1d48cacbe62455dbd6dbaa9a642978df622037656ccd`.
- CSS `index-DwbgfJ9I.css`: `c374e05c3cb0b797bafc4be6fc778f3a6eec8712ab428e526139666f5dcb5f10`.
- HEAD `4593d112` + 미커밋 제품 소스10개를 해시로 고정. `evidence/custom-settings/deploy-manifest.json`, `deploy-verification.json`. 이전18:44 배포 증거는 보존.

```powershell
cd C:\20.HDev\boxcycle
node document/ops/20261027-ride-interval/verify-deploy.mjs custom-settings
```

새로고침 → MENU → 주행 설정 → 운동 설정 → 프리셋 선택/직접 입력 → 설정 적용 → 인터벌 켜기 → 주행 시작.
