# 준비·마무리 시간 설정 / 주행 설정 폭 축소

2026-10-27 21:16 KST · **DEPLOYED / 운영 자산 대조 완료**

Chief 지시: 준비 운동·마무리 시간을 직접 조절하고 주행 설정 창의 불필요한 가로 길이를 줄인다. 기존 구현 후 배포 지시에 따라 이번 후속도 시험 후 Hosting 반영.

## 변경

- 운동 설정 오른쪽에 **준비·마무리(초)** 입력 추가. 각각 정수0~1800초, 0초이면 그 단계 건너뜀. 고/저강도·반복 입력과 같은 창에서 총시간·구성 막대에 반영.
- 총시간=`준비초+마무리초+(고강도초+저강도초)×반복 수`. 기본은 기존 각300초 유지. 8종 프리셋을 불러오면 준비·마무리도 각300초로 불러오고 이후 직접 조절 가능.
- `warmupSec`/`cooldownSec` optional 확장. 기존 v1 저장키와3필드 설정의 고/저강도·반복은 보존, 없는 새 시간만300초로 정규화. 새 적용 시5필드 모두 저장.
- 적용 전 초안 분리·취소·같은값 적용 시 운동 유지·변경 적용 시 처음부터 재시작·일시정지 동작 유지. 준비0초도 가능하므로 재시작 문구는 「처음부터」로 명확화.
- 오른쪽의 중복 요약을 두 입력칸으로 바꿔 운동 설정 창의 높이를 늘리지 않았다.
- **주행 설정 폭은520px 고정에서fit-content/최대360px로 축소.** 기존 표시·토글·운동 설정 진입·프로필 기능 보존. 프로필 등 다른 창의 고정 크기는 변경하지 않음.

## 역할·감리

Cursor: core·hook·단위시험3개 파일. 지시서 `04-cursor-warmup-task.md`.
Codex: 두 설정 UI·브라우저 시험·코드/캡처 감리·배포 및 운영 SHA256 대조.

699×273 실기기 근사 조건:

| 창 | 최종 rect | 확인 |
|---|---|---|
| 주행 설정 | **287×257px** | 가로 넘침0, 화면 경계 안. 내용 세로 스크롤은 낮은 화면에서 기존처럼 허용 |
| 인터벌 운동 설정 | **419×245px** | 종전과 동일 크기, 내부 스크롤0·영역 겹침0·터치44px 이상 |

699×273·667×300·800×360·320×568의 캡처/측정: `evidence/edge-times/`. 이전 단계 증거는 보존.

## 시험

실행 폴더 `C:\20.HDev\boxcycle\apps\web`, 기존 개발 서버5027 재사용.

| 명령/범위 | 결과 |
|---|---|
| `node --experimental-strip-types --test scripts/ride-interval/ride-interval.test.ts` | **12/12 PASS**. 기존9+시간합계/첫·마지막 경계/0초/legacy·invalid 검증3 |
| `npx playwright test ride-interval-settings.spec.ts ride-interval.spec.ts ui-redesign-batch4.spec.ts --workers=1 --retries=0 --reporter=line` | 최초 **41PASS/1FAIL**:667×300 주행 설정 열림 애니메이션 도중 경계 측정 |
| `npx playwright test ride-interval-settings.spec.ts --grep '지도 가림' --workers=1 --retries=0 --reporter=line` | 애니메이션 완료 대기 후 **4/4PASS**. 동일한 경계 기준 유지. **42개 고유 시나리오 최종 전부 통과** |
| 준비15초·마무리20초 / 7·11초×3회 | 저장·새로고침복원·총1:29·정확한 단계/완료 전환 PASS |
| 준비·마무리0초 | 총0:54·운동부터 시작·회복 후 바로 완료 PASS |
| 구3필드45/60초×6회 | 준비·마무리300초 복원, 고/저·반복 보존, 변경 저장/재복원 PASS |
| 입력/최대값 | 빈값·음수·1801·소수 차단, 양쪽1800초·600/600초×30 총660:00 PASS |
| `npm run test:quick` | **1396/1396 PASS**, 에뮬레이터/전체하네스3파일은 기존 제외 |
| `npm run build` / 변경TS ESLint | **PASS**, Vite523 modules. 기존 큰 번들 경고 |
| 진입 셀렉터 | **19/19 PASS** |
| 루트 `npm run check:dep` / `git diff --check` | **PASS**, 방향/순환0 |

애니메이션 중간 실패는 `evidence/edge-times/initial-parent-animation-failure.md`에 보존. 실제 UI 동작 오류가 아니라 translateY 열림 도중(180ms)의 위치를 읽은 시험 문제였다. `animation.finished` 후 엄격한 화면 경계 검사를 유지했다. 최초 check:dep는 웹 하위 폴더에 없는 script를 호출해 실패했으며 올바른 루트 명령에서 통과했다. 실센서·실 Firebase 새 시간 설정 주행은 자동화 범위 밖으로 미실행.

## 배포

- 배포 폴더 `C:\20.HDev\boxcycle\tmp\deploy-interval-edge-times-20261027`.
- `firebase deploy --only hosting --project boxcycle-dc2df --non-interactive` exit0. 웹52파일만 반영. 함수·Rules·커밋·푸시 변경 없음.
- 운영 `https://boxcycle-dc2df.web.app/` HTTP200, HTML 진입 자산5개 SHA256 모두 배포본과 일치.
- JS `index-CSTgMVw7.js`: `4ef69157f595e5b9a3b8dcd2853bee37954dde38da7b693f3a951743139db137`.
- CSS `index-BwNTbOpf.css`: `651199bbda8cab30f3c948ae89df0db1e93a57bfa843fd0248491c42761d3aec`.
- HEAD4593d112+미커밋 제품 소스11개 및 산출물52개 hash: `evidence/edge-times/deploy-manifest.json`; 대조: `deploy-verification.json`.
- 보호 inline-history PNG5장 원본 SHA256 모두 일치, 보호 flight JSON `4CAFA2A2…179F` 일치. 기존 dirty·증거·다른 서버 보존.

새로고침 → MENU → 주행 설정 → 운동 설정 → 준비·마무리(초) 입력 → 설정 적용.

```powershell
cd C:\20.HDev\boxcycle
node document/ops/20261027-ride-interval/verify-deploy.mjs edge-times
```
