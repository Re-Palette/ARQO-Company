import { companyDate, shortId } from "@friday/core";
import { schema, type DbOrTx } from "@friday/db";
import { safeName, VAULT_DIRS, wikiLink, yearMonth } from "@friday/vault";
import { eq } from "drizzle-orm";
import type { ServiceContext } from "./context";

type AgentRow = typeof schema.agents.$inferSelect;
type ProjectRow = typeof schema.projects.$inferSelect;

/** Notes that make up the company's long-term memory in Obsidian. */
export async function writeAgentProfile(ctx: ServiceContext, agent: AgentRow, divisionName: string) {
  const dir = agent.vaultPath ?? `${VAULT_DIRS.agents}/${agent.id}`;
  await ctx.vault.upsertNote(`${dir}/Profile.md`, {
    id: agent.id, type: "agent", title: agent.displayName, division: agent.divisionId, level: agent.level,
    model_tier: agent.modelTier, runtime: agent.runtime, tags: ["friday/agent", `division/${agent.divisionId}`],
  }, {
    profile: [
      `| 項目 | 内容 |`, `|---|---|`,
      `| 役職 | ${agent.title} |`, `| 部署 | ${divisionName} |`, `| レベル | ${agent.level} |`,
      `| モデル階層 | ${agent.modelTier} |`, `| 実行方式 | ${agent.runtime} |`,
      `| 担当 | ${agent.responsibilities.join("、")} |`, `| 成果物 | ${agent.deliverableTypes.join("、")} |`,
      "", `**ペルソナ**: ${agent.persona || "—"}`,
    ].join("\n"),
  }, (b) => `# ${agent.displayName}\n\n${block("profile", b.profile!)}\n\n## CEOメモ\n`);
  if (!(await ctx.vault.store.exists(`${dir}/Memory.md`))) {
    await ctx.vault.store.write(`${dir}/Memory.md`,
      `---\nid: ${agent.id}-memory\ntype: memory\nagent: ${agent.id}\nfriday_managed: true\n---\n\n# ${agent.displayName} の長期記憶\n\nAgent Memory から昇格した学び・CEOの好みがここに蓄積されます（Phase 5）。\n`);
  }
}

export async function appendAgentJournal(ctx: ServiceContext, agentId: string, line: string, at = new Date()) {
  const date = companyDate(at);
  const path = `${VAULT_DIRS.agents}/${agentId}/Journal/${date}.md`;
  const current = (await ctx.vault.store.read(path)) ?? `---\ntype: journal\nagent: ${agentId}\ndate: ${date}\nfriday_managed: true\n---\n\n# ${date} 作業日誌\n`;
  await ctx.vault.store.write(path, `${current.trimEnd()}\n- ${line}\n`);
}

export async function writeProjectNote(ctx: ServiceContext, db: DbOrTx, project: ProjectRow) {
  const parent = project.parentProjectId
    ? (await db.select().from(schema.projects).where(eq(schema.projects.id, project.parentProjectId)))[0]
    : undefined;
  const template = (await db.select().from(schema.projectTemplates).where(eq(schema.projectTemplates.key, project.templateKey)))[0];
  const dir = project.vaultPath ?? `${VAULT_DIRS.projects}/${project.slug}`;
  for (const folder of ((template?.vaultScaffold as { folders?: string[] })?.folders ?? [])) {
    await ctx.vault.store.ensureDir(`${dir}/${folder}`);
    if (!(await ctx.vault.store.exists(`${dir}/${folder}/.gitkeep`))) await ctx.vault.store.write(`${dir}/${folder}/.gitkeep`, "");
  }
  await ctx.vault.upsertNote(`${dir}/${safeName(project.name)}.md`, {
    id: project.id, type: "project", title: project.name, slug: project.slug, status: project.status,
    category: project.category, template: project.templateKey,
    parent: parent ? wikiLink(`${parent.vaultPath ?? `${VAULT_DIRS.projects}/${parent.slug}`}/${safeName(parent.name)}`, parent.name) : null,
    tags: ["friday/project", `project/${project.slug}`],
  }, {
    summary: [
      `| 項目 | 内容 |`, `|---|---|`,
      `| ステータス | ${project.status} |`, `| フェーズ | ${project.phase ?? "—"} |`, `| 進捗 | ${project.progress}% |`,
      `| 健康度 | ${project.health} |`, `| 主担当部署 | ${project.ownerDivisionId} |`,
      `| 親プロジェクト | ${parent?.name ?? "—"} |`, "", project.description || "",
    ].join("\n"),
  }, (b) => `# ${project.name}\n\n${block("summary", b.summary!)}\n\n## CEOメモ\n`);
}

export async function writeDailyNote(ctx: ServiceContext, lines: string[], at = new Date()) {
  const date = companyDate(at);
  const { year, month } = yearMonth(date);
  await ctx.vault.upsertNote(`${VAULT_DIRS.daily}/${year}/${month}/${date}.md`, {
    id: `daily-${date}`, type: "daily", date, tags: ["friday/daily"],
  }, { briefing: lines.join("\n") }, (b) => `# ${date}\n\n${block("briefing", b.briefing!)}\n\n## CEOメモ\n`);
}

export async function writeMeetingNote(ctx: ServiceContext, title: string, agenda: string[], at = new Date()) {
  const date = companyDate(at);
  const { year, month } = yearMonth(date);
  const path = `${VAULT_DIRS.meetings}/${year}/${month}/${date}_${safeName(title)}.md`;
  await ctx.vault.upsertNote(path, { id: `meeting-${date}-${safeName(title)}`, type: "meeting", title, date, tags: ["friday/meeting"] },
    { agenda: agenda.map((a) => `- ${a}`).join("\n") },
    (b) => `# ${title}\n\n## 議題\n${block("agenda", b.agenda!)}\n\n## 決議\n\n## CEOメモ\n`);
  return path;
}

export function deliverablePath(projectVaultPath: string | null | undefined, title: string, id: string): string {
  const base = projectVaultPath ? `${projectVaultPath}/Deliverables` : `${VAULT_DIRS.tasks}/Deliverables`;
  return `${base}/${safeName(title)} (${shortId(id, "D")}).md`;
}

function block(name: string, content: string) {
  return `<!-- friday:begin ${name} -->\n${content}\n<!-- friday:end ${name} -->`;
}
