/** Vault folder layout (docs/design/10-obsidian.md 10.2). */
export const VAULT_DIRS = {
  inbox: "00_Inbox",
  ceo: "01_CEO",
  directives: "01_CEO/Directives",
  decisions: "01_CEO/Decisions",
  daily: "01_CEO/Daily",
  company: "02_Company",
  policies: "02_Company/Policies",
  kpi: "02_Company/KPI",
  divisions: "03_Divisions",
  agents: "04_AI Employees",
  projects: "05_Projects",
  tasks: "06_Tasks",
  meetings: "07_Meetings",
  boardMeetings: "07_Meetings/Board",
  reports: "08_Reports",
  approvedReports: "08_Reports/Approved",
  draftReports: "08_Reports/Drafts",
  knowledge: "09_Knowledge",
  activity: "10_Activity",
  templates: "90_Templates",
  system: "99_System",
} as const;

export function yearMonth(date: string): { year: string; month: string } {
  return { year: date.slice(0, 4), month: date.slice(5, 7) };
}

/** Make a string safe as a file/folder name on macOS, Windows and iOS. */
export function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|#^[\]]/g, "-").replace(/\s+/g, " ").trim().slice(0, 120);
}
