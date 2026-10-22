# 지시00 — 리더보드 1단계 사실 조사 (읽기 전용)

2026-10-23 · task · 담당 **opencode Nemotron 3 Ultra** · 감리 Claude · 보고 `00-facts.md`

리더보드 1단계(주행 거리 순위 · 개척 순위 · 「지금 달리는 중 → 같이 달리기」)를 설계하기 전에, 지금 코드와 데이터 구조에서 아래 질문의 답을 **근거(파일 경로:줄 번호)와 함께** 찾아 `document/ops/20261023-leaderboard/00-facts.md` 에 한국어로 적는다. 모르면 「찾지 못함 — 찾아본 곳: …」이라고 적는다. 추측하지 않는다.

## 질문

1. **주행 기록(`rides` 컬렉션)** 에 저장되는 필드 전부 — 특히 사용자 id, 거리, 시간, 종료 시각, `conquestResult.newMeters`, 이 주행이 어떤 경로/퍼블릭(publication)·Trail 에서 달렸는지 가리키는 필드. 쓰는 곳: `apps/web/src/lib/ride/repo/firestoreRides.ts`, `apps/web/src/lib/ride/rideEndPersistence.ts` 근처.
2. 주행마다 **입력 방식(케이던스 센서 vs 손으로 고른 체험 속도)** 이나 **Trust Tier** 가 기록되는가? 서버(`functions/src`)에서 Trust Tier 를 판정하는 코드는 어디인가?
3. **퍼블릭 경로(`routePublications`)** 에 등록한 사람(개척자)의 uid·닉네임이 저장되는가? 필드 이름은? 다른 사람이 그 퍼블릭을 달렸을 때 그 주행에서 퍼블릭을 어떻게 알 수 있는가?
4. **users 문서**에 닉네임·tier·지역(나라 등) 정보가 있는가? 필드 이름과 쓰는 곳.
5. **「지금 달리는 중」** 을 아는 방법 — 실시간 위치/Trail 참여 데이터(RTDB·Firestore 경로), 남의 Trail 에 합류하는 앱 함수 이름.
6. `firestore.indexes.json` 에 `rides` 관련 인덱스(userId·createdAt·endedAt 등)는 무엇이 있나?
7. 예약 실행 Cloud Function(예: `routeActivityScheduledReconcile`) 의 작성 방식(파일·스케줄 표현) — 주간 집계 함수를 만들 때 따를 본보기.
8. 게스트가 회원 등록할 때(익명 → Google 연결) uid 가 유지되는가 — `apps/web/src/hooks/useAppAuth.ts` 의 연결 흐름.

## 금지

파일 수정(결과 파일 `00-facts.md` 작성 외), 명령 실행으로 운영 데이터 접근, git 명령.
