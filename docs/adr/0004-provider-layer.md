# ADR 0004: AI Provider Layer（モデル非固定）

- 状態: 採用（Phase 0）
- 決定: 呼び出し側は tier（fast / standard / deep / mock）だけを指定し、`model_routes` テーブルで具体モデルへ解決する。アダプタは registry に登録（Gemini / Claude / OpenAI / OpenRouter / Mock）。
- 実装: Gemini・OpenAI・OpenRouter は REST（fetch）、Claude は公式 `@anthropic-ai/sdk`。構造化出力は各プロバイダの JSON Schema 機能を使い、結果は Zod で再検証。
- ルール: 再試行可能なエラー（429/5xx/ネットワーク）のみフォールバック。`confidential` / `restricted` データは学習利用の可能性があるプロバイダ（無料枠など）へ送らない。本番ルートが Mock へ黙ってフォールバックすることはない。
- コスト方針（2026-10 追記）: 全 tier の既定は Flash-Lite（`gemini-3.5-flash-lite`）。上位モデル（`gemini-3.8-flash`）は `escalation` ルートに置き、Router が有効な理由（長文・複雑な推論・複数情報源の横断・CEO の Deep 要求・低信頼）を持つときだけ使う。理由と閾値は DB の `model_routes.params.escalation` で管理し、コードには書かない。
