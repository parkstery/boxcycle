# 결과15b — 두 줄 위치 버튼

2026-10-18 Developer Cursor. 지시15b의 두 파일만 수정했다. 커밋·푸시·배포 없음. CSS·환경파일·키는 열지 않았다. 기존 dirty는 유지했다.

## 수정

`apps/web/src/components/auth/EntryLocationDialog.tsx`

- `NativeControl` 타입과 `NativeLocationControl` 함수를 삭제했다. `createElement`·`useEffect`·`useState`·`isUsableLngLat` import도 삭제했다.
- `native` 변수와 함수 인자의 `onPosition`만 뺐다. `EntryLocationDialogProps.onPosition`은 호출부 호환을 위해 타입에 남겼다.
- `phase === "choice"`이면 일반 primary 버튼을 항상 표시한다. 첫 줄은 `CURRENT_LABEL`(`내 위치 근처에서 시작`), 둘째 줄은 `span.entry-location__button-hint`의 `CURRENT_HINT`(`(위치공유 필요)`). 힌트의 `display: block`은 기존 CSS라 버튼 안에서 두 줄이 된다. 버튼 밖에 같은 문구를 두지 않았다.
- `onClick={onChooseCurrent}`·`onClick={onChooseRome}` 연결은 그대로다.
- `choice`이고 `permission === "denied"`일 때 상태 문구는 `위치가 차단되어 있습니다. 브라우저 사이트 설정에서 위치를 허용한 뒤 다시 시도해 주세요.`

`apps/web/scripts/ride-verify/entry-contract.mjs`

- `최초 native` 정규식만 `/createElement\("geolocation"/`에서 `/onClick=\{onChooseCurrent\}/`로 바꿨다. 같은 단계의 다른 앵커는 그대로다.

CSS는 수정하지 않았다. `.entry-location__button`·`.entry-location__button--primary`의 파란 테두리(`#2563eb`)는 이전 작업 상태 그대로다.

## 일반 위치 API와 기존 차단

이번에 지운 네이티브 `<geolocation>` 컨트롤 대신, 버튼은 기존 `onChooseCurrent`로 브라우저 일반 위치 API를 호출한다. 일반 위치 API는 한 번 거부·차단된 권한을 페이지 버튼만으로 다시 묻지 못한다. 이미 차단된 경우에는 브라우저 사이트 설정에서 위치를 허용한 뒤 같은 버튼을 다시 눌러야 한다. denied 문구는 그 차이를 적는다.

## 검증

작업 디렉터리 `C:\20.HDev\boxcycle\apps\web`에서 실행:

```
node scripts/ride-verify/verify-selectors.mjs
```

exit 1. `location-choice`만 실패. 앵커 실종: `위치 결과` `/onPosition\(coords.longitude, coords.latitude\)/`. 이 문자열은 삭제한 `NativeLocationControl` 안에만 있었다. 지시는 `최초 native` 정규식만 바꾸라고 해서 그 앵커는 그대로 두었고, 그래서 계약 검사가 깨진다. 나머지 단계는 통과했다. `최초 native`와 `legacy 직접 요청`은 이제 같은 `onClick={onChooseCurrent}` 정규식이다.

`git diff --check`는 이번 두 파일에 대해 exit 0. 타입·lint·브라우저 확인은 지시대로 하지 않았다. Supervisor 몫이다.

## Git

- branch: `main2`
- HEAD: `0936cfe910c4a826c9b829a529478a2f9950d5f2`
- 커밋·푸시·배포 없음
