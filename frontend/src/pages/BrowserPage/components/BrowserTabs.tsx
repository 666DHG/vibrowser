import { useEffect, useRef } from "react";
import {
  Compass,
  Globe2,
  LoaderCircle,
  Plus,
  X,
  SquareArrowOutUpRight,
} from "lucide-react";
import type { BrowserTab } from "../objects/BrowserState";

type Props = {
  tabs: BrowserTab[];
  activeTabId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onClose: (id: string) => void;
};
export function BrowserTabs({
  tabs,
  activeTabId,
  onSelect,
  onAdd,
  onClose,
}: Props) {
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    strip.current
      ?.querySelector('[aria-selected="true"]')
      ?.parentElement?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeTabId]);
  return (
    <div className="flex h-12 min-w-0 items-center gap-3 px-3 md:px-5">
      <div
        data-testid="browser-brand"
        className="flex h-9 shrink-0 items-center gap-2 text-sm tracking-tight"
      >
        <Compass size={18} className="text-[#b8d69a]" />
        <strong className="font-semibold">
          vibrowser<span className="text-[#b8d69a]">.</span>
        </strong>
      </div>
      <div
        ref={strip}
        role="tablist"
        aria-label="浏览器标签页"
        className="flex h-full min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]"
      >
        {tabs.map((tab, index) => {
          const active = tab.id === activeTabId;
          const loading =
            tab.content.status === "loading" ||
            tab.content.status === "generating";
          return (
            <div
              key={tab.id}
              role="presentation"
              className={
                "group flex h-9 w-36 shrink-0 items-center rounded-lg border md:w-52 " +
                (active
                  ? "border-white/10 bg-[#2e3328] text-[#e4ecd9]"
                  : "border-transparent text-[#919d85] hover:bg-white/5")
              }
            >
              <button
                role="tab"
                id={"tab-" + tab.id}
                aria-controls={"panel-" + tab.id}
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                title={tab.title}
                onClick={() => onSelect(tab.id)}
                onKeyDown={(event) => {
                  const next =
                    event.key === "ArrowRight"
                      ? (index + 1) % tabs.length
                      : event.key === "ArrowLeft"
                        ? (index - 1 + tabs.length) % tabs.length
                        : event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? tabs.length - 1
                            : null;
                  if (next !== null) {
                    event.preventDefault();
                    onSelect(tabs[next].id);
                    document.getElementById("tab-" + tabs[next].id)?.focus();
                  }
                  if (event.key === "Delete") {
                    event.preventDefault();
                    onClose(tab.id);
                    requestAnimationFrame(() =>
                      strip.current
                        ?.querySelector<HTMLButtonElement>(
                          '[aria-selected="true"]',
                        )
                        ?.focus(),
                    );
                  }
                }}
                className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg pl-3 pr-1 text-left text-xs outline-offset-[-2px] focus-visible:outline-2 focus-visible:outline-[#b8d69a]"
              >
                {loading ? (
                  <LoaderCircle
                    size={13}
                    className="shrink-0 animate-spin text-[#b8d69a]"
                  />
                ) : (
                  <Globe2 size={13} className="shrink-0 text-[#99ac86]" />
                )}
                <span className="truncate">{tab.title || "新标签页"}</span>
              </button>
              <button
                aria-label={"关闭标签页：" + (tab.title || "新标签页")}
                onClick={() => onClose(tab.id)}
                className="mr-1 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded hover:bg-white/10 focus-visible:outline-[#b8d69a]"
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
      <button
        aria-label="新建标签页"
        title="新建标签页"
        onClick={onAdd}
        className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#b8c7aa] hover:bg-white/5 focus-visible:outline-[#b8d69a]"
      >
        <Plus size={18} />
      </button>
      <button
        aria-label="新建窗口"
        title="新建窗口"
        onClick={() =>
          window.open(
            window.location.origin,
            "_blank",
            "popup,width=1280,height=900,noopener,noreferrer",
          )
        }
        className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#b8c7aa] hover:bg-white/5 focus-visible:outline-[#b8d69a]"
      >
        <SquareArrowOutUpRight size={16} />
      </button>
    </div>
  );
}
