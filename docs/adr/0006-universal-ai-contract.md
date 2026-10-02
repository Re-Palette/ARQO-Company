# ADR 0006: Universal AI は契約のみで接続（疎結合）

- 状態: 採用（Phase 0）
- 決定: Universal AI と共有するのは `@friday/contracts`（v1 スキーマ・Webhook 署名・耐障害クライアント）だけ。F.R.I.D.A.Y. 側は APIキー（ハッシュ保存・scope）、冪等キー、Webhook Outbox（業務と同一トランザクションで記録、指数バックオフで最大72時間再送）、取りこぼし回収用の Event Feed を提供する。
- 結果: Universal AI 停止中も F.R.I.D.A.Y. は通常稼働し、Outbox に滞留するだけ。F.R.I.D.A.Y. 停止中は Universal AI 側クライアントがローカルキューに保持し、同じ冪等キーで再送する。承認系の scope は存在しない。
