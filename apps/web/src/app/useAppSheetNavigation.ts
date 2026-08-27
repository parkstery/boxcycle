import { useCallback, useState, type Dispatch, type SetStateAction } from "react";

export type AppSheetNavigation = {
  menuOpen: boolean;
  placeSearchOpen: boolean;
  mapViewSheetOpen: boolean;
  userInfoSheetOpen: boolean;
  rideSettingsSheetOpen: boolean;
  cadenceSensorSheetOpen: boolean;
  setMenuOpen: Dispatch<SetStateAction<boolean>>;
  setPlaceSearchOpen: Dispatch<SetStateAction<boolean>>;
  setMapViewSheetOpen: Dispatch<SetStateAction<boolean>>;
  setUserInfoSheetOpen: Dispatch<SetStateAction<boolean>>;
  setRideSettingsSheetOpen: Dispatch<SetStateAction<boolean>>;
  setCadenceSensorSheetOpen: Dispatch<SetStateAction<boolean>>;
  openMenuPanel: () => void;
  openPlaceSearchPanel: () => void;
  openMapViewPanel: () => void;
  openUserInfoPanel: () => void;
  openRideSettingsPanel: () => void;
  openCadenceSensorPanel: () => void;
};

/** MENU·지도·프로필·주행 설정·센서 시트 — 한 번에 하나만 열리도록 상호 배타 */
export function useAppSheetNavigation(): AppSheetNavigation {
  const [menuOpen, setMenuOpen] = useState(false);
  const [placeSearchOpen, setPlaceSearchOpen] = useState(false);
  const [mapViewSheetOpen, setMapViewSheetOpen] = useState(false);
  const [userInfoSheetOpen, setUserInfoSheetOpen] = useState(false);
  const [rideSettingsSheetOpen, setRideSettingsSheetOpen] = useState(false);
  const [cadenceSensorSheetOpen, setCadenceSensorSheetOpen] = useState(false);

  const openMenuPanel = useCallback(() => {
    setPlaceSearchOpen(false);
    setMapViewSheetOpen(false);
    setUserInfoSheetOpen(false);
    setRideSettingsSheetOpen(false);
    setCadenceSensorSheetOpen(false);
    setMenuOpen(true);
  }, []);

  const openPlaceSearchPanel = useCallback(() => {
    setMenuOpen(false);
    setMapViewSheetOpen(false);
    setUserInfoSheetOpen(false);
    setRideSettingsSheetOpen(false);
    setCadenceSensorSheetOpen(false);
    setPlaceSearchOpen((v) => !v);
  }, []);

  const openMapViewPanel = useCallback(() => {
    setMenuOpen(false);
    setPlaceSearchOpen(false);
    setUserInfoSheetOpen(false);
    setRideSettingsSheetOpen(false);
    setCadenceSensorSheetOpen(false);
    setMapViewSheetOpen((v) => !v);
  }, []);

  const openUserInfoPanel = useCallback(() => {
    setMenuOpen(false);
    setPlaceSearchOpen(false);
    setMapViewSheetOpen(false);
    setRideSettingsSheetOpen(false);
    setCadenceSensorSheetOpen(false);
    setUserInfoSheetOpen((v) => !v);
  }, []);

  const openRideSettingsPanel = useCallback(() => {
    setMenuOpen(false);
    setPlaceSearchOpen(false);
    setMapViewSheetOpen(false);
    setUserInfoSheetOpen(false);
    setCadenceSensorSheetOpen(false);
    setRideSettingsSheetOpen(true);
  }, []);

  /** HUD 센서 칩 — 케이던스 상세 설정(주행 입력 준비·단절 복구) */
  const openCadenceSensorPanel = useCallback(() => {
    setMenuOpen(false);
    setPlaceSearchOpen(false);
    setMapViewSheetOpen(false);
    setUserInfoSheetOpen(false);
    setRideSettingsSheetOpen(false);
    setCadenceSensorSheetOpen((v) => !v);
  }, []);

  return {
    menuOpen,
    placeSearchOpen,
    mapViewSheetOpen,
    userInfoSheetOpen,
    rideSettingsSheetOpen,
    cadenceSensorSheetOpen,
    setMenuOpen,
    setPlaceSearchOpen,
    setMapViewSheetOpen,
    setUserInfoSheetOpen,
    setRideSettingsSheetOpen,
    setCadenceSensorSheetOpen,
    openMenuPanel,
    openPlaceSearchPanel,
    openMapViewPanel,
    openUserInfoPanel,
    openRideSettingsPanel,
    openCadenceSensorPanel,
  };
}
