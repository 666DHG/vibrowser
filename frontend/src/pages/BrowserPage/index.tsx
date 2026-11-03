import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Home,
  Settings,
  Globe2,
  Search,
  ArrowUpRight,
  LoaderCircle,
  AlertCircle,
  Command,
  Compass,
} from "lucide-react";
import { useBrowserState } from "./stores/browserStore";
import { useBrowserNavigation } from "./hooks/useBrowserNavigation";
import { HomePage } from "./components/HomePage";
import { PageRenderer } from "./components/PageRenderer";
import { SettingsPanel } from "./components/SettingsPanel";
export default function BrowserPage() {
  const { entries, index, content } = useBrowserState();
  const navigation = useBrowserNavigation();
  const [draft, setDraft] = useState("");
  const [settings, setSettings] = useState(false);
  const [mock, setMock] = useState(false);
  useEffect(() => {
    fetch("/health")
      .then((r) => r.json())
      .then((r) => setMock(r.mock === true))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (content.status === "ready" || content.status === "generating")
      setDraft(
        content.page.kind === "search"
          ? content.page.prompt
          : content.page.address,
      );
    else if (content.status === "idle") setDraft("");
    else if (content.status === "loading") setDraft(content.input);
  }, [content]);
  const title =
    content.status === "ready" ? content.page.spec?.title : "新的可能";
  const isDemo =
    mock || (content.status === "ready" && content.page.source === "mock");
  const isLoading =
    content.status === "loading" || content.status === "generating";
  const phase =
    content.status === "generating" ? content.job.phase : "connecting";
  const phases: Record<string, string> = {
    queued: "等待生成",
    generating: "正在创造这个世界",
    validating: "正在检查页面结构",
    saving: "正在保存页面",
    connecting: "正在连接想象引擎",
  };
  const iconButton =
    "cursor-pointer rounded-lg p-2 text-[#a4ac99] transition-colors hover:bg-white/5 hover:text-white disabled:cursor-default disabled:opacity-25";
  return (
    <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#191c17] text-[#dce3d2]">
      <header className="shrink-0 border-b border-white/8 bg-[#242820]">
        <div className="flex h-12 items-center gap-5 px-4 md:px-6">
          <div className="flex items-center gap-2 text-sm tracking-tight">
            <Compass size={18} className="text-[#b8d69a]" />
            <strong className="font-semibold">
              vibrowser<span className="text-[#b8d69a]">.</span>
            </strong>
          </div>
          <div className="mt-auto flex h-9 w-52 items-center gap-2 rounded-t-xl border-x border-t border-white/8 bg-[#2e3328] px-4 text-[11px]">
            <Globe2 size={12} className="text-[#99ac86]" />
            <span className="truncate">{title}</span>
          </div>
          <span className="ml-auto hidden font-mono text-[9px] tracking-[.17em] text-[#77856b] sm:block">
            SMOKE / 01
          </span>
        </div>
        <div className="flex items-center gap-1 bg-[#2e3328] px-3 py-3 md:gap-2 md:px-5">
          <button
            aria-label="后退"
            disabled={index <= 0}
            onClick={() => void navigation.move(index - 1)}
            className={iconButton}
          >
            <ArrowLeft size={17} />
          </button>
          <button
            aria-label="前进"
            disabled={index >= entries.length - 1}
            onClick={() => void navigation.move(index + 1)}
            className={iconButton}
          >
            <ArrowRight size={17} />
          </button>
          <button
            aria-label="刷新"
            disabled={index < 0}
            onClick={() => void navigation.move(index)}
            className={iconButton}
          >
            <RotateCw size={16} />
          </button>
          <button
            aria-label="首页"
            onClick={navigation.home}
            className={"hidden sm:block " + iconButton}
          >
            <Home size={16} />
          </button>
          <form
            aria-label="地址栏"
            onSubmit={(e) => {
              e.preventDefault();
              void navigation.navigate(draft);
            }}
            className="mx-1 flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-white/8 bg-[#1d211a] px-3 focus-within:border-[#a1bb84]/50 md:px-4"
          >
            <Search size={14} className="shrink-0 text-[#68775c]" />
            <input
              aria-label="网址或搜索词"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="输入网址，或搜索一个尚未存在的世界"
              className="h-10 min-w-0 flex-1 bg-transparent text-xs text-[#d1dcc4] outline-none placeholder:text-[#728068]"
            />
            <button
              aria-label="前往"
              className="cursor-pointer p-1 text-[#a5bf8c]"
            >
              <ArrowRight size={16} />
            </button>
          </form>
          <button
            aria-label="设置"
            onClick={() => setSettings(true)}
            className={iconButton}
          >
            <Settings size={18} />
          </button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-14 shrink-0 flex-col items-center gap-4 border-r border-white/5 bg-[#1e221b] py-6 md:flex">
          <button
            aria-label="探索首页"
            onClick={navigation.home}
            className="cursor-pointer rounded-xl bg-[#b8d69a]/10 p-2.5 text-[#b8d69a]"
          >
            <Compass size={17} />
          </button>
          <span className="h-10 w-px bg-white/8" />
          <span className="font-mono text-[9px] tracking-[.2em] text-[#5a6850] [writing-mode:vertical-rl]">
            BROWSE THE UNWRITTEN
          </span>
          <Command size={14} className="mt-auto text-[#58664d]" />
        </aside>
        <div
          className="relative min-w-0 flex-1 overflow-y-auto"
          data-testid="content-viewport"
        >
          {content.status === "idle" && (
            <HomePage
              onNavigate={(input) => void navigation.navigate(input)}
              onSettings={() => setSettings(true)}
            />
          )}
          {isLoading && (
            <section className="flex min-h-[65vh] flex-col items-center justify-center px-6 text-center">
              <div className="relative mb-8 flex size-24 items-center justify-center rounded-full border border-[#b8d69a]/15">
                <LoaderCircle
                  className="animate-spin text-[#b8d69a]"
                  size={30}
                  strokeWidth={1}
                />
                <span className="absolute -right-1 top-3 size-2 rounded-full bg-[#b8d69a]" />
              </div>
              <p className="mb-3 font-mono text-[10px] tracking-[.2em] text-[#80966a]">
                VIBE ENGINE
              </p>
              <h1 className="text-2xl">{phases[phase] ?? "生成中"}</h1>
              <p className="mt-4 max-w-md break-all text-sm text-[#87977a]">
                {draft}
              </p>
              <p className="mt-8 text-xs text-[#66765a]">
                文字、布局与链接，正在成为一个可以探索的地方。
              </p>
            </section>
          )}
          {content.status === "ready" && content.page.spec && (
            <PageRenderer
              spec={content.page.spec}
              onNavigate={(target) =>
                void navigation.navigate(
                  new URL(target, content.page.address).href,
                  content.page.id,
                )
              }
            />
          )}
          {content.status === "error" && (
            <section className="mx-auto flex min-h-[65vh] max-w-lg flex-col items-center justify-center gap-5 p-8 text-center">
              <AlertCircle size={32} className="text-[#c6af80]" />
              <h1 className="text-2xl">这个世界还没准备好</h1>
              <p role="alert" className="text-sm leading-7 text-[#a2ad96]">
                {content.message}
              </p>
              <div className="flex gap-4">
                {content.page && (
                  <button
                    onClick={() => void navigation.retry()}
                    className="cursor-pointer rounded-full bg-[#b8d69a] px-6 py-3 text-xs text-[#26301e]"
                  >
                    重新尝试
                  </button>
                )}
                <button
                  onClick={() => setSettings(true)}
                  className="cursor-pointer rounded-full border border-white/15 px-6 py-3 text-xs"
                >
                  打开设置
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
      <footer className="flex h-8 shrink-0 items-center justify-between border-t border-white/6 bg-[#20251c] px-5 font-mono text-[9px] text-[#77876a]">
        <span className="flex items-center gap-2">
          <span
            className={
              "size-1.5 rounded-full " +
              (isDemo ? "bg-amber-400" : "bg-[#b8d69a]")
            }
          />
          {isDemo
            ? "MOCK · 预存演示，非实时 AI"
            : isLoading
              ? "GENERATING"
              : "LOCAL / DEEPSEEK"}
        </span>
        <span className="truncate pl-4">
          {content.status === "ready" && content.page.kind === "search"
            ? "虚构搜索 · 非真实互联网结果"
            : "文字构筑的互联网"}
        </span>
      </footer>
      {settings && <SettingsPanel onClose={() => setSettings(false)} />}
    </main>
  );
}
