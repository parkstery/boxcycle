import { RouteListModalShell } from "./RouteListModalShell";
import { SavedRoutesPanel, type SavedRoutesPanelProps } from "./SavedRoutesPanel";

export type SavedRoutesModalProps = SavedRoutesPanelProps & {
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
 * 목록·검색·정렬·필터는 `SavedRoutesPanel` 이 그대로 소유한다. 여기서는 자리만 바꾼다.
 */
export function SavedRoutesModal({ onClose, ...panel }: SavedRoutesModalProps) {
  return (
    <RouteListModalShell titleId="saved-routes-modal-title" title="내 경로" onClose={onClose}>
      <SavedRoutesPanel
        {...panel}
        onLoadRoute={(route) => {
          panel.onLoadRoute(route);
          onClose();
        }}
      />
    </RouteListModalShell>
  );
}
