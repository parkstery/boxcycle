# BOXCYCLE `document/` 목록

| 항목 | 내용 |
|------|------|
| 문서 유형 | **메타** — 네 덩어리별 문서 색인(파일명·경로는 변경하지 않음) |
| 최초 작성 | 2026-05-23 |
| 상태 | **검토됨** |
| 연결 문서 | [문서 생성·수정 지침](260509-BOXCYCLE-문서-생성-및-수정-지침.md) |

새 `.md`를 추가·분류를 바꿀 때 **이 목록을 함께 갱신**한다. 상세 규칙·메타 블록·상태 값은 [지침](260509-BOXCYCLE-문서-생성-및-수정-지침.md)을 따른다.

**복합 유형**(`product` + `architecture` 등)은 **주 분류 한 곳**에만 두고, 「비고」에 부가 분류를 적는다. 애매하면 지침 §2 — **가장 좁은 범위** 우선.

---

## 단일 진실 (의사결정 우선)

| 주제 | 문서 |
|------|------|
| 현재 단계·스택·1차 마일스톤 | [260509-BOXCYCLE-현재단계-범위-스택-및-1차마일스톤](260509-BOXCYCLE-현재단계-범위-스택-및-1차마일스톤.md) |
| 서비스 비전·UGC·권한(장기) | [260511-RTW-마스터-비전-및-종합계획](260511-RTW-마스터-비전-및-종합계획.md) |
| 제품 용어 Trailhead / Trail | [260517-제품-용어-Trailhead-Trail](260517-제품-용어-Trailhead-Trail.md) |
| tier·진입·Firestore identity | [260519-사용자-tier-및-진입-정책](260519-사용자-tier-및-진입-정책.md) |
| 월드 맵 activity presence · publication dot | [260523-World-Activity-Presence-설계](260523-World-Activity-Presence-설계.md) |

---

## product — 제품·범위

| 문서 | 요약 | 비고 |
|------|------|------|
| [260511-RTW-마스터-비전-및-종합계획](260511-RTW-마스터-비전-및-종합계획.md) | 비전·도메인·권한 체계 | 단일 진실 |
| [260509-BOXCYCLE-현재단계-범위-스택-및-1차마일스톤](260509-BOXCYCLE-현재단계-범위-스택-및-1차마일스톤.md) | MVP 범위·스택·1차 마일스톤 | `+architecture` 요약 |
| [260509-기능-추가-계획-제품-및-아키텍처](260509-기능-추가-계획-제품-및-아키텍처.md) | 기능 로드맵·데이터 확장 방향 | `+architecture` |
| [260515-ux-주행-여정-및-패널-IA](260515-ux-주행-여정-및-패널-IA.md) | 주행 여정·패널 IA | |
| [260517-제품-용어-Trailhead-Trail](260517-제품-용어-Trailhead-Trail.md) | 용어·브랜딩 | 단일 진실 |
| [260519-사용자-tier-및-진입-정책](260519-사용자-tier-및-진입-정책.md) | identity·tier·진입 | `+architecture` |
| [260519-tier-subscription-정책](260519-tier-subscription-정책.md) | Stripe 구독 → `registered_paid` | |
| [260519-tier-quota-정책](260519-tier-quota-정책.md) | tier별 생성·저장 한도 | |
| [260518-Route-Token-경제-설계](260518-Route-Token-경제-설계.md) | Route Token 경제 루프 | `+architecture` |
| [260523-World-Activity-Presence-설계](260523-World-Activity-Presence-설계.md) | publication 1 dot · heartbeat 분리 | 단일 진실 · `+architecture` |
| [260517-Activity-World-지도-LOD-설계](260517-Activity-World-지도-LOD-설계.md) | 지도 LOD(점↔선)·Mapbox | presence는 위 문서 우선 |
| [260514-맵퍼스트-HUD-시트-화면구성-디자인-분석](260514-맵퍼스트-HUD-시트-화면구성-디자인-분석.md) | 맵 퍼스트 HUD·시트 구현 분석 | 메타 블록 없음 · 2026-05-14 코드 기준 |

---

## architecture — 아키텍처·데이터

