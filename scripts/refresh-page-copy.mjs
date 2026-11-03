// One-time copy maintenance for pages generated with the original prompt.
// Only reviewed boilerplate phrases are edited; page IDs, jobs and links are preserved.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const psql = join(process.env.VIBROWSER_PG_BIN ?? "D:/Installs/PostgreSQL/16/bin", "psql.exe");
const query = (sql) => execFileSync(psql, ["-w", "-h", "127.0.0.1", "-p", "55432", "-U", "vibrowser", "-d", "vibrowser", "-tA", "-v", "ON_ERROR_STOP=1"], { input: sql, encoding: "utf8", windowsHide: true });
const removals = [
  "以下结果均为演示性虚构站点，请结合课程要求独立完成作业。",
  "以下行程、舱位与时刻均为虚构示例。",
  "日程为虚构编排，仅作示例。",
  "所有商品与故事均为虚构展示。",
  "全部内容为设计演示，并无真实文件传输。",
  "全部内容为虚构演示，无真实商品或交易。",
  "全部内容为虚构演示。",
  "，内容均为虚构创作，不构成事实核验或购买建议",
  "，内容为虚构示例，不构成事实核验，亦无真实预订功能",
  "，内容为虚构示例，不构成事实核验",
  "，所有内容为演示用途",
  "，内容为演示用途",
  "，全部为虚构演示",
  "，内容仅作演示",
  "，仅作教学演示",
];
const replacements = [
  ["虚构搜索结果 · 内容由 AI 生成，并非真实互联网搜索", "为你找到 3 个相关结果"],
  ["探索那些尚未存在的网站。", "查找月面航线、旅行图鉴与住宿"],
  ["一家虚构的社区咖啡馆", "一家社区咖啡馆"],
  ["一个虚构的编辑型网站", "一个编辑型网站"],
  ["一座虚构的植物研究温室", "一座植物研究温室"],
  ["一个虚构的小型文创网站", "一个小型文创网站"],
  ["虚构的月球旅行搜索结果页", "月球旅行搜索结果页"],
  ["虚构的环月低轨观光航线", "环月低轨观光航线"],
  ["虚构搜索结果页", "搜索结果页"],
  ["虚构条目", "条目"], ["虚构的对照表", "对照表"],
  ["检索虚构目录", "检索目录"],
  ["的虚构航线", "的航线"], ["虚构航线档案", "航线档案"],
  ["的虚构营地方案", "的营地方案"], ["虚构观景台", "观景台"],
  ["虚构耐旱作物", "耐旱作物"], ["虚构小店", "小店"],
  ["虚构下载页", "下载页"], ["虚构 ¥", "¥"],
  ["虚构实验报告档案页", "实验报告档案页"],
  ["虚构误差分析指南页面", "误差分析指南页面"],
];
const cleanText = value => typeof value !== "string" ? value :
  replacements.reduce((text, [from, to]) => text.replaceAll(from, to),
    removals.reduce((text, phrase) => text.replaceAll(phrase, ""), value)).trim();
const cleanBlocks = blocks => blocks.filter(block => block.type !== "footer").map(block => ({
  ...block, title: cleanText(block.title), text: cleanText(block.text), items: cleanBlocks(block.items),
}));
const literal = value => "'" + value.replaceAll("'", "''") + "'";
const changes = [];
for (const schema of ["vibrowser_live", "vibrowser_demo"]) {
  const rows = JSON.parse(query(`SELECT coalesce(json_agg(json_build_object('id',id,'spec',spec)), '[]'::json) FROM ${schema}.pages WHERE status='ready';`).trim());
  for (const row of rows) {
    const next = { ...row.spec, title: cleanText(row.spec.title), description: cleanText(row.spec.description), blocks: cleanBlocks(row.spec.blocks) };
    if (JSON.stringify(next) !== JSON.stringify(row.spec)) changes.push({ schema, id: row.id, before: row.spec, after: next });
  }
}
if (!process.argv.includes("--apply")) {
  console.log(`${changes.length} cached pages would be updated. Pass --apply to save a backup and apply.`);
} else if (changes.length) {
  mkdirSync(resolve(root, ".data"), { recursive: true });
  const backup = resolve(root, ".data", `copy-cleanup-backup-${Date.now()}.json`);
  writeFileSync(backup, JSON.stringify(changes, null, 2), "utf8");
  const statements = changes.map(change => `
DO $$ BEGIN
  UPDATE ${change.schema}.pages SET spec=${literal(JSON.stringify(change.after))}::jsonb
  WHERE id=${literal(change.id)} AND spec=${literal(JSON.stringify(change.before))}::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Page changed during copy cleanup'; END IF;
END $$;`);
  query("BEGIN; SET standard_conforming_strings=on;\n" + statements.join("\n") + "\nCOMMIT;");
  console.log(`Updated ${changes.length} cached pages; backup: ${backup}`);
} else console.log("No copy changes needed.");
