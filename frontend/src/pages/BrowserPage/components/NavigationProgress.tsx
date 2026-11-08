import { companionProgress } from "../functions/companionRules";
import { displayAddress } from "../functions/displayAddress";
import { useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";
import type { PendingNavigation } from "../objects/BrowserState";
const labels: Record<string, string> = {
  designing: "设计页面",
  measuring: "检查布局",
  reviewing: "评审设计",
  refining: "优化页面",
  planning: "理解需求",
  searching: "搜索资料",
  reading: "阅读来源",
  choosing: "选择要浏览的对象",
  connecting: "正在连接",
  queued: "等待加载",
  preparing: "准备页面",
  generating: "正在加载页面",
  validating: "正在整理内容",
  repairing: "正在修复页面",
  retrying: "正在重试连接",
  saving: "正在保存页面",
  ready: "页面已就绪",
  failed: "加载失败",
};
type Props = {
  companion?: boolean;
  expanded?: boolean;
  pending: PendingNavigation;
  onRetry: () => void;
  onSettings?: () => void;
  onSelectCandidate?: (id: string) => void;
  onCancel: () => void;
  onCollapse: () => void;
  onDismiss: () => void;
};
export function NavigationProgress({
  pending,
  companion = false,
  expanded,
  onRetry,
  onSettings,
  onSelectCandidate,
  onCancel,
  onCollapse,
  onDismiss,
}: Props) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (pending.finishedAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pending.requestId, pending.finishedAt]);
  useEffect(() => {
    if (pending.status !== "complete") return;
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [pending.status, pending.requestId, onDismiss]);
  const details = expanded ?? !pending.collapsed;
  const error = pending.status === "error";
  const done = pending.status === "complete";
  const steps = pending.job?.steps.length
    ? pending.job.steps
    : pending.job
      ? [{ phase: pending.job.phase, attempt: 1, at: "" }]
      : [];
  const phase = error
    ? "failed"
    : done
      ? "ready"
      : (pending.job?.phase ?? "connecting");
  const elapsed = Math.max(
    0,
    Math.floor(((pending.finishedAt ?? now) - pending.startedAt) / 1000),
  );
  return (
    <section
      data-testid="navigation-progress"
      className={
        "pointer-events-auto relative flex min-h-0 w-80 max-w-[calc(100vw-1.5rem)] flex-col rounded-2xl border border-[#b8d69a]/25 bg-[#252c21] p-4 text-[#dce3d2] shadow-2xl " +
        (companion ? "cat-bubble" : "")
      }
    >
      {companion && (
        <p
          className="mb-3 shrink-0 text-sm leading-6 text-[#dce3d2]"
          aria-live="polite"
        >
          {companionProgress(pending).text}
        </p>
      )}
      <div className="flex shrink-0 items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden">
          {error ? (
            <AlertCircle size={22} className="shrink-0 text-[#e5bc85]" />
          ) : done ? (
            <Check size={22} className="shrink-0 text-[#b8d69a]" />
          ) : (
            <LoaderCircle
              size={22}
              className="shrink-0 animate-spin text-[#b8d69a]"
            />
          )}
        </span>
        <h1 aria-live="polite" className="min-w-0 flex-1 text-sm font-semibold">
          {labels[phase] ?? phase}
        </h1>
        <span className="shrink-0 text-xs tabular-nums text-[#a5b49a]">
          {elapsed} 秒
        </span>
        <button
          aria-label={!details ? "展开加载进度" : "折叠加载进度"}
          aria-expanded={details}
          onClick={onCollapse}
          className="cursor-pointer rounded p-1 hover:bg-white/10"
        >
          {!details ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>
      <div className="min-h-0 overflow-y-auto overscroll-contain">
        {(details || error) && (
          <div className="progress-body min-h-0 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]">
            <p className="mb-4 mt-3 break-all text-xs leading-5 text-[#acbaa1]">
              {displayAddress(pending.input)}
            </p>
            <ol aria-label="加载步骤" className="space-y-2 text-xs">
              <li className="progress-step flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden">
                  {pending.job || done ? (
                    <Check size={12} />
                  ) : error ? (
                    <AlertCircle size={12} />
                  ) : (
                    <LoaderCircle size={12} className="animate-spin" />
                  )}
                </span>
                <span>{pending.job || done ? "连接完成" : "正在连接"}</span>
              </li>
              {steps.map((step, index) => (
                <li
                  key={index}
                  data-step-state={
                    step.phase === "failed"
                      ? "failed"
                      : index === steps.length - 1 && !done && !error
                        ? "active"
                        : "completed"
                  }
                  className="progress-step flex items-center gap-2"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden">
                    {index === steps.length - 1 && !done && !error ? (
                      <LoaderCircle size={12} className="animate-spin" />
                    ) : step.phase === "failed" ? (
                      <AlertCircle size={12} className="text-[#e5bc85]" />
                    ) : (
                      <Check size={12} className="text-[#9cb786]" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    {{
                      queued: "等待队列",
                      preparing: "准备页面",
                      generating: "生成内容",
                      validating: "校验内容",
                      repairing: "修复内容",
                      retrying: "重试接口",
                      saving: "保存内容",
                      ready: "页面就绪",
                      failed: "任务失败",
                    }[step.phase] ??
                      labels[step.phase] ??
                      step.phase}
                    {step.attempt > 1 ? ` · 第 ${step.attempt} 次` : ""}
                  </span>
                  {step.at && (
                    <time className="ml-auto shrink-0 tabular-nums text-[#89997e]">
                      {new Date(step.at).toLocaleTimeString("zh-CN", {
                        hour12: false,
                      })}
                    </time>
                  )}
                </li>
              ))}
              {done && steps.at(-1)?.phase !== "ready" && (
                <li className="text-[#b8d69a]">页面已读取</li>
              )}
            </ol>
            {error && (
              <p
                role="alert"
                className="mt-4 break-words text-sm leading-6 text-[#e5cba8]"
              >
                {pending.message}
              </p>
            )}
          </div>
        )}
        {!done && (details || error) && (
          <div className="mt-4 flex shrink-0 gap-3 text-xs">
            {error && (
              <button
                onClick={onRetry}
                className="cursor-pointer rounded-full bg-[#b8d69a] px-4 py-2 text-[#26301e]"
              >
                重新尝试
              </button>
            )}
            <button
              onClick={onCancel}
              className="cursor-pointer rounded-full border border-white/20 px-4 py-2 hover:bg-white/5"
            >
              取消本次打开
            </button>
          </div>
        )}
        {!!pending.researchCandidates?.length && (
          <div className="mt-4 space-y-2 overflow-y-auto">
            {pending.researchCandidates.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelectCandidate?.(c.id)}
                className="block w-full rounded-xl border border-white/15 p-3 text-left"
              >
                <strong className="text-sm">{c.title}</strong>
                <p className="mt-1 text-xs text-[#a5b49a]">{c.description}</p>
              </button>
            ))}
          </div>
        )}
        {error && pending.message?.includes("配置联网搜索") && (
          <button
            onClick={onSettings}
            className="mt-3 rounded-lg bg-[#b8d69a] p-2 text-sm text-[#25301c]"
          >
            配置联网搜索
          </button>
        )}
      </div>
    </section>
  );
}
