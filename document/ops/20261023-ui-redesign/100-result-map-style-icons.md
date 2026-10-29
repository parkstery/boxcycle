# 지도 스타일 버튼 아이콘 — 결과·검수

2026-10-29 Codex 직접. **LOCAL_VERIFIED·미커밋·미푸시·미배포.** [지시99](99-task-map-style-icons.md).

## 변경

- MapHud의 위성/야외 텍스트를 현재 스타일을 나타내는 인공위성/접힌 지도 SVG로 교체. 20×20px·기존 버튼 색/컨테이너 사용.
- `styleLabel` 기반 표시만 변경. App의 실제 지도 스타일 전환·카메라2~6 야외 잠금·주행/일시정지 표시·줌·aria-label/tooltip은 유지한다. 장식 SVG는 aria-hidden.
- 기존 프리뷰의 noop 토글을 메모리 내 두 상태 전환으로 바꿔 두 아이콘을 직접 확인할 수 있게 했다. 실제 지도/인증/서버 기록 쓰기 없음.
- 기존 ui-800x360 조작 계약에 텍스트 없음·SVG·왕복 전환을 반영했다. minimap-map-shots의 텍스트 판별은 아이콘 상태 판별로 변경.
- Chief 고정52·결정로그·상태보드·공용 창구 갱신. 기존 타 작업 변경/증거·서버 보존.

## 검증

실행 폴더: `C:\20.HDev\boxcycle\apps\web`.

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npx tsc -b --noEmit
npx eslint src/components/maphud/MapHud.tsx scripts/ui-800x360/preview.tsx e2e/ui-800x360.spec.ts e2e/minimap-map-shots.spec.ts
$env:RTW_DEV_PORT='5031'
npx playwright test ui-800x360.spec.ts --grep '준비·일시정지 조작부와 순위 칩' --workers=1 --retries=0 --reporter=line --global-timeout=90000
npm run build
```

- PASS: TypeScript, 변경4파일 eslint 오류0, 기존 화면 계약1건(17.1초), build(TypeScript 포함). 기존 번들 크기 경고 유지.
- Ego space12: 800×360/736×300/699×273/667×300 × 준비/주행/일시정지 12상태에서 아이콘·왕복 전환·화면 경계·줌 버튼 비겹침 PASS.
- Ego `Page.captureScreenshot`는 CDP timeout으로 실패. headless Chromium으로 캡처 경로를 전환해 같은12상태 재검 PASS·두 아이콘 캡처 눈검수 PASS. space12 종료 완료.
- [측정JSON](evidence/map-style-icons-20261029/qa.json), [위성800×360](evidence/map-style-icons-20261029/satellite-800x360.png), [지도800×360](evidence/map-style-icons-20261029/map-800x360.png), [지도667×300](evidence/map-style-icons-20261029/map-667x300.png). 이번 새 경로에만 저장.
- 최초5031 서버 기동은 이미 점유 중이라 실패했고 기존 서버를 재사용했다. 기존 서버 종료/교체 없음. 프리뷰 수정 패치의 첫 문맥 불일치는 변경 없이 실패·정확한 문자열로 재적용했다.
- 실폰·실Firebase 지도 전환·실센서 미실행. 기존 App 토글/잠금 로직은 변경하지 않았다. 전체quick·서버시험은 표시 변경 범위라 재실행하지 않았다. minimap 실지도 캡처 묶음은 미실행(인증/실지도 의존).

루트 `C:\20.HDev\boxcycle` 최종 검사: `node scripts/check-document-system.mjs` PASS(431파일·brokenLinks0·structuralErrors0), `node scripts/check-dep-direction.mjs --check` PASS(방향위반0·순환0), `node scripts/check-code-tidy.mjs` PASS(exports186·types44·반복18줄), `git diff --check` PASS.

## 직접 확인

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npm run dev:localhost -- --port 5031
```

이미 서버가 있으면 재사용. http://localhost:5031/ 새로고침 → 오른쪽 위 위성/지도 아이콘 클릭 → 스타일 전환 확인. 주행·일시정지에서도 보이고 카메라2~6에서는 기존대로 야외 지도 잠금.

인증 없이 UI만 보려면 http://localhost:5031/scripts/ui-800x360/preview.html?state=riding → 오른쪽 위 아이콘 클릭. 이 프리뷰는 실제 지도/카메라 스타일 잠금 검증이 아닌 두 SVG 표시·콜백 확인용이다.
