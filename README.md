# BOXCYCLE

문서 작성은 [`document/260509-BOXCYCLE-문서-생성-및-수정-지침.md`](document/260509-BOXCYCLE-문서-생성-및-수정-지침.md)를 따른다. **분류별 전체 목록**은 [`document/README.md`](document/README.md)를 본다.

**현재 단계·범위·스택·1차 마일스톤(멀티 유저 검증)** 의 단일 진실은 [`document/260509-BOXCYCLE-현재단계-범위-스택-및-1차마일스톤.md`](document/260509-BOXCYCLE-현재단계-범위-스택-및-1차마일스톤.md)를 본다.

**서비스 비전·UGC 정책·저장 전략(장기)** 의 단일 진실은 [`document/260511-RTW-마스터-비전-및-종합계획.md`](document/260511-RTW-마스터-비전-및-종합계획.md)를 본다.

Mapbox 기반 **실내 사이클** 서비스입니다. Mapbox 시뮬 검증은 완료되었으며, 본 개발 앱은 **`apps/web`** (Vite + TypeScript + React + Firebase Auth) 에서 진행한다.

## 본 개발 웹 앱 (`apps/web`)

웹 UI·지도·인증·로비는 **`apps/web`** 패키지(`boxcycle-web`, Vite + TypeScript + React + Firebase) 한 곳에서만 개발한다. **Node 의존성은 npm workspaces 기준으로 저장소 루트에서 한 번만 설치**한다(`package-lock.json`도 루트 하나). 루트 `npm run dev` / `npm run build`는 워크스페이스 `boxcycle-web`으로 위임된다.

- **인증:** Firebase(Google·게스트 등 콘솔 설정에 따름).
- **경로 계산:** Callable **`getMapboxDirections`**. 지도 타일은 클라이언트 **`VITE_MAPBOX_ACCESS_TOKEN`(pk.)**.

1. [Node.js LTS](https://nodejs.org/) 설치
2. PowerShell(권장: **저장소 루트**에서 설치·실행):

```powershell
cd C:\20.HDev\boxcycle
npm install
Copy-Item apps\web\.env.example apps\web\.env
# apps\web\.env 에 Firebase 웹 앱 설정값 + VITE_MAPBOX_ACCESS_TOKEN(pk.) 입력 후 저장
npm run dev
```

`apps/web`만 열어 두었다면, 위와 동일하게 **먼저 루트에서 `npm install`** 한 뒤 `apps/web`에서 `npm run dev`를 써도 같은 워크스페이스를 가리킨다. **`apps/web`에 별도 `package-lock.json`은 두지 않는다.**

**Firebase CLI:** 프로젝트 연결은 저장소 **루트**의 `.firebaserc`(기본 프로젝트 ID)와 `firebase.json`을 쓴다. 명령은 루트에서 실행한다.

**Firestore(프로필/Trailhead·Trail/라이드/코스 동기화):** Firebase Console에서 **Firestore Database** 를 생성한다. 로그인 시 `users/{uid}` 문서에 표시 이름·이메일 등을 **merge** 저장한다. Trail presence는 `trails/{trailId}/members/{uid}`, Trail 주행 진행률은 `trails/{trailId}/liveCourseRides/{uid}`, 주행 요약은 `rides`, 코스는 `courses`, 입문 허브 동행은 `coursePresence/{courseId}/members/{uid}` 를 사용한다. `rooms/` 레거시 데이터는 `npm run admin:migrate-rooms-to-trails` 로 이전한다(용어·배포 순서: `document/260517-제품-용어-Trailhead-Trail.md` §8). 저장소 루트의 `firestore.rules`, `firestore.indexes.json`을 기준으로 적용한다.

**Hosting:** `firebase.json` 이 `apps/web/dist` 를 SPA(`rewrites` → `index.html`)로 배포하도록 설정되어 있다. 배포 전에 웹 앱을 빌드해야 한다.

```powershell
cd C:\20.HDev\boxcycle
# Firestore 규칙·인덱스만
firebase deploy --only firestore
# 웹 빌드 + Hosting (또는 npm run deploy:hosting)
npm run build
firebase deploy --only hosting
```

**Cloud Functions(Mapbox Directions 프록시):** `functions/` 에 Callable **`getMapboxDirections`** 가 있다. Mapbox **secret** 을 쓰므로 프로젝트가 **Blaze(종량제)** 여야 하는 경우가 많다.

```powershell
cd C:\20.HDev\boxcycle\functions
npm install
cd ..
# 최초 1회: 시크릿에 Mapbox 토큰 저장(Mapbox 계정에서 발급한 동일 토큰을 서버 전용으로 써도 되고, 제한된 pk.를 써도 됨)
firebase functions:secrets:set MAPBOX_ACCESS_TOKEN
firebase deploy --only functions
```

배포 후 웹 앱은 기본 리전 **`asia-northeast3`** 으로 Callable 을 호출한다. Functions 를 다른 리전에 두었다면 `apps/web/.env` 에 `VITE_FUNCTIONS_REGION` 을 맞춘다.

개발용 규칙 예시는 아래와 같다(운영 전 반드시 재검토).

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null && request.auth.uid == userId;
      allow delete: if false;
    }
    match /trails/{trailId}/members/{userId} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null && request.auth.uid == userId;
      allow delete: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

