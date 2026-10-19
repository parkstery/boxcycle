# 결과11 — 최초 위치 컨트롤 → 브라우저 허용 직접 연결

2026-10-17. 시작 main2 @ 0936cfe. 지시07~10과 다른 ops dirty 보존. GLM-5.3이 준비한 위치 결과 연결 위에 Codex가 최종 직접 교정했다. OpenCode에 최신 구현 재지시를 보내는 실행은 자동 승인 심사에서 외부 코드 전송에 대한 명시 승인 부족으로 거부됐다. 우회 전송하지 않았다. 종료 지시만 별도 전달했고 공식 `/api/session/{sessionID}/interrupt` 조회 응답 `interrupted:false` 및 해당 CLI exit0 중단 보고로 기존 작업 종료를 확인했다. 커밋·푸시·배포 없음.

## 최종 동작

- 최초 카드에 실제 `<geolocation lang="ko">`를 바로 렌더한다. 지원 브라우저의 실제 위치 사용 컨트롤 1클릭 → 브라우저 허용/거절 → 위치 결과 → 지도 이동. 앱 중간 질문·허용·취소 화면과 alert는 없다.
- native label은 브라우저가 제어하므로 「위치 사용」을 존중한다. 주변에 「내 위치 근처에서 시작」「(위치공유 필요)」를 표시하며 별도 클릭 영역이나 투명 덮개는 없다.
- 미지원 브라우저는 첫 현재 위치 버튼의 동기 callback에서 기존 getCurrentPosition을 1회 호출한다. 거절 시 선택 유지, 기본 위치는 명시 선택 시만 확정(기타 API 실패의 기존 fallback은 유지).
- 네이티브 `position.coords`의 유효 결과만 `acceptPosition` → hook → App의 bootFlyTarget으로 전달한다. 세션 비활성/이미 ready/다른 위치 요청 진행 중에는 받지 않는다. 요소 unmount 시 이벤트 구독을 해제한다. 네이티브 permissionStatus는 string으로 처리한다. 중간 동의용 cancelLocate API는 제거.

주요 파일: EntryLocationDialog.tsx/css, entryLocation.ts, useEntryLocation.ts, App.tsx의 onPosition 연결, identity 시험·DOM시험, entry-contract. 최종 제품 dialog는 73행으로 중간 state wrapper를 없앴다. 새 시험은 *.test.*이므로 도구등록 제외. 위치 저장·감시·전송 없음.

## 검증

실행 폴더 `C:\20.HDev\boxcycle\apps\web`.

| 명령 | exit | 결과 |
|---|---|---|
| `node --experimental-strip-types --import ./scripts/s42/register-vite-env.mjs --test scripts/identity/entry-location.test.ts scripts/map/map-boot-center.test.ts scripts/map/entry-location-camera.test.mjs` | 0 | 32 PASS |
| `node --test scripts/identity/entry-location-dom.test.mjs` | 0 | 실제 Edge155·React hook/dialog·native control·실제 브라우저 좌표→세션→실제 Mapbox 카메라 PASS. legacy 첫1클릭→요청1회→좌표 PASS |
| `node scripts/ride-verify/verify-selectors.mjs` | 0 | 19단계 PASS |
| `npx.cmd eslint src/components/auth/EntryLocationDialog.tsx src/hooks/useEntryLocation.ts src/lib/geo/entryLocation.ts scripts/identity/entry-location.test.ts scripts/identity/entry-location-dom.test.mjs scripts/ride-verify/entry-contract.mjs` | 0 | 오류·경고 없음 |
| `npm.cmd run build` | 0 | 타입/Vite PASS. 기존 큰 청크/SADDLE/PELVIS 경고 |
| `git diff --check` | 0 | 공백 오류 없음. LF→CRLF 안내만 있음 |

DOM시험은 API 위치 성공을 가짜 DOM event로 발생시키지 않는다. Edge context 권한을 허용하고 가상 서울(126.978,37.5665)을 지정한 뒤 실제 visible native 컨트롤을 클릭한다. 첫 화면에 native가 있고, 중간 질문이 없고, 위치 결과가 ready로 들어온 뒤 **실제 Mapbox GL 인스턴스**가 그 좌표·줌15로 도달하는지 검사한다. MapView 소스 AST에서 기존 두 부트 effect를 가져와 그대로 실행한다. 667×300/740×300에서 native isValid=true·rect 화면 내 확인. [최초 화면](evidence/11-direct-location-667x300.png).

한계: 전체 App 인증·실지도 타일·실기기 GPS·네이티브 권한창의 사람 허용 클릭 자동화는 미검증. 권한은 Playwright context에서 허용한 상태이며 허용창을 수동 선택한 것처럼 보고하지 않는다. Mapbox는 외부 타일 없는 단색 로컬 스타일·토큰 없음으로 카메라만 검사하며 인증 토큰 경고가 발생한다. 카메라 실제 도달 검사와 타일 성공은 구분한다. 최초 native 클릭에서 실제 차단 복구 dialog가 열린 것은 Chief 첨부 화면에서 확인한 기능이며 이번 자동 시험이 그 UI 선택을 대신하지 않는다.

중간 실패: 기존 OpenCode가 종료되기 전 옛 dialog를 덮어써 빌드/계약이 실패했다. 종료 확인 후 최종 dialog를 다시 적용하고 전부 재검증했다. fixture bare import/strict-mode callback 삽입 오류는 virtual module/ES module transpile로 교정. 화면 리사이즈 직후 native 임시 비활성 때문에 1회 timeout → 리사이즈 안정화 후 isValid를 다시 확인해 실제 1클릭 검증 PASS. 제품에 재클릭 우회/자동click은 추가하지 않았다.

## Chief 확인

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
npm.cmd run dev -- --host 127.0.0.1 --port 5014 --strictPort
```

http://localhost:5014 접속(이미 같은 폴더의 5180 서버 실행 중이면 그 화면 새로고침 가능) → 최초 위치 카드에서 파란 「위치 사용」 1클릭 → 브라우저 허용/차단 복구 창 → 「이 시간 허용」 → 현재 위치 확대. 중간 앱 공유 질문 화면이 나오면 실패. 앱 기본 위치는 별도 버튼으로 확인. 이미 위치 권한이 granted면 기존 정책대로 위치 조회·이동하고 재허용창을 요구하지 않는다.
