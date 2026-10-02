/**
 * Timeline text rendering. Templates are data (timeline_templates table),
 * e.g. "{actor} が {subject} を完成". No LLM involved.
 */
export function renderTemplate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{([a-zA-Z0-9_.]+)\}/g, (_m, path: string) => {
    const value = path.split(".").reduce<unknown>((acc, key) => {
      if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
      return undefined;
    }, vars);
    return value === undefined || value === null ? "" : String(value);
  });
}
