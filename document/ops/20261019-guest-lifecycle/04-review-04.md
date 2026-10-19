# Task04 감리 — HTTP 검증

- 수행: OpenCode GLM-5.3 / 감리 Codex. 허용 시험파일과 결과문서만 변경. 운영 접근 없음.
- HTTP handler 메모리 동작19건: **18 PASS / 1 FAIL**, lint0. 잘못된 lease token complete 성공을 실제 실패시험으로 고정한 점 유효. 빌드 exit2의 core 타입오류는 제품측 별도 결함이며 PASS로 보고하지 않음.
- 결과 판정: **시험 작업 완료 / 제품 REWORK_REQUIRED**. Task07(GLM 서버 전담)으로 token 검증·HTTP 장애분류·타입오류 인계. Task06(Cursor web 전담)과 파일 소유 분리.
- 실제 HTTP·Rules 통합은 Task05(Codex)에서 demo 에뮬레이터로 진행. 첫 실행은 RTDB JSON 중복tail 파싱오류로 기동 실패(exit1), 운영 변경 없음.
