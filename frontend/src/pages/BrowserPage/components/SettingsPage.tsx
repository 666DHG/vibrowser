import { CompanionSettings } from "./CompanionSettings";
import { ResearchSettingsPanel } from "./ResearchSettingsPanel";
import { useState, useEffect, useRef } from "react";
import { SettingsPanel } from "./SettingsPanel";
export function SettingsPage({
  mock,
  focusResearchAt,
}: {
  mock: boolean;
  focusResearchAt?: number;
}) {
  const [section, setSection] = useState("api");
  const research = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focusResearchAt) return;
    setSection("api");
    const frame = requestAnimationFrame(() =>
      research.current?.scrollIntoView({ block: "start" }),
    );
    return () => cancelAnimationFrame(frame);
  }, [focusResearchAt]);
  return (
    <section className="mx-auto flex min-h-full max-w-6xl flex-col gap-8 p-5 md:flex-row md:p-10">
      <nav
        aria-label="设置导航"
        className="flex shrink-0 gap-2 md:w-44 md:flex-col"
      >
        <h1 className="mr-4 text-2xl font-semibold md:mb-6">设置</h1>
        {[
          ["api", "API 配置"],
          ["companion", "小猫陪伴"],
          ["about", "项目说明"],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-current={section === id ? "page" : undefined}
            onClick={() => setSection(id)}
            className={
              "rounded-xl px-4 py-3 text-left text-sm " +
              (section === id ? "bg-white/10 text-white" : "text-[#9cad8e]")
            }
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="min-w-0 flex-1">
        <div hidden={section !== "api"}>
          <SettingsPanel mock={mock} />
          <div ref={research}>
            <ResearchSettingsPanel mock={mock} />
          </div>
        </div>
        <div hidden={section !== "companion"}>
          <CompanionSettings />
        </div>
        <article
          hidden={section !== "about"}
          className="max-w-3xl space-y-6 leading-8"
        >
          <h2 className="text-3xl">Vibrowser</h2>
          <p>把一个想法，打开成一个网站。</p>
          <p>
            幻觉模式自由创造世界；认真模式搜索互联网资料，将信息组织成自然、可探索的网页。
          </p>
          <p>
            支持多标签、站内搜索、筛选、局部更新和书签。收藏保留当时的页面与交互状态。
          </p>
          <p className="text-sm text-[#9cad8e]">
            WebDocument v3 · React / TypeScript · Scala / PostgreSQL
          </p>
        </article>
      </div>
    </section>
  );
}
