# F.R.I.D.A.Y. — AI COMPANY OS システム設計書（Phase 1）

> ステータス: **設計レビュー待ち** / 実装コードはまだ存在しません。
> 作成日: 2026-10-02

CEO（陽大）が最終意思決定だけを行い、AI社員が働き、プロジェクトを進め、レポートを作り、承認を求めてくる——
そんな「自分専用のAI会社」を動かす経営OSの設計書です。

## 目次

| # | ドキュメント | 依頼項目との対応 |
|---|---|---|
| 01 | [システム概要・全体アーキテクチャ・データフロー](./01-architecture.md) | 1. 全体アーキテクチャ図 / 2. データフロー図 |
| 02 | [AI組織・部署構成・AI社員一覧](./02-organization.md) | 3. AI組織図 / 4. 部署構成 / 5. AI社員一覧 |
| 03 | [エージェント実行基盤（COOオーケストレーション）](./03-agent-runtime.md) | COOの役割の実現方式 |
| 04 | [データモデル・DB設計](./04-data-model-db.md) | 6. データモデル設計 / 14. DB設計 |
| 05 | [Obsidian Vault設計（会社の脳）](./05-obsidian.md) | 7. Obsidian構造設計 |
| 06 | [AI Provider Layer設計](./06-ai-provider.md) | 8. AI Provider設計 |
| 07 | [通知・承認フロー設計](./07-notification-approval.md) | 9. 通知システム設計 / 10. 承認フロー設計 |
| 08 | [PDFレポート設計](./08-pdf-reports.md) | 11. PDFレポート設計 |
| 09 | [万能AIエージェント接続設計](./09-universal-agent.md) | 12. 万能AIエージェント接続設計 |
| 10 | [API設計](./10-api.md) | 13. API設計 |
| 11 | [Dashboard UI設計](./11-dashboard-ui.md) | 添付デザインの進化版 |
| 12 | [フォルダ構成](./12-folder-structure.md) | 15. フォルダ構成 |
| 13 | [実装ロードマップ](./13-roadmap.md) | 16. 実装ロードマップ |

図はすべて **Mermaid** で記述しています（GitHub と Obsidian の両方でそのまま描画されます）。

## 設計の要点（1分サマリー）

1. **3層構造**: `Dashboard（本社）` ／ `Company Runtime（会社の頭脳と手足）` ／ `Memory（Obsidian Vault + DB）`。
2. **指揮系統は一本化**: CEO・万能AI・スケジューラ、どこから来た依頼も必ず **COO（F.R.I.D.A.Y.）の Intake** を通る。部署やAI社員を直接叩くAPIは外部に公開しない。
3. **副作用はすべて承認ゲート経由**: Deploy・SNS投稿・メール送信・外部連携・予算執行などは、AI社員が「実行」できず「実行リクエスト（ActionRequest）」しか作れない。CEO承認後、**承認時点のペイロードそのもの**だけが実行される。
4. **DBは"今"、Obsidianは"記憶"**: ダッシュボードの高速表示・状態管理は Postgres、会社の記憶（タスク・PJ・会議・レポート・CEO指示・知識・AI社員メモリ）は Obsidian Vault に Markdown で永続化。両者は共通IDで結ばれる。
5. **モデル非固定**: Provider Layer で Gemini（初期・無料枠）⇄ Claude を設定画面から切替。AI社員ごとに「モデル階層（fast / standard / deep）」で指定し、具体モデルはルーティング表で解決。
6. **毎日のリズム**: 07:30 Morning Briefing → 日中 自律稼働 → 21:00 Daily Executive Report（PDF）→ CEO確認。
7. **UIは"1画面で会社全体"**: 1920×1080 でスクロールなし。最重要は **CEO ACTION REQUIRED**（画面右上の固定・最強コントラスト・その場で承認可能）。

## レビューで決めてほしいこと

設計の大部分は推奨案で確定させていますが、以下は CEO の判断が必要です（各ドキュメント内にも記載）。

| # | 論点 | 推奨案 | 代替案 |
|---|---|---|---|
| D1 | 稼働場所 | **ハイブリッド**: Web（Vercel）+ Worker（常駐: Railway/Fly.io もしくは自宅Mac） | 全部ローカル（Mac上で完結） |
| D2 | DB | **Supabase（Postgres + Realtime + Storage + Auth + pgvector）** | ローカル SQLite |
| D3 | Obsidian同期方式 | **Vault を Private Git リポジトリ化**（Worker が commit/push、Obsidian Git プラグインで pull） | Obsidian Local REST API（PC起動中のみ）/ iCloud・Dropbox 同期 |
| D4 | 通知チャネル | **アプリ内 + Web Push(PWA) + メール**、Phase 7 で LINE / Slack | 最初から LINE |
| D5 | レポート時刻 | **Morning Briefing 07:30 / Daily Report 21:00（JST）** | 任意 |
| D6 | 初期AI社員数 | **MVPは11名（COO + 10部門のリード各1名）**、以降段階的に増員 | 最初から全員 |
| D7 | 自律度 | **L2: 社内作業は自律、外部副作用は全件承認** | L1（全タスク着手前に承認）/ L3（低リスクは自動承認） |
