import type { RouteProfile } from "../../services/mapboxDirections";
import {
  ROUTE_PROFILE_ICON_INNER_HTML,
  routeProfileLabelKo,
} from "../../lib/route/routeProfileIcons";

type RouteProfileIconProps = {
  profile: RouteProfile;
  className?: string;
};

/** 경로 목록·내 경로(classic) — 팝업과 동일한 Lucide stroke 아이콘 */
export function RouteProfileIcon({ profile, className = "route-list__profile-icon" }: RouteProfileIconProps) {
  const label = routeProfileLabelKo(profile);
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      <g dangerouslySetInnerHTML={{ __html: ROUTE_PROFILE_ICON_INNER_HTML[profile] }} />
    </svg>
  );
}
