# 독립 감리 보완 — Cursor 같은 대화 재개

Supervisor Codex / Developer Cursor AI. Chief승인범위의결함수정이며추가승인불필요. 03-task의소유·금지·기존dirty/증거보존계약유지. 당신은다른변경자와공유하므로타인의변경을되돌리지않는다. 05-review-first.md와독립증거를먼저읽는다. 이지시는1차Cursor종료후실행한다.

감리 중 보존 보완: Supervisor가 ui-800x360.spec.ts 두 캡처의 기본 경로를 testInfo.outputPath로 바꿨다. 이 변경을 보존하라. 1차 회귀가 기존PNG11장을 덮어써서 ZIP baseline으로 정확복구, 새캡처는 evidence/relocated-first-pass에 보존. 이번 실행은 UI_REVALIDATION_EVIDENCE_DIR/ENTRY_CARD_HISTORY_EVIDENCE를 evidence/rework 아래로 명시하고 기존PNG를 다시 쓰지 않는다.

1. **확장된순위창하단잘림**: 실제699×273 개척보조열림시 bottom285>273. 상단offset·안전영역·하단여유를반영해유효최대높이계산. 열린추가순위/개척보조/게스트/순위없음도창전체경계내이고, 최하단문구·모든기존동작을스크롤로라도접근가능하게. 기본순위10명동시노출·440×236목표는유지. expanded순위는스크롤허용(주행설정만스크롤금지). 부모overflow:hidden으로숨기지말것.
2. **행별개척이용정보접근복구**: 현재내길이용details는본인4명/2.2km만, 참가자uses정보는title/aria에만남음. 모바일터치로보이는기존접기/펼치기안에서각참가자의닉네임+이용인원/이용km를확인할수있게하라. 본인/상위/추가/내주변의실제데이터누락금지, 중복제거필요시rank기준. 제목/hover/aria만으로보존완료보고금지. 이름에올려뒀다는부정확한안내삭제/교정. 기본순위밀도유지.
3. **주행설정스트레스실측**: preview에시험전용query등으로유효한긴인터벌값(최대고저/반복/준비/마무리·다중라운드), 프로필체중/체력미설정, bgm미구성비활성, 고도loading을함께재현. 제품컴포넌트실제props로검증하고제품/저장알고리즘변경금지. 699×273·667×300에서모든항목/운동설정/프로필수정/loader가viewport와panel경계내·부모/자식스크롤0인지검증. 현재테스트명「긴 값」만있고실제긴값없으므로실질회귀추가. 필요밀도조정은이번승인설정창에한정, 항목/정보숨김·폰트11px미만금지. 계정embedded/복귀동작유지.
4. **증거와시험**: 기존신규spec에개척보조터치/추가순위/게스트경계와최하단스크롤접근, 설정상기상태를추가. 카메라캡처는메뉴를열고저장(현재implementation/camera샷은메뉴닫은상태). 새증거는evidence/rework/에만저장해1차원본보존. compact-controls·관련영향회귀·tsc·바뀐파일eslint·build·selector·dep/tidy(기존188baseline비교)실행,실패원인과미실행구분. 1차전체quick이미실행했다면변경이UI만인한불필요반복금지.

완료는 `07-result-review-fixes.md`에실제변경파일/명령·통과실패/실측/증거/남은일을한국어로기록. Codex소유HANDOFF/README/고정목록/다른감리문서수정금지. 커밋푸시배포금지. 결과남기고종료.
