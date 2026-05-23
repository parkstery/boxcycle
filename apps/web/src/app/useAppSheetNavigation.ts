import { useCallback, useState, type Dispatch, type SetStateAction } from "react";

export type AppSheetNavigation = {
  menuOpen: boolean;
  mapViewSheetOpen: boolean;
  userInfoSheetOpen: boolean;
  rideSettingsSheetOpen: boolean;
  setMenuOpen: Dispatch<SetStateAction<boolean>>;
  setMapViewSheetOpen: Dispatch<SetStateAction<boolean>>;
  setUserInfoSheetOpen: Dispatch<SetStateAction<boolean>>;
  setRideSettingsSheetOpen: Dispatch<SetStateAction<boolean>>;
  openMenuPanel: () => void;
  openMapViewPanel: () => void;
  openUserInfoPanel: () => void;
  openRideSettingsPanel: () => void;
};

/** MENU·지도·프로필·주행 설정 시트 — 한 번에 하나만 열리도록 상호 배타 */
export function useAppSheetNavigation(): AppSheetNavigation {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mapViewSheetOpen, setMapViewSheetOpen] = useState(false);
  const [userInfoSheetOpen, setUserInfoSheetOpen] = useState(false);
  const [rideSettingsSheetOpen, setRideSettingsSheetOpen] = useState(false);

  const openMenuPanel = useCallback(() => {
    setMapViewSheetOpen(false);
    setUserInfoSheetOpen(false);
    setRideSettingsSheetOpen(false);
    setMenuOpen(true);
  }, []);

  const openMapViewPanel = useCallback(() => {
    setMenuOpen(false);
    setUserInfoSheetOpen(false);
    setRideSettingsSheetOpen(false);
    setMapViewSheetOpen((v) => !v);
  }, []);

  const openUserInfoPanel = useCallback(() => {
    setMenuOpen(false);
    setMapViewSheetOpen(false);
    setRideSettingsSheetOpen(false);
    setUserInfoSheetOpen((v) => !v);
  }, []);

  const openRideSettingsPanel = useCallback(() => {
    setMenuOpen(false);
    setMapViewSheetOpen(false);
    setUserInfoSheetOpen(false);
    setRideSettingsSheetOpen(true);
  }, []);

  return {
    menuOpen,
    mapViewSheetOpen,
    userInfoSheetOpen,
    rideSettingsSheetOpen,
    setMenuOpen,
    setMapViewSheetOpen,
    setUserInfoSheetOpen,
    setRideSettingsSheetOpen,
    openMenuPanel,
    openMapViewPanel,
    openUserInfoPanel,
    openRideSettingsPanel,
  };
}
