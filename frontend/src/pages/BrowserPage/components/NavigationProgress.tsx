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
  pending: PendingNavigation;
  fullscreen: boolean;
  onRetry: () => void;
  onCancel: () => void;
  onCollapse: () => void;
  onDismiss: () => void;
};
export function NavigationProgress({
  pending,
  fullscreen,
  onRetry,
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
    const timer = setTimeout(onDismiss, 1800);
    return () => clearTimeout(timer);
  }, [pending.status, pending.requestId, onDismiss]);
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
      data-testid={fullscreen ? "fullscreen-progress" : "navigation-progress"}
      className={
        fullscreen
          ? "mx-auto flex min-h-[65vh] max-w-lg flex-col justify-center px-6 py-8"
          : "absolute bottom-4 right-4 z-20 max-h-[calc(100%-2rem)] w-[360px] max-w-[calc(100%-2rem)] overflow-y-auto rounded-2xl border border-white/15 bg-[#252c21] p-5 text-[#dce3d2] shadow-2xl"
      }
    >
      <div className="flex items-center gap-3">
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
        <h1
          className={
            "flex-1 " + (fullscreen ? "text-2xl" : "text-sm font-semibold")
          }
        >
          {labels[phase] ?? phase}
        </h1>
        <span className="shrink-0 text-xs tabular-nums text-[#a5b49a]">
          {elapsed} 秒
        </span>
        {!fullscreen && (
          <button
            aria-label={pending.collapsed ? "展开加载进度" : "折叠加载进度"}
            onClick={onCollapse}
            className="cursor-pointer rounded p-1 hover:bg-white/10"
          >
            {pending.collapsed ? (
              <ChevronUp size={16} />
            ) : (
              <ChevronDown size={16} />
            )}
          </button>
        )}
      </div>
      {(!pending.collapsed || fullscreen || error) && (
        <>
          <p className="mb-4 mt-3 break-all text-xs leading-5 text-[#acbaa1]">
            {pending.input}
          </p>
          <ol
            aria-label="加载步骤"
            className="max-h-60 space-y-2 overflow-y-auto text-xs"
          >
            <li className="flex items-center gap-2">
              <Check size={12} />
              <span>{pending.job || done ? "连接完成" : "正在连接"}</span>
            </li>
            {steps.map((step, index) => (
              <li key={index} className="flex items-center gap-2">
                {index === steps.length - 1 && !done && !error ? (
                  <LoaderCircle size={12} className="animate-spin" />
                ) : (
                  <span className="size-1.5 rounded-full bg-[#9cb786]" />
                )}
                <span>
                  {labels[step.phase] ?? step.phase}
                  {step.attempt > 1 ? ` · 第 ${step.attempt} 次` : ""}
                </span>
                {step.at && (
                  <time className="ml-auto text-[#89997e]">
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
        </>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm leading-6 text-[#e5cba8]">
          {pending.message}
        </p>
      )}
      {!done && (
        <div className="mt-4 flex gap-3 text-xs">
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
    </section>
  );
}
