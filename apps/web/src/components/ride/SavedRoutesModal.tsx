import { useState } from "react";
import { RouteListModalShell } from "./RouteListModalShell";
import { SavedRoutesPanel, type SavedRoutesPanelProps } from "./SavedRoutesPanel";

/** 검색어는 이 모달이 제목 줄에서 소유한다 — 호출 측은 넘기지 않는다 */
export type SavedRoutesModalProps = Omit<SavedRoutesPanelProps, "queryText"> & {
  onClose: () => void;
};

/**
 * 「내 경로」 목록 모달 (2026-09-16 B단계).
 *
 * 종전에는 MENU 안 좁은 사이드 패널에서 스크롤했다 — 폰 가로 계측에서 목록에 남는 높이가
 * 61px(스크롤러 clientH 117 / scrollH 221)뿐이라 경로 수십 개를 그 틈으로 봐야 했다.
 * 공식 코스는 이미 모달이었는데, **더 많고 더 자주 쓰고 이름변경·삭제·퍼블릭 등록까지
 * 달린** 내 경로가 더 좁은 자리에 있었다 — 우선순위가 거꾸로였다.
 *
 * 목록·정렬·필터는 `SavedRoutesPanel` 이 그대로 소유한다. 여기서는 자리만 바꾼다.
 * 검색어만은 제목 줄(껍데기)에 입력칸이 있으므로 여기서 들고 패널에 내려준다(2026-10-06).
 */
export function SavedRoutesModal({ onClose, ...panel }: SavedRoutesModalProps) {
  const [queryText, setQueryText] = useState("");
  return (
    <RouteListModalShell
      titleId="saved-routes-modal-title"
      title="내 경로"
      dialogLabel="내 경로"
      searchValue={queryText}
      onSearchChange={setQueryText}
      onClose={onClose}
    >
      <SavedRoutesPanel
        {...panel}
        queryText={queryText}
        onLoadRoute={(route) => {
          panel.onLoadRoute(route);
          onClose();
        }}
        onResumeRoute={
          panel.onResumeRoute
            ? (route) => {
                panel.onResumeRoute?.(route);
                onClose();
              }
            : undefined
        }
        // 「공개」 클릭 시 내 경로 창을 닫아 등록 창이 뒤에 깔리지 않게 한다(2026-10-06 Chief).
        onOpenPublicRequest={
          panel.onOpenPublicRequest
            ? (route) => {
                panel.onOpenPublicRequest?.(route);
                onClose();
              }
            : undefined
        }
      />
    </RouteListModalShell>
  );
}
