"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client-api";

/** Command Center: CEO instructions go to the COO intake as directives. */
export function CommandBar() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = () => start(async () => {
    try {
      await api("/api/v1/directives", { body: { text } });
      setText("");
      setMsg("COO が受け付けました（Phase 2 で自動分解されます）");
      router.refresh();
    } catch (e) {
      setMsg((e as Error).message);
    }
  });
  return (
    <form className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 backdrop-blur-md"
      onSubmit={(e) => { e.preventDefault(); if (text.trim()) submit(); }}>
      <div className="hidden shrink-0 sm:block">
        <p className="text-xs font-semibold tracking-[0.15em]">COMMAND CENTER</p>
        <p className="text-[10px] text-muted-foreground">AIに指示して、会社を動かす</p>
      </div>
      <Sparkles className="size-4 shrink-0 text-gold" />
      <Input value={text} onChange={(e) => setText(e.target.value)} aria-label="AI会社への指示"
        placeholder="AI会社に指示をする…（例: 今月の売上を伸ばすための施策を考えて）" className="h-10 border-none bg-transparent shadow-none focus-visible:ring-0" />
      <Button type="submit" size="icon" disabled={pending || !text.trim()} aria-label="送信"><Send /></Button>
      {msg && <span className="hidden max-w-60 truncate text-xs text-muted-foreground lg:block">{msg}</span>}
    </form>
  );
}
