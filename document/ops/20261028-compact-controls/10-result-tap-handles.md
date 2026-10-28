# 10-result-tap-handles — 좌우 반달 탭 전용·위치 고정

상태: LOCAL_VERIFIED(관련 핸들) / 미배포. Cursor AI. 커밋·푸시·배포 없음. HANDOFF·README·고정 목록·다른 감리 문서는 수정하지 않음.

08 완료분(순위 440×236·반달 60%·설정 두 열·카메라 단일트리거)과 이번 탭/고정위치 변경을 섞지 않는다. baseline은 `evidence/tap-baseline.json/zip`.

## 요지

Chief 후속: 좌우 edge handle은 슬라이드가 아니라 탭/클릭/Enter/Space만으로 열고 닫는다. 왼쪽도 열린 뒤 화면 가장자리 같은 x/y를 유지하고 캐럿만 반전한다. 보이는 반달 20.4×43.2·터치 44×76·색상은 08 값을 유지했다.

1. **문서 capture 스와이프 제거** — `edgePanelDocumentGesture.ts` 삭제. 가장자리 20px·반달 끌기로 열고 닫기/손가락 추적 없음. 버튼 안 6px slop만으로 drag 뒤 click 토글을 막는다. document 전역 제스처는 추가하지 않음. 헤더 닫기 드래그(`usePanelHeaderCloseDrag`)는 유지.
2. **위치 고정** — 왼쪽 open의 `left: min(300px)` / `translateX(-100%)` 제거. 항상 `safe-area` 왼쪽 같은 자리, 열리면 `z-index: 51`로 메뉴·스크림 위. 오른쪽도 가장자리 고정·캐럿 반전.
3. **호출자 정리** — `App.tsx`·`preview.tsx`에서 `onDragProgress` / `menuReveal` 제거. `MenuPanel`의 `revealProgress` prop은 헤더 드래그용으로 남겨 두었고 이번 핸들은 넘기지 않음.

## 실측 (699×273, 제품 컴포넌트 preview)

| 항목 | 닫힘 | 열림 | 결과 |
|---|---|---|---|
| 왼쪽 탭 | x=0 y=98.5, 44×76 | x=0 y=98.5, 44×76 | 동일 |
| 왼쪽 반달 | x=0 y=114.9, 20.39×43.19 | 동일 | 60% 유지 |
| 왼쪽 캐럿 | `M2 1.5L5 5L2 8.5` | `M5 1.5L2 5L5 8.5` | 반전·복귀 |
| 왼쪽 hit-test | 반달 중심이 탭 | 메뉴 위에서도 탭 | `elementFromPoint` 탭 |
| 오른쪽 탭 | x=655 y=98.5, 44×76 | x=655 y=98.5, 44×76 | 동일 |
| 오른쪽 반달 | x=678.6 y=114.9, 20.39×43.19 | 동일 | 캐럿 반전 |

800×360 / 667×300도 탭 열고닫기·rect 동일·캐럿 반전 시험 PASS. 마우스 드래그·CDP 터치 드래그로 반달/빈 가장자리 끌기는 상태 불변. Enter·Space로 왼쪽 열고 닫기 PASS.

## 변경 파일

제품:

- `apps/web/src/components/ui/EdgePanelHandle.tsx` — 탭 전용, slop, `onDragProgress` 제거
- `apps/web/src/components/ui/EdgePanelHandle.css` — 열린 왼쪽 위치 이동 제거, z-index 51만
- `apps/web/src/components/ui/edgePanelDocumentGesture.ts` — 삭제
- `apps/web/src/components/ui/usePanelHeaderCloseDrag.ts` — 제스처 모듈만 쓰던 export를 파일 내부로(knip 증가 방지). 헤더 닫기 동작 유지
- `apps/web/src/App.tsx` — 핸들 드래그 콜백·`menuReveal` 제거

프리뷰·시험:

- `apps/web/scripts/ui-800x360/preview.tsx` — 같은 드래그 콜백 제거
- `apps/web/e2e/ui-800x360.spec.ts` — 스와이프 열림 기대를 탭 전용·드래그 불변으로 교정
- `apps/web/e2e/ride-ui-moments.spec.ts` — 좌우 스와이프 열림 기대 삭제, 클릭만 열림
- `apps/web/e2e/compact-controls.spec.ts` — 탭 열고닫기/위치/캐럿/hit-test/키보드/마우스·터치 드래그 보강
- `apps/web/e2e/ui-edge-live.spec.ts` — 에뮬레이터 전용, 스와이프 열기를 탭 클릭으로 교정(이번 실행은 skip)

