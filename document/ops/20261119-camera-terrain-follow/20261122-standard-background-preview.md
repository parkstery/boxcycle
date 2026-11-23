# Standard 낮 배경 간소화 비교

수행 Codex · 2026-11-22 · 실행 폴더 `C:\20.HDev\boxcycle`.

Chief 지시: Standard light(현재 앱의 Standard 낮/day)를 사용할 예정이므로 raster 바탕 대신 배경 간소화를 먼저 시험한다. 전용5218에 기본/간소화 전환을 추가했다. 제품 기본 지도·고정 UI·주행 데이터 정책은 변경하지 않았다. 커밋·푸시·배포 없음. 최소24FPS 하한 유지, 앞선300m 후보의 불합격 판정 유지.

## Chief 검수 후속 — 간소화 체감효과 없음·연결 확인

Chief는 간소화/기본을 시험하고 「차이가 없다」고 보고했다. 제공 화면은 간소화10.4FPS·기본9.0FPS이며 두 화면 모두300m 원거리 병합이 켜져 있다. 위치/시점도 달라 배경 단독의 정밀 효과량으로 해석하지 않는다. 최소24FPS 미달과 Chief의 체감 실패를 유지하며 **간소화 성공/제품 채택으로 판정하지 않는다**. 배경 필터만 적용하면 해결된다는 전제를 이어가지 않는다.

Chief 제안인 가까운 건물/나무만3D·라이더별LOD는 기존의 지형proxy 타일 병합과 다른 실험이며 검토 가치가 있다. 다만 지형ON의 비용이 남으므로 먼저 자산 전체를 숨긴 조건에서 절감 상한을 확인하는 것이 타당하다. 건물/나무OFF, 라이더OFF를 각각 별도로 비교하고 효과가 큰 그룹에만 거리 제한/모델 경량화를 적용한다. 현재 제공된 판정만으로 해당 그룹의 CPU/GPU 기여를 확정하지 않는다.

