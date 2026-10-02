"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/form-select";
import { api } from "@/lib/client-api";

interface Option { value: string; label: string }

export function CreateProjectForm({ templates, divisions, parents }: { templates: Option[]; divisions: Option[]; parents: Option[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="grid grid-cols-1 gap-3 md:grid-cols-6" action={(form) => start(async () => {
      setError(null);
      try {
        await api("/api/v1/projects", { body: {
          name: form.get("name"), slug: form.get("slug"), templateKey: form.get("templateKey"),
          ownerDivisionId: form.get("ownerDivisionId"), parentSlug: form.get("parentSlug") || undefined,
          category: form.get("category") || undefined, pinned: form.get("pinned") === "on",
        } });
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    })}>
      <div className="md:col-span-2"><Label htmlFor="name">名前</Label><Input id="name" name="name" required placeholder="ARQO Labs" /></div>
      <div><Label htmlFor="slug">slug</Label><Input id="slug" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="arqo-labs" /></div>
      <div><Label htmlFor="templateKey">テンプレート</Label><Select id="templateKey" name="templateKey">{templates.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></div>
      <div><Label htmlFor="ownerDivisionId">主担当部署</Label><Select id="ownerDivisionId" name="ownerDivisionId">{divisions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></div>
      <div><Label htmlFor="parentSlug">親プロジェクト</Label><Select id="parentSlug" name="parentSlug"><option value="">（なし）</option>{parents.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></div>
      <div className="md:col-span-2"><Label htmlFor="category">カテゴリ</Label><Input id="category" name="category" placeholder="venture" /></div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" name="pinned" /> Home に表示</label>
      <div className="flex items-end md:col-span-3"><Button type="submit" disabled={pending}>プロジェクトを作成</Button>
        {error && <span className="ml-3 text-xs text-critical">{error}</span>}</div>
    </form>
  );
}
