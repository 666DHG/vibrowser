import type { PendingNavigation } from "../objects/BrowserState";
import type {
  CatExpression,
  CompanionPreferences,
} from "../objects/CompanionState";
export const defaultCompanionPreferences: CompanionPreferences = {
  visible: true,
  automatic: true,
  ai: true,
};
export function readCompanionPreferences(
  raw: string | null,
): CompanionPreferences {
  try {
    const value = JSON.parse(raw ?? "{}");
    return Object.fromEntries(
      Object.entries(defaultCompanionPreferences).map(([key, fallback]) => [
        key,
        typeof value?.[key] === "boolean" ? value[key] : fallback,
      ]),
    ) as unknown as CompanionPreferences;
  } catch {
    return defaultCompanionPreferences;
  }
}
export function canSpeak(
  now: number,
  last: number,
  automatic: boolean,
): boolean {
  return now - last >= (automatic ? 60000 : 3000);
}
export function companionProgress(pending: PendingNavigation): {
  text: string;
  expression: CatExpression;
} {
  if (pending.status === "error")
    return { text: "这里绊了一下，我们看看怎么继续。", expression: "puzzled" };
  if (pending.researchCandidates?.length)
    return { text: "找到几个方向，你想先看哪个？", expression: "observe" };
  if (pending.status === "complete")
    return { text: "打开啦！一起看看里面有什么。", expression: "happy" };
  const phase = pending.job?.phase ?? "connecting";
  const lines: Record<string, string> = {
    planning: "让我理理这条线索……",
    searching: "我去找找线索……",
    reading: "正在翻阅找到的资料。",
    designing: "给这个想法找个合适的模样。",
    measuring: "看看内容有没有挤在一起。",
    reviewing: "再仔细瞧一瞧。",
    refining: "正在打磨几个小地方。",
    repairing: "有个地方需要修一修。",
    retrying: "再试着连接一次。",
    saving: "快收拾好了。",
    queued: "排到我们前，先陪你坐一会儿。",
  };
  return {
    text: lines[phase] ?? "你的想法正在慢慢展开。",
    expression:
      phase === "connecting" || phase === "planning" ? "observe" : "waiting",
  };
}
