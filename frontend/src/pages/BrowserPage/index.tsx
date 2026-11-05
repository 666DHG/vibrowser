import { SourcesPanel } from "./components/SourcesPanel";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Home,
  Settings,
  Search,
  Star,
  Bookmark,
} from "lucide-react";
import {
  useBrowserState,
  addTab,
  selectTab,
  setDraft,
  openBookmarks,
  openSettings,
  setBrowsingMode,
} from "./stores/browserStore";
import { useBrowserNavigation } from "./hooks/useBrowserNavigation";
import { BrowserTabs } from "./components/BrowserTabs";
import { TabContent } from "./components/TabContent";
import { BookmarksPage } from "./components/BookmarksPage";
import { useBookmarks } from "./hooks/useBookmarks";

export default function BrowserPage() {
  const { tabs, activeTabId } = useBrowserState();
  const tab = tabs.find((tab) => tab.id === activeTabId)!;
  const { entries, index, draft } = tab;
  const navigation = useBrowserNavigation();
  const bookmarks = useBookmarks();
  const visiblePage = tab.content.status === "ready" ? tab.content.page : null;
  const saved =
    !!visiblePage &&
    bookmarks.items.some((item) => item.pageId === visiblePage.id);
  const address = useRef<HTMLInputElement>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  useEffect(() => setSourcesOpen(false), [activeTabId, visiblePage?.id]);
  const [mock, setMock] = useState(false);
  useEffect(() => {
    fetch("/health")
      .then((r) => r.json())
      .then((r) => setMock(r.mock === true))
      .catch(() => {});
  }, []);
  const iconButton =
    "cursor-pointer rounded-lg p-2 text-[#a4ac99] transition-colors hover:bg-white/5 hover:text-white disabled:cursor-default disabled:opacity-25";
  const showBookmarks = () => {
    openBookmarks();
    void bookmarks.refresh();
  };
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
        <div
          data-testid="navigation-toolbar"
          className="flex h-12 w-full min-w-0 items-center gap-1 bg-[#2e3328] px-3 md:gap-2 md:px-5"
        >
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
            onClick={() => void navigation.refresh()}
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
            <Search
              size={14}
              className="hidden shrink-0 text-[#68775c] sm:block"
            />
            <select
              aria-label="浏览模式"
              value={tab.browsingMode ?? "imagination"}
              onChange={(e) =>
                setBrowsingMode(
                  activeTabId,
                  e.target.value as "imagination" | "research",
                )
              }
              className="max-w-20 shrink-0 rounded-md bg-[#303829] py-1 text-xs text-[#c1d5ad]"
            >
              <option value="imagination">幻觉</option>
              <option value="research">认真</option>
            </select>
            <input
              ref={address}
              aria-label="网址或搜索词"
              value={draft}
              onChange={(event) => setDraft(activeTabId, event.target.value)}
              placeholder="输入网址，或搜索一个尚未存在的世界"
              className="h-9 min-w-0 flex-1 bg-transparent text-xs text-[#d1dcc4] outline-none placeholder:text-[#728068]"
            />
            <button
              type="button"
              aria-label={saved ? "取消收藏当前网页" : "收藏当前网页"}
              aria-pressed={saved}
              title={
                visiblePage
                  ? (saved ? "取消收藏：" : "收藏：") +
                    (visiblePage.document?.title ?? visiblePage.spec?.title)
                  : "加载网页后可收藏"
              }
              disabled={
                !visiblePage || bookmarks.busy || bookmarks.status !== "ready"
              }
              onClick={() =>
                visiblePage &&
                void bookmarks.toggle(
                  visiblePage.id,
                  tab.entries[tab.index]?.state,
                )
              }
              className="shrink-0 cursor-pointer p-1 text-[#b8d69a] disabled:opacity-25"
            >
              <Star size={16} fill={saved ? "currentColor" : "none"} />
            </button>
            <button
              aria-label="前往"
              className="cursor-pointer p-1 text-[#a5bf8c]"
            >
              <ArrowRight size={16} />
            </button>
          </form>
          {visiblePage?.mode === "research" && (
            <button
              onClick={() => setSourcesOpen((v) => !v)}
              className="shrink-0 rounded-lg px-2 py-1 text-xs text-[#b8d69a]"
            >
              来源 {visiblePage.sourceCount}
            </button>
          )}
          <button
            aria-label="书签"
            onClick={showBookmarks}
            className={iconButton}
          >
            <Bookmark size={17} />
          </button>
          <button
            aria-label="设置"
            onClick={() => openSettings()}
            className={iconButton}
          >
            <Settings size={18} />
          </button>
        </div>
      </header>
      {tabs.map((item) => (
        <TabContent
          key={item.id}
          mock={mock}
          tab={item}
          active={item.id === activeTabId}
          onNavigate={(input, referrer, sourceBlockId) =>
            void navigation.navigate(input, referrer, item.id, sourceBlockId)
          }
          onAction={(action, values) =>
            void navigation.submitAction(item.id, action, values)
          }
          onSelectCandidate={(id) => void navigation.selectSubject(item.id, id)}
          onRetry={() => void navigation.retry(item.id)}
          onCancel={() => navigation.cancel(item.id)}
          bookmarks={
            <BookmarksPage
              {...bookmarks}
              onRefresh={() => void bookmarks.refresh()}
              onOpen={(bookmark) =>
                void navigation.openSaved(
                  bookmark.pageId,
                  bookmark.kind === "search"
                    ? bookmark.title
                    : bookmark.address,
                )
              }
              onRemove={(id) => void bookmarks.remove(id)}
            />
          }
          onSettings={() => openSettings()}
        />
      ))}
      {sourcesOpen && visiblePage && (
        <SourcesPanel
          pageId={visiblePage.id}
          onClose={() => setSourcesOpen(false)}
        />
      )}
      {bookmarks.error && tab.content.status !== "bookmarks" && (
        <div
          role="alert"
          className="absolute left-4 top-28 z-30 max-w-[calc(100%-2rem)] rounded-xl border border-white/15 bg-[#252c21] p-4 text-sm text-[#e5bc85]"
        >
          {sourcesOpen && visiblePage && (
            <SourcesPanel
              pageId={visiblePage.id}
              onClose={() => setSourcesOpen(false)}
            />
          )}
          {bookmarks.error}
          <button
            onClick={() => void bookmarks.refresh()}
            className="ml-3 cursor-pointer underline"
          >
            重试读取书签
          </button>
        </div>
      )}
    </main>
  );
}
