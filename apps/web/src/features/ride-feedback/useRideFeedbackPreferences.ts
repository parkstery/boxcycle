import { useState } from "react";

/** 코칭 TTS · 주행 BGM · HUD 코칭 배너 토글(주행 핵심 상태와 분리) */
export function useRideFeedbackPreferences(): {
  rideTtsEnabled: boolean;
  setRideTtsEnabled: (v: boolean) => void;
  rideBgmEnabled: boolean;
  setRideBgmEnabled: (v: boolean) => void;
  rideCoachingBannerVisible: boolean;
  setRideCoachingBannerVisible: (v: boolean) => void;
} {
  const [rideTtsEnabled, setRideTtsEnabled] = useState(true);
  const [rideBgmEnabled, setRideBgmEnabled] = useState(true);
  const [rideCoachingBannerVisible, setRideCoachingBannerVisible] = useState(true);
  return {
    rideTtsEnabled,
    setRideTtsEnabled,
    rideBgmEnabled,
    setRideBgmEnabled,
    rideCoachingBannerVisible,
    setRideCoachingBannerVisible,
  };
}
