import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { measureDocument } from "../dist-measure/measure.mjs";
const fixture = JSON.parse(
  await readFile(
    new URL("../../contracts/web-documents/docs.json", import.meta.url),
    "utf8",
  ),
);
test("production iframe measures viewport overflow without mistaking scroll containers or hidden panels", async () => {
  const doc = {
    ...fixture,
    html: '<main id="main"><h1>测量</h1><div id="table-scroll" style="overflow-x:auto;width:100%"><table style="width:1800px"><tr><td>表格</td></tr></table></div><section hidden style="width:2000px">隐藏</section></main>',
    css: "main{width:100%}",
    entities: [],
    actions: [],
    bindings: [],
  };
  const good = await measureDocument(doc);
  assert.equal(good.error, null);
  assert.deepEqual(
    good.viewports.map((v) => v.width),
    [1440, 390],
  );
  assert(good.viewports.every((v) => v.overflowIds.length === 0));
  const bad = await measureDocument({
    ...doc,
    html: '<main id="wide"><h1>溢出</h1></main>',
    css: "#wide{width:1800px}",
  });
  assert(bad.viewports.every((v) => v.overflowIds.includes("wide")));
});
test("all existing runtime fixtures measure without submitting or loading external resources", async () => {
  for (const name of ["forum", "shop", "docs"]) {
    const doc = JSON.parse(
      await readFile(
        new URL(
          "../../contracts/web-documents/" + name + ".json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const result = await measureDocument(doc);
    assert.equal(result.viewports.length, 2);
    assert(
      result.viewports.every(
        (v) => v.headings.length > 0 && v.controls.length > 0,
      ),
    );
  }
});
test("offscreen navigation distinguishes local scrolling from document overflow", async () => {
  const result = await measureDocument({
    ...fixture,
    html: '<nav id="scroll-nav"><div class="row"><a id="first" href="#main">起点</a><a id="last" href="#main">末项</a></div></nav><main id="main"><h1>正文</h1></main><div id="uncontained"><a id="outside" href="#main">真正溢出</a></div>',
    css: "#scroll-nav{width:300px;overflow-x:auto}.row{width:1800px;display:flex;justify-content:space-between}#uncontained{width:1800px;text-align:right}",
    entities: [],
    actions: [],
    bindings: [],
  });
  assert.equal(result.error, null);
  for (const viewport of result.viewports) {
    const last = viewport.controls.find((c) => c.id === "last");
    assert(last.x > viewport.width);
    assert.equal(last.horizontalScroll.containerId, "scroll-nav");
    assert.equal(last.horizontalScroll.clientWidth, 300);
    assert(last.horizontalScroll.scrollWidth >= 1800);
    assert.equal(
      last.horizontalScroll.viewportRight - last.horizontalScroll.viewportLeft,
      300,
    );
    assert(!viewport.overflowIds.includes("last"));
    assert.equal(
      viewport.controls.find((c) => c.id === "outside").horizontalScroll,
      null,
    );
    assert(viewport.overflowIds.includes("outside"));
  }
});
test("visual profiles describe rendering without copying page text, links or element identifiers", async () => {
  const result = await measureDocument({
    ...fixture,
    html: '<main id="secret-identity"><h1>Private person and facts</h1><section><p>Sensitive biography</p><p>Another fact</p></section></main>',
    css: "body{background:rgb(12,34,56);font-family:serif}h1{font-size:40px}section{display:grid;grid-template-columns:1fr 1fr}",
    entities: [],
    actions: [],
    bindings: [],
  });
  for (const viewport of result.viewports) {
    const profile = viewport.visualProfile;
    assert(profile.backgrounds.includes("rgb(12, 34, 56)"));
    assert(profile.headingSizes.includes(40));
    assert(
      profile.regions.some((r) => r.display === "grid" && r.columns === 2),
    );
    assert(profile.regions.length <= 4);
    assert(
      !/secret|Private|Sensitive|biography|https:/.test(
        JSON.stringify(profile),
      ),
    );
  }
});
