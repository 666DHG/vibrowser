import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import ts from "typescript";
const root = resolve(import.meta.dirname, "..");
await mkdir(resolve(root, "dist-measure"), { recursive: true });
const source = await readFile(
  resolve(root, "src/pages/BrowserPage/functions/webRuntime.ts"),
  "utf8",
);
const result = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
});
await writeFile(
  resolve(root, "dist-measure/webRuntime.mjs"),
  result.outputText,
);
await copyFile(
  resolve(root, "tools/measure.mjs"),
  resolve(root, "dist-measure/measure.mjs"),
);
