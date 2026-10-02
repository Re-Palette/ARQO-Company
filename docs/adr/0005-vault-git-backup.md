# ADR 0005: Vault → Git → Private GitHub → Cloudflare R2

- 状態: 採用（Phase 0）
- 決定: Obsidian Vault は独立した Git リポジトリ。書き込みはプロセス内の直列化＋Postgres アドバイザリロックで単一ライター化し、コミット後に Private GitHub へ push。毎日 03:00 に `git bundle --all` を R2 へ保存（未設定時は Supabase Storage、開発時のみローカル）し、保存したものを取り戻して clone・fsck・ノート数照合で復元検証する。
- 重要: Git コマンドは常に `GIT_DIR` / `GIT_WORK_TREE` をVault自身に固定する（親リポジトリへ誤って書き込まないため。Phase 0 で実際に発生した不具合の再発防止）。
- バックアップは上書き不可（R2: `If-None-Match: *`、Supabase: `x-upsert: false`、ローカル: `wx`）。
