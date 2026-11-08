import { existsSync, readdirSync } from "node:fs";
import { delimiter, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const requiredTools = ["pg_ctl.exe", "initdb.exe", "psql.exe", "createdb.exe"];
export function resolvePostgresBin(env = process.env, fs = { existsSync, readdirSync }) {
  const complete = (dir) => requiredTools.every((name) => fs.existsSync(join(dir, name)));
  if (env.VIBROWSER_PG_BIN !== undefined) {
    if (!env.VIBROWSER_PG_BIN.trim() || !complete(env.VIBROWSER_PG_BIN))
      throw new Error("VIBROWSER_PG_BIN must name a directory containing " + requiredTools.join(", "));
    return resolve(env.VIBROWSER_PG_BIN);
  }
  for (const dir of (env.PATH ?? env.Path ?? "").split(delimiter).filter(Boolean)) {
    const candidate = dir.replace(/^"|"$/g, "");
    if (complete(candidate)) return resolve(candidate);
  }
  const candidates = [];
  for (const parent of [env.ProgramFiles, env["ProgramFiles(x86)"]].filter(Boolean)) {
    const directory = join(parent, "PostgreSQL");
    if (!fs.existsSync(directory)) continue;
    for (const version of fs.readdirSync(directory)) {
      if (!/^\d+(?:\.\d+)*$/.test(version)) continue;
      const bin = join(directory, version, "bin");
      if (complete(bin)) candidates.push({ version, bin });
    }
  }
  candidates.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
  if (candidates.length) return resolve(candidates[0].bin);
  throw new Error("PostgreSQL tools not found. Install PostgreSQL and set VIBROWSER_PG_BIN to its bin directory.");
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(resolvePostgresBin()); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