- 설치3.23.1의 `draw_model.ts`에는 instanced draw 경로가 있다. Standard의 모델을 앱의 개별메시처럼 다시InstancedMesh로 묶는 단순한 추가 스위치로 접근하지 않는다.
- 공식 `fill-extrusion-cutoff-fade-range`는 화면 높이 기준이며 **terrain 활성화 시 효과가 없다는 제약**이 있다. 이것을300m 컬링으로 제시하지 않는다. `model-cutoff-fade-range`도 미터 반경 자체가 아니다. [공식 사양](https://docs.mapbox.com/style-spec/reference/layers/)
- 앱의 `riderDetailLod.ts`와 `riderPreservedLayer.ts`에는 지도줌19 미만의정적LOD2/자세계산생략이 이미 있다. 현재는 한 줌 값으로 전체라이더를 판단하고 한 rig를 라이더마다 설정해 다시그린다. 근거리카메라에서먼동행까지상세모델이될수있다. 개선후보는라이더별화면크기/거리LOD·화면밖컬링·LOD별애니메이션빈도이며, 원거리전체를정적으로바꾸거나peer위치동기화빈도를낮추는것과구분한다. 아직구현하지않았다.
- 교차로/오르막에서만3D를켜는방식은성능최적화뿐아니라기본주행외관의제품정책변경이다. Chief의Standard3D기본의도·오르막접지·3D복귀전환·보호정책과함께별도판단해야하며자동으로제품에적용하지않는다.

Firestore 질문의 확인 결과:

-5218 실행기는 `isolatedWebEnvironment`의 `VITE_USE_EMULATOR=1`과가짜로컬API키로빌드한다. 실제served산출물의emulator설정마커를확인했다.
- `src/lib/firebase/app.ts`의getFirebaseFirestore는이플래그에서connectFirestoreEmulator를호출한다. 현재hub `http://127.0.0.1:4400/emulators`에서도Firestore8080·Auth9099·RTDB9000·Functions5001을확인했다.
- 실제5218HTTP응답의connect-src는로컬호스트·Mapbox·Open-Meteo만허용하고운영Firebase/Google엔드포인트를제외한다. 에뮬레이터미기동시운영폴백을허용하는실행기가아니다.
- 따라서이프리뷰는Firestore를없앤앱이아니라**로컬Firestore를사용하는앱**이다. 운영Firebase콘솔에이요청이집계되지않고, 이주행을운영의계정/기록/순위검증으로간주하면안된다. 실제요청횟수와모든앱흐름별읽기/쓰기는이번에새로계측하지않았다.
- Mapbox지도·지형/자산은실제외부서비스에서받으므로Firestore사용량0표시를모든외부트래픽/비용0으로해석하지않는다. 스크린샷의차트「데이터없음」만으로운영전체사용량이0인지까지확정하지않는다. [Firebase 공식 에뮬레이터 설명](https://firebase.google.com/docs/emulator-suite/connect_firestore)

이번후속은코드/설정·HTTP헤더·emulator허브조회와공식사양조사만실행했다. 제품/프리뷰코드변경·새성능시험·배포없음.

## 사용

기존5218 서버를 그대로 사용한다. 현재 주행 결과를 복사한 뒤 Ctrl+F5로 최신 패널을 받는다. 다른 프리뷰/에뮬레이터를 종료하지 않는다.

```powershell
node "C:\20.HDev\boxcycle\document\ops\20261119-camera-terrain-follow\tools\run-manual-ride-3d-preview.mjs"
```

주소: http://127.0.0.1:5218/?maxdpr=1.5&perflab=1

1. Guest 진입 시 위치 선택 → 경로 선택 → 주행 시작·카메라2. 상단 「Standard 낮 비교」를 펼친다. 처음에는 접힌 상태로 두어 위치 선택·경로 모달을 가리지 않는다. 접혀도 FPS는 보인다.
2. 「Standard 낮 선택」을 누른다. 기존 앱의 스타일 버튼을 통해 Standard 낮으로 전환한다. 주행 전이거나 해당 카메라에서 스타일 전환이 잠겨 있으면 카메라2/주행 시작 안내를 표시한다.
3. 실제 상태의 `Standard 낮`, 지형ON·건물ON·나무ON을 확인한다. 원거리는 기본으로 둔다. 자동평면/지형 복구 중에는 안정 회복을 기다린다.
4. 「배경: 기본」에서10초 측정 → 「배경: 간소화」로 바꾸고 최소3초 안정화 및 생략 레이어/누적 호출 표시 확인 →10초 측정 → 다시 기본으로 복원하여 재측정한다. 같은 경로·속도·카메라·줌 조작·DPR·창 크기를 사용한다.
5. 「결과 복사」로 평균·최저1초FPS·p95·배경 프로필·실제 Standard/day·생략 레이어 목록과 카메라/해상도를 함께 전달한다. 새로고침하면 결과는 초기화된다.

새 패널은 **Standard 낮에서만 측정을 허용**한다. Outdoors·해질녘·로딩 중에는 측정을 시작하지 않는다. 배경 전환은 진행 중인 측정을 취소하며 앞선 원거리 후보를 기본으로 되돌린다. 서로 다른 실험을 섞어 단독 효과로 해석하지 않는다.

## 유지·생략

| 유지 | 간소화에서 생략 |
|---|---|
| Standard 낮 조명·지형1배·지형 보호 | 기존 hillshade/일부 장식 면·수심 표현 |
| 일반 도로 본선·물·넓은 토지색 | 도로/교량 윤곽선·선형 그림자·건물 바닥 윤곽선 |
| 도로명·3D 건물·랜드마크 모델·가로수 | 보행로·계단·철도/궤도·공항선·울타리 등 부가 선 |
| 라이더·앱 경로선·주행선·내 도로망 | POI/장소/교통 라벨·랜드마크 아이콘/이름·행정경계·실내 지도/라벨 |

`roads`는 여러 도로 등급을 하나의 레이어에 담으므로 이번 후보를 「주요 도로만 남김」이라고 표현하지 않는다. 본선은 보존하고 장식/부가 표현을 줄인 시험이다. 건물의 실제3D 그림자·재질/파사드·가로수 모델은 별도로 끄지 않는다. 개별 장소의 건물·가로수 데이터 존재 여부는 Standard의 원본 커버리지에 따른다.

## 구현과 제약

- `manual-standard-background-preview.js`는 전용 산출물에만 연결된다. 앱 번들·SDK 설치 파일은 수정하지 않았다.
- Standard 공개 설정9개를 false로 바꾸고, 전환 전 실제 값을 저장해 기본 복귀 시 정확히 복원한다. 원래false였던 설정도 false로 유지한다. 도로명과3D 객체 설정은 건드리지 않는다. [Standard 공식 설정](https://docs.mapbox.com/map-styles/reference/standard/)
- 공개 설정으로 접근할 수 없는 장식 레이어는 Mapbox3.23.1 내부 `painter.renderLayer` 진입에서만 생략한다. `scope === basemap`과 레이어 타입·ID가 일치할 때만 필터링한다. 앱/다른 import의 같은 이름 레이어, custom·model·building·fill-extrusion·symbol 렌더는 통과시킨다. 숨겨진 내부 레이어를 자유롭게 편집하는 공개 API가 있다고 전제하지 않는다.
- 실제 Standard에서 읽은 레이어 ID를 기준으로 필터를 정했다. 원격 Standard 스타일/SDK 변경 시 재검증이 필요하며 제품 채택 방식으로 확정하지 않는다.
- 기본 복귀는 renderer 원본 메서드 및 저장한 공개 설정을 복원한다. 스타일이 교체되면 이전 스타일 설정을 새 스타일에 덮어쓰지 않고 새 기본값을 별도로 저장한다. day를 벗어나면 필터를 해제한다.
- 모드 전환 때만 지형 합성 캐시를 무효화하고 source/style 갱신을 요청한다. 매 프레임 고정/캐시 무효화 우회나 카메라 정지 처리는 없다. 기존 지형 보호의 자동평면도 유지한다.
- 생략 수는 **renderLayer 진입 호출 수**이다. 빈 데이터에 대한 호출도 포함할 수 있으며 GPU draw call 수나 절감 시간으로 해석하지 않는다. 소스 파싱·심볼 준비·지형 타일 합성의 모든 비용을 제거한 것은 아니다.
- FPS는 기존 Mapbox render 이벤트 기반이다. 「24FPS 표본 통과」는10개의1초 구간이 모두24 이상이고 p95≤41.7ms인 짧은 표본 검사이며 장시간 실폰/발열 판정이 아니다.

## 검증

통과:

- 새 배경4/0: 장식 생략·본선/물/3D/custom/앱 레이어 보존, 원래true/false 설정과 prototype 메서드 복원, Standard/day/스타일 교체·기본값 보존, 호환 설정 실패 시 부분 적용 회수.
- 패널5/0: 기존FPS 계수·최저1초·취소, Standard/day 외 측정 거부, 배경 프로필 기록·측정 취소·원거리 후보 리셋.
- 기존 거리4/0·독립3D12/0과 합계25/0. 실행기/컨트롤러 문법·HTTP 연결·diff 공백 검사 통과.
- 실제 WebGL Standard/day·원주3.42km·카메라2·수동5km/h: 약45~46개 장식 레이어의 렌더 진입 생략을 확인했다. 한 관측에서 생략1981회/통과1194회였으며 누적 창의 진입 수이므로 FPS 효과량은 아니다. 지형1배·건물/가로수/도로명true를 확인했다.
- 지도 render 이벤트 안에서 PNG를 캡처해 직접 시각 검사했다. 기본/간소화에서 도로 본선·라이더·경로선·건물을 확인했고 도로 윤곽선이 줄었다. 서로 다른 시점/위치의 정지 이미지로 픽셀 동등성을 주장하지 않는다. 이 구간의 가로수 실제 픽셀은 확인하지 못했으며 설정/모델 타입 통과만 검증했다.
- 새 「Standard 낮 선택」→배경 토글→10초 결과에 `backgroundMode:simple`/Standard/day 기록→기본 복원 흐름을 확인했다. 앞선 거리 후보는baseline, renderer 원본복원 및POI/보행로 설정 원복 확인.
- 증거: `tmp/standard-background-baseline.png`, `standard-background-simple.png`, `standard-background-simple.json`, `standard-background-restored.json`, `standard-background-panel.json`.

초기 위치 선택은 펼친 패널이 클릭을 가려 실패했다. 처음 접힌 상태로 바꾸고 다시 진입했다. 초기 측정 시도는 지형 보호의 자동평면 중이라 시작을 거부했으며 실제지형ON 회복 후 측정했다. 보호를 끄거나 결과를3D 성능으로 잘못 기록하지 않았다.

이번은ops JS만 바꾸어 제품TypeScript/생산 앱 재빌드/전체map 시험은 재실행하지 않았다. 기존 제품 변경의map183/0·tsc/buildPASS 기록은 별도다. 미실행: 실폰/센서·발열·장시간 주행·모든지역 외관. Ego환경 render는약1Hz로 관측되어 이번 FPS를 기기 성능 결론에 사용하지 않는다. **Chief 직접 화질/FPS 검수 대기·미채택·미배포**.

재현(어느 현재 폴더에서도 실행 가능):

```powershell
node --test "C:\20.HDev\boxcycle\document\ops\20261119-camera-terrain-follow\tools\manual-standard-background-preview.test.mjs" "C:\20.HDev\boxcycle\document\ops\20261119-camera-terrain-follow\tools\manual-ride-3d-preview.test.mjs" "C:\20.HDev\boxcycle\document\ops\20261119-camera-terrain-follow\tools\manual-terrain-distance-preview.test.mjs" "C:\20.HDev\boxcycle\document\ops\20261119-camera-terrain-follow\tools\test-ride-3d-preview.mjs"
node "C:\20.HDev\boxcycle\document\ops\20261119-camera-terrain-follow\tools\run-manual-ride-3d-preview.mjs" --check
node "C:\20.HDev\boxcycle\document\ops\20261119-camera-terrain-follow\tools\run-manual-ride-3d-preview.mjs" --refresh-ui
```
