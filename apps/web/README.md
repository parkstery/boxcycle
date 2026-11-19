# BOXCYCLE 웹 (`boxcycle-web`)

Vite + TypeScript + React 본 개발 앱입니다.

## 설치·실행 규칙 (혼동 방지)

- **의존성 설치:** 저장소 **루트**에서 `npm install` 한 번만 실행한다(npm **workspaces** — 루트 `package-lock.json`만 사용).
- **스크립트:** 루트에서 `npm run dev` / `npm run build` / `npm run lint` 를 쓰거나, 이 폴더에서 같은 명령을 써도 동일한 `boxcycle-web` 워크스페이스를 실행한다.
- **환경 변수:** `apps/web/.env.example` → `apps/web/.env` (Firebase 웹 SDK 값 등). 자세한 배경은 저장소 루트 [`README.md`](../../README.md) 를 본다.

**Cloud Functions**(`functions/`)는 별도 패키지이므로, Functions 쪽은 루트 README의 안내대로 `functions` 폴더에서 `npm install` 한다.

## 자동 시험의 Firebase 격리

`npm run test:e2e -- smoke`는 Auth·Firestore·RTDB·Functions 에뮬레이터를 실행한 뒤 별도 Vite 서버(기본 5002)로 시험한다. 기존 5000 개발 서버는 재사용하지 않는다. 에뮬레이터 설정이 없거나 포트가 맞지 않으면 직접 `playwright test`를 실행해도 spec import 전에 중단한다. 에뮬레이터가 꺼져 있으면 브라우저 실행 전에 중단하며 운영으로 폴백하지 않는다.

외부에서 에뮬레이터를 실행할 때에는 `firebase emulators:exec --only auth,firestore,database --project boxcycle-dc2df --config ../../firebase.json "playwright test ..."`로 실행한다. Functions를 사용하는 시험은 기존 `test:e2e:ride` 등의 래퍼를 사용한다. 브라우저 시험 서버에는 운영 Firebase/Functions/RTDB 연결을 허용하지 않는 CSP도 적용된다. 지도·날씨의 기존 시험 스텁/외부 호출 계약은 별개다. 일반 개발 서버와 제품 빌드에는 시험 CSP를 적용하지 않는다.
