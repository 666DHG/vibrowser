import { describe, it, expect } from "vitest";
import { displayAddress } from "../src/pages/BrowserPage/functions/displayAddress";
describe("readable domains", () => {
  it("preserves Chinese host names without changing path or query", () => {
    expect(
      displayAddress("https://xn--xkr069b3udl0a.com/t/84458?q=a%20b"),
    ).toBe("https://清华树洞.com/t/84458?q=a%20b");
    expect(displayAddress("https://清华树洞.com/")).toBe(
      "https://清华树洞.com/",
    );
    expect(displayAddress("vibrowser://bookmarks")).toBe(
      "vibrowser://bookmarks",
    );
  });
});
