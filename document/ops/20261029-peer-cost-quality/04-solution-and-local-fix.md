# 해결 방향과 송신 표본 시각 로컬 수정

작성2026-10-29 · 독자Chief/AI · 상태: **표본시각 수정 Hosting 배포완료 / 큰수신공백 미해결** · [입구](README.md) · [후속 배포검증](06-release-verification.md)

아래는로컬수정당시검증기록이다. 이후Chief승인으로8101ead2커밋·푸시·Hosting배포및운영주요자산해시대조를완료했다. 상세완료상태는06을따른다.

Chief는 눈의피로로추가육안테스트없이해결방법조사를요청했다. 새실주행·화면확인·승인질문을요구하지않고코드/재생을진행했다. 이번결과를현장최종해결로표시하지않는다.

## 1. 실제로 확인한 거리/시각 계약 결함

`buildLiveLocationSnapshot`은세션의마지막rAF거리·속도를읽되`tSrv`는그보다늦은송신시각으로붙였다. 송신Worker와주행rAF의위상이변하면정속이어도서로다른나이의거리에동일한간격의시각이붙는다. 5km/h에서40ms는5.56cm다. 이는프레임수정10-16의화면용투영과별개인 **송신표본시각** 경로다. 예전수정이삭제됐다는의미가아니다.

수정전제품함수회귀시험은 **2FAIL/1PASS**였다.40ms오래된거리를현재시각에찍는오차를확인했다. 이번현장의작은진동이100%이결함때문이라는증거는없지만,독립적으로재현되는계약위반이다.

## 2. 적용한 최소 수정

| 제품파일 | 변경 |
|---|---|
| `apps/web/src/hooks/useVirtualRideSession.ts` | 원본거리·적용속도·그값이적분된시각을한callback으로읽음. running은`performance.timeOrigin + lastAnimTs`,그외는현재시각 |
| `apps/web/src/lib/peerMotion/peerSyncDistanceSamplers.ts` | 내부선택적snapshot읽기추가.기존raw진단getter보존·해제시새callback도해제 |
| `apps/web/src/lib/ride/liveLocationSnapshot.ts` | 실제거리표본시각을서버축으로변환해기존`tSrv`에사용.미등록/유효하지않은표본은기존폴백 |

주행거리적분·HUD·Claim·송신주기200ms·FS4초·공통지연600ms·1.2초외삽상한은변경하지않았다. wire필드·Rules·DB경로·패킷횟수추가없음. 외부공용API/데이터모델이아닌기존3모듈내부의선택적sample읽기보완으로판단해자율수정했다. 수신공백시제품표시정책을확대하는구현은하지않았다.

## 3. 작은진동 재생 결과

두라이더5km/h·B표본나이0/40ms교대·송신위상차80ms·네트워크sin지터를설정했다. 실제snapshot작성→encode→self표본/peerRegistry→공통표시시각의제품함수를사용했다.

| 조건 | 상대간격변동폭 | 3cm게이트 |
|---|---:|---|
| 예전동작모델:오래된거리+송신시각 | **6.0cm** | FAIL |
| 수정:거리+그적분시각 | **1.2cm** | PASS |

[비교JSON](evidence/capture-age-comparison-20261029.json) · [그래프PNG](evidence/capture-age-comparison-20261029.png) · [SVG](evidence/capture-age-comparison-20261029.svg)。그래프는생성후직접눈검수했다. 합성조건의수치이며실측개선율로일반화하지않는다. 예전동작모델은동일함수에현재시각을태깅해복원했고,그외입력/판정기준은동일하다.

새 `motion-capture-timeline.test.mjs` 3시험으로시각짝보존·정속가변표본나이·미등록/서버시각미준비폴백을고정했다. `low5captureAge`는기본동행재생게이트에추가했다. 예전태깅모델은명시선택진단셀로남아FAIL한다.

## 4. 큰밀림은 다른 해결이 필요하다

수초공백에서는보간할정보자체가없다. 정상5Hz를더높여도송수신작업이막힌공백은해결되지않는다. 정상표본의시각을맞추는이번수정이큰공백까지해결한다고주장하지않는다.

