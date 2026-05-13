/**
 * 퍼블릭 신청 제목·소개 자동 검수(클라이언트).
 * 욕설·정책 위반의 최종 판단은 Cloud Functions + 전용 모더레이션 API 권장.
 * `VITE_PUBLIC_ROUTE_MODERATION_URL` 이 설정되면 동일 본문을 POST 로 위임해 `allowed: false` 시 거절한다.
 */

const INVISIBLE_OR_CONTROL = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u200B-\u200D\uFEFF]/;

/** 동일 문자·이모지 등 과도 반복(스팸 패턴) */
const EXCESSIVE_REPEAT = /(.)\1{49,}/u;

function countHttpUrls(s: string): number {
  return (s.match(/https?:\/\//gi) ?? []).length;
}

/**
 * 구조·스팸 패턴만 차단. 전문 모더레이션은 `maybeModeratePublicRouteCopyRemote` 사용.
 */
export function validatePublicRouteTitleAndSummary(title: string, summary: string): void {
  if (INVISIBLE_OR_CONTROL.test(title) || INVISIBLE_OR_CONTROL.test(summary)) {
    throw new Error("제목·소개에 사용할 수 없는 제어문자·숨김 문자가 포함되어 있습니다.");
  }
  if (/[\r\n]/.test(title)) {
    throw new Error("공개 제목에는 줄바꿈을 넣을 수 없습니다.");
  }
  if (EXCESSIVE_REPEAT.test(title) || EXCESSIVE_REPEAT.test(summary)) {
    throw new Error("제목·소개에 과도하게 반복되는 문자가 있습니다.");
  }
  const links = countHttpUrls(title) + countHttpUrls(summary);
  if (links > 8) {
    throw new Error("제목·소개에 포함할 수 있는 링크 개수를 초과했습니다.");
  }
}

function readModerationUrl(): string | null {
  try {
    const v = import.meta.env?.VITE_PUBLIC_ROUTE_MODERATION_URL;
    return typeof v === "string" && v.length >= 8 ? v.trim() : null;
  } catch {
    return null;
  }
}

/**
 * 배포 시 Functions 프록시 등에 `POST { title, summary }` → JSON `{ allowed: boolean, reason?: string }` 규약을 맞춘다.
 * URL 미설정이면 아무 것도 하지 않는다.
 */
export async function maybeModeratePublicRouteCopyRemote(title: string, summary: string): Promise<void> {
  const url = readModerationUrl();
  if (!url) return;

  const ac = new AbortController();
  const timer = globalThis.setTimeout(() => ac.abort(), 12_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, summary }),
      signal: ac.signal,
    });
    if (!res.ok) {
      throw new Error("콘텐츠 검수 서비스에 연결하지 못했습니다. 잠시 후 다시 시도하세요.");
    }
    const j = (await res.json()) as { allowed?: boolean; reason?: string };
    if (j.allowed === false) {
      const r = typeof j.reason === "string" && j.reason.trim().length > 0 ? j.reason.trim() : null;
      throw new Error(r ?? "콘텐츠 검수에서 등록이 거부되었습니다.");
    }
  } finally {
    globalThis.clearTimeout(timer);
  }
}
