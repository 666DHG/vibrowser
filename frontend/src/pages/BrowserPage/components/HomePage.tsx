import { HomePlanet } from "./HomePlanet";
import {
  ArrowUpRight,
  BookOpen,
  ShoppingBag,
  Code2,
  MessagesSquare,
} from "lucide-react";
export function HomePage({
  onNavigate,
  active,
}: {
  onNavigate: (input: string) => void;
  active: boolean;
}) {
  return (
    <div className="min-h-full overflow-x-clip pb-12">
      <div className="relative lg:h-[clamp(420px,58vh,680px)]">
        <div className="relative z-10 mx-auto max-w-6xl px-6 pt-10 sm:px-8 md:px-14 lg:flex lg:h-full lg:items-center lg:pt-0 pointer-events-none">
          <div className="pointer-events-auto lg:max-w-[48%]">
            <h1 className="text-[clamp(2.25rem,7vw,3.875rem)] font-medium leading-[1.2] tracking-tight text-[#f0f0e6]">
              世界还没写好。
              <br />
              <span className="text-[#b8d69a]">先去看看。</span>
            </h1>
            <p className="mt-6 max-w-md text-sm leading-7 text-[#a4ac9b] sm:text-base">
              输入网址，或搜索一个念头，看看会遇见什么。
            </p>
          </div>
        </div>
        <div className="lg:absolute lg:inset-y-0 lg:right-0 lg:w-[55%]">
          <HomePlanet active={active} />
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-6 sm:px-8 md:px-14">
        <h2 className="mb-5 mt-6 text-base font-medium text-[#d1d8c7] lg:mt-0">
          从好奇开始
        </h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              icon: BookOpen,
              title: "田野观察季刊",
              url: "fieldnotes-journal.example",
              note: "沿着河岸、街巷和山谷，读几篇故事。",
            },
            {
              icon: ShoppingBag,
              title: "纸间文具店",
              url: "stationery-shop.example",
              note: "纸张、笔墨，和一张重新整理的书桌。",
            },
            {
              icon: Code2,
              title: "TiDB Lab 文档",
              url: "docs.tidb-lab.example/quickstart",
              note: "从第一条命令开始，搭建自己的实验室。",
            },
            {
              icon: MessagesSquare,
              title: "城市骑行论坛",
              url: "forum.city-cycling.example",
              note: "约一场夜骑，交换几条熟悉的小路。",
            },
          ].map((x) => (
            <button
              key={x.url}
              data-navigation-target={
                "https://" + x.url + (x.url.includes("/") ? "" : "/")
              }
              onClick={() => onNavigate(new URL("https://" + x.url).href)}
              className="group cursor-pointer rounded-2xl border border-white/8 bg-[#1e211c] p-5 text-left transition-colors hover:border-[#b8d69a]/40 hover:bg-[#252b22] sm:p-6"
            >
              <div className="mb-6 flex justify-between text-[#94ad7e]">
                <x.icon size={21} strokeWidth={1.3} />
                <ArrowUpRight
                  size={15}
                  className="text-[#5c6753] group-hover:text-[#b8d69a]"
                />
              </div>
              <h3 className="text-base font-medium text-[#e0e4d8]">
                {x.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#a1aa96]">{x.note}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
