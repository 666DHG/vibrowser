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
    const selfLinked = bindEntity(
      { ...spec.blocks[0], target: spec.entities[0].id, text: "详情展开正文" },
      spec.entities,
      spec.subjectEntityId,
    );
    expect(selfLinked.text).toBe("详情展开正文");
  });
  it("legacy-only facts remain verbatim, while structured metadata is displayed once", () => {
    const entity = spec.entities[0];
    const duplicated = bindEntity(spec.blocks[0], [
      { ...entity, legacyMeta: "月面旅人 · 37 条回复" },
    ]);
    expect(duplicated.meta?.match(/37 条回复/g)).toHaveLength(1);
    const legacy = bindEntity(spec.blocks[0], [
      {
        ...entity,
        author: null,
        publishedAt: null,
        replyCount: null,
        legacyMeta: "原始作者 · 三十七条回复",
      },
    ]);
    expect(legacy.meta).toBe("原始作者 · 三十七条回复");
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
