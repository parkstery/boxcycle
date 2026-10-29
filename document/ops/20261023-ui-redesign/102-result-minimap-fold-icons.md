# 미니맵 접기·펼치기 표시 — 결과

2026-10-29 Codex 직접, **LOCAL_VERIFIED·미배포**. [지시101](101-task-minimap-fold-icons.md).

`RouteOverviewFoldToggle.tsx`: map 종류는 접힘=지도만, 펼침=캐럿만 조건부 렌더링. 단독 SVG 도안을 버튼 중앙에 맞췄다. RouteDock 경로 도안/캐럿·28×28px 외형·aria-expanded/controls·독립 토글 콜백은 유지한다.

검증 실행 폴더 `C:\20.HDev\boxcycle\apps\web`:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
$env:RTW_DEV_PORT='5031'
npx playwright test address-minimap-width.spec.ts --workers=1 --retries=0 --reporter=line --global-timeout=90000
npx eslint src/components/route-dock/RouteOverviewFoldToggle.tsx e2e/address-minimap-width.spec.ts
npm run build
```

- PASS: 기존 패널 폭/독립 접힘 계약2건(19.7초), 변경 eslint 오류0, build(TypeScript 포함·기존 chunk 경고).
- PASS: 가로800×360/736×300/699×273/667×300 × 주행/일시정지 × 펼침/접힘16상태. 상태별 도안 하나·28×28px·가로 중심 오차0.1px 이하·화면 경계·왕복 전환.
- [측정](evidence/minimap-fold-icons-20261029/qa.json) · [펼침](evidence/minimap-fold-icons-20261029/expanded-667x300.png) · [접힘](evidence/minimap-fold-icons-20261029/collapsed-667x300.png). 새 경로에 headless 캡처·직접 눈검수 PASS. 직전 작업 Ego 캡처 timeout 이력에 따라 기존 headless 검증 경로 사용.
- 실폰·실센서·실Firebase 미실행(표시 변경). 전체quick·서버 시험은 범위 밖으로 생략. 실패 시험 없음. 기존5031서버·다른 작업 변경/증거 보존, 커밋·푸시·배포 없음.
- 루트 `C:\20.HDev\boxcycle`의 `node scripts/check-document-system.mjs` PASS(433파일·링크/구조 오류0), `git diff --check` PASS(기존 Windows 줄끝 변환 안내만 출력).

직접 확인:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npm run dev:localhost -- --port 5031
```

서버가 있으면 재사용. http://localhost:5031/ 새로고침 → 주행 → 미니맵 펼침에서 캐럿만 → 접으면 지도만 → 다시 누르면 복원. 인증 없이 실제 UI만 볼 때는 http://localhost:5031/scripts/ui-800x360/preview.html?state=riding .
