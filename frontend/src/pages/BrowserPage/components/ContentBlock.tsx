import { ArrowRight, ArrowUpRight, MessageSquare } from "lucide-react";
import type { PageBlock } from "../../../shared/pageSpec";
import type { RenderContext } from "./pageDesign";

function LinkedTitle({
  block,
  context,
}: {
  block: PageBlock;
  context: RenderContext;
}) {
  return block.target ? (
    <button
      onClick={() => context.onNavigate(block.target!)}
      className="cursor-pointer text-left hover:text-[var(--site-accent)] hover:underline underline-offset-4"
    >
      {block.title}
    </button>
  ) : (
    <>{block.title}</>
  );
}
function Paragraphs({
  text,
  className = "",
}: {
  text?: string | null;
  className?: string;
}) {
  return (
    <div className={"space-y-4 " + className}>
      {text?.split(/\n\s*\n/).map((paragraph, index) => (
        <p key={index} className="whitespace-pre-line">
          {paragraph}
        </p>
      ))}
    </div>
  );
}
export function ContentBlock({
  block: b,
  context,
  parent,
}: {
  block: PageBlock;
  context: RenderContext;
  parent?: string;
}) {
  const compact = context.density === "compact";
  const editorial = context.layout === "editorial";
  const feature = b.style?.variant === "feature";
  const meta = b.meta && (
    <p className="mb-3 font-sans text-[11px] font-medium uppercase tracking-[.12em] text-[var(--site-accent)]">
      {b.meta}
    </p>
  );
  switch (b.type) {
    case "hero": {
      const sizing = {
        classic: "text-4xl md:text-6xl",
        editorial: "text-4xl md:text-7xl leading-[1.08]",
        storefront: "text-4xl md:text-6xl leading-[1.05]",
        documentation: "text-3xl md:text-4xl",
        community: "text-2xl md:text-3xl",
        dashboard: "text-2xl md:text-3xl",
        studio: "text-5xl md:text-8xl xl:text-[110px] leading-[.97]",
        directory: "text-2xl md:text-3xl",
      }[context.layout];
      return (
        <section className={editorial ? "border-b-2 border-current pb-7" : ""}>
          {meta}
          <h1
            className={
              "max-w-6xl whitespace-pre-line font-semibold tracking-tight " +
              sizing
            }
          >
            {b.title}
          </h1>
          {b.text && (
            <Paragraphs
              text={b.text}
              className={
                "mt-5 max-w-3xl opacity-75 " +
                (compact ? "text-sm leading-6" : "text-base leading-8")
              }
            />
          )}
        </section>
      );
    }
    case "text":
      return (
        <section className="max-w-[76ch]">
          {meta}
          {b.title && (
            <h2
              className={
                "mb-4 font-semibold " + (compact ? "text-xl" : "text-2xl")
              }
            >
              {b.title}
            </h2>
          )}
          <Paragraphs
            text={b.text}
            className={compact ? "text-sm leading-7" : "text-base leading-8"}
          />
        </section>
      );
    case "article":
      return (
        <article
          className={
            "h-full border-b border-current/20 " + (compact ? "pb-4" : "pb-7")
          }
        >
          {meta}
          <h2
            className={
              "mb-4 font-semibold leading-snug tracking-tight " +
              (feature ? "text-3xl md:text-4xl" : "text-xl md:text-2xl")
            }
          >
            <LinkedTitle block={b} context={context} />
          </h2>
          <Paragraphs
            text={b.text}
            className={
              "max-w-[75ch] opacity-80 " +
              (compact ? "text-sm leading-6" : "text-base leading-8")
            }
          />
          {b.target && (
            <button
              onClick={() => context.onNavigate(b.target!)}
              aria-label={b.title + " · 阅读全文"}
              className="mt-5 flex cursor-pointer items-center gap-2 font-sans text-xs text-[var(--site-accent)]"
            >
              阅读全文 <ArrowRight size={13} />
            </button>
          )}
        </article>
      );
    case "product":
      return (
        <article className="group flex h-full flex-col">
          <button
            disabled={!b.target}
            onClick={() => b.target && context.onNavigate(b.target)}
            aria-label={b.title ?? ""}
            className={
              "relative flex w-full items-center justify-center overflow-hidden bg-current/5 p-6 text-center disabled:cursor-default " +
              (feature ? "aspect-[5/3]" : "aspect-[4/3]") +
              (b.target ? " cursor-pointer" : "")
            }
          >
            <span className="absolute inset-5 border border-current/15 transition-transform group-hover:scale-95" />
            <span className="relative max-w-[13ch] whitespace-pre-line text-3xl font-semibold tracking-tight opacity-85 md:text-4xl">
              {b.title}
            </span>
          </button>
          <div className="flex flex-1 flex-col py-4">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-base font-semibold">
                <LinkedTitle block={b} context={context} />
              </h2>
              {b.meta && (
                <span className="shrink-0 font-sans text-sm font-semibold text-[var(--site-accent)]">
                  {b.meta}
                </span>
              )}
            </div>
            <Paragraphs
              text={b.text}
              className="mt-2 text-sm leading-6 opacity-65"
            />
          </div>
        </article>
      );
    case "thread":
      return (
        <article className="flex items-start gap-4 border-b border-current/15 py-4">
          <MessageSquare
            size={18}
            className="mt-1 shrink-0 text-[var(--site-accent)]"
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">
              <LinkedTitle block={b} context={context} />
            </h2>
            {b.text && (
              <p className="mt-2 whitespace-pre-line text-sm leading-6 opacity-70">
                {b.text}
              </p>
            )}
            {b.meta && (
              <p className="mt-3 font-sans text-xs opacity-50">{b.meta}</p>
            )}
          </div>
          {b.target && (
            <ArrowUpRight size={14} className="shrink-0 opacity-40" />
          )}
        </article>
      );
    case "stat":
      return (
        <section className="h-full border-l-2 border-[var(--site-accent)] pl-5">
          <h2 className="font-sans text-xs font-medium tracking-wide opacity-65">
            {b.title}
          </h2>
          <p className="my-3 break-words text-4xl font-semibold tracking-tight tabular-nums">
            {b.meta ?? b.text}
          </p>
          {b.meta && b.text && (
            <p className="text-xs leading-5 opacity-60">{b.text}</p>
          )}
        </section>
      );
    case "quote":
      return (
        <blockquote className="border-l-4 border-[var(--site-accent)] py-2 pl-6">
          <p className="whitespace-pre-line text-2xl leading-relaxed italic">
            {b.text}
          </p>
          {(b.title || b.meta) && (
            <cite className="mt-5 block font-sans text-xs not-italic opacity-60">
              {[b.title, b.meta].filter(Boolean).join(" · ")}
            </cite>
          )}
        </blockquote>
      );
    case "code":
      return (
        <figure className="min-w-0 overflow-hidden rounded-lg border border-white/10 bg-[#171b24] text-[#d9e5ee]">
          {(b.title || b.meta) && (
            <figcaption className="flex justify-between gap-4 border-b border-white/10 px-5 py-3 font-sans text-xs text-[#91a2b6]">
              <span>{b.title}</span>
              <span>{b.meta}</span>
            </figcaption>
          )}
          <pre className="overflow-x-auto p-5 font-mono text-sm leading-7">
            <code>{b.text}</code>
          </pre>
        </figure>
      );
    case "divider":
      return (
        <div className="flex items-center gap-4">
          <span className="h-px flex-1 bg-current/20" />
          {b.title && (
            <h2 className="font-sans text-xs font-medium uppercase tracking-[.2em]">
              {b.title}
            </h2>
          )}
          <span className="h-px flex-1 bg-current/20" />
        </div>
      );
    case "card": {
      const search = parent === "results" || context.layout === "directory";
      const frame = search
        ? "max-w-3xl py-3"
        : context.layout === "classic"
          ? "rounded-2xl border border-current/15 p-6"
          : "h-full border-b border-current/20 py-4";
      return (
        <article className={frame}>
          {meta}
          {search && b.target && (
            <p className="mb-2 break-all font-sans text-xs opacity-60">
              {b.target}
            </p>
          )}
          <h2
            className={
              "mb-3 font-medium " +
              (search ? "text-xl text-[var(--site-accent)]" : "text-xl")
            }
          >
            <LinkedTitle block={b} context={context} />
          </h2>
          <Paragraphs text={b.text} className="text-sm leading-7 opacity-75" />
        </article>
      );
    }
    case "button":
      return (
        <button
          onClick={() => b.target && context.onNavigate(b.target)}
          className={
            parent === "navbar" || context.layout === "documentation"
              ? "inline-flex cursor-pointer items-center gap-2 text-left text-sm hover:text-[var(--site-accent)] hover:underline underline-offset-4"
              : "inline-flex cursor-pointer items-center gap-4 border border-current/25 px-5 py-3 font-sans text-sm transition-colors hover:bg-current/5"
          }
        >
          {b.title}
          {parent !== "navbar" && context.layout !== "documentation" && (
            <ArrowRight size={14} />
          )}
        </button>
      );
    case "ascii":
      return (
        <figure className="min-w-0">
          {b.title && (
            <figcaption className="mb-3 font-sans text-[10px] uppercase tracking-[.2em] opacity-50">
              {b.title}
            </figcaption>
          )}
          <pre
            aria-label={b.title ?? "文本插画"}
            className="overflow-x-auto py-4 font-mono text-sm leading-6 opacity-75"
          >
            {b.text}
          </pre>
        </figure>
      );
    case "footer":
      return null;
    default:
      return null;
  }
}
