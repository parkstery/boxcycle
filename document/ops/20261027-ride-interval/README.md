# 인터벌 안내 — 시험 마무리 (2026-10-27)

상태: **준비·마무리 시간 직접 설정 및 주행 설정 폭 축소 Hosting 배포 완료(2026-10-27 21:16 KST).** [최신 결과](05-result-edge-times.md), [프리셋8종 구현](03-result-custom-settings.md). Cursor core/단위시험, Codex UI·감리·화면시험·배포. 커밋·푸시 없음. 아래 초기15분 루틴·실기기 확인·시안 기록은 당시 이력으로 보존한다.

## 구현 범위 (이번 단계)

고정 루틴 하나. 기본 끔. 주행 설정 스위치로 켠다.

- 준비 5분 → 운동 30초 / 회복 30초 ×5 → 마무리 5분. 총 15분.
- 주행 `accumulatedMs`를 공유한다. 독립 시계·속도·RPM으로 단계를 밀지 않는다.
- 주행 중 끄면 안내만 사라진다. 다시 켜면 준비부터.
- 선택(켜/끔)은 주행이 끝나도 유지한다. 새 주행은 준비부터.
- 완료 뒤에도 주행은 계속된다(자유 주행).
- 센서가 없어도 시간은 간다.

제품 코드는 기존 dirty(App / `useRideInterval` / `rideInterval` / HUD / 설정 스위치). 이번 Cursor 작업의 코드 변경은 아래만이다.

- `apps/web/e2e/ride-interval.spec.ts` — 주행 중 메뉴→설정 끄기/켜기, 종료 후 새 주행 준비 초기화
- `apps/web/scripts/ui-800x360/preview.tsx` — 켜진 동안만 경과, 종료 시 경과 0 (제품 `accumulatedMs` 리셋과 맞춤)
- `apps/web/dep-layers.json` — `ride/rideInterval.ts` 도메인 지정 (check:dep 미지정 1건)

운동 프리셋 5~10개, 고·저강도 시간·반복 수 사용자 지정은 구현하지 않았다.

## 사용 흐름

1. 주행 설정에서 인터벌 스위치를 켠다. 기본은 꺼짐.
2. 주행을 시작하면 상단 중앙에 단계·남은 시간·반복·현재 RPM이 겹친다. 기존 HUD·조작과 겹치지 않고 클릭을 받지 않는다.
3. 일시정지는 주행과 같이 멈춘다. 재개하면 이어서 간다.
4. 주행 중 Trail 메뉴 → 주행 설정에서 끄면 안내가 사라지고, 다시 켜면 준비 5:00부터다.
5. 15분이 끝나면 「자유 주행 계속」. 일시정지·종료는 그대로다.

## 시험 명령과 결과

실행 폴더: `C:\20.HDev\boxcycle\apps\web`  
서버: Supervisor 소유 `http://127.0.0.1:5027` (PID 27532, 재사용·종료하지 않음)  
다른 포트(3000 / 5000 / 5040)는 손대지 않음.

증거 경로는 기존 캡처를 덮지 않도록 이번 폴더 `evidence/rerun/` 아래만 썼다. 보호 PNG 5장 SHA256은 `recovery-git-matches.json`과 일치.

```
cd C:\20.HDev\boxcycle\apps\web
$base = "C:\20.HDev\boxcycle\document\ops\20261027-ride-interval\evidence"
$env:RTW_DEV_PORT = "5027"
$env:UI_REVALIDATION_EVIDENCE_DIR = "$base\rerun\ui-revalidation"
$env:ENTRY_CARD_HISTORY_EVIDENCE = "$base\rerun\entry-card-history"
$env:BATCH2_EVIDENCE_DIR = "$base\rerun\batch2"
$env:BATCH4_EVIDENCE_DIR = "$base\rerun\batch4"
$env:INTERVAL_EVIDENCE_DIR = "$base\rerun\interval"
```

| 시험 | 명령 | 결과 |
|---|---|---|
| 인터벌 e2e | `npx playwright test ride-interval.spec.ts --workers=1 --retries=0` | **6/6 PASS** (24.8s). 설정 기본 끔→시작 준비, 주행 중 끄기/켜기→준비, 종료→새 경로 확정→시작 준비 |
| 묶음4 | `npx playwright test ui-redesign-batch4.spec.ts --workers=1 --retries=0` | **21/21 PASS**. 스위치 개수 5(인터벌 포함) |
| ui-800x360 | `npx playwright test ui-800x360.spec.ts --workers=1 --retries=0` | **21 PASS / 2 FAIL**. 캡처 경로 실패(c)는 새 증거 폴더에서 재현되지 않음 |
| watchdog | `node --test scripts/e2e/e2e-deadline-watchdog.test.mjs` | **4/4 PASS** (이번 단독). 이전 quick 1384/3 FAIL은 전체 quick 미반복 |
| 타입 | `npx tsc -b --noEmit` | exit 0 |
| lint | 변경 파일 eslint | 오류 0, App 기존 경고 7 |
| 의존 | 루트 `npm run check:dep` | `rideInterval.ts` 지정 후 PASS |
| diff | `git diff --check` | exit 0 |