격리된Vite변환실험으로1.2초외삽상한을4초로늘려봤다(제품파일변경없음). 이것만으로는낡은FS대체표본선택이겹쳐동속공백뒤처짐4.579m가남았다. 여기에「RTDB보다뒤의낡은FS위치는선택하지않음」을실험적으로결합하면동속공백오차변동은 **4.579m→0.015m**로줄었다.

하지만같은공백중상대가실제로정지하는조건에서는오차변동이 **4.829m**로커졌다. 따라서이조합은 **제품채택하지않았다**. 동속시나리오만매끄럽게만들고실제정지를망가뜨리는해법을완료로포장하지않는다.

증거: [상한만4초실험](evidence/extrap4s-rejected-experiment-20261029.json) · [4초+낡은FS차단실험](evidence/extrap4s-guard-rejected-experiment-20261029.json)。실험스크립트는 `C:\20.HDev\boxcycle\apps\web\.out\extrap-workbench.mjs`이며현재제품소스를로딩시변환할뿐정본파일을덮어쓰지않는다. `low5bothStreamsStop`은진단셀로보존했다. 기본게이트범위를넓혀실패를숨기지않았다.

## 5. 권고 순서

1. 이번 **거리/실제시각짝수정**을검수해작은진동후보부터제거한다. 사용자실주행은Chief휴식후원할때하며지금요청하지않는다.
2. 큰공백은추가읽기대신송신실제박자/수신내용변화시각/공통시각/버퍼고갈/소스전환을동시에진단한다. 회선공백,송신탭부하,수신메인스레드부하를구분해공백자체를줄인다. 기존진단으로부족한관측만기기내로추가하며DB진단쓰기를늘리지않는다.
3. 장애중에는「정확한위치를모르는상태」를명시하고제한예측·정지·복구보정정책을구분한다. 무조건긴외삽·위치snap·과거FS표본에의한되감기를해결책으로쓰지않는다. 상대가이동중인지정지했는지정보가오지않는동안둘모두의정확한위치를보장할수없다. 허용지연·추정표시·복구시간의제품기준은Chief결정용으로분리한다.
4. 품질회귀고정후Firestore상시위치복제의역할을분리해비용을줄인다. 현재수정은추가통신없이이뤄졌다. 큰공백을고치기위해전송량부터늘리지않는다.

## 6. 검증

실행폴더 `C:\20.HDev\boxcycle\apps\web`:

| 명령 | 결과 |
|---|---|
| `node --test scripts/peer-sync/motion-capture-timeline.test.mjs` | 수정전2FAIL/1PASS→수정후 **3PASS/0FAIL** |
| `node scripts/test-quick.mjs peer` | **75PASS/0FAIL**·8파일·제외3개(에뮬레이터/하네스) |
| `npm run test:peer-spacing` | 기본11셀·소스전환7셀·residual10셀 **PASS** |
| `npx tsc -b --noEmit` | **PASS** |
| `npm run build` | **PASS**·기존큰chunk경고 |
| 변경제품3파일+새시험eslint | **PASS**·출력없음 |
| 루트 `node scripts/check-dep-direction.mjs --check` | **PASS** |
| 루트 `node scripts/check-code-tidy.mjs` | **PASS**·exports186/types44 |

이전rAF회귀8PASS는동일rAF코드의직전검증을재사용했다. 기존동행기본7시나리오수치는보존됐다. 전체제품시험/실폰/실브라우저두창/운영패킷수집/실제청구전후측정은미실행이다. 현재수정의실화면효과와큰밀림최종해결은미확정이다.

검증로그는루트`.out`의 `motion-capture-{before,after,tsc}-20261029.log`, `capture-age-comparison-20261029.log`, `peer-spacing-capturefix-20261029.log`, `capturefix-{peer-tests,build,eslint,dep,tidy}-20261029.log`에있다.

휴식후선택적로컬확인명령:

```powershell
Set-Location C:\20.HDev\boxcycle\apps\web
node --test scripts/peer-sync/motion-capture-timeline.test.mjs
node scripts/peer-sync/residual-peer-jitter-harness.mjs --scenario low5captureAge
```

위명령은브라우저주소불필요. 기존개발서버 `http://localhost:5031/`는재시작하지않았다. 실제화면확인은나중에두창모두새로고침→같은Trail→각5km/h고정순서이며현재요구하지않는다. 커밋·푸시·운영배포없음,다른작업dirty보존.
