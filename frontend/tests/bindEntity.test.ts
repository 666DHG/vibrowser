import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { pageSpecSchema } from "../src/shared/pageSpec";
import { bindEntity } from "../src/pages/BrowserPage/functions/bindEntity";
import { navigationTarget } from "../src/pages/BrowserPage/functions/navigationTarget";
describe("entity display", () => {
  const spec = pageSpecSchema.parse(
    JSON.parse(
      readFileSync("../contracts/fixtures/valid/entities-detail.json", "utf8"),
    ),
  );
  it("host renders inherited title/count instead of duplicated block guesses", () => {
    const result = bindEntity(
      { ...spec.blocks[0], title: "错误标题", meta: "2 回复" },
      spec.entities,
    );
    expect(result.title).toBe("夜航回来的那一杯");
    expect(result.meta).toContain("月面旅人");
    expect(result.meta).toContain("37 条回复");
    expect(result.text).toContain("夜班");
  });
  it("reply range is displayed independently from the total", () => {
    const result = bindEntity(spec.blocks[1], spec.entities);
    expect(result.title).toBe("回复");
    expect(result.meta).toContain("37 条回复");
    expect(result.meta).toContain("显示第 1–2 条");
  });
  it("preview and navigation share relative/absolute URL resolution", () => {
    expect(
      navigationTarget("../t/84458", "https://forum.example/boards/today"),
    ).toBe("https://forum.example/t/84458");
    expect(navigationTarget("https://other.example/")).toBe(
      "https://other.example/",
    );
  });
});
