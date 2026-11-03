import type { PageSpec, PageBlock } from "../../../shared/pageSpec";
import { PageBlockView } from "./PageBlockView";
import { pageAppearance, placement, pageRegions } from "./pageDesign";
type Props = {
  spec: PageSpec;
  onNavigate: (target: string, sourceBlockId?: string) => void;
};
export function PageRenderer({ spec, onNavigate }: Props) {
  const appearance = pageAppearance(spec);
  const { layout, density, typography } = appearance.design;
  const context = {
    layout,
    density,
    onNavigate,
    entities: spec.entities ?? [],
    subjectEntityId: spec.subjectEntityId,
  };
  const asideFirst = ["documentation", "storefront", "dashboard"].includes(
    layout,
  );
  const render = (block: PageBlock) => (
    <PageBlockView key={block.id} block={block} context={context} />
  );
  const column = (side: "main" | "aside") => placement(side, layout);
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
          "mx-auto flex flex-col gap-[var(--site-gap)] " + appearance.width
        }
      >
        {pageRegions(spec.blocks).map((region, index) =>
          region.kind === "full" ? (
            <div key={region.block.id} className="min-w-0">
              {render(region.block)}
            </div>
          ) : (
            <div
              key={"columns-" + index}
              className="grid grid-cols-12 items-start gap-x-7 lg:gap-x-10 gap-y-[var(--site-gap)]"
            >
              <div
                data-placement="main"
                className={
                  "flex min-w-0 flex-col gap-[var(--site-gap)] " +
                  column("main") +
                  (asideFirst ? " order-2" : " order-1")
                }
              >
                {region.main.map(render)}
              </div>
              <aside
                data-placement="aside"
                className={
                  "flex min-w-0 flex-col gap-[var(--site-gap)] " +
                  column("aside") +
                  (asideFirst ? " order-1" : " order-2")
                }
              >
                {region.aside.map(render)}
              </aside>
            </div>
          ),
        )}
      </div>
    </article>
  );
}
