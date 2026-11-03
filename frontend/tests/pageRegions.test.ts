import { it, expect } from "vitest";
import type { PageBlock } from "../src/shared/pageSpec";
import { pageRegions } from "../src/pages/BrowserPage/components/pageDesign";

const block = (
  id: string,
  placement: "main" | "aside" | "full" = "main",
): PageBlock => ({
  id,
  type: "text",
  title: null,
  text: id,
  target: null,
  items: [],
  style: { placement, variant: "plain" },
});

it("keeps long documentation sections in the same main column beside all sidebar sections", () => {
  const blocks = [
    block("toc", "aside"),
    block("intro"),
    block("install"),
    block("related", "aside"),
    block("usage"),
  ];
  expect(pageRegions(blocks)).toEqual([
    {
      kind: "columns",
      aside: [blocks[0], blocks[3]],
      main: [blocks[1], blocks[2], blocks[4]],
    },
  ]);
});

it("full-width sections delimit independent column groups without dropping content", () => {
  const blocks = [
    block("lead"),
    block("news", "aside"),
    block("feature", "full"),
    block("stories"),
    block("links", "aside"),
  ];
  expect(pageRegions(blocks)).toEqual([
    { kind: "columns", main: [blocks[0]], aside: [blocks[1]] },
    { kind: "full", block: blocks[2] },
    { kind: "columns", main: [blocks[3]], aside: [blocks[4]] },
  ]);
});
