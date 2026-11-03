import type { PageEntity } from "../../../shared/pageEntity";
import type { CSSProperties } from "react";
import type { PageSpec, PageBlock, PageDesign } from "../../../shared/pageSpec";
export type PageLayout = PageDesign["layout"];
export interface RenderContext {
  entities: PageEntity[];
  layout: PageLayout;
  density: PageDesign["density"];
  onNavigate: (target: string, sourceBlockId?: string) => void;
}
const themes: Record<PageSpec["theme"], string> = {
  paper: "bg-[#f5f2e9] text-[#292921]",
  midnight: "bg-[#171b2d] text-[#f3efdf]",
  terminal: "bg-[#101c17] text-[#a6edb5]",
  coral: "bg-[#fae7dd] text-[#672e35]",
  white: "bg-[#ffffff] text-[#20242c]",
  graphite: "bg-[#18191b] text-[#ececea]",
  sage: "bg-[#edf0e7] text-[#28392c]",
};
export const fonts: Record<PageDesign["typography"], string> = {
  sans: "font-sans",
  serif: "font-[Georgia,'Songti_SC',SimSun,serif]",
  mono: "font-['Cascadia_Code',Consolas,'Microsoft_YaHei_UI',monospace]",
  display: "font-[Bahnschrift,'Arial_Narrow','Microsoft_YaHei',sans-serif]",
};
const accentColors = {
  blue: ["#2459ad", "#9bbcff"],
  red: ["#a83429", "#ffab9d"],
  green: ["#34704e", "#98d7ac"],
  amber: ["#92631b", "#f2d08d"],
  violet: ["#7850a2", "#ccaff3"],
  neutral: ["#464946", "#d4d7d0"],
};
export function pageAppearance(spec: PageSpec) {
  const design: PageDesign = spec.design ?? {
    layout: "classic",
    typography: "sans",
    density: "comfortable",
    accent: "neutral",
  };
  const dark = ["midnight", "graphite", "terminal"].includes(spec.theme);
  const gap = { compact: "1rem", comfortable: "1.75rem", airy: "3rem" }[
    design.density
  ];
  const width = {
    classic: "max-w-5xl",
    editorial: "max-w-6xl",
    storefront: "max-w-7xl",
    documentation: "max-w-7xl",
    community: "max-w-6xl",
    dashboard: "max-w-[1500px]",
    studio: "max-w-7xl",
    directory: "max-w-5xl",
  }[design.layout];
  return {
    design,
    root: themes[spec.theme] + " " + fonts[design.typography],
    width,
    variables: {
      "--site-accent": accentColors[design.accent][dark ? 1 : 0],
      "--site-gap": gap,
    } as CSSProperties,
  };
}
export function placement(
  position: "auto" | "main" | "aside" | "full",
  layout: PageLayout,
) {
  const narrow =
    layout === "storefront" ||
    layout === "documentation" ||
    layout === "community" ||
    layout === "dashboard";
  if (position === "aside")
    return narrow ? "col-span-12 lg:col-span-3" : "col-span-12 lg:col-span-4";
  if (position === "main")
    return narrow ? "col-span-12 lg:col-span-9" : "col-span-12 lg:col-span-8";
  return "col-span-12";
}
export const columnClasses: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
};
export function variantClasses(block: PageBlock) {
  return {
    plain: "",
    feature: "bg-[var(--site-accent)]/10 p-6 md:p-8",
    outline: "border border-current/20 p-5",
    muted: "bg-current/5 p-5",
  }[block.style?.variant ?? "plain"];
}
export type PageRegion =
  | { kind: "full"; block: PageBlock }
  | { kind: "columns"; main: PageBlock[]; aside: PageBlock[] };
export function pageRegions(blocks: PageBlock[]): PageRegion[] {
  const regions: PageRegion[] = [];
  let pending: PageBlock[] = [];
  const flush = () => {
    if (!pending.length) return;
    const aside = pending.filter((block) => block.style?.placement === "aside");
    if (aside.length)
      regions.push({
        kind: "columns",
        aside,
        main: pending.filter((block) => block.style?.placement !== "aside"),
      });
    else pending.forEach((block) => regions.push({ kind: "full", block }));
    pending = [];
  };
  for (const block of blocks) {
    if (block.type === "footer") continue;
    if (block.type === "navbar" || block.style?.placement === "full") {
      flush();
      regions.push({ kind: "full", block });
    } else pending.push(block);
  }
  flush();
  return regions;
}
