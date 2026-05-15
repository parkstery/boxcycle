import { useState } from "react";
import type { SavedRoute } from "../lib/firestoreSavedRoutes";
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
  }) => Promise<void>;
};

export function PublicRouteRequestModal(props: PublicRouteRequestModalProps) {
  const [publicTitle, setPublicTitle] = useState(props.route.name);
  const [publicSummary, setPublicSummary] = useState("");
  const [tags, setTags] = useState<ExperienceTagId[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (tags.length < 1) {
      setError("경로 프로필 태그를 1개 이상 선택하세요.");
      return;
    }
    setBusy(true);
    try {
      await props.onSubmit({ publicTitle, publicSummary, experienceTags: tags });
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
        <form onSubmit={(e) => void handleSubmit(e)} className="pr-modal__form">
          <label className="pr-modal__label">
            공개 제목 (1~80자)
            <input
              className="pr-modal__input"
              value={publicTitle}
              maxLength={80}
              required
              onChange={(e) => setPublicTitle(e.target.value)}
            />
          </label>
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
              disabled={busy}
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
