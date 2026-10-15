# 감리 P6 — rider14 승격

| 항목 | 내용 |
|---|---|
| 감리 | 2026-10-16 · Supervisor (Claude) |
| 대상 | [03-result-p6.md](03-result-p6.md) (Cursor) |
| 판정 | **APPROVED — G6 통과** (커밋 전) |

## 확인

- 전환은 두 곳뿐: `config.ts` `PRESERVED_RIDER_ACTIVE_MODEL = "rider14"`(롤백 주석 유지), rider14 `candidate.json` status/approval 3필드. rider14 GLB·가이드 해시 불변, s5 후보 폴더 무변경.
- 계약 시험: 활성 후보를 `config.ts` 에서 읽고 rider14 를 단언, 롤백 후보(s5) 해시 고정 시험 추가 → 6/6. 느슨해진 단언 없음(s5 `pedalReportSha256` 단언은 schemaVersion 1 분기로 보존).
- `test:rider-preserve` 25/25 + 6/6, `tsc` 0.
- `npm run lint` exit 1 — 오류 16건은 `scripts/ride-result/*.test.ts`, 경고는 App/MapView 훅. **이 브랜치 diff 에 없는 파일**(Supervisor `git diff --name-only` 확인) → 기존 부채, 범위 밖. 변경 파일 대상 eslint 는 0.
- 운영 빌드에서 `riderModel` 문자열 0건 → DEV 전용 미리보기 쿼리가 제품에 없음.
- **번들**: Supervisor 가 `main2`(734af62) 를 임시 worktree 에서 따로 빌드 — 3,648,375 B(gzip 1,025.04 kB). rider14 최종 3,680,928 B(gzip 1,034.68 kB). **증가 +32,553 B (gzip +9.6 kB)** = meshopt 디코더 + 프로필·팔레트 키트. 라이더 자산 −1,507,772 B 와 견주어 순감.
- **로컬 앱**: Cursor 캡처(카메라 2 전환 0.8 초 뒤)에는 라이더가 안 보였다 → Supervisor 가 같은 흐름을 대기 3/8/15 초로 다시 찍음(`.out/rider14/p6/sv-capture-app.mjs`). **15 초 컷 `sv-rider14-cam2-15s.png` 에 rider14 가 주행 화면 중앙에 정상 렌더**(뒷모습, 주황 키트, 네임태그, 조명 조절판 값 적용). 원인은 카메라 비행 중 캡처. 자산 URL 은 rider14 후보만 200, 페이서 2명 `__rtwPacerDiag` 확인.
- 기존 빌드 경고 `SADDLE`/`PELVIS` import 는 계획 §11-3 의 알려진 항목.

## 남은 것

- G5 스마트폰 실기기 1회(Chief).
- P7: 결정 로그·상태보드·완료 보고서·커밋(Chief 지시 후 병합·배포).
