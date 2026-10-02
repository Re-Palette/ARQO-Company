# ADR 0001: TypeScript モノレポ（pnpm + Turborepo）

- 状態: 採用（Phase 0）
- 決定: Web・Worker・共有ロジックを TypeScript の単一モノレポで管理する。`apps/*`（web, worker）と `packages/*`（core, db, ai, vault, backup, notify, contracts, services）。
- 理由: 型（Zod スキーマ・状態遷移・ポリシー）を UI〜Worker〜外部契約まで共有し、仕様の二重管理を避ける。
- 結果: パッケージは TS ソースを直接公開し、Next.js は `transpilePackages`、Worker は `tsx` で実行する。
