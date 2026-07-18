import { useEffect, useMemo, useRef, useState } from "react";
import type { SavedRoute } from "../lib/firestoreSavedRoutes";
import {
  PUBLIC_ROUTE_NAMING_DISCLOSURE_KO,
  PUBLIC_ROUTE_NAMING_GUIDE_KO,
  hintPublicRouteTitle,
  shouldOpenNamingHelpForError,
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

function NamingHelpPanel(props: { onClose: () => void }) {
  return (
    <div
      className="pr-modal__help-overlay"
      role="presentation"
      onMouseDown={() => props.onClose()}
    >
      <div
        className="pr-modal__help"
        role="dialog"
        aria-labelledby="pr-naming-help-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 id="pr-naming-help-title" className="pr-modal__help-title">
          공개 제목 안내
        </h3>
        <ul className="pr-modal__help-list">
          {PUBLIC_ROUTE_NAMING_DISCLOSURE_KO.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="pr-modal__help-guide">{PUBLIC_ROUTE_NAMING_GUIDE_KO}</p>
        <button type="button" className="pr-modal__btn" onClick={props.onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}

export function PublicRouteRequestModal(props: PublicRouteRequestModalProps) {
  const [publicTitle, setPublicTitle] = useState(props.route.name);
  const [publicSummary, setPublicSummary] = useState("");
  const [tags, setTags] = useState<ExperienceTagId[]>([]);
  const [policyAck, setPolicyAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const lastHintRef = useRef<string | null>(null);

  const titleHint = useMemo(() => hintPublicRouteTitle(publicTitle), [publicTitle]);

  useEffect(() => {
    if (!titleHint || titleHint === lastHintRef.current) return;
    lastHintRef.current = titleHint;
    setHelpOpen(true);
  }, [titleHint]);

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
      setError("제목 정책에 동의해 주세요.");
      setHelpOpen(true);
      return;
    }
    if (tags.length < 1) {
      setError("태그 1개 이상 선택");
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
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      if (shouldOpenNamingHelpForError(message)) {
        setHelpOpen(true);
      }
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
          퍼블릭 등록
        </h2>

        <form onSubmit={(e) => void handleSubmit(e)} className="pr-modal__form">
          <div className="pr-modal__field">
            <div className="pr-modal__label-row">
              <label className="pr-modal__label" htmlFor="pr-public-title">
                공개 제목
              </label>
              <button
                type="button"
                className="pr-modal__help-btn"
                aria-label="공개 제목 안내"
                title="안내"
                onClick={() => setHelpOpen(true)}
              >
                ?
              </button>
            </div>
            <input
              id="pr-public-title"
              className="pr-modal__input"
              value={publicTitle}
              maxLength={80}
              required
              placeholder="닉네임 · 지역 · 특성"
              onChange={(e) => setPublicTitle(e.target.value)}
            />
          </div>

          <div className="pr-modal__field">
            <label className="pr-modal__label" htmlFor="pr-public-summary">
              소개 (선택)
            </label>
            <textarea
              id="pr-public-summary"
              className="pr-modal__textarea"
              value={publicSummary}
              maxLength={500}
              rows={3}
              placeholder="이 코스의 특징이나 볼거리를 소개해 주세요"
              onChange={(e) => setPublicSummary(e.target.value)}
            />
          </div>

          <fieldset className="pr-modal__fieldset">
            <legend className="pr-modal__legend">태그 (1~3)</legend>
            <div className="pr-modal__tags">
              {EXPERIENCE_TAG_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`pr-modal__tag ${tags.includes(opt.id) ? "is-on" : ""}`}
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
            <span>제목 정책 확인</span>
            <button
              type="button"
              className="pr-modal__help-btn pr-modal__help-btn--inline"
              aria-label="제목 정책 안내"
              onClick={(e) => {
                e.preventDefault();
                setHelpOpen(true);
              }}
            >
              ?
            </button>
          </label>

          {error ? (
            <p className="pr-modal__error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="pr-modal__actions">
            <button type="button" className="pr-modal__btn" disabled={busy} onClick={props.onClose}>
              취소
            </button>
            <button
              type="submit"
              className="pr-modal__btn pr-modal__btn--primary"
              disabled={busy || !policyAck}
            >
              {busy ? "검수 중…" : "등록"}
            </button>
          </div>
        </form>

        {helpOpen ? <NamingHelpPanel onClose={() => setHelpOpen(false)} /> : null}
      </div>
    </div>
  );
}
