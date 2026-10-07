import type { Response } from "@playwright/test";

/** 경로 Functions 미리 깨우기(`{ data: { warm: true } }`) 응답 — 경로 결과로 집지 않는다. */
export function isRouteWarmRequest(r: Response): boolean {
  return r.request().postData()?.includes('"warm":true') ?? false;
}