로그: `evidence/logs/`. 캡처: `evidence/rerun/`.

## ui-800x360 실패 2건 (기대값 완화 없음)

**(a) 주행 시작 원 44px — 재현.**  
`시작·센서·접기는…` L189. Expected 44, received **47.74**. CSS `.ride-start-ready-pulse`가 `scale(1.1)` (지시90·91, `RideMediaButton.css`). 44×1.085≈47.74로 펄스 도중 측정과 맞다. assertion 변경 없음. 이번 인터벌 코드와 무관.

**(b) 결과 story-detail 11px — 이번 변경 무관.**  
Expected ≥11, received **10**. HEAD `77739223`(지시92) `RideSummarySheet.css` L765–766이 가로 판 미디어쿼리에서 이미 `font-size: 10px`. `git diff HEAD -- apps/web/src/components/ride/RideSummarySheet.css` 공백. 이번 작업 미수정. assertion 변경 없음.

**(c) 이전 증거 경로 쓰기 실패 — 이번 실행에서 소멸.**  
다섯 환경 변수를 `evidence/rerun/` 하위로 지정. inline-history 원본 5장 SHA256은 recovery JSON과 동일.

## 제한

- 프리뷰 시험이다. 실 Firebase·실센서 주행 e2e는 이 범위 밖.
- Trail 메뉴는 HUD가 포인터를 가로채므로 기존 계약대로 focus+Enter로 연다.
- 종료 후 시작 버튼은 `RideControlBar`가 같은 경로 토큰을 끝난 것으로 보아, 기존 `검수용 새 경로 확정` 버튼이 필요하다.
- 기존 dirty·타인 변경·기존 증거 PNG는 되돌리지 않았다. 커밋·푸시·배포 없음.
- 전체 `test:quick` 반복은 지시대로 하지 않음.

## 후속 확장 보류

Chief 지시: 테스트 후 미래 방향이며 이번에 구현하지 않는다.

- 운동 프리셋 5~10개
- 고강도/저강도 시간과 반복 수 사용자 지정

확인 주소: `http://127.0.0.1:5027/scripts/ui-800x360/preview.html?state=settings` → 인터벌 켜기 → 닫기 → 주행 시작. 주행 중은 `?state=riding&interval&intervalMs=443000`.

## 배포 — Chief 승인 후 2026-10-27 18:44 KST

- 승인: 「구현되고 나면 배포해 줘」. 실행·운영 대조 Codex 직접.
- 최종 `npm run build` PASS. 루트 HEAD `4593d112`와 미커밋 인터벌 제품 소스8개의 SHA256을 manifest로 고정했다.
- 배포 폴더 `C:\20.HDev\boxcycle\tmp\deploy-interval-20261027`에는 웹 빌드52개 파일과 Hosting 설정만 복사했다. 소스·설정·기존 dirty는 그대로 보존.
- 위 폴더에서 `firebase deploy --only hosting --project boxcycle-dc2df --non-interactive` exit0. 함수·Rules 변경 없음.
- 운영 `https://boxcycle-dc2df.web.app/` HTTP200. 메인JS `index-Cu0Io9Jq.js`, CSS `index-BPVLCLKE.css`를 포함해 HTML 진입 자산5개 SHA256 모두 로컬 배포본과 일치.
- 증거: `evidence/deploy-manifest.json`, `evidence/deploy-verification.json`. 커밋·푸시 없음.

운영 확인 순서: 새로고침 → MENU → 주행 설정 → 인터벌 켜기 → 주행 시작. 실센서·실운동 확인과 이후 프리셋/사용자 지정 확장은 별도 후속이다.

```powershell
cd C:\20.HDev\boxcycle
node document/ops/20261027-ride-interval/verify-deploy.mjs
```

## Chief 실기기 확인 — 2026-10-27

Chief: 「인터벌 준비에서부터 완료까지 시간 순서대로 데이터를 캡쳐했다. 작동은 문제없이 진행되고 있다.」 이를 해당 기기에서의 기능 확인으로 기록한다. 프리셋/사용자 지정 구현 지시로 해석하지 않는다.

