# 11. AI Provider Layer 設計

## 11.1 目的

- **モデル固定禁止**。アプリのどこにもモデル名をハードコードしない。
- 初期は **Gemini API（無料枠）**、将来 **Claude API** に設定画面から切替。
- 社員単位・用途単位で混在可能（例: COO だけ Claude）。

## 11.2 レイヤー構成

```mermaid
flowchart TB
    A["呼び出し側<br/>COO / AI社員 / Memory抽出 / Report / Indexer"] --> B["AIClient<br/>ai.generate({ tier, purpose, agentId, sensitivity })"]
    B --> C["Model Router<br/>tier → route / override / sensitivity / 予算"]
    C --> D1["Rate Limiter<br/>(RPM / RPD / TPM)"]
    D1 --> D2["Retry + Fallback"]
    D2 --> D3["Usage Recorder<br/>(llm_usage)"]
    D3 --> E{"Provider Adapter"}
    E --> G["GeminiProvider"]
    E --> H["ClaudeProvider"]
    E --> I["MockProvider<br/>(開発・デモ)"]
    E --> J["OpenAICompatibleProvider<br/>(拡張枠)"]
```

## 11.3 共通インターフェース

| メソッド | 説明 |
|---|---|
| `generateText` / `streamText` | テキスト生成 / ストリーミング |
| `generateObject(schema)` | 構造化出力（COO計画、Memory抽出、レポート本文、承認要約で必須） |
| `generateWithTools(tools)` | ツール呼び出しループ |
| `embed(texts)` | 埋め込み（Agent Memory・Vault RAG） |
| `capabilities()` | tools / json_schema / vision / context_window / grounding |

リクエスト: `messages, system, tier, purpose, agentId, runId, sensitivity, maxOutputTokens, temperature, timeoutMs`
レスポンス: `text | object | toolCalls, usage, model, provider, finishReason, latencyMs`

## 11.4 ルーティング表とコスト方針（設定画面で編集）

**方針: 基本は Flash-Lite、必要なときだけ Flash。** 低コスト・無料枠の最大活用を優先する（2026-10 CEO 決定）。

| route（tier） | Gemini 初期値 | fallback | 用途 |
|---|---|---|---|
| `fast` | `gemini-3.5-flash-lite` | なし | 会話・Agent 間通信・Activity / Notification 生成・要約・分類・定型 Report・Dashboard の軽量判断 |
| `standard` | `gemini-3.5-flash-lite` | なし | 同上（将来の差別化用に tier だけ分けておく） |
| `deep` | `gemini-3.5-flash-lite` | なし | 同上。deep tier であること自体では上位モデルにしない |
| `escalation` | `gemini-3.8-flash` | `fast`（Flash-Lite） | 下記の**理由がある場合のみ** |
| `embedding` | （Phase 2） | — | |

**上位モデルへの切替（escalation）**: Router は次の理由のときだけ `escalation` ルートを使う。理由と閾値はそのルートの `params.escalation`（DB）で有効/無効を切り替える。ルートを `active=false` にすれば上位モデルは一切使われない。

| 理由 | 発生条件 |
|---|---|
| `long_document` | 入力が `long_input_chars`（初期 40,000 文字）を超えたとき（自動判定） |
| `complex_reasoning` / `cross_source_analysis` | 呼び出し側が明示 |
| `ceo_deep_request` | CEO が Deep 処理を明示的に要求したとき |
| `low_confidence` | 構造化出力が Flash-Lite でスキーマ不一致、または呼び出し側の判定（`escalateIf`）で不十分なとき、1 回だけ再実行 |

- Flash-Lite の各ルートには fallback を設定しない（無料枠の 429 で黙って上位モデルへ流れない）。上位モデルが失敗した場合は Flash-Lite に戻る。
- 上位モデルを使った呼び出しは `llm_usage.purpose` に `#escalated:<理由>` を付けて記録し、コストを追跡できるようにする。
- 具体モデル ID は `model_routes.model_id`、プロバイダは `provider_configs`（Provider と Model は分離）。コードにモデル ID は書かない。
- シードは既存の設定値を上書きしない（`onConflictDoNothing`）。既存 DB の変更は設定値の更新で行う。
- 解決順: `agents.model_override` → `model_routes(tier)`（理由があれば `escalation`）→ fallback。
- **Provider Preset**: `Gemini Free` / `Claude` / `Hybrid（COOのみClaude）` をワンクリックで切替（Phase 7）。

## 11.5 データ機密区分によるルーティング

| sensitivity | 送信先の制約 |
|---|---|
| `normal` | 制約なし |
| `confidential` | 入力データが学習に使われない契約のプロバイダ/プランのみ（無料枠は不可） |
| `restricted` | `confidential` と同じ + Re-Palette の `data_access` を持つ社員の run のみ。そもそも個人情報は保存しない（[04章](./04-repalette-division.md)） |

条件を満たすルートがない場合は実行せず、`blocked` として CEO に通知（無料枠に勝手に流さない）。

## 11.6 Gemini 無料枠への対応

| 対策 | 内容 |
|---|---|
| トークンバケット | provider×model 単位の RPM/RPD/TPM を Postgres で共有管理（値は `provider_configs.rate_limits` で設定） |
| 優先度 | CEO直接指示・判断関連 > 定時レポート > Memory処理 > バックグラウンド調査 |
| 降格 | deep → standard → fast |
| 枠の予約 | 22:30〜23:00 の Daily Report、06:30 の Morning Briefing、日曜の Board 用に RPD を予約 |
| キャッシュ | 同一入力の要約・埋め込みは content hash でキャッシュ |
| 可視化 | ヘッダーに「本日の残り枠」 |

## 11.7 プロンプト管理

- `packages/agents/prompts/` にテンプレート管理（Provider非依存）。
- 構成: `AI運用ルール（常時）` + `会社共通` + `CEO Preferences` + `部署Playbook` + `社員Persona` + `Working Context Card` + `Agent Memory 想起` + `RAG` + `タスク`。
- バージョンを `agent_runs.prompt_version` に記録し、評価指標（採用率など）と比較できるようにする。

## 11.8 コスト記録

`llm_usage` に全呼び出しを記録。設定画面・Analytics で本日/今月、社員別・部署別・用途別に表示。評価システムの「成果物1件あたりコスト」にも使用。
