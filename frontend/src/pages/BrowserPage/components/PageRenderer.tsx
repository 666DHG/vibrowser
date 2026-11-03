import type { PageSpec } from "../../../shared/pageSpec";
import { PageBlockView } from "./PageBlockView";
import { pageAppearance, placement } from "./pageDesign";
type Props = { spec: PageSpec; onNavigate: (target: string) => void };
export function PageRenderer({ spec, onNavigate }: Props) {
  const appearance = pageAppearance(spec);
  const { layout, density, typography } = appearance.design;
  return (
    <article
      data-page-layout={layout}
      data-page-typography={typography}
      style={appearance.variables}
      className={
        "min-h-full px-5 md:px-10 xl:px-14 " +
        (density === "compact"
          ? "py-6"
          : density === "airy"
            ? "py-12 md:py-16"
            : "py-8 md:py-10") +
        " " +
        appearance.root
      }
    >
      <div
        className={
          "mx-auto grid grid-cols-12 items-start gap-x-7 lg:gap-x-10 gap-y-[var(--site-gap)] " +
          appearance.width
        }
      >
        {spec.blocks
          .filter((block) => block.type !== "footer")
          .map((block) => (
            <div
              key={block.id}
              data-placement={block.style?.placement ?? "auto"}
              className={"min-w-0 " + placement(block, layout)}
            >
              <PageBlockView
                block={block}
                context={{ layout, density, onNavigate }}
              />
            </div>
          ))}
      </div>
    </article>
  );
}
