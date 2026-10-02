import Link from "next/link";
import { Bot, Building2, FileText, FolderKanban, Home, Settings } from "lucide-react";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/agents", label: "AI Employees", icon: Bot },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ active }: { active: string }) {
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-[#060a12]/80 px-3 py-5 backdrop-blur md:flex">
      <div className="mb-8 px-2">
        <p className="text-lg font-semibold tracking-[0.3em] text-gold">F.R.I.D.A.Y.</p>
        <p className="text-[9px] tracking-[0.4em] text-muted-foreground">AI COMPANY OS</p>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${active === href ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"}`}>
            <Icon className="size-4" /> {label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto flex items-center gap-2 px-2 text-[11px] text-muted-foreground">
        <Building2 className="size-3.5" /> Phase 0 · 基盤
      </div>
    </aside>
  );
}
