import { useCallback, useState, type Dispatch, type SetStateAction } from "react";

export type AppSheetNavigation = {
  menuOpen: boolean;
  placeSearchOpen: boolean;
  mapViewSheetOpen: boolean;
  userInfoSheetOpen: boolean;
  rideSettingsSheetOpen: boolean;
  setMenuOpen: Dispatch<SetStateAction<boolean>>;
  setPlaceSearchOpen: Dispatch<SetStateAction<boolean>>;
  setMapViewSheetOpen: Dispatch<SetStateAction<boolean>>;
  setUserInfoSheetOpen: Dispatch<SetStateAction<boolean>>;
  setRideSettingsSheetOpen: Dispatch<SetStateAction<boolean>>;
  openMenuPanel: () => void;
  openPlaceSearchPanel: () => void;
  openMapViewPanel: () => void;
  openUserInfoPanel: () => void;
  openRideSettingsPanel: () => void;
};

/** MENU·지도·프로필·주행 설정 시트 — 한 번에 하나만 열리도록 상호 배타 */
export function useAppSheetNavigation(): AppSheetNavigation {
  const [menuOpen, setMenuOpen] = useState(false);
  const [placeSearchOpen, setPlaceSearchOpen] = useState(false);
  const [mapViewSheetOpen, setMapViewSheetOpen] = useState(false);
  const [userInfoSheetOpen, setUserInfoSheetOpen] = useState(false);
  const [rideSettingsSheetOpen, setRideSettingsSheetOpen] = useState(false);

  const openMenuPanel = useCallback(() => {
    setPlaceSearchOpen(false);
    setMapViewSheetOpen(false);
    setUserInfoSheetOpen(false);
    setRideSettingsSheetOpen(false);
    setMenuOpen(true);
  }, []);

  const openPlaceSearchPanel = useCallback(() => {
    setMenuOpen(false);
    setMapViewSheetOpen(false);
    setUserInfoSheetOpen(false);
    setRideSettingsSheetOpen(false);
    setPlaceSearchOpen((v) => !v);
  }, []);

  const openMapViewPanel = useCallback(() => {
    setMenuOpen(false);
    setPlaceSearchOpen(false);
    setUserInfoSheetOpen(false);
    setRideSettingsSheetOpen(false);
    setMapViewSheetOpen((v) => !v);
  }, []);

  const openUserInfoPanel = useCallback(() => {
    setMenuOpen(false);
    setPlaceSearchOpen(false);
    setMapViewSheetOpen(false);
    setRideSettingsSheetOpen(false);
    setUserInfoSheetOpen((v) => !v);
  }, []);

  const openRideSettingsPanel = useCallback(() => {
    setMenuOpen(false);
    setPlaceSearchOpen(false);
    setMapViewSheetOpen(false);
    setUserInfoSheetOpen(false);
    setRideSettingsSheetOpen(true);
  }, []);

  return {
    menuOpen,
    placeSearchOpen,
    mapViewSheetOpen,
    userInfoSheetOpen,
    rideSettingsSheetOpen,
    setMenuOpen,
    setPlaceSearchOpen,
    setMapViewSheetOpen,
    setUserInfoSheetOpen,
    setRideSettingsSheetOpen,
    openMenuPanel,
    openPlaceSearchPanel,
    openMapViewPanel,
    openUserInfoPanel,
    openRideSettingsPanel,
  };
}
