import { useRef } from "react";
import { useDialogFocus } from "../ui/useDialogFocus";
import { useEscapeKeyClose } from "../ui/useEscapeKeyClose";
import { SettingsCloseIcon } from "../ui/SettingsCloseIcon";
import "./RouteClearBlockedDialog.css";

type RouteClearBlockedDialogProps = {
  open: boolean;
  /** 「주행 종료」 — 기존 종료 흐름. 경로는 자동으로 지우지 않는다. */
  onEndRide: () => void;
  /** 「계속 주행」·Esc·바깥 클릭 — 창만 닫는다. */
  onContinue: () => void;
};

/** 주행 중 「경로 삭제」 안내 — 설정 창(SettingsSurface)과 같은 흰 판, 작게. */
export function RouteClearBlockedDialog(props: RouteClearBlockedDialogProps) {
  const { onContinue } = props;
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(props.open, panelRef);
  useEscapeKeyClose(props.open, onContinue);

  if (!props.open) return null;

  return (
    <div className="route-clear-blocked settings-surface" role="dialog" aria-label="주행 중 경로 삭제 안내">
      <button
        type="button"
        className="route-clear-blocked__scrim"
        aria-label="바깥 영역(계속 주행)"
        title="계속 주행"
        onClick={onContinue}
      />
      <div className="route-clear-blocked__panel settings-surface__panel" ref={panelRef}>
        <div className="settings-surface__head">
          <h2 className="settings-surface__title route-clear-blocked__title">주행 중에는 경로를 지울 수 없습니다</h2>
          <button
            type="button"
            className="settings-surface__close"
            aria-label="닫기"
            title="닫기"
            onClick={onContinue}
          >
            <SettingsCloseIcon />
          </button>
        </div>
        <p className="route-clear-blocked__body">주행을 종료한 뒤 경로를 지울 수 있어요.</p>
        <div className="route-clear-blocked__actions">
          <button type="button" className="route-clear-blocked__btn" onClick={onContinue}>
            계속 주행
          </button>
          <button
            type="button"
            className="route-clear-blocked__btn route-clear-blocked__btn--primary"
            onClick={props.onEndRide}
          >
            주행 종료
          </button>
        </div>
      </div>
    </div>
  );
}
