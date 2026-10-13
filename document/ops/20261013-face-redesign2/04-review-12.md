# 감리12 — 프로필 지정 컨트롤 절반 높이

Chief 명시 지시로 지정 컨트롤의44px원칙을22px로대체. 다른창/공용규칙의변경아님. Developer Muse Spark1.3,exec27511 exit0. target face-redesign2의ProfileEditSheet.css/tsx만. TSX전후snapshotdiff:닉네임전용class추가1곳,칼로리계산제목span삭제1곳,로직변경없음. CSS높이44→22,padding/line-height/닉네임grid만변경. 글씨·색·안내·옵션이름불변.

독립검증: profile-state-qa.cjs를AUDIT_PROFILE_BASELINE=profile-before-12.css,AUDIT_OUT=profile-12-shots로실행 exit0。실제컴포넌트/로컬mockUser·callback,정상/잠금/입력오류 ×800x360/740x300/667x300/844x390 총12조합。pageerror0,수평/수직overflow0。모든입력·강도칩·취소·저장rect높이정확히22px,전후fontSize차이0。정상afterPNG직접시각확인:닉네임라벨과입력같은행,글씨잘림없음,칼로리계산제목없음。

정상패널297×154.06px,잠금297×141.67px,오류297×171.89px。측정before는새TSX에기존CSS만주입한것이므로'전체변경전높이'로성과비교하지않는다。profile-before-12.tsx/css원본별도보존。실제계정인증/서버저장/실기기터치미검증,기능전체PASS아님。

정확한apps/web cwd에서 node C:/20.HDev/boxcycle/node_modules/typescript/bin/tsc -b --pretty false 및git diff --check 최종exit0。개발자diff-check출력없음。commit/push/deploy/서버재시작/사용자관찰탭조작없음。5013HMR반영,Chief확인대기。
