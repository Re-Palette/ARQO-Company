"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/form-select";
import { api } from "@/lib/client-api";

export function RegisterAgentForm({ divisions }: { divisions: { value: string; label: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="grid grid-cols-1 gap-3 md:grid-cols-6" action={(form) => start(async () => {
      setError(null);
      try {
        await api("/api/v1/agents", { body: {
          id: form.get("id"), displayName: form.get("displayName"), title: form.get("title"),
          divisionId: form.get("divisionId"), level: form.get("level"),
          deliverableTypes: String(form.get("deliverableTypes") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
          persona: form.get("persona") ?? "", runtime: "mock",
        } });
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    })}>
      <div><Label htmlFor="id">ID</Label><Input id="id" name="id" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="designer" /></div>
      <div><Label htmlFor="displayName">表示名</Label><Input id="displayName" name="displayName" required placeholder="Designer AI" /></div>
      <div><Label htmlFor="title">役職</Label><Input id="title" name="title" required placeholder="デザイン部長" /></div>
      <div><Label htmlFor="divisionId">部署</Label><Select id="divisionId" name="divisionId">{divisions.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</Select></div>
      <div><Label htmlFor="level">レベル</Label><Select id="level" name="level"><option value="lead">lead</option><option value="specialist">specialist</option></Select></div>
      <div><Label htmlFor="deliverableTypes">成果物（カンマ区切り）</Label><Input id="deliverableTypes" name="deliverableTypes" placeholder="design" /></div>
      <div className="md:col-span-4"><Label htmlFor="persona">ペルソナ</Label><Input id="persona" name="persona" placeholder="ブランドを大切にするデザイナー" /></div>
      <div className="flex items-end md:col-span-2"><Button type="submit" disabled={pending}>Mock Agent を採用</Button></div>
      {error && <p className="text-xs text-critical md:col-span-6">{error}</p>}
    </form>
  );
}
