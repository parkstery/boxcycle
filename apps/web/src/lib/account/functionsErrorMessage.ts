/** Functions HTTP 응답 `{ error: { message } }` 에서 사용자에게 보일 메시지를 뽑는다. 없으면 fallback. */
export function parseErrorMessage(json: unknown, fallback: string): string {
  if (typeof json === "object" && json !== null && "error" in json) {
    const err = (json as { error?: { message?: string } }).error;
    if (typeof err?.message === "string" && err.message.trim()) return err.message.trim();
  }
  return fallback;
}
