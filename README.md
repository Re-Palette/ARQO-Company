# F.R.I.D.A.Y. — AI COMPANY OS

CEO が最終意思決定だけを行い、AI社員が働く「自分専用のAI会社」の経営OS。

- 設計書: [docs/design/](./docs/design/README.md)（v1.0）
- Phase 0 完了報告: [docs/phase0/](./docs/phase0/README.md)
- 設計判断の記録: [docs/adr/](./docs/adr/)

## 構成

```
apps/web        Next.js 16（Dashboard・REST API /api/v1・認証）
apps/worker     定時ジョブ（JST cron）・Webhook配信・Vault同期・バックアップ
packages/core   ドメイン型・Zod・AI運用ルール（policy）・状態遷移
packages/db     Drizzle スキーマ・マイグレーション・シード
packages/ai     AI Provider Layer（Gemini / Claude / OpenAI / OpenRouter / Mock）
packages/vault  Obsidian Vault（Markdown・管理ブロック・Git）
packages/backup バックアップ保存先（R2 → Supabase Storage → ローカル）
packages/notify 通知プロバイダ層（App / Web Push / Slack / Discord …）
packages/contracts Universal AI との公開契約 v1
packages/services  ドメインサービス（全アプリ共通）
```

## ローカル起動

前提: Node.js 22+, pnpm 10+, PostgreSQL 16, git（git-lfs 推奨）

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # 値を設定（下記）
export DATABASE_URL=postgres://friday:friday@localhost:5432/friday
pnpm db:migrate && pnpm db:seed                 # SEED_PROFILE=system なら会社データなしで起動
pnpm dev                                        # http://localhost:3000
pnpm worker                                     # 別ターミナル（JST の定時ジョブ）
```

`.env.local` の最低限: `DATABASE_URL`, `CEO_EMAIL`, `AUTH_SECRET`（32文字以上）, `LOCAL_AUTH_PASSWORD`（12文字以上・開発用）, `VAULT_PATH`。
本番は `AUTH_PROVIDER=supabase` と `SUPABASE_URL` / `SUPABASE_ANON_KEY`（ローカル認証は本番で自動的に無効）。

## 検証

```bash
pnpm typecheck && pnpm lint && pnpm test   # services の統合テストは TEST_DATABASE_URL の Postgres を使用
pnpm worker -- --once vault.sync            # ジョブを1回だけ実行
```
