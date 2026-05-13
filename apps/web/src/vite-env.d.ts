/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  /** Mapbox GL 타일·스타일용 public 토큰(pk.). Directions REST는 기본적으로 Cloud Functions만 사용 */
  readonly VITE_MAPBOX_ACCESS_TOKEN: string;
  /** Cloud Functions 리전(기본 asia-northeast3). Callable `getMapboxDirections` 와 일치해야 함 */
  readonly VITE_FUNCTIONS_REGION?: string;
  /**
   * 임시 우회 플래그. "1" 또는 "true" 이면 Directions 를 브라우저에서 Mapbox REST 로 직접 호출합니다.
   * Cloud Functions Gen2 의 Cloud Run Invoker 권한 이슈로 CORS 가 막힐 때만 켜고,
   * Firebase 정상화 후에는 즉시 제거하세요. (pk. 토큰이 네트워크에 노출됨)
   */
  readonly VITE_DIRECTIONS_DIRECT?: string;
  /**
   * 공개 경로 신청 제목·소개 원격 모더레이션(선택).
   * POST JSON `{ title, summary }` → `{ allowed: boolean, reason?: string }` 규약. Functions 프록시 URL 권장.
   */
  readonly VITE_PUBLIC_ROUTE_MODERATION_URL?: string;
  /** Mapillary Graph + mapillary-js Viewer용 클라이언트 토큰(선택). 없으면 거리뷰 비활성 */
  readonly VITE_MAPILLARY_CLIENT_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
