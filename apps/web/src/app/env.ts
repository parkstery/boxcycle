/** 앱 런타임 env (Vite `import.meta.env`) */
export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim() ?? "";
export const FUNCTIONS_REGION =
  import.meta.env.VITE_FUNCTIONS_REGION?.trim() || "asia-northeast3";
