# ADR 0002: Postgres（Supabase）+ Drizzle ORM

- 状態: 採用（Phase 0）
- 決定: 運用状態の正は Postgres。ORM は Drizzle、マイグレーションは drizzle-kit。Supabase は本番のホスティング（DB・Auth・Storage・Realtime）として使い、アプリは標準の Postgres 接続（`DATABASE_URL`）で接続する。
- 理由: Supabase 固有 API に依存しないことで、ローカル Postgres・CI・Supabase のどこでも同じコードが動く。
- 安全策: 全テーブルで RLS を有効化しポリシーなし（anon/authenticated からは何も見えない）。承認の `approved` 遷移はトランザクション変数 `friday.actor='ceo'` を DB トリガーで必須化。監査テーブルは追記のみ。
