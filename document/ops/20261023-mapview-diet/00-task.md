# 맵 뷰 다이어트 — 지시서 (2026-10-23)

chief 결정: 맵 뷰 시트에서 중복이거나 쓰지 않는 컨트롤을 없앤다. 이후 순위 칩·순위판(A+C) 구현의 앞 단계.

## 없앨 것

1. **Spinatlas Dark 지도 스타일 전체.** 실제로 쓴 적이 없다.
   - `src/lib/map/rtwMapConfig.ts`
     - `MAP_STYLE_OPTIONS`에서 Dark 항목을 빼고 Outdoors·Satellite 두 개만 남긴다. 인덱스로 꺼내는 `MAP_STYLE_OPTIONS[1]`/`[2]`는 이름 있는 상수로 바꾼다.
     - Dark 전용 코드인 `RTW_MAP_STYLE_URL`, `applyRtwLayerStyle`, 그에 딸린 스냅샷·POI 처리는 다른 곳에서 안 쓰면 지운다.
     - `mapStyleHudShortLabel`의 「다크」 분기와 `nextOutdoorsSatelliteMapStyle` 주석의 Dark 언급을 정리한다.
   - `src/components/map/MapView.tsx`: 「RTW 다크 스타일 한정」 effect를 지운다(2439행 근처, `applyRtwLayerStyle` 호출). `resetRtwStyleSnapshot`도 Dark 전용이면 함께 지운다.
   - **「장소 이름」 체크박스(`showRtwPoi`)도 지운다.** Dark 스타일에서만 동작하므로 Dark를 빼면 아무 일도 하지 않는다. `useAppMapCameraState.ts`·`App.tsx`·`MapView.tsx`·`MapViewSheet.tsx`의 prop·state를 모두 지운다.
   - 저장된 값 방어: 예전에 Dark를 고른 상태가 어딘가 저장돼 있다가 다시 들어오면 `DEFAULT_MAP_STYLE`(Outdoors)로 돌린다. 저장 위치를 grep 으로 확인하고, 저장하지 않으면 「저장 안 함」이라고 보고에 적는다.
2. **맵 뷰 시트의 「지도」 줄 스타일 칩 3개**(Spinatlas Dark / 야외 / 위성). 화면 오른쪽 위 「위성/야외」 토글이 같은 일을 한다. **「3D 뷰」 체크박스는 남긴다.** 「지도」 줄에 3D 뷰만 남는다.
3. **맵 뷰 시트의 「시점」 줄**(자유·유지·상공·북향·전방·후방·좌측·우측). 화면의 카메라 버튼이 맡는다. `followMode` 상태와 화면 카메라 버튼 동작은 그대로 둔다. 시트의 버튼과 시트로 넘기던 prop만 지운다.
4. **맵 뷰 시트의 「줌」 줄**(− 숫자 + 슬라이더). 화면 오른쪽 위 + − 가 맡는다. `mapZoom` 상태 자체와 화면 줌 버튼은 그대로 둔다.

## 남길 것 (건드리지 않음)

- 「내 도로망」(전체 도로망 / 신규 도로만)
- 「3D 뷰」
- 「고급 설정」 안의 「노선」(끔 / 도로 비교)
- 「고급 설정」 안의 주행 중 카메라 거리 조절
- 화면 위 위성/야외 토글, 줌 + −, 카메라 버튼

## 함께 고칠 시험·하네스

- `scripts/ui-800x360/preview.tsx` 107행의 `MapViewSheet` props를 새 props 에 맞춘다.
- 맵 뷰 시트의 스타일 칩·시점·줌·장소 이름을 찾는 시험이 있으면 고친다. 다음을 먼저 grep 할 것: `e2e/ui-800x360.spec.ts`, `e2e/ui-edge-live.spec.ts`, `e2e/camera-*.spec.ts`, `e2e/u5-*.spec.ts`, `e2e/peer-sync-*.spec.ts`, `scripts/**/*.test.ts`.
  - 시험이 시트의 「시점」 버튼으로 카메라를 바꾸고 있었다면, 같은 상태를 만드는 다른 길(화면 카메라 버튼 등)로 바꾼다.
  - 바꿀 길이 없으면 시험을 지우지 말고 보고에 적는다.
- 지운 것을 찾는 계약 시험(소스 문자열 검사)이 있으면 새 구조에 맞춘다. **검사를 느슨하게 만들어 통과시키지 말 것.**

## 금지

- `git worktree`·`git restore`·`git clean`·`git stash`·브랜치 전환 금지. 커밋·푸시 금지. 감리가 확인 후 커밋한다.
- localhost:3000 서버는 건드리지 않는다.
- 요청 범위 밖 리팩토링 금지.

## 검증 (apps/web 폴더)

```
npx tsc -b --noEmit
npx eslint <바꾼 파일들>
npm run test:quick
node ../../scripts/check-code-tidy.mjs        # 루트 기준. 안 쓰는 export 가 늘면 안 된다(줄어야 정상)
RTW_DEV_PORT=5016 npx playwright test ui-800x360 --workers=1 --retries=0
```

- `ui-800x360.spec.ts:84`(「시작·센서·접기…」)는 예전부터 실패하던 시험이다. 그 외 새 실패는 0이어야 한다.
- 맵 뷰 시트 캡처 한 장을 `C:\20.HDev\boxcycle\.out\mapview-diet-after.png` 로 남긴다. preview 하네스 `?state=map` 이면 충분하다.

## 보고

`document/ops/20261023-mapview-diet/03-result.md`에 다음을 적는다.
- 지운 파일·함수·prop 목록
- 고친 시험 목록
- 검증 결과 숫자(tsc, test:quick 통과 수, tidy 수치 전→후, e2e 결과)
- 저장된 Dark 값 처리 방법
