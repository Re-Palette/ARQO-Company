import { CreateProjectInput, newId } from "@friday/core";
import { schema, type DbOrTx } from "@friday/db";
import { VAULT_DIRS } from "@friday/vault";
import { asc, eq } from "drizzle-orm";
import { CEO, type Actor } from "./actors";
import type { ServiceContext } from "./context";
import { ServiceError } from "./errors";
import { emitEvent } from "./events";
import { writeProjectNote } from "./memory-notes";
import { notify } from "./notifications";

/** Minimal JSON-schema check for template custom fields (top-level types only). */
export function validateCustomFields(schemaDef: unknown, values: Record<string, unknown>): string[] {
  const props = ((schemaDef as { properties?: Record<string, { type?: string }> })?.properties) ?? {};
  const problems: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    const expected = props[key]?.type;
    if (!expected) continue;
    const actual = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
    if (expected !== actual && !(expected === "integer" && actual === "number")) {
      problems.push(`${key}: expected ${expected}, got ${actual}`);
    }
  }
  return problems;
}

/**
 * Create a project from a template. No project-specific code anywhere: the
 * template drives divisions, KPIs and the vault folder layout.
 */
export async function createProject(ctx: ServiceContext, raw: unknown, actor: Actor = CEO) {
  const parsed = CreateProjectInput.safeParse(raw);
  if (!parsed.success) throw new ServiceError("VALIDATION_ERROR", "invalid project", parsed.error.issues);
  const input = parsed.data;
  const db = ctx.db;
  const template = (await db.select().from(schema.projectTemplates).where(eq(schema.projectTemplates.key, input.templateKey)))[0];
  if (!template) throw new ServiceError("VALIDATION_ERROR", `unknown template "${input.templateKey}"`);
  const division = (await db.select().from(schema.divisions).where(eq(schema.divisions.id, input.ownerDivisionId)))[0];
  if (!division) throw new ServiceError("VALIDATION_ERROR", `unknown division "${input.ownerDivisionId}"`);
  const parent = input.parentSlug
    ? (await db.select().from(schema.projects).where(eq(schema.projects.slug, input.parentSlug)))[0]
    : undefined;
  if (input.parentSlug && !parent) throw new ServiceError("VALIDATION_ERROR", `unknown parent "${input.parentSlug}"`);
  const fieldProblems = validateCustomFields(template.customFieldsSchema, input.customFields);
  if (fieldProblems.length) throw new ServiceError("VALIDATION_ERROR", "custom fields do not match the template", fieldProblems);
  if ((await db.select({ id: schema.projects.id }).from(schema.projects).where(eq(schema.projects.slug, input.slug))).length) {
    throw new ServiceError("CONFLICT", `project "${input.slug}" already exists`);
  }

  const project = await db.transaction(async (tx) => {
    const [p] = await tx.insert(schema.projects).values({
      id: newId(), slug: input.slug, name: input.name, description: input.description ?? "", category: input.category,
      templateKey: template.key, parentProjectId: parent?.id ?? null, ownerDivisionId: division.id, status: input.status,
      phase: (template.phases as string[])[0] ?? null, pinned: input.pinned, color: input.color, icon: input.icon,
      dataSensitivity: input.dataSensitivity, customFields: input.customFields, vaultPath: `${VAULT_DIRS.projects}/${input.slug}`,
    }).returning();
    const divisionIds = new Set([division.id, ...template.defaultDivisions]);
    const known = new Set((await tx.select({ id: schema.divisions.id }).from(schema.divisions)).map((d) => d.id));
    for (const d of divisionIds) {
      if (known.has(d)) {
        await tx.insert(schema.projectDivisions).values({ projectId: p!.id, divisionId: d, role: d === division.id ? "owner" : "support" });
      }
    }
    for (const k of (template.defaultKpis as { key: string; name: string; unit?: string; period?: string }[])) {
      await tx.insert(schema.kpiDefinitions).values({
        id: newId(), key: `${input.slug}.${k.key}`, name: k.name, unit: k.unit ?? "", period: k.period ?? "monthly", projectId: p!.id,
      }).onConflictDoNothing();
    }
    await emitEvent(tx, {
      type: "project.created", actor, subjectType: "project", subjectId: p!.id, projectId: p!.id, divisionId: division.id,
      importance: 4, data: { name: p!.name, slug: p!.slug, template: template.key, parent: parent?.slug ?? null },
    });
    await notify(ctx, tx, { category: "project", title: `新規プロジェクト: ${p!.name}`, link: `/projects/${p!.slug}` });
    return p!;
  });

  await ctx.vault.exclusive(async () => {
    await writeProjectNote(ctx, ctx.db, project);
    await ctx.vault.commit(ctx.db, `friday: project.created ${project.slug}`);
  });
  return project;
}

export async function listProjects(db: DbOrTx) {
  const rows = await db.select().from(schema.projects).orderBy(asc(schema.projects.sortOrder), asc(schema.projects.createdAt));
  const bySlug = new Map(rows.map((r) => [r.id, r.slug]));
  return rows.map((p) => ({
    id: p.id, slug: p.slug, name: p.name, description: p.description, category: p.category, templateKey: p.templateKey,
    parentSlug: p.parentProjectId ? bySlug.get(p.parentProjectId) ?? null : null, ownerDivisionId: p.ownerDivisionId,
    status: p.status, phase: p.phase, progress: p.progress, health: p.health, color: p.color, pinned: p.pinned,
    dataSensitivity: p.dataSensitivity, customFields: p.customFields, vaultPath: p.vaultPath,
  }));
}

export async function getProject(db: DbOrTx, slug: string) {
  const p = (await db.select().from(schema.projects).where(eq(schema.projects.slug, slug)))[0];
  if (!p) throw new ServiceError("NOT_FOUND", `project "${slug}" not found`);
  return p;
}

export async function listProjectTemplates(db: DbOrTx) {
  return db.select().from(schema.projectTemplates).orderBy(asc(schema.projectTemplates.key));
}
