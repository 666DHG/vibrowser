import { describe, it, expect } from "vitest";
import {
  canSpeak,
  companionProgress,
  readCompanionPreferences,
} from "../src/pages/BrowserPage/functions/companionRules";
import type { PendingNavigation } from "../src/pages/BrowserPage/objects/BrowserState";
import { companionReplySchema } from "../src/shared/companion";
const pending: PendingNavigation = {
  requestId: "one",
  input: "moon",
  mode: "navigate",
  status: "loading",
  startedAt: 0,
  collapsed: true,
};
describe("companion policy", () => {
  it("keeps defaults through corrupt or partial storage", () => {
    expect(readCompanionPreferences("oops")).toEqual({
      visible: true,
      automatic: true,
      ai: true,
    });
    expect(readCompanionPreferences('{"visible":false,"ai":"true"}')).toEqual({
      visible: false,
      automatic: true,
      ai: true,
    });
    expect(readCompanionPreferences("null").visible).toBe(true);
  });
  it("limits proactive and click speech independently", () => {
    expect(canSpeak(59999, 0, true)).toBe(false);
    expect(canSpeak(60000, 0, true)).toBe(true);
    expect(canSpeak(2999, 0, false)).toBe(false);
    expect(canSpeak(3000, 0, false)).toBe(true);
  });
  it("uses true error and completed states", () => {
    expect(companionProgress({ ...pending, status: "error" }).expression).toBe(
      "puzzled",
    );
    expect(
      companionProgress({ ...pending, status: "complete" }).expression,
    ).toBe("happy");
    expect(companionProgress(pending).expression).toBe("observe");
  });
  it("rejects unknown responses and oversized text", () => {
    expect(
      companionReplySchema.safeParse({
        id: "1",
        status: "invented",
        text: null,
        expression: "happy",
      }).success,
    ).toBe(false);
    expect(
      companionReplySchema.safeParse({
        id: "1",
        status: "complete",
        text: "字".repeat(41),
        expression: "happy",
      }).success,
    ).toBe(false);
  });
});
