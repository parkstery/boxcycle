# 감리01 — 카피·브랜드 화면 통과 / 셀렉터 재작업

| 항목 | 내용 |
|---|---|
| 문서 유형 | record — Supervisor 독립 감리 |
| 최초 작성 | 2026-10-18 |
| 상태 | REWORK_REQUIRED — [재지시02](02-task-02.md) |
| 독자 | chief · Developer |
| 연결 문서 | [지시01](02-task-01.md) · [묶음](README.md) |

## 판정

브랜드·A안 카피 구현과 화면 배치는 통과. 이전 소개 제목을 기대하는 셀렉터 계약은 이번 변경 때문에 실패하므로 합격 처리하지 않는다. 회전 안내의 `Spinatlas 는` 띄어쓰기도 재작업한다. Developer가 처음 언급한 '위치 작업 관련 실패'는 부정확하며 새 결과에서 정정하도록 지시했다.

## 실제 변경 검수

인트로 브랜드·두 줄 제목·정확한 부제·옛 영어 모토 제거, GuestEntryCard/AuthGateCard/MapHud/회전 안내/스타일 선택지·툴팁·HTML title의 브랜드 변경 확인. 사용하지 않는 인트로 영문 모토 CSS만 제거. 인증 콜백·지도/카메라·저장 키·프로젝트 ID 변경 없음. Ontology 브랜드 절·결정 로그 한 행·AGENTS/CLAUDE 현재 브랜드 설명 반영 확인. UI보다 Ontology를 먼저 수정하라는 순서 지시는 준수하지 않았지만 현재 산출물의 용어 정합은 맞는다.

실행 전 저장한 `.out/spinatlas-supervisor/before.patch`와 현재 diff를 메모리에서 대조했다. 기존 위치 관련 소스/시험 9개 파일의 미커밋 diff가 바이트 단위로 동일했다. 공용 entry-contract·ops 색인·결정 로그는 각 신규 행을 별도 검수한다. 다른 작업 변경을 커밋·푸시하지 않았다.

## Supervisor 독립 검증

| 검증 | 명령/방법 | 결과 |
|---|---|---|
| 빌드 | 루트 `npm run build` | 종료0, PASS. chunk 크기와 riderRig SADDLE/PELVIS export 경고는 범위 밖 |
| 전체 lint | 루트 `npm run lint` | 종료1, FAIL: 기존 ride-result 시험4파일의 오류16 / 경고40. 해당4파일 `git diff --exit-code -- <각파일>` 종료0, 이번 변경 없음 |
| 변경 소스 lint | apps/web에서 `npx --no-install eslint src/components/RotateOverlay.tsx src/components/auth/AppIntroScreen.tsx src/components/auth/AuthGateCard.tsx src/components/auth/GuestEntryCard.tsx src/components/map/MapViewSheet.tsx src/components/maphud/MapHud.tsx src/lib/map/rtwMapConfig.ts` | 종료0, 오류0 / MapViewSheet 기존 hook 경고1 |
| 진입 셀렉터 | 루트 `node apps/web/scripts/ride-verify/verify-selectors.mjs` | FAIL: app-intro `/달린 길이,/` 실종. 나머지18단계 통과 |
| 문서 | 루트 `node scripts/check-document-system.mjs` | 종료0, 현재225파일·깨진링크/구조오류0(감리 문서 추가 전 실행) |
| 공백 검사 | 루트 `git diff --check` | 종료0 |
| 실제 앱 UI | inline Node ESM + Vite createServer + Playwright msedge headless, 실제 `/` | 667×300,740×300,844×390,1366×768 PASS: title Spinatlas, 제목 두 줄, 가로 overflow 없음·CTA 44px·화면 내 접근 |
| 실제 컴포넌트 fixture | 같은 임시 Vite의 메모리 virtual module에서 원본 AppIntroScreen/MapHud를 직접 import | 인트로 두 CTA 각 콜백1회 PASS. HUD idle/ready-to-start/riding/paused의 메뉴 콜백1회, 브랜드와 주행 계기판 간격4.72px, overflow 없음 |

검증 코드는 파일·쿼리·제품 번들에 추가하지 않고 PowerShell here-string을 `node --input-type=module`에 전달해 메모리에서 실행했다. fixture 경로는 임시 서버가 닫히면 사라진다. [수치 JSON](evidence/supervisor-geometry.json), [전667](evidence/supervisor-before-667.png), [후667](evidence/supervisor-after-667.png), [후740](evidence/supervisor-after-740.png), [후844](evidence/supervisor-after-844.png), [후PC](evidence/supervisor-after-1366.png), [HUD 주행](evidence/supervisor-hud-riding.png)에 증거 보존.

지도 타일·Firestore 외부 요청은 검증 환경에서 실패했다. 이번 화면 검증은 텍스트·배치·콜백을 확인한 것이며 실지도 영상 품질/실OAuth/실주행/폰 실기기 검증을 주장하지 않는다. 지도 인스턴스·설정은 이번에 변경하지 않았다. Firebase 전제가 없는 실제 진입 e2e는 미실행. fixture 콜백은 인증 요청을 실행하지 않는다.

## 재현

실행 폴더: `C:\20.HDev\boxcycle`.

```powershell
Set-Location 'C:\20.HDev\boxcycle'
npm run dev -- --host 127.0.0.1 --port 5000
```

Vite가 안내하는 [로컬 주소](http://127.0.0.1:5000)를 새 브라우저 프로필/시크릿 창으로 열고 인트로의 Spinatlas·두 줄 제목·부제·게스트/로그인 버튼을 확인한다. 폰 가로667×300 등에서 잘림 확인. 기존 로그인 상태가 있으면 인트로가 생략될 수 있다. 커밋·push·배포 없음, Chief 화면 확인은 최종 감리 후.
