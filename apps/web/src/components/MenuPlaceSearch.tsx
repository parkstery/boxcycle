import { useCallback, useEffect, useRef, useState } from "react";
import type { LngLat } from "../lib/geo";
import {
  fetchMapboxForwardGeocodeSuggestions,
  fetchMapboxPlacePickDetail,
  isMapboxGeocodeFeatureId,
  type MapboxGeocodeBbox,
  type MapboxGeocodeSuggestion,
} from "../services/mapboxForwardGeocode";
import "./MenuPlaceSearch.css";

type MenuPlaceSearchProps = {
  accessToken: string;
  /** 메뉴가 닫히면 목록·로딩만 정리; 검색어는 유지 */
  menuOpen: boolean;
  onPickPlace: (lngLat: LngLat, placeName: string, bbox: MapboxGeocodeBbox | null) => void;
};

export function MenuPlaceSearch({ accessToken, menuOpen, onPickPlace }: MenuPlaceSearchProps) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [suggestions, setSuggestions] = useState<MapboxGeocodeSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const wasMenuOpenRef = useRef(false);

  useEffect(() => {
    if (!menuOpen) {
      setSuggestions([]);
      setFetchError(null);
      setLoading(false);
      abortRef.current?.abort();
      abortRef.current = null;
    }
  }, [menuOpen]);

  /** 메뉴를 막 연 직후: 직전 검색어로 debounced 를 맞춰 자동완성이 바로 동작하게 함 */
  useEffect(() => {
    if (menuOpen && !wasMenuOpenRef.current) {
      setDebounced(query.trim());
    }
    wasMenuOpenRef.current = menuOpen;
  }, [menuOpen, query]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 320);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const token = accessToken.trim();
    if (!menuOpen || debounced.length < 2 || !token) {
      setSuggestions([]);
      setFetchError(null);
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setSuggestions([]);
    setLoading(true);
    setFetchError(null);

    void (async () => {
      try {
        const list = await fetchMapboxForwardGeocodeSuggestions(debounced, token, ac.signal);
        if (ac.signal.aborted) return;
        setSuggestions(list);
      } catch (e) {
        if (ac.signal.aborted) return;
        setSuggestions([]);
        setFetchError(e instanceof Error ? e.message : "검색에 실패했습니다.");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [debounced, accessToken, menuOpen]);

  const handlePick = useCallback(
    async (s: MapboxGeocodeSuggestion) => {
      const token = accessToken.trim();
      let lngLat = s.center;
      let bbox: MapboxGeocodeBbox | null = s.bbox;
      if (token && isMapboxGeocodeFeatureId(s.id)) {
        try {
          const detail = await fetchMapboxPlacePickDetail(s.id, token);
          if (detail) {
            lngLat = detail.center;
            if (detail.bbox) bbox = detail.bbox;
          }
        } catch {
          /* 자동완성 center·bbox 유지 */
        }
      }
      onPickPlace(lngLat, s.placeName, bbox);
      setQuery(s.placeName);
      setSuggestions([]);
    },
    [accessToken, onPickPlace],
  );

  const tokenOk = accessToken.trim().length > 0;
  const showList = Boolean(
    menuOpen &&
      tokenOk &&
      debounced.length >= 2 &&
      (suggestions.length > 0 || loading || fetchError),
  );

  return (
    <div className="menu-place-search">
      <label className="menu-place-search__label" htmlFor="menu-place-search-input">
        지명 검색
      </label>
      <div className="menu-place-search__input-wrap">
        <input
          id="menu-place-search-input"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          className="menu-place-search__input"
          placeholder="예: Rome, 강남역"
          value={query}
          disabled={!menuOpen || !tokenOk}
          onChange={(e) => setQuery(e.target.value)}
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls="menu-place-search-listbox"
        />
      </div>
      {!tokenOk ? (
        <p className="menu-place-search__hint">Mapbox 토큰이 없으면 검색할 수 없습니다.</p>
      ) : null}
      {showList ? (
        <>
          {loading ? <p className="menu-place-search__status">검색 중…</p> : null}
          {fetchError ? <p className="menu-place-search__status">{fetchError}</p> : null}
          {!loading && !fetchError && suggestions.length === 0 ? (
            <p className="menu-place-search__status">일치하는 지명이 없습니다.</p>
          ) : null}
          {suggestions.length > 0 ? (
            <ul id="menu-place-search-listbox" className="menu-place-search__list" role="listbox">
              {suggestions.map((s) => (
                <li key={s.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    className="menu-place-search__item"
                    title="Go to this place"
                    onClick={() => handlePick(s)}
                  >
                    {s.placeName}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
