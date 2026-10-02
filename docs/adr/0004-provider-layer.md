# ADR 0004: AI Provider Layer（モデル非固定）

- 状態: 採用（Phase 0）
- 決定: 呼び出し側は tier（fast / standard / deep / mock）だけを指定し、`model_routes` テーブルで具体モデルへ解決する。アダプタは registry に登録（Gemini / Claude / OpenAI / OpenRouter / Mock）。
- 実装: Gemini・OpenAI・OpenRouter は REST（fetch）、Claude は公式 `@anthropic-ai/sdk`。構造化出力は各プロバイダの JSON Schema 機能を使い、結果は Zod で再検証。
- ルール: 再試行可能なエラー（429/5xx/ネットワーク）のみフォールバック。`confidential` / `restricted` データは学習利用の可能性があるプロバイダ（無料枠など）へ送らない。本番ルートが Mock へ黙ってフォールバックすることはない。
