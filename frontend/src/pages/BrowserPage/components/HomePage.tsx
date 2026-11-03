import { ArrowUpRight, Globe2, Orbit, Search, Sparkles } from "lucide-react";
export function HomePage({
  onNavigate,
  onSettings,
}: {
  onNavigate: (input: string) => void;
  onSettings: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col px-7 py-12 md:px-14 md:py-16">
      <div className="mb-9 flex items-center gap-2 font-mono text-[10px] tracking-[.24em] text-[#869276]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#aecb8b]" /> A SMALL
        WINDOW INTO THE UNWRITTEN
      </div>
      <div className="grid items-center gap-12 lg:grid-cols-[1.25fr_1fr]">
        <div>
          <h1 className="text-5xl font-medium leading-[1.2] tracking-tight text-[#f0f0e6] md:text-[62px]">
            世界还没写好。
            <br />
            <span className="text-[#b8d69a]">先去看看。</span>
          </h1>
          <p className="mt-6 max-w-md text-sm leading-7 text-[#92978d]">
            输入一个网址，让它开始存在。
            <br />
            或者搜索一个念头，沿着链接走进新的世界。
          </p>
          <button
            onClick={onSettings}
            className="mt-7 flex cursor-pointer items-center gap-2 text-xs text-[#b9c4ac] hover:text-white"
          >
            连接你的 DeepSeek <ArrowUpRight size={14} />
          </button>
        </div>
        <div
          aria-label="字符星球插画"
          className="relative flex min-h-64 items-center justify-center overflow-hidden rounded-3xl border border-white/7 bg-[#1d211c]"
        >
          <div className="absolute left-5 top-4 font-mono text-[9px] tracking-widest text-[#5f6a57]">
            IMAGINATION / ONLINE
          </div>
          <pre className="select-none text-center font-mono text-[12px] leading-[1.55] text-[#a3bc8b]">
            {
              "        ·          +       \n    +      .-\"\"\"\"-.         \n         .'  .  .  '.    ·  \n   ─────/  ·    +   \\─────  \n     . /  .      .   \\ .    \n    ──(      ◦       )──    \n       \\  +     .   /       \n    ·   \\    .     /   +    \n         '-.____.-'         \n   +          ·        .   "
            }
          </pre>
          <span className="absolute bottom-4 right-5 font-mono text-[9px] tracking-widest text-[#5f6a57]">
            NO PIXELS. JUST POSSIBILITIES.
          </span>
        </div>
      </div>
      <div className="mb-4 mt-14 flex items-center justify-between">
        <h2 className="text-xs tracking-wider text-[#b2b7aa]">
          从一个小小的好奇开始
        </h2>
        <span className="font-mono text-[9px] text-[#697163]">
          SUGGESTED EXPLORATIONS
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {[
          {
            icon: Orbit,
            title: "月面咖啡馆",
            url: "moon-coffee.example",
            note: "一杯拿铁，和窗外的地球。",
            tag: "生成网站",
          },
          {
            icon: Globe2,
            title: "未来植物档案",
            url: "future-botany.example",
            note: "记录那些尚未被发现的绿色。",
            tag: "生成网站",
          },
          {
            icon: Search,
            title: "如果城市漂浮在云上",
            url: "漂浮在云上的城市",
            note: "沿着一个念头，寻找另一种可能。",
            tag: "虚构搜索",
          },
        ].map((x) => (
          <button
            key={x.url}
            onClick={() => onNavigate(x.url)}
            className="group cursor-pointer rounded-2xl border border-white/8 bg-[#1e211c] p-5 text-left transition-colors hover:border-[#b8d69a]/40 hover:bg-[#252b22]"
          >
            <div className="mb-8 flex justify-between text-[#94ad7e]">
              <x.icon size={21} strokeWidth={1.3} />
              <ArrowUpRight
                size={15}
                className="text-[#5c6753] group-hover:text-[#b8d69a]"
              />
            </div>
            <h3 className="text-sm text-[#e0e4d8]">{x.title}</h3>
            <p className="mt-2 text-xs leading-6 text-[#838d7a]">{x.note}</p>
            <div className="mt-5 flex items-center justify-between border-t border-white/5 pt-3">
              <span className="font-mono text-[9px] text-[#64705b]">
                {x.tag === "虚构搜索" ? "vibe://search" : x.url}
              </span>
              <span className="text-[9px] text-[#7f8e72]">{x.tag}</span>
            </div>
          </button>
        ))}
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-12 text-[10px] text-[#626e58]">
        <span className="flex items-center gap-2">
          <Sparkles size={12} /> 虚构内容，真实的探索。
        </span>
        <span>无图片 · 文字构筑的互联网</span>
      </div>
    </div>
  );
}
