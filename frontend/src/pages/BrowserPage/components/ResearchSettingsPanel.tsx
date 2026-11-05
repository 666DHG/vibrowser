import { useEffect, useState, useRef } from "react";
import { GetResearchSettingsMessage } from "../../../apis/settings/GetResearchSettingsMessage";
import { SaveResearchSettingsMessage } from "../../../apis/settings/SaveResearchSettingsMessage";
import { ClearResearchCredentialsMessage } from "../../../apis/settings/ClearResearchCredentialsMessage";
import { TestResearchConnectionMessage } from "../../../apis/settings/TestResearchConnectionMessage";
import { GetPageMessage } from "../../../apis/browser/GetPageMessage";
export function ResearchSettingsPanel({ mock }: { mock: boolean }) {
  const [config, setConfig] = useState<{
    hasKey: boolean;
    canReuseGenerationKey: boolean;
    reuseGenerationKey: boolean;
  } | null>(null);
  const [reuse, setReuse] = useState(true),
    [key, setKey] = useState(""),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState(""),
    [error, setError] = useState("");
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    const c = new AbortController();
    new GetResearchSettingsMessage()
      .send(c.signal)
      .then((s) => {
        setConfig(s);
        setReuse(s.reuseGenerationKey);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => {
      active.current = false;
      c.abort();
    };
  }, []);
  useEffect(() => {
    const refresh = () => {
      void new GetResearchSettingsMessage()
        .send()
        .then((s) => {
          if (active.current) setConfig(s);
        })
        .catch(() => {});
    };
    window.addEventListener("vibrowser:provider-settings", refresh);
    return () =>
      window.removeEventListener("vibrowser:provider-settings", refresh);
  }, []);
  const perform = async (fn: () => Promise<void>) => {
    setBusy(true);
    setNote("");
    setError("");
    try {
      await fn();
    } catch (e) {
      if (active.current) setError(e instanceof Error ? e.message : "请求失败");
    } finally {
      if (active.current) setBusy(false);
    }
  };
  const update = (s: NonNullable<typeof config>) => {
    if (active.current) {
      setConfig(s);
      setReuse(s.reuseGenerationKey);
      setKey("");
    }
  };
  return (
    <section className="mt-6 max-w-3xl rounded-2xl border border-white/10 bg-[#23271f] p-6">
      <h2 className="text-xl">联网检索</h2>
      <p className="my-3 text-sm text-[#9cad8e]">
        DeepSeek 官方 Search / Fetch
      </p>
      <label className="block text-sm">
        检索凭据
        <select
          aria-label="检索凭据"
          disabled={busy || !config}
          value={reuse ? "reuse" : "separate"}
          onChange={(e) => {
            setReuse(e.target.value === "reuse");
            setKey("");
          }}
          className="my-3 block w-full rounded-xl bg-[#171a16] p-3"
        >
          <option value="reuse" disabled={!config?.canReuseGenerationKey}>
            复用 DeepSeek 官方生成凭据
          </option>
          <option value="separate">单独配置 DeepSeek Key</option>
        </select>
      </label>
      {config && !config.canReuseGenerationKey && (
        <p className="mb-3 text-xs text-[#9cad8e]">
          当前生成接口需单独配置官方检索 Key。
        </p>
      )}
      {!reuse && (
        <label className="block text-sm">
          检索 API Key
          <input
            aria-label="检索 API Key"
            type="password"
            autoComplete="new-password"
            disabled={busy || !config}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="my-3 block w-full rounded-xl bg-[#171a16] p-3"
            placeholder="输入检索密钥"
          />
        </label>
      )}
      <p className="mb-4 text-xs text-[#9cad8e]">
        {config?.hasKey ? "已配置" : "尚未配置"} · 独立密钥使用当前 Windows
        用户加密保存
      </p>
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-200">
          {error}
        </p>
      )}
      {note && (
        <p role="status" className="mb-3 text-sm text-[#b8d69a]">
          {note}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          disabled={busy || !config}
          onClick={() =>
            void perform(async () => {
              update(
                await new SaveResearchSettingsMessage(
                  reuse,
                  key || null,
                ).send(),
              );
              setNote("检索设置已保存");
            })
          }
          className="rounded-full bg-[#b8d69a] px-5 py-3 text-xs text-[#25301c] disabled:opacity-40"
        >
          保存检索设置
        </button>
        <button
          disabled={
            busy ||
            !config?.hasKey ||
            !!key ||
            reuse !== config?.reuseGenerationKey
          }
          onClick={() =>
            void perform(async () => {
              const { jobId } =
                await new TestResearchConnectionMessage().send();
              for (let i = 0; active.current && i < 50; i++) {
                const { job } = await new GetPageMessage(null, jobId).send();
                if (job?.status === "succeeded") {
                  setNote(
                    mock
                      ? "Mock 检索测试通过，尚未调用真实搜索"
                      : "联网搜索连接成功",
                  );
                  return;
                }
                if (job?.status === "failed")
                  throw new Error(job.error ?? "检索失败");
                await new Promise((r) => setTimeout(r, 700));
              }
              if (active.current) throw new Error("测试等待超时");
            })
          }
          className="rounded-full border border-white/15 px-5 py-3 text-xs disabled:opacity-40"
        >
          测试联网搜索
        </button>
        <button
          disabled={busy || reuse}
          onClick={() =>
            void perform(async () => {
              update(await new ClearResearchCredentialsMessage().send());
              setNote("独立检索密钥已清除");
            })
          }
          className="text-xs text-[#9cad8e] disabled:opacity-40"
        >
          清除检索密钥
        </button>
      </div>
    </section>
  );
}
