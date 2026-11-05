import type { WebDocument } from "../../../shared/webDocument";
// This function is serialized into an opaque-origin frame. Keep it self-contained.
function runtime(
  documentSpec: WebDocument,
  instance: string,
  savedState?: Record<string, string>,
  savedScroll?: number,
) {
  let state = { ...documentSpec.initialState, ...savedState };
  const actions = new Map(documentSpec.actions.map((a) => [a.elementId, a]));
  const byId = (id?: string | null) =>
    id ? document.getElementById(id) : null;
  const send = (type: string, payload: object) =>
    parent.postMessage({ instance, type, ...payload }, "*");
  const publish = () => send("state", { state, scroll: window.scrollY });
  const draw = () => {
    document.querySelectorAll<HTMLElement>("[data-state]").forEach((e) => {
      if (
        !e.matches("button,a,input,select,textarea,form") &&
        e.children.length === 0
      )
        e.textContent = state[e.dataset.state!] ?? "";
    });
  };
  const values = (element: HTMLElement) => {
    const form =
      element instanceof HTMLFormElement ? element : element.closest("form");
    return form
      ? Object.fromEntries(
          [...new FormData(form).entries()].filter(
            (pair): pair is [string, string] => typeof pair[1] === "string",
          ),
        )
      : {};
  };
  const run = (element: HTMLElement) => {
    const action = actions.get(element.id);
    if (!action) return;
    const region = byId(action.region);
    const value =
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement
        ? element.value
        : (action.value ?? "");
    const key = action.stateKey ?? action.id;
    if (action.kind === "Toggle") {
      if (region) {
        region.hidden = !region.hidden;
        state[key] = String(!region.hidden);
      }
    } else if (action.kind === "Switch") {
      if (region)
        [...region.children].forEach((e) => {
          (e as HTMLElement).hidden = e.id !== value;
        });
      state[key] = value;
    } else if (action.kind === "Filter") {
      if (region)
        [...region.children].forEach((e) => {
          (e as HTMLElement).hidden = !(
            e.getAttribute("data-" + (action.field ?? "filter")) ??
            e.textContent ??
            ""
          )
            .toLocaleLowerCase()
            .includes(value.toLocaleLowerCase());
        });
      state[key] = value;
    } else if (action.kind === "Sort") {
      if (region)
        [...region.children]
          .sort(
            (a, b) =>
              (
                a.getAttribute("data-" + (action.field ?? "sort")) ??
                a.textContent ??
                ""
              ).localeCompare(
                b.getAttribute("data-" + (action.field ?? "sort")) ??
                  b.textContent ??
                  "",
                undefined,
                { numeric: true },
              ) * (value === "desc" ? -1 : 1),
          )
          .forEach((e) => region.append(e));
      state[key] = value;
    } else if (action.kind === "Set") state[key] = value;
    else if (action.kind === "Increment")
      state[key] = String(
        Math.max(0, Number(state[key] ?? 0) + Number(value || 1)),
      );
    else {
      send("action", { actionId: action.id, values: values(element) });
      return;
    }
    draw();
    publish();
  };
  const actionElement = (event: Event) => {
    let e = event.target instanceof Element ? event.target : null;
    while (e && e !== document.body) {
      if (actions.has(e.id)) return e as HTMLElement;
      e = e.parentElement;
    }
    return null;
  };
  document.addEventListener("click", (event) => {
    const e = actionElement(event);
    if (
      e &&
      !(e instanceof HTMLFormElement) &&
      !(e instanceof HTMLInputElement) &&
      !(e instanceof HTMLSelectElement)
    ) {
      event.preventDefault();
      run(e);
    } else if ((event.target as Element)?.closest("a")) {
      event.preventDefault();
      const href = (event.target as Element).closest("a")!.getAttribute("href");
      if (href?.startsWith("#")) byId(href.slice(1))?.scrollIntoView();
    }
  });
  document.addEventListener("submit", (event) => {
    event.preventDefault();
    if (
      event.target instanceof HTMLFormElement &&
      event.target.reportValidity()
    )
      run(event.target);
  });
  let composing = false;
  document.addEventListener("compositionstart", () => {
    composing = true;
  });
  document.addEventListener("compositionend", () => {
    composing = false;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (composing || event.isComposing))
      event.preventDefault();
  });
  document.addEventListener("input", (event) => {
    const field = event.target;
    if (
      field instanceof HTMLInputElement ||
      field instanceof HTMLTextAreaElement ||
      field instanceof HTMLSelectElement
    ) {
      if (field.name) {
        state["$draft:" + (field.form?.id ?? "") + ":" + field.name] =
          field instanceof HTMLInputElement &&
          (field.type === "checkbox" || field.type === "radio")
            ? String(field.checked)
            : field.value;
        publish();
      }
    }
  });
  document.addEventListener("input", (event) => {
    const e = actionElement(event);
    if (e && actions.get(e.id)?.kind === "Filter") run(e);
  });
  document.addEventListener("change", (event) => {
    const e = actionElement(event);
    if (e && !(e instanceof HTMLFormElement)) run(e);
  });
  const preview = (event: Event) => {
    const e = actionElement(event);
    const a = e ? actions.get(e.id) : null;
    send("preview", { actionId: a?.kind === "Navigate" ? a.id : null });
  };
  document.addEventListener("mouseover", preview);
  document.addEventListener("focusin", preview);
  document.addEventListener("mouseout", () =>
    send("preview", { actionId: null }),
  );
  document.addEventListener("focusout", () =>
    send("preview", { actionId: null }),
  );
  window.addEventListener(
    "scroll",
    () => send("preview", { actionId: null }),
    true,
  );
  const restore = () => {
    for (const action of documentSpec.actions) {
      const value = state[action.stateKey ?? action.id];
      const region = byId(action.region);
      const element = byId(action.elementId);
      if (action.kind === "Toggle" && value !== undefined && region)
        region.hidden = value !== "true";
      if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement
      ) {
        if (
          value !== undefined &&
          ["Filter", "Sort", "Set"].includes(action.kind)
        ) {
          element.value = value;
          run(element);
        }
      }
    }
    document
      .querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >("input[name],textarea[name],select[name]")
      .forEach((field) => {
        const value =
          state["$draft:" + (field.form?.id ?? "") + ":" + field.name];
        if (value !== undefined) {
          if (
            field instanceof HTMLInputElement &&
            (field.type === "checkbox" || field.type === "radio")
          )
            field.checked = value === "true";
          else field.value = value;
        }
      });
    for (const action of documentSpec.actions) {
      if (action.kind === "Switch") {
        const value = state[action.stateKey ?? action.id];
        const region = byId(action.region);
        if (value !== undefined && region)
          [...region.children].forEach((e) => {
            (e as HTMLElement).hidden = e.id !== value;
          });
      }
    }
    draw();
  };
  restore();
  window.addEventListener("message", (event) => {
    if (
      event.source !== parent ||
      event.data?.instance !== instance ||
      event.data?.type !== "document-update"
    )
      return;
    const next = event.data.document as WebDocument;
    const region = byId(event.data.region);
    const parsed = new DOMParser().parseFromString(next.html, "text/html");
    const replacement = parsed.getElementById(event.data.region);
    if (!region || !replacement) return;
    const scroll = window.scrollY;
    region.replaceChildren(...replacement.childNodes);
    documentSpec = next;
    actions.clear();
    next.actions.forEach((a) => actions.set(a.elementId, a));
    state = { ...next.initialState, ...state };
    restore();
    window.scrollTo(0, scroll);
    publish();
    send("updated", {});
  });
  if (savedScroll) window.scrollTo(0, savedScroll);
  window.addEventListener("scroll", publish, { passive: true });
  send("ready", {});
}
export function frameSource(
  spec: WebDocument,
  instance: string,
  nonce: string,
  savedState?: Record<string, string>,
  savedScroll?: number,
): string {
  const json = (value: unknown) =>
    JSON.stringify(value).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html{overflow-x:hidden;scrollbar-gutter:stable}body{margin:0;overflow-wrap:anywhere}*{box-sizing:border-box}button,input,select,textarea{font:inherit}button,a,summary{cursor:pointer}[hidden]{display:none!important}@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}</style><style>${spec.css.replace(/<\/style/gi, "< /style")}</style></head><body>${spec.html}<script nonce="${nonce}">(${runtime.toString()})(${json(spec)},${json(instance)},${json(savedState ?? {})},${json(savedScroll ?? 0)})</script></body></html>`;
}
