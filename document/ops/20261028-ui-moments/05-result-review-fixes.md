# 05-result-review-fixes

Cursor. 2026-10-28. `04-task-review-fixes.md` + `03-review-notes.md`. 1차 구현 보존, 커밋·푸시·배포 없음.

## 수정

1. **순위판** — `.lb-glance__panel`을 우상단 조작(2.79rem+간격) 아래, 주행제어·시계 위로 고정. 740×560 이하에서는 TR 2행(7.25rem) 아래, 목록만 스크롤. `top: pad+8px` 제거. e2e가 펼친 판 vs 맵제어·카메라·계정·일시정지·종료 rect를 비교.
2. **응원 실행 단위** — idle→running 또는 `ended` 잔존 시 메모리 초기화(pause→running은 유지). 지난 종료 payload는 재생하지 않음. pause는 warnedStep 보존. 큰 점프는 절반/경유/완료/예고를 소비만 하고 재생하지 않음. complete→다음 단계 또는 `intervalRunKey`(useRideInterval `runKey`)로 같은 주행 재시작. 준비 0초는 실제 첫 구간 문구. 표시 중 낮은 우선순위는 덮지 않음. 훅 deps는 필드 분해, pause/idle/언마운트에서 timeout·효과음 취소.
3. **효과음** — AudioContext 생성 try/catch. `cancelRideMomentSound` generation으로 느린 resume·옛 oscillator 취소. TTS 중 재생 안 함, 기본 끔 유지.
4. **설정** — 접힌 화면에 준비/고저×반복/마무리·라운드/사이휴식 한 줄. 펼치면 이 요약 없음(총시간만). 부분주행 진행 막대는 유지, 완주는 `variant=completed` fixture.

## 검증

| 명령 | 결과 |
|---|---|
| `cd C:\20.HDev\boxcycle`; `node --experimental-strip-types document/ops/20261028-ui-moments/review-probes.ts` | **7/7 PASS** (프로브 파일 미수정) |
| `cd apps/web`; `node --test --experimental-strip-types scripts/ride-interval/ride-moments.test.ts scripts/ride-interval/ride-moments-lifecycle.test.ts scripts/ride-interval/ride-moment-sound.test.ts` | **14/14 PASS** (원본 함수 import. run key·느린 resume 별도 추가) |
| `npx playwright test e2e/ride-ui-moments.spec.ts --grep "HUD 50%"` (RTW_DEV_PORT=5031) | **4/4 PASS** 800×360·736×360·699×273·667×300 |
| `npx tsc -b --noEmit` | PASS |
| eslint 변경 TS | 오류 0 |
| `verify-selectors.mjs` | 19/19 |
| `node scripts/check-dep-direction.mjs --check` (저장소 루트) | PASS |
| `npm run build` | PASS vite 1.92s |
| `npm run test:quick` | **1433 PASS / 0 FAIL** (ride-moments 신규 파일 자동 수집) |

구형 `ui-800x360` 스토리 10px·에지 클릭/히트 3건과 설정 e2e 잔여는 이번 4크기 프로브 우선 뒤에 남아 있을 수 있음. 새 승인과 직접 충돌하는 기대만 1차에서 일부 수정.

## 캡처

`document/ops/20261028-ui-moments/evidence/riding-{800x360,736x360,699x273,667x300}.png` (4크기 재촬영). `supervisor-initial-riding-800x360.png` 등 기존 감리 증거는 덮지 않음.

## 남은 위험

실폰·실센서·실제 TTS/효과음 청취 없음. 740px 이하에서 순위판 높이가 컨트롤·종료 버튼 사이에 짧아 목록 스크롤에 의존. 인터벌 runKey는 로컬 훅 값이며 DB 필드 없음. 5031 재사용, 3000 미변경.
