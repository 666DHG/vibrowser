import { test } from "node:test";
import assert from "node:assert/strict";
import { join, resolve, delimiter } from "node:path";
import { resolvePostgresBin, requiredTools } from "./postgres-bin.mjs";
const fake = (directories, versions = {}) => ({
  existsSync: (path) => Object.hasOwn(versions, path) || directories.some((dir) => requiredTools.some((name) => path === join(dir, name))),
  readdirSync: (path) => versions[path] ?? [],
});
test("explicit path with spaces overrides PATH; invalid explicit path fails", () => {
  const fs = fake(["C:/Custom PostgreSQL/bin", "C:/path/bin"]);
  assert.equal(resolvePostgresBin({ VIBROWSER_PG_BIN: "C:/Custom PostgreSQL/bin", PATH: "C:/path/bin" }, fs), resolve("C:/Custom PostgreSQL/bin"));
  assert.throws(() => resolvePostgresBin({ VIBROWSER_PG_BIN: "missing", PATH: "C:/path/bin" }, fs), /VIBROWSER_PG_BIN/);
  assert.throws(() => resolvePostgresBin({ VIBROWSER_PG_BIN: "" }, fs), /VIBROWSER_PG_BIN/);
});
test("PATH uses first complete toolset", () => {
  assert.equal(resolvePostgresBin({ PATH: ["missing", "C:/tools/bin"].join(delimiter) }, fake(["C:/tools/bin"])), resolve("C:/tools/bin"));
});
test("standard installations use highest complete numeric version", () => {
  const base = "C:/Program Files", parent = join(base, "PostgreSQL");
  const fs = fake([join(parent,"9.6","bin"), join(parent,"16","bin")], { [parent]: ["9.6", "16", "17", "invalid"] });
  assert.equal(resolvePostgresBin({ ProgramFiles: base }, fs), resolve(parent, "16", "bin"));
});
test("missing or incomplete installation explains setup", () => {
  assert.throws(() => resolvePostgresBin({}, fake([])), /Install PostgreSQL/);
  assert.throws(() => resolvePostgresBin({ PATH: "partial" }, { existsSync: (p) => p.endsWith("psql.exe"), readdirSync: () => [] }), /not found/);
});
