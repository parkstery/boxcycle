# 결과 — 순위 글자구름·인터벌60%·반복 도넛

2026-10-30 Codex 직접 구현·검수·캡처. 로컬 완료·미커밋·미푸시·미배포.

- LeaderboardGlance.css: 공통패널 배경/테두리 제거, 줄배경 없음. 남색 본문·자기순위만 코발트, 제목/이름/거리 글자에 다중 흰 text-shadow로 부드러운 구름 halo. 이름의 overflow영역에3px내부여유/상쇄margin을 주어 halo잘림완화. 열간·행간·행수·스크롤·입력로직 유지. 이름과거리 사이에 지도 그대로 보임. 순위접속초록점은 기존유지, 외곽검정선만 흰halo로 교체.
- RideIntervalHud: 흰 rgba(255,255,255,.6), 패널전체opacity1·본문남색, 준비/회복코발트·운동진한앰버·마무리초록·일시정지회청색. 이전70%불투명시안보다 투명도10%p추가. 픽셀필터/배경흐림 없이 지도를 더 드러냄.
- 이전 가로바는 반복수 진행이었다. 같은view.repeat/totalRepeats/phase를44×44 SVG 분할도넛에 사용, 미래/현재/끝난반복 구분. 시간진도로 의미변경하지 않음. 타이머옆 배치, 완료시제거. 남은시간/반복수/라운드/단계/일시정지·완료·코칭·진입계약 불변. SVG 접근성이름 기존반복정보·title반복진행.
- 고정57에 명시승인을 기록해 고정7/31의 어두운표면만 대체. 일반지도계기판·코칭·순위목록모달·앞선구름버튼/Trail작업 보존.

## 검증

실행폴더 `C:\20.HDev\boxcycle\apps\web`:

```powershell
npm run build
npx eslint src/components/ride/RideIntervalHud.tsx e2e/ride-interval.spec.ts
node scripts/ride-verify/verify-selectors.mjs
$env:RTW_DEV_PORT='5031'
$env:INTERVAL_EVIDENCE_DIR='C:\20.HDev\boxcycle\document\ops\20261030-cloud-rank-interval\evidence'
npx playwright test ride-interval.spec.ts --workers=1 --retries=0
```

PASS: build(TypeScript포함·기존큰번들경고), ESLint, 셀렉터21/21, e2e10/10, diff --check. 본문색/내순위번호색 보정후 영향4건 재실행4/4PASS·최종build/ESLintPASS. 기존동작6건:30초경계·일시정지60초freeze/재개·센서없음·완료후자유주행·INT일시정지변경시준비복원·가로3크기8화면비겹침/지도pointer통과. 신규4건:1000×455·800×360·699×273·667×300에서순위10행·공통/줄배경transparent·흰halo/남색파랑·인터벌background.6/opacity1/pointer-none·패널간비겹침·SVG5분할/접근성·warmup0/current3(완료2/현재1)/cooldown5·완료ring제거.

실제제품in-memory preview PNG 눈검수PASS: evidence/cloud-donut-1000.png·800/699/667 및 기존인터벌기하캡처. 운영Firebase·실폰/WebKit·실센서·실계정순위 미실행(UI표시만 수정·로직불변), ride-entry live 미실행(셀렉터21단계는PASS). 추가실패 없음.

## 확인

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npm run dev:localhost -- --port 5031
```

기존5031서버재사용. `http://127.0.0.1:5031/` 새로고침→인터벌켜고주행→왼쪽흰카드/도넛·오른쪽순위확인.
저장없는확인: `http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=glance-riding&interval&intervalMs=713000`.
