import { VAULT_DIRS } from "./layout";
import { renderNote } from "./markdown";
import type { VaultStore } from "./store";

const README: Record<string, string> = {
  [VAULT_DIRS.inbox]: "CEOのメモ置き場。COOがトリアージします。",
  [VAULT_DIRS.directives]: "CEOからの指示（Directive）の記録。",
  [VAULT_DIRS.decisions]: "承認・却下・差し戻し・Board決議の記録。",
  [VAULT_DIRS.daily]: "CEOデイリーノート（Morning Briefing へのリンク）。",
  [VAULT_DIRS.agents]: "AI社員のプロフィール・長期記憶・作業日誌。",
  [VAULT_DIRS.projects]: "プロジェクト。テンプレートから自動生成されます。",
  [VAULT_DIRS.meetings]: "会議記録（Weekly Board Meeting を含む）。",
  [VAULT_DIRS.approvedReports]: "承認済みレポートの長期アーカイブ。追記のみ・変更禁止。",
  [VAULT_DIRS.draftReports]: "承認前レポートの md 版。",
  [VAULT_DIRS.knowledge]: "会社の知識。出典URLと confidence を必須とします。",
  [VAULT_DIRS.activity]: "Company Timeline の日次ログ。",
};

const TEMPLATES: Record<string, string> = {
  "Project.md": "# {{name}}\n\n<!-- friday:begin summary -->\n<!-- friday:end summary -->\n\n## CEOメモ\n",
  "Meeting.md": "# {{title}}\n\n## 議題\n\n## 決議\n\n## CEOメモ\n",
  "Daily.md": "# {{date}}\n\n<!-- friday:begin briefing -->\n<!-- friday:end briefing -->\n\n## CEOメモ\n",
  "Knowledge.md": "---\ntype: knowledge\nsource_url:\nconfidence:\n---\n\n# {{title}}\n",
};

const SCHEMA_DOC = `# Frontmatter 仕様

| key | 説明 |
|---|---|
| id | ULID。DB の id と同一 |
| type | directive / decision / project / task / deliverable / report / meeting / agent / memory / journal / knowledge / activity / daily |
| title | タイトル |
| status | 状態（DB が正） |
| friday_managed | true ならシステム管理ノート |

## 書き込みルール
- システムは \`<!-- friday:begin -->\`〜\`<!-- friday:end -->\` の内側だけを書き換えます。
- マーカーの外（CEOメモ）はシステムが上書きしません。
- 削除はしません（\`archived: true\`）。\`08_Reports/Approved/\` は追記のみです。
- Re-Palette の個人情報は保存しません（集計値のみ）。
`;

const BACKUP_DOC = `# バックアップと復元

保全経路: **Vault → Git → Private GitHub → Cloudflare R2（Daily Backup）**

- 毎日 03:00 JST に git bundle を作成し、バックアップストレージへ保存します。
- R2 が未設定の場合は Supabase Storage、どちらも未設定の開発環境ではローカルディレクトリへ保存します。
- 復元: \`git clone <bundle> FRIDAY-Vault\` で全履歴を復元できます。

<!-- friday:begin backups -->
<!-- friday:end backups -->
`;

/** Create the vault folder structure. Idempotent; never overwrites existing notes. */
export async function scaffoldVault(store: VaultStore, companyName: string): Promise<string[]> {
  const created: string[] = [];
  for (const dir of Object.values(VAULT_DIRS)) {
    await store.ensureDir(dir);
    const readme = `${dir}/README.md`;
    if (README[dir] && !(await store.exists(readme))) {
      await store.write(readme, `# ${dir.split("/").at(-1)}\n\n${README[dir]}\n`);
      created.push(readme);
    }
  }
  const files: Record<string, string> = {
    "README.md": `# ${companyName} — 会社の脳\n\nF.R.I.D.A.Y. AI COMPANY OS が管理する Obsidian Vault です。\n`,
    [`${VAULT_DIRS.ceo}/Preferences.md`]: renderNote({
      frontmatter: { type: "preferences", friday_managed: false },
      body: "# CEO Preferences\n\nCEOの判断基準・好みを書いてください。全AI社員が常に参照します。\n",
    }),
    [`${VAULT_DIRS.system}/schema.md`]: SCHEMA_DOC,
    [`${VAULT_DIRS.system}/BACKUP.md`]: BACKUP_DOC,
    [`${VAULT_DIRS.knowledge}/_MOC.md`]: "# Knowledge — Map of Content\n",
    ".gitignore": ".obsidian/workspace*.json\n.trash/\n",
  };
  for (const [name, body] of Object.entries(TEMPLATES)) files[`${VAULT_DIRS.templates}/${name}`] = body;
  for (const [path, content] of Object.entries(files)) {
    if (!(await store.exists(path))) {
      await store.write(path, content);
      created.push(path);
    }
  }
  return created;
}
