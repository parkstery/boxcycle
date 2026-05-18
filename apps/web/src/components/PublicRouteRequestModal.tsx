import { useMemo, useState } from "react";
import type { SavedRoute } from "../lib/firestoreSavedRoutes";
import {
  PUBLIC_ROUTE_NAMING_DISCLOSURE_KO,
  PUBLIC_ROUTE_NAMING_GUIDE_KO,
  hintPublicRouteTitle,
} from "../lib/publicRouteNamingPolicy";
import {
  EXPERIENCE_TAG_OPTIONS,
  type ExperienceTagId,
} from "../lib/publicRouteRequests";
import "./PublicRouteRequestModal.css";

export type PublicRouteRequestModalProps = {
  route: SavedRoute;
  onClose: () => void;
  onSubmit: (input: {
    publicTitle: string;
    publicSummary: string;
    experienceTags: ExperienceTagId[];
    namingPolicyAcknowledged: boolean;
  }) => Promise<void>;
};

export function PublicRouteRequestModal(props: PublicRouteRequestModalProps) {
  const [publicTitle, setPublicTitle] = useState(props.route.name);
  const [publicSummary, setPublicSummary] = useState("");
  const [tags, setTags] = useState<ExperienceTagId[]>([]);
  const [policyAck, setPolicyAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleHint = useMemo(() => hintPublicRouteTitle(publicTitle), [publicTitle]);

  function toggleTag(id: ExperienceTagId) {
    setTags((prev) => {
      if (prev.includes(id)) return prev.filter((t) => t !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!policyAck) {
      setError("공개 제목 정책에 동의해야 신청할 수 있습니다.");
      return;
    }
    if (tags.length < 1) {
      setError("경로 프로필 태그를 1개 이상 선택하세요.");
      return;
    }
    setBusy(true);
    try {
      await props.onSubmit({
        publicTitle,
        publicSummary,
        experienceTags: tags,
        namingPolicyAcknowledged: true,
      });
      props.onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pr-modal-overlay" role="presentation" onMouseDown={() => props.onClose()}>
      <div
        className="pr-modal"
        role="dialog"
        aria-labelledby="pr-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="pr-modal-title" className="pr-modal__title">
          공개 경로 등록 신청
        </h2>
        <p className="pr-modal__lead">
          완주한 사용자 경로 「{props.route.name}」을 다른 이용자에게 공개하려면 아래를 작성한 뒤 제출하세요. 관리자
          승인 후 공개 코스로 등록됩니다.
        </p>

        <section className="pr-modal__notice" aria-label="공개 제목 정책">
          <h3 className="pr-modal__notice-title">공개 제목 안내</h3>
          <ul className="pr-modal__notice-list">
            {PUBLIC_ROUTE_NAMING_DISCLOSURE_KO.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="pr-modal__guide">{PUBLIC_ROUTE_NAMING_GUIDE_KO}</p>
        </section>

        <form onSubmit={(e) => void handleSubmit(e)} className="pr-modal__form">
          <label className="pr-modal__label">
            공개 제목 (1~80자)
            <input
              className="pr-modal__input"
              value={publicTitle}
              maxLength={80}
              required
              placeholder="예: 닉네임 · 한강 양화 · 왕복 12km"
              onChange={(e) => setPublicTitle(e.target.value)}
            />
          </label>
          {titleHint ? (
            <p className="pr-modal__hint" role="status">
              {titleHint}
            </p>
          ) : null}
          <p className="pr-modal__name-note">
            내 경로 이름 「{props.route.name}」은 본인만 보는 라벨이며, 위 공개 제목과 자동으로 맞춰지지
            않습니다.
          </p>
          <label className="pr-modal__label">
            간단 소개 (선택, 최대 500자)
            <textarea
              className="pr-modal__textarea"
              value={publicSummary}
              maxLength={500}
              rows={3}
              onChange={(e) => setPublicSummary(e.target.value)}
            />
          </label>
          <fieldset className="pr-modal__fieldset">
            <legend className="pr-modal__legend">경로 프로필 (1~3개)</legend>
            <div className="pr-modal__tags">
              {EXPERIENCE_TAG_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`pr-modal__tag ${tags.includes(opt.id) ? "is-on" : ""}`}
                  title="Toggle experience tag (max 3)"
                  onClick={() => toggleTag(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="pr-modal__ack">
            <input
              type="checkbox"
              checked={policyAck}
              onChange={(e) => setPolicyAck(e.target.checked)}
            />
            <span>공개 제목은 승인 후 임의로 바꿀 수 없으며, 위 안내와 명명 가이드를 확인했습니다.</span>
          </label>

          {error ? (
            <p className="pr-modal__error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="pr-modal__actions">
            <button
              type="button"
              className="pr-modal__btn"
              disabled={busy}
              title="Cancel"
              onClick={props.onClose}
            >
              취소
            </button>
            <button
              type="submit"
              className="pr-modal__btn pr-modal__btn--primary"
              disabled={busy || !policyAck}
              title="Submit request"
            >
              {busy ? "제출 중…" : "신청하기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
