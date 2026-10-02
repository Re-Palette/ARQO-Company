import { getContext, listDivisions, listProjects, listProjectTemplates } from "@friday/services";
import { AppShell } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateProjectForm } from "./create-project-form";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const ctx = getContext();
  const [projects, templates, divisions] = await Promise.all([listProjects(ctx.db), listProjectTemplates(ctx.db), listDivisions(ctx.db)]);
  return (
    <AppShell active="/projects" title={<span className="font-semibold">Projects</span>}>
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader><CardTitle>新規プロジェクト（テンプレートから作成・コード変更不要）</CardTitle></CardHeader>
          <CardContent>
            <CreateProjectForm
              templates={templates.map((t) => ({ value: t.key, label: t.name }))}
              divisions={divisions.map((d) => ({ value: d.id, label: d.nameJa }))}
              parents={projects.map((p) => ({ value: p.slug, label: p.name }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>プロジェクト一覧（{projects.length}）</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2">名前</th><th>slug</th><th>親</th><th>テンプレート</th><th>状態</th><th>進捗</th><th>機密区分</th><th>Vault</th></tr></thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="py-2 font-medium">{p.name}</td><td className="text-muted-foreground">{p.slug}</td>
                    <td>{p.parentSlug ?? "—"}</td><td>{p.templateKey}</td><td><Badge variant="outline">{p.status}</Badge></td>
                    <td className="tabular-nums">{p.progress}%</td><td>{p.dataSensitivity}</td>
                    <td className="font-mono text-[11px] text-muted-foreground">{p.vaultPath}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
