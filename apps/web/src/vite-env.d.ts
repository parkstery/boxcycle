/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  /** Mapbox GL 타일·스타일용 public 토큰(pk.). Directions REST는 Cloud Functions만 사용 */
  readonly VITE_MAPBOX_ACCESS_TOKEN: string;
  /** Cloud Functions 리전(기본 asia-northeast3). Callable `getMapboxDirections` 와 일치해야 함 */
  readonly VITE_FUNCTIONS_REGION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
