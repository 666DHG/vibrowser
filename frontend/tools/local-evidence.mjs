import { readFile as read } from "node:fs/promises";
export async function readFile(path, ...options) {
  try {
    return await read(path, ...options);
  } catch (error) {
    if (error.code === "ENOENT" && String(path).includes("release-archive"))
      throw new Error(
        `Local acceptance evidence is missing: ${path}. Public releases omit raw evidence. Restore your local archive or run the explicitly authorized acceptance workflow; see docs/RELEASE.md.`,
        { cause: error },
      );
    throw error;
  }
}
