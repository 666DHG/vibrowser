import { useEffect, useState } from "react";
import { GetPageSourcesMessage } from "../../../apis/browser/GetPageSourcesMessage";
export function SourcesPanel({
  pageId,
  onClose,
}: {
  pageId: string;
  onClose: () => void;
}) {
  const [sources, setSources] = useState<
      { id: string; url: string; title: string; retrievedAt: string }[]
    >([]),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    setSources([]);
    setError("");
    new GetPageSourcesMessage(pageId)
      .send(c.signal)
      .then((s) => setSources(s.sources))
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [pageId]);
  return (
    <aside
      aria-label="网页来源"
      className="absolute bottom-0 right-0 top-24 z-40 w-[min(420px,100%)] overflow-y-auto border-l border-white/15 bg-[#252c21] p-6 shadow-2xl"
    >
      <div className="mb-6 flex justify-between">
        <h2 className="text-xl">来源</h2>
        <button aria-label="关闭来源" onClick={onClose}>
          关闭
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <ol className="space-y-6">
        {sources.map((s) => (
          <li key={s.id}>
            <h3>{s.title}</h3>
            <p className="my-2 break-all text-xs text-[#9cad8e]">
              {new URL(s.url).hostname} ·{" "}
              {new Date(s.retrievedAt).toLocaleString()}
            </p>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#b8d69a] underline"
            >
              查看原文
            </a>
          </li>
        ))}
      </ol>
    </aside>
  );
}
