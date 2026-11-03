import { ArrowUpRight, ArrowRight } from "lucide-react";
import type { PageSpec, PageBlock } from "../../../shared/pageSpec";
type Props = { spec: PageSpec; onNavigate: (target: string) => void };
const themes: Record<PageSpec["theme"], string> = {
  paper: "bg-[#f5f2e9] text-[#343a2e]",
  midnight: "bg-[#171b2d] text-[#f3efdf]",
  terminal: "bg-[#101c17] text-[#a6edb5]",
  coral: "bg-[#fae7dd] text-[#672e35]",
};
function Block({
  block: b,
  onNavigate,
}: {
  block: PageBlock;
  onNavigate: Props["onNavigate"];
}) {
  const children = b.items.map((item) => (
    <Block key={item.id} block={item} onNavigate={onNavigate} />
  ));
  switch (b.type) {
    case "navbar":
      return (
        <nav className="mb-12 flex flex-wrap items-center justify-between gap-5 border-b border-current/20 pb-5">
          <span className="font-mono text-sm tracking-[.18em]">{b.title}</span>
          <div className="flex gap-3">{children}</div>
        </nav>
      );
    case "hero":
      return (
        <section className="mb-10 max-w-4xl">
          <h1 className="whitespace-pre-line text-4xl font-semibold leading-[1.25] tracking-tight md:text-6xl">
            {b.title}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 opacity-65">
            {b.text}
          </p>
        </section>
      );
    case "text":
      return (
        <section className="my-10 max-w-3xl">
          <h2 className="mb-4 text-2xl font-medium">{b.title}</h2>
          <p className="whitespace-pre-wrap text-base leading-8 opacity-75">
            {b.text}
          </p>
        </section>
      );
    case "grid":
      return (
        <section className="my-8 grid gap-4 md:grid-cols-2">{children}</section>
      );
    case "results":
      return (
        <section className="my-8 grid max-w-4xl gap-4">{children}</section>
      );
    case "card":
      return (
        <article className="rounded-2xl border border-current/15 p-6 transition-colors hover:bg-current/5">
          <div className="mb-3 flex items-start justify-between gap-4">
            <h2 className="text-xl font-medium">
              {b.target ? (
                <button
                  onClick={() => onNavigate(b.target!)}
                  className="cursor-pointer text-left hover:underline"
                >
                  {b.title}
                </button>
              ) : (
                b.title
              )}
            </h2>
            {b.target && <ArrowUpRight size={18} />}
          </div>
          {b.target?.startsWith("http") && (
            <p className="mb-3 break-all font-mono text-xs opacity-50">
              {b.target}
            </p>
          )}
          <p className="whitespace-pre-wrap text-sm leading-7 opacity-70">
            {b.text}
          </p>
        </article>
      );
    case "button":
      return (
        <button
          onClick={() => b.target && onNavigate(b.target)}
          className="my-2 inline-flex cursor-pointer items-center gap-4 rounded-full border border-current/25 px-6 py-3 text-sm transition-colors hover:bg-current/10"
        >
          {b.title}
          <ArrowRight size={15} />
        </button>
      );
    case "ascii":
      return (
        <figure className="my-10 overflow-hidden rounded-2xl bg-current/5 p-6">
          <figcaption className="font-mono text-[10px] tracking-[.2em] opacity-50">
            {b.title}
          </figcaption>
          <pre
            aria-label={b.title ?? "文本插画"}
            className="my-7 overflow-x-auto text-center font-mono text-sm leading-6 opacity-75 md:text-lg"
          >
            {b.text}
          </pre>
        </figure>
      );
    case "footer":
      return null;
  }
}
export function PageRenderer({ spec, onNavigate }: Props) {
  return (
    <article
      className={
        "min-h-full px-7 py-10 md:px-16 md:py-12 " + themes[spec.theme]
      }
    >
      <div className="mx-auto max-w-5xl">
        {spec.blocks.map((b) => (
          <Block key={b.id} block={b} onNavigate={onNavigate} />
        ))}
      </div>
    </article>
  );
}
