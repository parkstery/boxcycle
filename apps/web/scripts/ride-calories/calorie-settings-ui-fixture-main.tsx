/**
 * 실제 RideSettingsSheet + ProfileEditSheet fixture — auth/앱 우회 없음.
 * 주행 설정은 칼로리 읽기 전용 요약, 편집은 프로필 수정(묶음4·시안13/15). 인메모리만.
 */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import type { User } from "firebase/auth";
import { RideSettingsSheet } from "../../src/components/ride/RideSettingsSheet";
import { ProfileEditSheet } from "../../src/components/ProfileEditSheet";
import {
  WEIGHT_KG_MAX,
  WEIGHT_KG_MIN,
  type CalorieIntensityId,
} from "../../src/lib/ride/caloriesEstimate";

const fixtureGuestUser = {
  uid: "calorie-fixture-guest",
  isAnonymous: true,
  displayName: null,
} as User;

export function FixtureApp() {
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [intensityId, setIntensityId] = useState<CalorieIntensityId | null>(null);

  return (
    <div
      id="calorie-settings-fixture"
      data-settings-open={settingsOpen ? "1" : "0"}
      data-profile-open={profileOpen ? "1" : "0"}
      data-weight-kg={weightKg ?? ""}
      data-intensity-id={intensityId ?? ""}
    >
      <RideSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
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
        calorieIntensityId={intensityId}
        onEditProfile={() => {
          setSettingsOpen(false);
          setProfileOpen(true);
        }}
      />
      <ProfileEditSheet
        open={profileOpen}
        onClose={() => {
          setProfileOpen(false);
          setSettingsOpen(true);
        }}
        user={fixtureGuestUser}
        weightKg={weightKg}
        intensityId={intensityId}
        nicknameChangedAtMs={null}
        onChangeNickname={async () => {}}
        onWeightKg={(raw) => {
          const t = String(raw).trim();
          if (t === "") {
            setWeightKg(null);
            return true;
          }
          const n = Number(t);
          if (!Number.isFinite(n) || n < WEIGHT_KG_MIN || n > WEIGHT_KG_MAX) return false;
          setWeightKg(n);
          return true;
        }}
        onIntensityId={(id) => {
          setIntensityId(id);
          return true;
        }}
      />
    </div>
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
