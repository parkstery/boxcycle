# 새로고침 후 마지막 주행 종료점 우선 — 2026-10-28

상태: LOCAL_VERIFIED / 미배포. Chief 직접 지시로 첫 지도 위치 우선순위를 변경한다. 위치 공유를 허용하지 않았더라도 최근 유효 주행의 실제 종료 좌표가 있으면 그곳을 표시한다. 주소 문자열로 위치를 추정하거나 계획 경로의 도착지를 실제 주행 종료점으로 대체하지 않는다.

## 원인·구현

기존 진입 위치 선택과 다음 주행 카드의 기록 해석은 분리돼 있어, 카드가 오사카를 안내해도 지도는 다른 진입 목적지나 기존 표시 위치에 남을 수 있었다. 첨부 화면의 대구 위치를 만든 구체적 브라우저 상태·권한은 실계정에서 재현하지 않았으며 위치 차단이 직접 원인이라고 확정하지 않는다.

- `useRecentRideSessions`가 현재 UID의 최초 서버 조회·로컬 병합 완료 여부를 제공한다. 기존 요청에 완료 상태만 추가하고 외부 API·쿼리·DB 저장 정책을 추가하지 않는다. 실패 시 기존 로컬 fallback 뒤 준비 완료 처리.
- App은 기존 `resolveNextRideView`를 `savedRoutes:[] / activeRouteId:null`로 사용하여 시간순 최신의 유효 실제 종료 좌표(`sessionEndLngLat`)를 선택한다. 폐기 주행·범위 밖 좌표 제외, 좌표 없는 legacy는 다음 유효 후보로 내려간다. 슬롯의 최대 진행률 재개점은 실제 종료 좌표와 별개라 사용하지 않는다.
- 기록 로드 완료 뒤 `useEntryLocation`에 목적지를 전달한다. 종료점이 있으면 위치 권한 조회·GPS 요청 없이 ready→기존 MapView 부트 이동으로 연결한다. 없으면 기존 현재 위치/기본 위치 선택 흐름. 초기 줌15 유지(직전 작업의 **주행 종료 시** 고도1,000m와 별개).
- 진입 때 한 번만 선택한다. 이후 새 기록 갱신은 사용자가 탐색 중인 지도 목적지를 덮지 않는다. UID 변경 중에는 이전 진입 목적지를 해제하고 현재 기록 완료를 기다린다. 카드 UI·주행 시작·데이터/Rules/동기화 불변. 다른 작업 dirty 보존.

## 검증 명령·결과

실행 폴더 `C:\20.HDev\boxcycle\apps\web`:

```powershell
cd C:\20.HDev\boxcycle\apps\web
node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/identity/last-ride-entry-dom.test.mjs scripts/identity/entry-location.test.ts scripts/map/entry-location-camera.test.mjs
node scripts/ride-verify/verify-selectors.mjs
npx eslint src/hooks/useEntryLocation.ts src/hooks/useRecentRideSessions.ts src/App.tsx
```

- 최종36PASS/0FAIL。 신규 실제React StrictMode/Mapbox 검증1개에3시나리오 포함: 권한차단+로컬대구/서버오사카, 권한허용+로컬없음/서버오사카, 좌표무효면기존choice. 실제 hooks·App목적지useMemo·실제MapView부트effect 사용, Firestore 응답만 mock. 699×273의 실제Mapbox 카메라가 대구→오사카 이동하는지 수치 확인. 기록대기중GPS0회·종료좌표있으면권한조회/GPS0회, 이후기록변경시초기목적지보존·UID전환대기/다른목적지준비 확인. 타일 없는 지도·Mapbox인증mock, 실개인지도/운영계정 재현은 아님.
- 기존 위치·카메라35PASS. 진입셀렉터19단계PASS. 변경 hook2개 eslint오류/경고0, App오류0/기존경고7.

실행 폴더 `C:\20.HDev\boxcycle`:

```powershell
cd C:\20.HDev\boxcycle
npm run build -w boxcycle-web
npm run check:dep
git diff --check -- apps/web/src/App.tsx apps/web/src/hooks/useEntryLocation.ts apps/web/src/hooks/useRecentRideSessions.ts apps/web/scripts/identity/last-ride-entry-dom.test.mjs apps/web/scripts/ride-verify/entry-contract.mjs
```

최종타입/Vite빌드PASS(기존큰청크경고), 의존방향위반0/순환0, diff검사PASS。

중간실패: 초기셀렉터는옛hook호출앵커로1FAIL→실제새호출계약반영후19PASS. 검증fixture effect추출때`use strict`가호출인자에섞여2회브라우저timeout·1회파싱assert실패→ESNext export형추출/파싱사전검사로교정. 최초ref렌더중갱신eslint1오류→선행effect갱신으로교정후0오류. 실제Mapbox초기추가시험은빈토큰오류로그를동반하며카메라검사는통과했으나, 최종은가짜토큰/인증mock으로교정해오류없이통과. 프로세스CIM진단은접근거부,관련시험프로세스는자체finally로종료. 검색경로/glob일부오류는실제경로로교정. 기존증거PNG/JSON변경없음.

전체quick·실Firebase진입e2e·실센서·실폰·실계정새로고침은미실행(이번범위는진입목적지선택,외부계정요청없이mock으로검증). 커밋/푸시/배포없음.

## Chief 확인 순서

```powershell
cd C:\20.HDev\boxcycle
npm run dev:localhost -- --port 5031
```

서버가 이미 있으면 재사용. `http://localhost:5031/`에서 최근 오사카 주행이 있는 계정으로 새로고침→기록로딩완료→위치권한차단상태에서도오사카실제종료점으로이동→다음주행안내확인. 유효기록이없으면기존위치선택화면. 운영반영없음.
