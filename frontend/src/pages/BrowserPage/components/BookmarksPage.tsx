import { displayAddress } from "../functions/displayAddress";
import { useState } from "react";
import {
  Bookmark as BookmarkIcon,
  ArrowUpRight,
  Trash2,
  Search,
} from "lucide-react";
import type { Bookmark } from "../../../shared/bookmark";
type Props = {
  items: Bookmark[];
  status: "loading" | "ready" | "error";
  error: string;
  busy: boolean;
  onRefresh: () => void;
  onOpen: (bookmark: Bookmark) => void;
  onRemove: (id: string) => void;
};
export function BookmarksPage({
  items,
  status,
  error,
  busy,
  onRefresh,
  onOpen,
  onRemove,
}: Props) {
  const [query, setQuery] = useState("");
  const filter = query.trim().toLocaleLowerCase();
  const visible = items.filter((item) =>
    (item.title + " " + displayAddress(item.address))
      .toLocaleLowerCase()
      .includes(filter),
  );
  return (
    <section className="mx-auto max-w-5xl px-6 py-10 md:px-12 md:py-16">
      <div className="mb-8 flex items-center gap-4">
        <BookmarkIcon className="text-[#b8d69a]" size={28} />
        <div>
          <h1 className="text-3xl font-semibold">书签</h1>
          <p className="mt-2 text-sm text-[#9cad8e]">那些值得再看一眼的网页</p>
        </div>
        <button
          onClick={onRefresh}
          className="ml-auto cursor-pointer rounded-lg border border-white/15 px-3 py-2 text-xs"
        >
          更新列表
        </button>
      </div>
      <label className="mb-8 flex items-center gap-3 rounded-xl border border-white/15 px-4">
        <Search size={16} className="text-[#9cad8e]" />
        <input
          aria-label="筛选书签"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索标题或网址"
          className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </label>
      {status === "loading" && (
        <p role="status" className="mb-4 text-sm text-[#9cad8e]">
          正在读取书签…
        </p>
      )}
      {error && (
        <div className="mb-6 flex items-center gap-3 text-sm text-[#e5bc85]">
          <p role="alert">{error}</p>
          <button onClick={onRefresh} className="cursor-pointer underline">
            重试读取
          </button>
        </div>
      )}
      {status === "ready" && !items.length && (
        <p className="py-16 text-center text-[#9cad8e]">
          还没有书签。打开喜欢的网页，点击地址栏里的星标即可保存。
        </p>
      )}
      {items.length > 0 && !visible.length && (
        <p className="py-12 text-center text-[#9cad8e]">没有找到匹配的书签</p>
      )}
      <ul className="divide-y divide-white/10">
        {visible.map((item) => (
          <li key={item.id} className="flex items-start gap-4 py-6">
            <button
              data-navigation-target={displayAddress(item.address)}
              onClick={() => onOpen(item)}
              aria-label={"打开书签：" + item.title}
              className="group min-w-0 flex-1 cursor-pointer text-left"
            >
              <h2 className="flex items-center gap-2 text-lg font-medium group-hover:text-[#b8d69a]">
                <span className="truncate">{item.title}</span>
                <ArrowUpRight size={16} className="shrink-0" />
              </h2>
              <p className="mt-2 break-all text-xs text-[#92a382]">
                {displayAddress(item.address)}
              </p>
              <p className="mt-3 text-xs text-[#728369]">
                {new Date(item.savedAt).toLocaleString("zh-CN")}
              </p>
            </button>
            <button
              aria-label={"删除书签：" + item.title}
              disabled={busy}
              onClick={() => onRemove(item.id)}
              className="shrink-0 cursor-pointer rounded-lg p-2 text-[#92a382] hover:bg-white/5 hover:text-[#e5bc85] disabled:opacity-40"
            >
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
