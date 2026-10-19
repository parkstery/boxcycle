import { authExpiryNoticeText, type AuthExpiryKind } from "../../lib/identity/authRestore";

export type { AuthExpiryKind };

export function AuthExpiryNotice({ kind }: { kind: AuthExpiryKind }) {
  return (
    <p className="guest-entry__notice" role="status">
      {authExpiryNoticeText(kind)}
    </p>
  );
}