카메라 계산·Functions·Rules·데이터·동행 변경 없음.

접힌 28×28 경로 › 버튼은 주소 카드가 아니므로 반달 겹침 검사에서 제외했다. 펼친 경로 카드·미니맵 겹침 검사는 유지. 800×360 주행에서 접힌 ›와 반달 손잡이가 약 4px 겹치는 것은 08 세로 중앙 배치의 기존 밀도이며 이번 탭 변경으로 위치를 옮기지 않았다.

## 검증

실행 폴더 `C:\20.HDev\boxcycle\apps\web`. 기존 5031 HTTP 200 재사용. `RTW_DEV_PORT=5031`, workers 1, retries 0. 새 증거만 `evidence/tap-handles/`. `UI_REVALIDATION_EVIDENCE_DIR`·`ENTRY_CARD_HISTORY_EVIDENCE` 미설정(기존 PNG 경로 출력 없음).

| 명령 | 결과 |
|---|---|
| `npx tsc -b --noEmit` | PASS |
| `npx eslint` EdgePanelHandle·App·preview·관련 spec | 오류 0. App 기존 hooks 경고 7 |
| `npx playwright test e2e/compact-controls.spec.ts e2e/ui-800x360.spec.ts e2e/ride-ui-moments.spec.ts` 1차 | **57 PASS / 2 FAIL** — 실패는 스와이프 열림·헤더 닫기 대기. 교정 후 해당 6시험 재실행 **6/6 PASS** |
| 같은 59시험 2차 | **57 PASS / 2 FAIL** — 실패는 카메라 699 `inside`·고정30 간격. 핸들/탭 신규 6 + 스와이프 교정 시험은 PASS |
| 카메라 699·고정30 단독 재실행 | 둘 다 FAIL. 카메라 메뉴 154×235, top=63.56 bottom=298.56 > vh 273. 고정30 `outer=2.69`(기대≥8). **이번 핸들 CSS/제스처와 무관**(CameraViewMenu·MapHud 미변경). 1차 59에서는 통과(메뉴 애니메이션 중 측정 가능) |
| `node scripts/ride-verify/verify-selectors.mjs` | **19/19 PASS** |
| `npm run build` | PASS (기존 큰 청크 경고만) |
| 루트 `node scripts/check-dep-direction.mjs --check` | PASS |
| 루트 `node scripts/check-code-tidy.mjs` | FAIL knip exports **188>186** — 08/착수와 동일. 제스처 삭제 직후 192까지 올랐다가 내부화로 188 복귀. 이번 증가 없음 |
| `git diff --check` 대상 | PASS (LF→CRLF 경고만) |

`test:quick` 미실행. ui-edge-live는 에뮬레이터 전용 skip. 실폰·실계정·실센서 미실행.

## 증거

절대 경로 `C:\20.HDev\boxcycle\document\ops\20261028-compact-controls\evidence\tap-handles\`

- `tap-closed-699x273.png` — 좌우 반달이 화면 가장자리
- `tap-left-open-699x273.png` — 메뉴 열린 뒤에도 왼쪽 반달이 왼쪽 끝, 캐럿 왼쪽
- `tap-right-open-699x273.png` — 순위 열린 뒤에도 오른쪽 반달이 오른쪽 끝, 캐럿 오른쪽

같은 폴더의 `rank-10`·`settings`·`camera-open` 등은 compact-controls 재실행 캡처이며 08 `evidence/rework/` 원본을 덮어쓰지 않았다.

## 한계

- 스마트폰 실기기 탭/슬라이드 체감은 미실행. 검증은 Playwright 마우스·CDP 터치.
- compact-controls 카메라 699 경계·고정30 8px 간격은 이번 승인 범위 밖. 제품 카메라/HUD를 맞추지 않음.
- 기존 dirty·08 PNG·다른 사람 변경은 보존. 커밋·푸시·배포·git restore/clean/stash/worktree 없음.

## 확인

```powershell
Set-Location 'C:\20.HDev\boxcycle\apps\web'
# 기존 서버가 있으면 재사용. 없으면:
npm run dev:localhost -- --port 5031
```

주소 `http://localhost:5031/` 새로고침 또는 `http://127.0.0.1:5031/scripts/ui-800x360/preview.html?state=ready`.

순서: 왼쪽 반달을 옆으로 끌어 메뉴가 안 열리는지 → 탭해서 열림 → 반달이 왼쪽 끝에 남고 캐럿만 뒤집히는지 → 다시 탭해 닫힘. 오른쪽 순번도 같음.
