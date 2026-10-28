# 결과·검수 — 센서 없는 주행의 순위 임시 허용

2026-10-29 Codex. Chief가 boxcycle 프로젝트임을 확인한 뒤 구현. 로컬 검증 완료, 미커밋·미푸시·미배포.

## 동작

- 서버 단일 설정 `LEADERBOARD_SENSOR_ONLY = false`. 주행 거리·개척, 주·달·전체에서 기존 t1과 센서 없는 t0를 집계한다. 기간 내 기존 완료 기록도 다음 계산에 포함된다.
- 회원 조회·퍼블릭 소유자 조회도 같은 인정 조건을 사용한다. Guest는 기존처럼 예상 순위만 받는다.
- 미처리/알 수 없는 tier는 제외한다. 원본 기록·conquest 판정·유효 주행 기준·정복 인정량은 수정하지 않았다.
- 응답 `rule.sensorOnly`를 웹의 주행 중 추가 거리·결과 순위·순위 안내·센서 안내가 따른다. 응답 전에는 기존 제한을 유지한다.
- 캐시 버전2에 sensorOnly를 보존한다. 이전 버전/다른 조건 캐시는 즉시 재계산하므로 복구 시 t0 집계가 남지 않는다.
- 출시 전 서버 상수를 true로 바꾸고 getLeaderboard를 재배포한다. 원본 tier가 남아 있어 기록 변경/삭제 없이 t0가 다시 제외된다.

## 검증

실행 폴더 `C:\20.HDev\boxcycle` 기준:

| 명령/검증 | 결과 |
|---|---|
| `npm --prefix functions test` | 171 PASS, 0 FAIL (서버 TypeScript 포함) |
| 웹 `npx tsc -b --noEmit` | PASS |
| 웹 `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/ride-stats/leaderboard-live-rank.test.ts` | 8 PASS, 0 FAIL |
| 웹 `npm run build` | PASS, 기존 번들 크기 경고 |
| 변경 웹 5파일 eslint | 오류0, App 기존 hook 경고7 |
| 변경 서버 2파일 eslint | 오류0 |
| 실제 순위·센서 컴포넌트 SSR, 임시/출시 안내 각2개 | 4 PASS |
| `node scripts/check-dep-direction.mjs --check` | PASS |
| `node scripts/check-code-tidy.mjs` | PASS, exports186·types44 기준선 이내 |
| `git diff --check` | PASS |

초기 SSR 보조 실행은 esbuild 미설치로 실패, TypeScript 변환으로 전환 후 임시 require의 CSS 확장자 탐색 순서로 한 번 실패했다. 보조 실행기만 고친 뒤 위 4개 렌더가 통과했다. 제품 오류는 아니다.

실폰·실센서·실Firebase·에뮬레이터 통합·브라우저 레이아웃 검증은 미실행. CSS/위치/크기 변경은 없다. 서버 및 Hosting 배포 전이므로 운영 순위는 아직 기존 조건이다.

## 직접 확인

```powershell
Set-Location C:\20.HDev\boxcycle\functions
npm test
Set-Location C:\20.HDev\boxcycle\apps\web
node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/ride-stats/leaderboard-live-rank.test.ts
```

실제 화면은 getLeaderboard와 Hosting의 승인된 배포 후 `https://boxcycle-dc2df.web.app` 새로고침 → 회원 센서 없는 유효 주행 완료 → 캐시 갱신(최대5분) 뒤 순위/새로고침 유지 확인. 출시 전 같은 절차로 센서 없는 기록 제외·센서 기록 유지 확인.

## 보존

착수 전 RideSummarySheet·ui-redesign-batch3·공용 ops 색인·디자인 고정 문서와 미추적 산출물의 변경이 있었다. 해당 제품 파일은 수정하지 않았고 공용 ops 문서는 이번 항목만 추가했다. 커밋·푸시·배포 없음.
