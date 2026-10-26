# 조사 83 — 「전체 도로망」 프레이밍이 국내 밀집 지역에 머무는 원인

## 판정

현재 현상은 Mapbox `fitBounds`의 실패가 아니라 **프레임 계산기가 의도적으로 가장 조밀한 하나의 연결 지역만 남기는 동작**이다. 따라서 서울·원주 밖의 일본·유럽·미국 trace가 로드돼 있어도 카메라 bbox 계산에서 제외된다.

특정 계정의 Firestore 원본을 이번 조사에서 조회하지는 않았다. 다만 클라이언트 데이터 경로는 `conquest/{uid}/traces` 컬렉션을 제한·페이지 조건 없이 `getDocs`하여 모든 유효 trace를 읽고, `focusConquestView("all")`가 그 geometry 전체를 계산기에 넘긴다. 코드상 별도의 국내·최근 기록 필터는 없다.

## 증거

1. `apps/web/src/lib/conquest/repo/firestoreConquest.ts`
   - `loadConquestTraces`는 `collection(db, "conquest", userId, "traces")`를 전체 조회한다.
2. `apps/web/src/hooks/useConquest.ts`
   - 요약 거리 변경 때 위 traces를 다시 로드하고 사용자 uid와 묶어 반환한다.
3. `apps/web/src/App.tsx`
   - 「전체 도로망」은 `conquestTraceGeometries + recentNewRoadGeometry` 전체를 `computeConquestOverviewFrame`에 전달한다.
4. `apps/web/src/lib/conquest/conquestOverviewFrame.ts`
   - 1도 격자별 선분 점수를 만든 뒤 최고 점수 격자를 seed로 정한다.
   - seed 점수의 2% 이상인 **인접 격자만 flood-fill**한다.
   - bbox는 그 연결 집합에 든 선분만으로 만든다. 바다를 사이에 둔 일본, 유럽, 미국은 연결되지 않아 제외된다.
   - `MAX_VIEW_DEGREES = 170`은 계산된 bbox를 자를 뿐이며, 제외된 세계 trace를 다시 포함시키지 않는다.
5. `apps/web/scripts/conquest/overview-frame.test.ts`
   - `dense local region wins over an isolated far-away trace`가 먼 trace를 버리고 2도 미만의 로컬 bbox가 되는 현재 동작을 명시적으로 정답으로 잠그고 있다.

즉 「전체」라는 UI 의미와, 2026-10-20에 도입된 「조밀한 연결 지역 하나」 알고리즘·시험 계약이 충돌한다.

## 해결 설계

`computeConquestOverviewFrame`을 **밀집 지역 선택기**에서 **밀도 중심의 반구 프레임 계산기**로 교체한다.

1. 모든 실제 주행 선분을 길이 가중 표본으로 만든다. 비정상적으로 긴 점프가 밀도를 독점하지 않도록 기존 선분별 기여 상한은 유지한다.
2. 구면 좌표에서 가중 밀도가 가장 높은 중심을 정한다. 1도 격자 점수를 후보로 쓰되 경도 ±180도 경계를 순환 처리한다.
3. 그 중심에서 대권거리 90도 이내인 선분/표본을 선택한다. 이것이 최대 한 반구라는 명시적 계약이다. 반대편 기록은 같은 화면에 억지로 넣지 않는다.
4. 선택 trace의 경도는 중심 기준으로 unwrap하여 날짜변경선에서도 짧은 방향으로 bbox를 만든다.
5. 선택 기록의 실제 범위가 작으면 실제 bbox로 더 가깝게 맞추고, 커지면 중심 기준 최대 180도 폭·Web Mercator 허용 위도 안에서 자른다. padding은 기존 `RIDE_HUD_SAFE_PADDING`을 재사용한다.
6. 반환 진단값을 `selectedCellCount`만 두지 말고 전체/선택 선분 수 또는 선택 거리도 포함해 시험과 향후 계측에서 「데이터 미로드」와 「반구 밖 제외」를 구분할 수 있게 한다.

이 방식이면 한국이 최고 밀도일 때 한국을 중심으로 하되, 같은 반구 안의 일본·유럽 등 실제 기록 범위까지 축척이 넓어진다. 미국 기록이 선택 반구 밖이라면 한 화면에서 제외되는 것이 요구사항에 맞다. 미국의 주행 밀도가 더 높다면 미국 중심 반구가 선택된다.

## 변경 계획

| 파일 | 변경 |
|---|---|
| `apps/web/src/lib/conquest/conquestOverviewFrame.ts` | flood-fill 제거, 구면 거리·순환 경도·반구 선택·최대 범위 계산 구현 |
| `apps/web/scripts/conquest/overview-frame.test.ts` | 기존 「먼 trace 폐기」 기대를 새 반구 계약으로 교체하고 경계 사례 추가 |
| `apps/web/src/App.tsx` | 원칙적으로 호출부 유지. 필요하면 진단값만 개발 계측에 연결 |
| `apps/web/src/components/map/MapView.tsx` | bbox가 중심 기준 unwrap 경도를 받을 수 있는지 확인; 필요할 때만 `fitBounds` 입력 보정 |

## 필수 회귀시험

- 서울·원주·일본·유럽·미국: 최고 밀도 지역이 중심이고 같은 반구의 먼 기록까지 bbox가 확장된다.
- 반대편 두 군집: 합계 가중 거리가 큰 반구를 선택하고 폭은 180도 이하이다.
- 날짜변경선 양쪽(예: 179도/-179도): 358도 세계 bbox가 아니라 짧은 bbox가 된다.
- 한 도시만 있는 사용자: 현재처럼 도시 범위로 확대된다.
- 적도·고위도·빈/퇴화 선분: 유효한 Mercator bbox 또는 null을 반환한다.
- 「신규 도로만」: 같은 계산기를 쓰되 전달된 최근 geometry 범위만 맞춘다.

## 구현 전 확인점

제품 의미를 바꾸는 작업이므로 이 문서의 「밀도 중심 + 중심에서 대권거리 90도 이내 + 작은 범위는 더 확대」 해석을 Chief가 승인한 뒤 구현한다. Firestore·Rules·데이터 마이그레이션은 필요하지 않다.
