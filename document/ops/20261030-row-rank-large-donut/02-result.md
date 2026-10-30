# 결과 — 순위 줄배경·고정크기 큰도넛·인터벌 글자 마스킹

2026-10-30. 구현은 Codex가 하던 중 한도로 멈춤 → Claude Code(Opus 5.5)가 이어받아 마무리·검증·캡처. 로컬 완료·미커밋·미푸시·미배포.

## 바뀐 것

- 순위(LeaderboardGlance.css): 글자구름(halo) 제거. 줄마다 글자높이(줄높이−3px) 흰 70% 띠, 내 줄은 옅은 파랑. 제목·하단 「N위까지」도 같은 띠. 공통 패널 배경·테두리 없음, 행간·행수·입력 통과 유지.
- 인터벌(RideIntervalHud.tsx/.css): 외곽 205×89.19px / 좁은 높이 150×86.59px 고정. 도넛 44→88px(오른쪽 세로 가운데), 중앙에 기존 반복수 「3 / 5」. 라운드 수는 2라운드 이상일 때만 머리줄에 표시(데이터 보존). 모든 글자에 흰 외곽. 다음 안내는 단어 단위로 줄바꿈(Claude Code 추가: 150px에서 「분」만 떨어지던 것 수정).
- 기능·단계 계산·순위 데이터 변경 없음. 고정58로 고정57 대체 기록.

## 검증

실행 폴더 `C:\20.HDev\boxcycle\apps\web`:

```powershell
npm run build
npx eslint src/components/ride/RideIntervalHud.tsx e2e/ride-interval.spec.ts
node scripts/ride-verify/verify-selectors.mjs
$env:RTW_DEV_PORT='5031'
npx playwright test ride-interval.spec.ts --workers=1 --retries=0
```

- PASS: build(기존 큰 번들 경고만), ESLint, 셀렉터 21/21, e2e 10/10, diff --check.
- 시험 갱신: 가로 4크기에서 줄 ::before 흰70%/내 줄 파랑·띠 높이<줄높이·글자 halo 없음, 인터벌 고정 크기·도넛 88px·패널 안·중앙 카운터 중심 오차<2px.
- 사보타주: 도넛을 44px로 되돌리면 시험 FAIL(Expected 88/Received 44) 확인 후 원복.
- 캡처 눈검수: evidence/row-donut-1000·800·699·667.png.
- 미실행: 실폰/WebKit·실센서·운영 순위 데이터(표시만 수정).

## 확인

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npm run dev:localhost -- --port 5031
```

브라우저 `http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=glance-riding&interval&intervalMs=713000` (이미 열려 있으면 새로고침).
