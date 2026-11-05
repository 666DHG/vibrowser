import { z } from "zod";
const messageNames = [
  "GetResearchSettingsMessage",
  "SaveResearchSettingsMessage",
  "ClearResearchCredentialsMessage",
  "TestResearchConnectionMessage",
  "GetPageSourcesMessage",
  "SelectResearchSubjectMessage",
  "NavigateMessage",
  "SubmitPageActionMessage",
  "GetPageMessage",
  "RetryPageMessage",
  "GetSettingsMessage",
  "SaveSettingsMessage",
  "ClearCredentialsMessage",
  "TestConnectionMessage",
  "ListBookmarksMessage",
  "SaveBookmarkMessage",
  "RemoveBookmarkMessage",
] as const;
export type MessageName = (typeof messageNames)[number];
export function apiName(name: MessageName): string {
  return name.replace(/Message$/, "").toLowerCase();
}
export async function send<T>(
  name: MessageName,
  payload: unknown,
  schema: z.ZodType<T>,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch("/api/" + apiName(name), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
      : AbortSignal.timeout(15000),
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    const error = z.object({ message: z.string() }).safeParse(data);
    throw new Error(
      error.success ? error.data.message : "请求失败，请检查本地服务",
    );
  }
  return schema.parse(data);
}
