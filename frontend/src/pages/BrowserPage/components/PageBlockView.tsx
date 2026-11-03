import { bindEntity } from "../functions/bindEntity";
import type { PageBlock } from "../../../shared/pageSpec";
import { ContentBlock } from "./ContentBlock";
import {
  columnClasses,
  variantClasses,
  type RenderContext,
} from "./pageDesign";
export function PageBlockView({
  block: original,
  context,
  parent,
}: {
  block: PageBlock;
  context: RenderContext;
  parent?: string;
}) {
  const block = bindEntity(original, context.entities, context.subjectEntityId);
  const children = block.items.map((item) => (
    <PageBlockView
      key={item.id}
      block={item}
      context={context}
      parent={block.type}
    />
  ));
  let content;
  switch (block.type) {
    case "navbar":
      content = (
        <nav
          className={
            "flex flex-wrap items-center justify-between gap-5 border-b pb-5 " +
            (context.layout === "editorial"
              ? "border-b-4 border-double border-current"
              : "border-current/20")
          }
        >
          <div>
            <span
              className={
                "font-semibold " +
                (context.layout === "editorial"
                  ? "text-3xl md:text-5xl tracking-tight"
                  : "text-lg tracking-tight")
              }
            >
              {block.title}
            </span>
            {block.meta && (
              <p className="mt-2 font-sans text-[10px] uppercase tracking-[.14em] opacity-60">
                {block.meta}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 font-sans">
            {children}
          </div>
        </nav>
      );
      break;
    case "grid": {
      const columns =
        block.style?.columns ??
        (context.layout === "storefront" || context.layout === "dashboard"
          ? 3
          : 2);
      content = (
        <section>
          {block.title && (
            <h2 className="mb-5 text-lg font-semibold">{block.title}</h2>
          )}
          {block.text && (
            <p className="mb-5 max-w-3xl text-sm leading-7 opacity-65">
              {block.text}
            </p>
          )}
          <div
            className={
              "grid items-stretch " +
              columnClasses[columns] +
              (context.density === "compact" ? " gap-4" : " gap-6 md:gap-8")
            }
          >
            {children}
          </div>
        </section>
      );
      break;
    }
    case "section":
    case "list":
    case "results":
      content = (
        <section>
          {(block.meta || block.title) && (
            <div className="mb-5 border-b border-current/20 pb-3">
              {block.meta && (
                <p className="mb-2 font-sans text-[10px] uppercase tracking-[.15em] text-[var(--site-accent)]">
                  {block.meta}
                </p>
              )}
              {block.title && (
                <h2 className="text-lg font-semibold">{block.title}</h2>
              )}
            </div>
          )}
          {block.text && (
            <p className="mb-5 text-sm leading-7 opacity-70">{block.text}</p>
          )}
          <div
            className={
              block.type === "list"
                ? "flex flex-col gap-3"
                : block.type === "results"
                  ? "space-y-5"
                  : "flex flex-col gap-[var(--site-gap)]"
            }
          >
            {children}
          </div>
        </section>
      );
      break;
    default:
      content = (
        <ContentBlock block={block} context={context} parent={parent} />
      );
  }
  if (block.type === "footer") return null;
  return (
    <div
      data-block-type={block.type}
      data-block-id={block.id}
      className={"min-w-0 " + variantClasses(block)}
    >
      {content}
    </div>
  );
}