동일 운영 빌드 `Cu0Io9Jq`, Android Chrome/Adreno730, 화면 내부699×273, 라이더3명. 첨부 원문4건은 `evidence/field-test/11111.txt`, `33333.txt`, `44444.txt`, `55555.txt`로 원문 복사했다. 22222는 사용자 메시지 본문에서 필요한 수치를 추출했고, 5건 요약은 같은 폴더 `summary.json`에 저장했다. 원문4건 SHA256 포함.

| 순서 | KST | FPS | p95 / p99 (ms) | 50ms 초과 | zoom |
|---|---|---|---|---|---|
| 11111 | 19:14:14 | 51.9 | 33.4 / 50.0 | 0.39% | 15.70 |
| 22222 | 19:17:01 | 54.1 | 33.3 / 50.0 | 0.55% | 15.70 |
| 33333 | 19:26:45 | 31.8 | 66.7 / 100.0 | 8.52% | 20.90 |
| 44444 | 19:32:12 | 46.3 | 33.4 / 50.0 | 0.87% | 20.90 |
| 55555 | 19:34:47 | 39.2 | 50.1 / 83.3 | 5.12% | 20.90 |

해석: 각10초 창에서 self/pacer 모두 reverseFrames0. 후기 캡처의 프레임 여유가 낮지만 zoom이15.70→20.90으로 바뀌어 동일 렌더링 조건 비교가 아니다. 수치상 지도 CPU 평균7.26~13.34ms, 틱2.52~4.77ms, 라이더0.26~0.91ms/프레임이며, 인터벌 추가가 저하 원인이라는 근거는 없다. GPU 타이밍 미지원이므로 waitMs를 GPU 시간으로 해석하지 않는다. React commits0도 계측 범위에서의 관측일 뿐 인터벌 렌더 비용0이라는 증거가 아니다.

범위: 전체 단계 진행 정상은 Chief 실기기 관찰로 확인했다. 이 성능 로그에는 인터벌 단계·남은시간 필드가 없어 구간별 정확한 전환 시각/오차를 로그만으로 검증하지는 못한다. 중간 전체 프레임을 기록한 연속 로그도 아니므로 각10초 창 밖의 상태를 단정하지 않는다. 이번 작업은 분석·문서/증거 보존만, 제품 수정·추가 시험·재배포 없음. 프리셋5~10종과 고/저강도 시간·반복 수 사용자 지정은 후속 확장 보류 상태 유지.

## 운동 설정 확장 시안 — Chief 후속 요청, 2026-10-27

실기기 확인 뒤 Chief가 확장의 설정 화면 시안을 요청했다. 아래는 제안이며 제품 구현 계약이나 배포 결과가 아니다.

- 한 화면 조절형(권장): 프리셋 선택 드롭다운 + 고강도 초/저강도 초/반복 수 입력을 한 화면에 배치.
- 프리셋 목록형: 8종 시간 조합을 한꺼번에 보고, 직접 설정 탭에서 숫자 입력.
- 공통: 준비·마무리 각5분 유지. 총시간 = 600초 + (고강도초 + 저강도초) × 반복 수. 고·저강도 누적시간/구성 막대 갱신. 설정 적용 후 기존 주행 설정의 인터벌 요약에 반영, 다시 변경 가능(시안 내 상태만).
- 8종 예시(고/저 초 ×횟수): 30/30×5, 30/60×5, 20/40×8, 40/20×8, 45/45×8, 60/60×5, 60/30×8, 90/60×6. 운동 효과·난이도를 보증하는 이름은 붙이지 않았다.
- 입력 범위5~600초/1~30회는 시안용 가정, 저장 위치·주행 도중 적용 정책·기존 루틴 마이그레이션·확정 범위는 아직 결정하지 않음.
- 시안: `C:\Users\kdrea\.codex\visualizations\2026\10\27\01a17c8e-ae6c-7f63-ac21-0997a910ddd8\spinatlas-workout-settings.html`.
- Codex 직접 작성/감리. Ego 선택·직접 입력·적용·입력오류 차단 PASS. 양안 736/699/667/320px 경계·겹침8/8 PASS. 가로 폭699에서 판 높이245px로 Chief 실기기 높이273px 안에 들어간다(포인터 기본 조건의 DOM 측정).
- 캡처 도구1회 시간초과로 스크린샷 미확보. 브라우저 taskSpace5 종료. 제품 코드·설정·운영 배포 변경 없음. 앱시험/빌드는 시안 전용이라 미실행.
