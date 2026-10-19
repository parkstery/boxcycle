# Supervisor 진행 체크포인트

2026-10-19. 완료보고 아님. 이어받을 때 현재코드/실행상태 재확인.

- GLM Task09 exit0/116단위PASS. **Task12 exec51546 진행중**, OpenCode 세션 `ses_eadc1e7a8ffer3oIfvcItNU9ve`, 모델 opencode/glm-5.3-flash-free. HTTP metadata오류삼킴제거/numeric503/openlisting후보가감리잔여. Task12파일에 routeAutoRouteCache.userId후보추가도append(초기read이후라최종확인필요). `run --standalone --session <id> --model ...` 가능. --continue 임의마지막세션 금지.
- Cursor Task13 완료: 세션 de850c4f-6906-407d-9dcb-bdb458476652, exec39291 exit0. REST주소·testimport·viewportfloat허용0.001 교정. Task11 실제SDK spec3개준비/새 lastVerifiedGuestUID만 localStorage보관, 자동계정생성없고 null/토큰만료만으로cache삭제안함. 새app수정뒤hook8동작·20단위/build/lint 보고PASS. 실제test는 아래서Supervisor실행중.
- 실제SDK E2E exec37433 exit1(fixture401), Cursor14헤더교정뒤 **exec38615 exit0/3PASS(1.2분)**. ①Guest새로고침동일UID ②logoutAuth/개인자료보존·자동생성0 ③삭제후만료·새탭·옛문서재생성0/다른UIDcache보존·명시시작새UID1. [감리14](04-review-14.md). emu전부종료.
- **Cursor Task15 exec61331 진행중**, 세션 de850c4f-6906-407d-9dcb-bdb458476652. 개인 routeAutoRouteCache 삭제누락+writeCache tombstone InTx guard. 소유distanceAutoRouteHttp.ts/accountDeletionCore.ts정책/purgeGuestUsersCore.ts/관련시험. GLM12와충돌없게경계지시. 완료후functions통합build/test/lint/실제RulesHTTP suite실행필요. Supervisor suite에 cache-only/openlisting-only고아fixture추가됨.
- HTTP/Rules 실제재검수 exec92883 exit1: 실제독립동작9 PASS/3FAIL(부모포함13/9/4). ①metadata Auth실패주입 뒤 onboarding200+users재생성(제품) ②숫자grpc4/10/14503미분류(제품) ③구글fixture providerData 옵션undefined 정규화비교오류(검증도구,양쪽JSON정규화로교정). 이전원래Admin재생성2건·고아발견/실제삭제는해결됨. Task12에서제품2건+openTrailListings.hostUid후보누락마감.
- Codex Supervisor scripts: guest-auth-hook-supervisor.test.mjs(8동작/부모포함9PASS), guest-rules-supervisor.test.mjs(actualHTTP/Rules/Admin/Google4fixture), guest-integration-supervisor.mjs(기본Rules→ride1→lifecycle3, --ride-only/--lifecycle-only는Rules제외), guest-preservation-supervisor.mjs(운영읽기검사), guest-lifecycle-supervisor.test.mjs7, guest-logout-supervisor.test.mjs2, guest-orphan-maintenance.*5.
- 최신운영읽기 evidence/preservation-latest.json: Google4Auth그대로·원래Auth5전원보존·추가Guest2(08:08생성,주체미확정)=전체7. 정리후2176문서삭제0, Google소유1976문서삭제0. 값변경4(주행누적/도로망/cells/lastSeenAt,최상위필드삭제0). motion2동일. 최초정리FS17/RTDB2완료. 원본개인정보 .out/private-guest-lifecycle은외부모델접근금지/ignore검증완료. 테스트전부demo; 새운영Guest는만들지않음. 커밋/푸시/배포없음.
- 마지막읽기검사명령 cwd C:\20.HDev\boxcycle: `node scripts/guest-preservation-supervisor.mjs`. Google계정원본UID등출력하지않음. 기존자료값변경을무조건덮어써복원하지않는다.
- 기존dev서버5000은다른테스트용프로세스이므로임의종료금지. 브라우저시험은5004에서자동서버생성/종료. emulator프로젝트demo 강제.
