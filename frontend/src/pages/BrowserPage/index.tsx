import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Home,
  Settings,
  Search,
} from "lucide-react";
import {
  useBrowserState,
  addTab,
  selectTab,
  setDraft,
} from "./stores/browserStore";
import { useBrowserNavigation } from "./hooks/useBrowserNavigation";
import { BrowserTabs } from "./components/BrowserTabs";
import { TabContent } from "./components/TabContent";
import { SettingsPanel } from "./components/SettingsPanel";

export default function BrowserPage() {
  const { tabs, activeTabId } = useBrowserState();
  const tab = tabs.find((tab) => tab.id === activeTabId)!;
  const { entries, index, draft } = tab;
  const navigation = useBrowserNavigation();
  const address = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState(false);
  const [mock, setMock] = useState(false);
  useEffect(() => {
    fetch("/health")
      .then((r) => r.json())
      .then((r) => setMock(r.mock === true))
      .catch(() => {});
  }, []);
  const iconButton =
    "cursor-pointer rounded-lg p-2 text-[#a4ac99] transition-colors hover:bg-white/5 hover:text-white disabled:cursor-default disabled:opacity-25";
  return (
    <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#191c17] text-[#dce3d2]">
      <header className="shrink-0 border-b border-white/8 bg-[#242820]">
        <BrowserTabs
          tabs={tabs}
          activeTabId={activeTabId}
          onSelect={selectTab}
          onClose={navigation.close}
          onAdd={() => {
            addTab();
            address.current?.focus();
          }}
        />
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
            onSubmit={(event) => {
              event.preventDefault();
              void navigation.navigate(draft);
            }}
            className="mx-1 flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-white/8 bg-[#1d211a] px-3 focus-within:border-[#a1bb84]/50 md:px-4"
          >
            <Search size={14} className="shrink-0 text-[#68775c]" />
            <input
              ref={address}
              aria-label="网址或搜索词"
              value={draft}
              onChange={(event) => setDraft(activeTabId, event.target.value)}
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
      {tabs.map((item) => (
        <TabContent
          key={item.id}
          tab={item}
          active={item.id === activeTabId}
          onNavigate={(input, referrer) =>
            void navigation.navigate(input, referrer, item.id)
          }
          onRetry={() => void navigation.retry(item.id)}
          onSettings={() => setSettings(true)}
        />
      ))}
      {settings && (
        <SettingsPanel mock={mock} onClose={() => setSettings(false)} />
      )}
    </main>
  );
}
