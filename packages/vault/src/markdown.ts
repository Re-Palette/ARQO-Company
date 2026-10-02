import { parse, stringify } from "yaml";

export interface Note {
  frontmatter: Record<string, unknown>;
  body: string;
}

export function renderNote(note: Note): string {
  const fm = stringify(note.frontmatter, { lineWidth: 0 }).trimEnd();
  return `---\n${fm}\n---\n\n${note.body.trim()}\n`;
}

export function parseNote(text: string): Note {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!m) return { frontmatter: {}, body: text };
  return { frontmatter: (parse(m[1]!) as Record<string, unknown>) ?? {}, body: m[2]!.replace(/^\n/, "") };
}

const begin = (name: string) => `<!-- friday:begin ${name} -->`;
const end = (name: string) => `<!-- friday:end ${name} -->`;

export function managedBlock(name: string, content: string): string {
  return `${begin(name)}\n${content.trim()}\n${end(name)}`;
}

/**
 * Replace the content of a managed block, leaving everything outside the
 * markers (CEO notes) untouched. Appends the block if it does not exist yet.
 */
export function upsertManagedBlock(body: string, name: string, content: string): string {
  const start = body.indexOf(begin(name));
  const stop = body.indexOf(end(name));
  const block = managedBlock(name, content);
  if (start === -1 || stop === -1 || stop < start) {
    return `${body.trimEnd()}\n\n${block}\n`;
  }
  return body.slice(0, start) + block + body.slice(stop + end(name).length);
}

export function wikiLink(path: string, alias?: string): string {
  const target = path.replace(/\.md$/, "");
  return alias ? `[[${target}|${alias}]]` : `[[${target}]]`;
}