3. 브라우저에서 터미널에 표시된 주소로 접속한다.
   - **이 PC만:** 개발 서버가 출력하는 `localhost` / `127.0.0.1` 주소(기본 포트는 `apps/web`의 Vite 설정을 따름).
   - **같은 Wi-Fi의 다른 기기:** 터미널에 출력되는 **`Network` — `http://192.168.x.x:…`** 형태의 주소를 사용한다. (`apps/web` 의 Vite 설정이 **LAN 바인딩**을 켜 두었다.)

**LAN 접속이 안 될 때:** Windows **방화벽**에서 Node.js(또는 해당 포트) 허용 여부를 확인한다. 이 PC의 IP는 PowerShell에서 `ipconfig` → **무선 LAN 어댑터 Wi-Fi** 의 **IPv4 주소**를 본다.

**Firebase Google 로그인을 폰에서도 쓸 때:** Firebase Console → Authentication → 설정 → **승인된 도메인**에 `192.168.x.x` 같은 **호스트만** 추가할 수 없고, **정확한 호스트 문자열**이 필요하다. IP가 바뀔 때마다 추가하거나, **ngrok·Cloudflare Tunnel** 등으로 고정 HTTPS 도메인을 쓰는 편이 낫다. (지도·로비만 테스트하고 로그인은 PC만 할 경우는 생략 가능.)

**Mapbox 토큰 URL 제한**을 쓰는 경우: 개발에 쓰는 `http://localhost:…` / `http://127.0.0.1:…` / LAN `http://192.168.…` 를 허용 목록에 넣는다.

**LAN에 열지 않고 이 PC만:** 루트에서 `npm run dev:localhost` (또는 `cd apps/web` 후 동일 스크립트)

**Trail:** 기본 Trail ID는 `default` 이다. 다른 Trail은 **`http://<호스트>:<포트>/?trail=my-ride`** (또는 `?room=` 호환) 또는 MENU **Trail 이동**으로 전환한다. Firestore 경로는 `trails/{trailId}/members/{uid}` 이다.

**Google 로그인 테스트**는 Cursor **간이 브라우저(리디렉션 탭)** 대신 **Chrome / Edge 같은 일반 브라우저**를 권장한다. 임베디드 탭에서 `firebaseapp.com/__/auth/handler` 가 흰 화면으로 멈추는 경우가 있다(팝업·쿠키·리디렉션 제한).

Firebase Console에서 **Authentication → Google** 사용 설정 및 **Authentication → 설정 → 승인된 도메인**을 확인한다.

- **`localhost`와 `127.0.0.1`은 서로 다른 출처입니다.** 브라우저에서 `http://127.0.0.1:…` 으로 열면 콘솔에 **`App domain is unauthorized`** 가 날 수 있다. 해결은 둘 중 하나다.  
  1. 승인된 도메인에 **`127.0.0.1`** 을 추가하거나  
  2. 항상 **`http://localhost:…`** 으로만 접속한다.  
- **`.env`를 저장한 직후**에는 개발 서버를 한 번 재시작해야 Vite가 환경 변수를 반영한다.

빌드 확인: 루트에서 `npm run build` → 산출물은 `apps/web/dist/` .

**과거 정적 POC:** Mapbox 검증용 HTML+단일 `app.js` 구현은 [260508 개발 중간 보고](document/260508-개발중간보고-HTML과-JS-프로토타입.md)에 기록되어 있다. 저장소 루트의 해당 파일은 제거하였다.

## 실행이 안 될 때 체크

- 개발자도구(Console)에 `CORS`, `blocked`, `Access token` 관련 에러가 있는지 확인
- Mapbox 토큰이 `pk.`로 시작하는 공개 토큰인지 확인
- Mapbox 토큰 URL 제한을 걸어둔 경우, 실제로 접속하는 호스트·포트를 허용 목록에 넣었는지 확인

## 본 개발 방향 (요약)

- 클라이언트: **Vite + TypeScript + React** → 최종 안드로이드는 **웹 래핑(Capacitor 등)** 우선  
- 초기 데이터·백엔드: **Firebase** 로 서비스 동작·멀티 유저 검증 후 분리  
- 인증(1차): **Google(Gmail)** 로 빠른 검증  

상세는 위 **현재 단계** 문서 링크를 본다.
