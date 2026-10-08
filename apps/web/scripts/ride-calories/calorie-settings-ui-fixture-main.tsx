/**
 * 실제 RideSettingsSheet fixture — auth/앱 우회 없음, 시트만 마운트.
 * 체중·강도 입력 가능(인메모리). 프로덕션 저장·로그인 불필요.
 */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { RideSettingsSheet } from "../../src/components/ride/RideSettingsSheet";
import type { CalorieIntensityId } from "../../src/lib/ride/caloriesEstimate";

export function FixtureApp() {
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [intensityId, setIntensityId] = useState<CalorieIntensityId | null>(null);

  return (
    <RideSettingsSheet
      open
      onClose={() => {}}
      rideTtsEnabled={false}
      onRideTtsEnabled={() => {}}
      rideBgmEnabled={false}
      onRideBgmEnabled={() => {}}
      rideCoachingBanner={true}
      onRideCoachingBanner={() => {}}
      pacerEnabled={true}
      onPacerEnabled={() => {}}
      rideBgmCatalogConfigured={false}
      rideElevationProfileLoading={false}
      calorieWeightKg={weightKg}
      onCalorieWeightKg={(raw) => {
        const t = String(raw).trim();
        if (t === "") {
          setWeightKg(null);
          return true;
        }
        const n = Number(t);
        if (!Number.isFinite(n) || n < 30 || n > 300) return false;
        setWeightKg(n);
        return true;
      }}
      calorieIntensityId={intensityId}
      onCalorieIntensityId={(id) => {
        setIntensityId(id);
        return true;
      }}
    />
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("#root missing");

document.body.style.margin = "0";
document.body.style.width = "740px";
document.body.style.height = "300px";
document.body.style.background =
  "linear-gradient(135deg, #1e3a5f 0%, #0f172a 55%, #334155 100%)";
document.body.style.position = "relative";
document.body.style.overflow = "hidden";

createRoot(root).render(<FixtureApp />);