| 문서 | 요약 | 비고 |
|------|------|------|
| [260509-아키텍쳐-DB설계](260509-아키텍쳐-DB설계.md) | Postgres 장기 DB·API 방향 | 일부 product 장기안 |
| [260509-Firestore-컬렉션-스키마-초안](260509-Firestore-컬렉션-스키마-초안.md) | Firestore 컬렉션·필드 초안 | |
| [260509-Firestore-Postgres-이전-체크리스트](260509-Firestore-Postgres-이전-체크리스트.md) | Firestore→Postgres 가드레일 | |
| [260511-경로저장-계층화-Frozen-Route-Segment](260511-경로저장-계층화-Frozen-Route-Segment.md) | Frozen Route·Segment 저장 | 단일 진실 |
| [260511-코스-수명-UGC-품질-정책](260511-코스-수명-UGC-품질-정책.md) | UGC 코스 수명·품질 게이트 | 단일 진실 |
| [260511-Firestore-Rules-일반화-방안](260511-Firestore-Rules-일반화-방안.md) | Rules 데이터 기반 일반화 | 단일 진실 |
| [260518-Route-Publication-통합-모델-및-마이그레이션](260518-Route-Publication-통합-모델-및-마이그레이션.md) | 경로 정체성·퍼블릭 출판 | presence 키: `publicationId` |
| [260516-보안-분석-보고서](260516-보안-분석-보고서.md) | 코드베이스 정적 보안 분석 | |
| [260523-Firebase-비용-운영-체크리스트](260523-Firebase-비용-운영-체크리스트.md) | Firebase·GCP 비용 관측·예산·증폭 경로 | `+execution` · [실행](#execution--실행)에도 교차 참조 |
| [260515-로그인-인증-코드-위치-및-흐름-보고서](260515-로그인-인증-코드-위치-및-흐름-보고서.md) | 인증 스택·코드 위치 | `+record` · [기록](#record--기록)에도 교차 참조 |
| [260514-사용자-통계-주행-데이터-및-UI-분석-보고서](260514-사용자-통계-주행-데이터-및-UI-분석-보고서.md) | 주행 데이터·집계·UI | `+record` |

---

## execution — 실행

| 문서 | 요약 | 비고 |
|------|------|------|
| [260509-app-js-프론트백엔드-분리-1차리팩터링](260509-app-js-프론트백엔드-분리-1차리팩터링.md) | `app.js` 분리 Phase | |
| [260511-Phase별-실행-체크리스트-Course-Session-Presence](260511-Phase별-실행-체크리스트-Course-Session-Presence.md) | Course·Session·Presence 체크리스트 | |
| [260516-App-도메인-훅-분리-분석-및-계획](260516-App-도메인-훅-분리-분석-및-계획.md) | App 도메인·훅 분리 계획 | |
| [260516-Firestore-트래픽-저감-상세-수정-계획](260516-Firestore-트래픽-저감-상세-수정-계획.md) | Firestore 트래픽·Activity World 정렬 | |
| [260518-Activity-World-경로표시-우선순위-백로그](260518-Activity-World-경로표시-우선순위-백로그.md) | 경로 표시 P0~ 백로그 | |
| [260516-수동-스모크-체크리스트](260516-수동-스모크-체크리스트.md) | 수동 QA·스모크 | 운영(`qa`) |
| [260523-Firebase-비용-운영-체크리스트](260523-Firebase-비용-운영-체크리스트.md) | Blaze·Functions·Firestore·Storage 비용 관측·대응 | `+architecture` |

---

## record — 기록

| 문서 | 요약 | 비고 |
|------|------|------|
| [260508-개발중간보고-HTML과-JS-프로토타입](260508-개발중간보고-HTML과-JS-프로토타입.md) | POC·프로토타입 스냅샷 | 검증 아카이브 |
| [260514-사용자-통계-주행-데이터-및-UI-분석-보고서](260514-사용자-통계-주행-데이터-및-UI-분석-보고서.md) | 2026-05-14 코드 기준 분석 | 주 분류: [architecture](#architecture--아키텍처데이터) |
| [260515-로그인-인증-코드-위치-및-흐름-보고서](260515-로그인-인증-코드-위치-및-흐름-보고서.md) | 2026-05-15 인증 흐름 스냅샷 | 주 분류: architecture |
| [260516-App-도메인-훅-분리-결과-보고서](260516-App-도메인-훅-분리-결과-보고서.md) | 훅 분리 작업 결과 | `report` |
| [260517-맵-줌-뷰-덜컹거림-원인-및-해결-보고서](260517-맵-줌-뷰-덜컹거림-원인-및-해결-보고서.md) | 맵 줌 덜컹거림 원인·해결 | 메타 블록 없음 |
| [260514-(cycle)로비_코스주행자_맵관전_구현_보고서](260514-(cycle)로비_코스주행자_맵관전_구현_보고서.md) | Trail 동행·코스 주행자 맵 표시 구현 | `(cycle)` |
| [260514-(cycle)음악_메시지_TTS_분석_보고서](260514-(cycle)음악_메시지_TTS_분석_보고서.md) | BGM·메시지·TTS 분석 | `(cycle)` |
| [260512-(cycle)주행_마커_라이더_애니메이션_작업_과정_및_로직_보고서](260512-(cycle)주행_마커_라이더_애니메이션_작업_과정_및_로직_보고서.md) | 라이더 마커·애니메이션 | `(cycle)` |
| [260515-(cycle)Firestore-부하-경감-조치-종합보고서](260515-(cycle)Firestore-부하-경감-조치-종합보고서.md) | Firestore 부하 1차 조치 종합 | `(cycle)` |

---

## 메타·기타

| 항목 | 설명 |
|------|------|
| [260509-BOXCYCLE-문서-생성-및-수정-지침](260509-BOXCYCLE-문서-생성-및-수정-지침.md) | 네 덩어리·파일명·메타·링크 규칙 |
| **본 파일** (`README.md`) | 분류 색인 — `YYMMDD-` 접두 예외(폴더 관례) |
| [루트 README](../README.md) | 실행 방법·배포·단일 진실 링크 |

### 정책 시드 JSON (문서 본문 아님)

| 파일 | 용도 |
|------|------|
| [config-tierQuotas.seed.json](config-tierQuotas.seed.json) | tier 한도 시드 |
| [config-subscription.seed.json](config-subscription.seed.json) | 구독 시드 |
| [config-routeTokenEconomy.seed.json](config-routeTokenEconomy.seed.json) | Route Token 경제 시드 |

---

## 개정 이력

| 날짜 | 내용 |
|------|------|
| 2026-05-23 | 최초 작성 — 네 덩어리 색인(단기 방안: 파일명·폴더 구조 유지) |
| 2026-05-23 | `260523-Firebase-비용-운영-체크리스트` 추가 (execution·architecture 교차) |
| 2026-05-23 | `260523-World-Activity-Presence-설계` 추가 — 단일 진실 |
