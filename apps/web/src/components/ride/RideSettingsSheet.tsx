import { useEffect } from "react";
import { RideSettingsPanel } from "./RideSettingsPanel";
import "./RideSettingsSheet.css";

type RideSettingsSheetProps = {
  open: boolean;
  onClose: () => void;
  rideTtsEnabled: boolean;
  onRideTtsEnabled: (enabled: boolean) => void;
  rideBgmEnabled: boolean;
  onRideBgmEnabled: (enabled: boolean) => void;
  rideCoachingBanner: boolean;
  onRideCoachingBanner: (enabled: boolean) => void;
  rideBgmCatalogConfigured: boolean;
  rideElevationProfileLoading: boolean;
};

/** 주행·표시 설정 — MENU 와 분리된 하단 시트. 센서는 별도 케이던스 상세 설정이 소유. */
export function RideSettingsSheet(props: RideSettingsSheetProps) {
  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.open, props.onClose]);

  if (!props.open) return null;

  return (
    <div className="ride-settings-sheet" role="dialog" aria-label="주행 설정">
      <button
        type="button"
        className="ride-settings-sheet__scrim"
        aria-label="닫기"
        title="Close"
        onClick={props.onClose}
      />
      <div className="ride-settings-sheet__panel">
        <div className="ride-settings-sheet__handle" aria-hidden />
        <h2 className="ride-settings-sheet__title">주행 설정</h2>

        <RideSettingsPanel
          rideTtsEnabled={props.rideTtsEnabled}
          onRideTtsEnabled={props.onRideTtsEnabled}
          rideBgmEnabled={props.rideBgmEnabled}
          onRideBgmEnabled={props.onRideBgmEnabled}
          rideCoachingBanner={props.rideCoachingBanner}
          onRideCoachingBanner={props.onRideCoachingBanner}
          rideBgmCatalogConfigured={props.rideBgmCatalogConfigured}
          rideElevationProfileLoading={props.rideElevationProfileLoading}
        />
      </div>
    </div>
  );
}
