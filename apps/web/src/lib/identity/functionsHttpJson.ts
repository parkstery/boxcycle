/** Functions HTTP 응답 본문 모양 — `{ result: { ok }, error: { message } }` */
export type FunctionsHttpJson = { result?: { ok?: boolean }; error?: { message?: string } };

/** 응답 본문을 읽는다(JSON 이 아니면 빈 객체). `ok` 는 HTTP 성공이고 `result.ok === true` 일 때만 true. */
export async function readFunctionsHttpJson(
  res: Response,
): Promise<{ ok: boolean; json: FunctionsHttpJson }> {
  let json: FunctionsHttpJson;
  try {
    json = (await res.json()) as FunctionsHttpJson;
  } catch {
    json = {};
  }
  const ok = res.ok && json.result?.ok === true;
  return { ok, json };
}
