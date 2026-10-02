# F.R.I.D.A.Y. — AI COMPANY OS システム設計書 v1.0

> ステータス: **v1.0 レビュー待ち**（承認後 Phase 0 に着手）/ 実装コードはまだ存在しません。
> 更新日: 2026-10-02 / 前版: v0.1（初版設計）

CEO（陽大）が最終意思決定だけを行い、AI社員が働き、プロジェクトを進め、レポートを作り、判断を求めてくる——そんな「自分専用のAI会社」を動かす経営OSの設計書です。

## 目次

| # | ドキュメント | 内容 |
|---|---|---|
| 01 | [全体アーキテクチャ・データフロー](./01-architecture.md) | 設計原則、アーキテクチャ図、データフロー、定時ジョブ |
| 02 | [AI運用ルール](./02-ai-operating-rules.md) 🆕 | 自律可 / CEO承認必須 / 禁止事項と、その強制の仕組み |
| 03 | [AI組織図・部署・AI社員](./03-organization.md) | 組織図（Universal AI は社外）、部署構成、社員名簿 |
| 04 | [Re-Palette Division](./04-repalette-division.md) 🆕 | 専用事業部、8領域、専用KPI、データ保護 |
| 05 | [エージェント実行基盤](./05-agent-runtime.md) | COOパイプライン、実行ループ、ツール、Weekly Board |
| 06 | [AI Memory Layer](./06-agent-memory.md) 🆕 | Short-Term → Agent Memory → Obsidian |
| 07 | [AI社員評価システム](./07-agent-evaluation.md) 🆕 | 指標定義、職種別指標、表示 |
| 08 | [プロジェクト管理（拡張可能設計）](./08-projects.md) 🆕 | テンプレート駆動、コード修正なしで追加 |
| 09 | [データモデル・DB設計](./09-data-model-db.md) | 全テーブル定義（v1.0 差分つき） |
| 10 | [Obsidian Vault設計](./10-obsidian.md) | 構成、書き込みルール、Git → GitHub → Daily Backup |
| 11 | [AI Provider Layer](./11-ai-provider.md) | Gemini ⇄ Claude、機密区分ルーティング |
| 12 | [承認フロー / CEO ACTION REQUIRED](./12-approval-flow.md) | 判断待ちの定義、状態遷移、安全ルール |
| 13 | [通知システム](./13-notifications.md) 🆕 | Notification Provider Layer（App / Web Push 必須） |
| 14 | [レポート（生成→承認→アーカイブ）](./14-reports.md) | Daily / Morning / Board、Approved Reports |
| 15 | [Universal AI 接続（疎結合）](./15-universal-ai.md) | 独立稼働、Outbox、Event Feed、MCP |
| 16 | [API設計](./16-api.md) | 全エンドポイント（v1.0 差分つき） |
| 17 | [Dashboard構成](./17-dashboard.md) | ACTION REQUIRED 最上部、Timeline 中央 |
| 18 | [フォルダ構成](./18-folder-structure.md) | モノレポ、依存方向のルール |
| 19 | [実装ロードマップ](./19-roadmap.md) | Phase 0〜7 |
| 20 | [Phase 0 実装計画](./20-phase0-plan.md) 🆕 | WBS、受け入れ基準、事前準備 |

図はすべて **Mermaid**（GitHub と Obsidian でそのまま描画）。

## v1.0 変更点（CEOレビュー反映）

| # | 指摘 | 反映内容 | 主な章 |
|---|---|---|---|
| 1 | AI Memory Layer 追加 | Short-Term Memory → Agent Memory（Working Context Card + Memory Items）→ Obsidian の3層。毎晩 02:00 に昇格判定 | 06, 09 |
| 2 | AI社員評価システム | データ駆動の指標定義。Research（調査件数・採用率・参照回数）/ Marketing（投稿作成数・採用率・成果数）/ Development（実装数・修正数・完了率）＋全職種 | 07, 17 |
| 3 | Company Timeline | ホーム中央に配置。`activity_events` + 文言テンプレートで生成。会話ログを統合 | 17, 09 |
| 4 | Universal AI の疎結合化 | 社外システムとして契約（`contracts`）のみで接続。Webhook Outbox・Event Feed・冪等キー・`/health` で相互に独立稼働 | 15, 03 |
| 5 | PDF アーカイブ | 承認 → Approved Reports（不変）→ Obsidian（PDF + md）→ GitHub → Daily Backup（永久保存） | 14, 10 |
| 6 | ACTION REQUIRED を最上部へ | 全幅の最優先エリア。「CEOが判断しないと進まないもの」だけを表示し、止まっているタスク数を明示 | 17, 12 |
| 7 | Re-Palette Division 強化 | 専用事業部（8領域・8名の専任AI）、専用KPI、助成金パイプライン、効果測定、個人情報を保存しない設計 | 04 |
| 8 | 将来プロジェクト対応 | プロジェクトテンプレート + 親子構造。Re-Palette / ARQO / NEWTONE / University / Personal / Future Ventures をシード | 08 |
| 9 | Obsidian 強化 | Vault → Git → Private GitHub → Daily Backup（別系統・世代管理・毎週の自動復元テスト） | 10 |
| 10 | 通知システム | Notification Provider Layer。App / Web Push 必須、LINE / Discord / Slack はアダプタ追加のみ | 13 |
| 11 | 時刻変更 | Morning Briefing 07:00 / Daily Executive Report 23:00 / Weekly Board Meeting 日曜 20:00（静音時間は 00:00〜06:30 に変更） | 01, 14 |
| 12 | AI運用ルール | 提案・分析・調査・作成は自律。メール送信・SNS投稿・外部公開・デプロイ・契約・支払い・外部サービス連携・PDF提出は承認必須。構造で強制 | 02 |

## v0.1 の論点の決着

| # | 論点 | v1.0 での扱い |
|---|---|---|
| D1 | 稼働場所 | 推奨案で進める: Web（Vercel）+ Worker（Railway / Fly.io）。Phase 0 はローカル実行でも可 |
| D2 | DB | 推奨案で進める: Supabase |
| D3 | Obsidian同期 | **確定**: Git + Private GitHub + Daily Backup |
| D4 | 通知チャネル | **確定**: App + Web Push 必須、LINE / Discord / Slack は将来 |
| D5 | レポート時刻 | **確定**: 07:00 / 23:00 / 日曜 20:00 |
| D6 | 初期AI社員数 | 推奨案で進める: MVP 11名（Phase 5 で Re-Palette 専任8名ほかを追加） |
| D7 | 自律度 | **確定**: AI運用ルール（02章） |

## v1.0 で確認したいこと

| # | 確認事項 | 設計上の仮置き |
|---|---|---|
| Q1 | F.R.I.D.A.Y. の開発を **ARQO の子プロジェクト**として扱ってよいか | 子プロジェクトとして登録 |
| Q2 | Daily Backup の保存先 | Cloudflare R2（暫定は Supabase Storage の別バケット） |
| Q3 | Phase 0 の事前準備（[20章 20.2](./20-phase0-plan.md#202-事前に-ceo-に用意していただくもの)）の用意方法とタイミング | 揃うまではローカル代替で着手 |
