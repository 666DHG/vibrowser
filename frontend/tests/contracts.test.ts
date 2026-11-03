import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pageSpecSchema, safeTarget } from "../src/shared/pageSpec";
import { apiName } from "../src/apis/system/send";
describe("shared content fixtures", () => {
  for (const kind of ["valid", "invalid"]) {
    const dir = resolve("../contracts/fixtures", kind);
    for (const file of readdirSync(dir))
      it(kind + ": " + file, () => {
        expect(
          pageSpecSchema.safeParse(
            JSON.parse(readFileSync(resolve(dir, file), "utf8")),
          ).success,
        ).toBe(kind === "valid");
      });
  }
  it("rejects executable and private targets", () => {
    for (const target of [
      "javascript:alert(1)",
      "data:text/html,x",
      "http://127.0.0.1",
      "https://x.local/",
    ])
      expect(safeTarget(target)).toBe(false);
    expect(safeTarget("/menu")).toBe(true);
  });
  it("route metadata stays stable after bundling", () =>
    expect(apiName("GetPageMessage")).toBe("getpage"));
});
