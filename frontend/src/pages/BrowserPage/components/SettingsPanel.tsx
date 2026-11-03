import { useEffect, useRef, useState } from "react";
import {
  X,
  Check,
  LoaderCircle,
  KeyRound,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { GetSettingsMessage } from "../../../apis/settings/GetSettingsMessage";
import { SaveSettingsMessage } from "../../../apis/settings/SaveSettingsMessage";
import { ClearCredentialsMessage } from "../../../apis/settings/ClearCredentialsMessage";
import { TestConnectionMessage } from "../../../apis/settings/TestConnectionMessage";
import { GetPageMessage } from "../../../apis/browser/GetPageMessage";
import type { Settings } from "../../../shared/pageSpec";
const presets = {
  deepseek: { url: "https://api.deepseek.com", model: "deepseek-flash" },
  tokenhub: {
    url: "https://tokenhub.tencentmaas.com/v1",
    model: "deepseek-v4.1-flash",
  },
};
export function SettingsPanel({
  onClose,
  mock = false,
}: {
  onClose: () => void;
  mock?: boolean;
}) {
  const [saved, setSaved] = useState<Settings | null>(null);
  const [url, setUrl] = useState("https://api.deepseek.com");
  const [model, setModel] = useState("deepseek-flash");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const active = useRef(true);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    active.current = true;
    dialog.current?.showModal();
    const controller = new AbortController();
    new GetSettingsMessage()
      .send(controller.signal)
      .then((s) => {
        setSaved(s);
        setUrl(s.baseUrl);
        setModel(s.model);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => {
      active.current = false;
      controller.abort();
    };
  }, []);
  const perform = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setNote("");
    try {
      await action();
    } catch (e) {
      if (active.current) setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      if (active.current) setBusy(false);
    }
  };
  const save = async () => {
    const s = await new SaveSettingsMessage(url, model, key || null).send();
    if (active.current) {
      setSaved(s);
      setKey("");
      setNote("设置已保存到本机");
    }
  };
  const test = () =>
    perform(async () => {
      const { jobId } = await new TestConnectionMessage().send();
      const deadline = Date.now() + 75000;
      while (active.current && Date.now() < deadline) {
        const { job } = await new GetPageMessage(null, jobId).send();
        if (job?.status === "succeeded") {
          setNote(
            mock
              ? "Mock 测试通过，尚未调用真实模型"
              : "连接成功，模型已返回响应",
          );
          return;
        }
        if (job?.status === "failed")
          throw new Error(job.error ?? "连接测试失败");
        await new Promise((r) => setTimeout(r, 600));
      }
      if (active.current) throw new Error("测试等待超时，请稍后重试");
    });
  const dirty = !!key || url !== saved?.baseUrl || model !== saved?.model;
  const inputStyle =
    "mt-2 w-full rounded-xl border border-white/10 bg-[#171a16] px-4 py-3 font-mono text-sm text-[#e1e6d8] outline-none focus:border-[#b8d69a]/60 disabled:opacity-50";
  return (
    <dialog
      ref={dialog}
      onCancel={onClose}
      className="fixed m-auto w-[min(94vw,520px)] rounded-3xl border border-white/10 bg-[#23271f] p-0 text-[#e2e7da] shadow-2xl backdrop:bg-black/65"
    >
      <div className="flex items-start justify-between border-b border-white/8 p-6">
        <div>
          <p className="mb-2 font-mono text-[9px] tracking-[.25em] text-[#9bae87]">
            MAKE THE CONNECTION
          </p>
          <h2 className="text-xl">连接你的想象引擎</h2>
        </div>
        <button
          aria-label="关闭设置"
          onClick={onClose}
          className="cursor-pointer rounded-lg p-2 hover:bg-white/5"
        >
          <X size={18} />
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void perform(save);
        }}
        className="space-y-5 p-6"
      >
        <label className="block text-xs text-[#a7b299]">
          服务预设
          <select
            aria-label="服务预设"
            value={
              url === presets.deepseek.url
                ? "deepseek"
                : url === presets.tokenhub.url
                  ? "tokenhub"
                  : "custom"
            }
            disabled={busy}
            onChange={(e) => {
              const p = presets[e.target.value as keyof typeof presets];
              setKey("");
              setNote("");
              if (p) {
                setUrl(p.url);
                setModel(p.model);
              } else {
                setUrl("https://");
                setModel("");
              }
            }}
            className={inputStyle}
          >
            <option value="deepseek">DeepSeek 官方</option>
            <option value="tokenhub">腾讯 TokenHub</option>
            <option value="custom">自定义兼容接口</option>
          </select>
        </label>
        <label className="block text-xs text-[#a7b299]">
          Base URL
          <input
            aria-label="Base URL"
            required
            value={url}
            disabled={busy}
            onChange={(e) => {
              setUrl(e.target.value);
              setKey("");
            }}
            className={inputStyle}
          />
        </label>
        <label className="block text-xs text-[#a7b299]">
          模型
          <input
            aria-label="模型"
            required
            value={model}
            disabled={busy}
            onChange={(e) => setModel(e.target.value)}
            className={inputStyle}
          />
        </label>
        <label className="block text-xs text-[#a7b299]">
          <span className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <KeyRound size={12} />
              API Key
            </span>
            <span className="text-[10px]">
              {saved?.hasKey ? "已配置 · 留空保留" : "尚未配置"}
            </span>
          </span>
          <input
            aria-label="API Key"
            type="password"
            autoComplete="new-password"
            value={key}
            disabled={busy}
            onChange={(e) => setKey(e.target.value)}
            placeholder={
              saved?.hasKey
                ? "输入新密钥以替换"
                : "在此填写，不需要发送到聊天中"
            }
            className={inputStyle}
          />
        </label>
        <p className="flex items-start gap-2 text-[11px] leading-5 text-[#819272]">
          <ShieldCheck size={14} className="mt-0.5 shrink-0" />
          使用当前 Windows
          用户加密保存；浏览器不会保存密钥。更换接口地址时需要重新填写。
        </p>
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-400/10 p-3 text-xs leading-6 text-red-200"
          >
            {error}
          </p>
        )}
        {note && (
          <p
            role="status"
            className="flex items-center gap-2 text-xs text-[#b8d69a]"
          >
            <Check size={14} />
            {note}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={busy || !saved}
            className="flex cursor-pointer items-center gap-2 rounded-full bg-[#b8d69a] px-6 py-3 text-xs font-semibold text-[#25301c] disabled:cursor-wait disabled:opacity-40"
          >
            {busy && <LoaderCircle size={14} className="animate-spin" />}
            保存设置
          </button>
          <button
            type="button"
            disabled={busy || !saved?.hasKey || dirty}
            onClick={() => void test()}
            className="cursor-pointer rounded-full border border-white/15 px-5 py-3 text-xs disabled:opacity-30"
          >
            测试连接
          </button>
          <button
            type="button"
            disabled={busy || !saved?.hasKey}
            onClick={() =>
              void perform(async () => {
                await new ClearCredentialsMessage().send();
                const s = await new GetSettingsMessage().send();
                if (active.current) {
                  setSaved(s);
                  setKey("");
                  setNote("密钥已清除");
                }
              })
            }
            className="ml-auto cursor-pointer text-[11px] text-[#8e9b80] disabled:opacity-30"
          >
            清除密钥
          </button>
        </div>
        <p className="text-[10px] text-[#78866c]">
          修改后先保存，再测试。测试会发送一次小型模型请求。
        </p>
      </form>
    </dialog>
  );
}
