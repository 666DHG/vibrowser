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
