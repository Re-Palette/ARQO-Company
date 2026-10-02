# 10. API設計

## 10.1 共通仕様

| 項目 | 内容 |
|---|---|
| Base | `/api/v1` |
| 形式 | JSON。日時は ISO 8601（UTC） |
| 認証 | ① CEOセッション（Supabase Auth Cookie）② APIキー（万能AI、scope制限） |
| ID | ULID |
| ページング | cursor 方式 `?cursor=&limit=` → `{ data, next_cursor }` |
| エラー | `{ error: { code, message, details? } }`（`VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN`, `CONFLICT`, `RATE_LIMITED`, `APPROVAL_HASH_MISMATCH` …） |
| 冪等性 | 作成系は `Idempotency-Key` ヘッダー対応 |
| 非同期 | 長時間処理は `202 Accepted` + リソースID。進捗は Realtime / ポーリング / Webhook |
| 検証 | 全入力を Zod スキーマで検証（スキーマは `packages/core` で共有し、OpenAPI を自動生成） |

認証列: 🔐 = CEOセッションのみ / 🔑 = APIキーも可（scope必要）

## 10.2 エンドポイント一覧

### Dashboard
| Method | Path | 認証 | 説明 |
|---|---|---|---|
| GET | `/dashboard` | 🔐 | 1画面分の集計を一括取得（サマリー、ACTION REQUIRED上位、Workforce、PJ進捗、最新レポート、会話ログ、予定） |
| GET | `/status` | 🔑 `read:status` | 会社状況サマリー |

### Directives（指示・依頼）
| Method | Path | 認証 | 説明 |
|---|---|---|---|
| POST | `/directives` | 🔑 `write:directives` | 指示を投入（Command Center・万能AI） |
| GET | `/directives` | 🔑 `read:directives` | 一覧（status, source でフィルタ） |
| GET | `/directives/:id` | 🔑 | 詳細（計画・タスク・成果物・進捗） |
| POST | `/directives/:id/comments` | 🔑 | 補足コメント |
| POST | `/directives/:id/clarifications/:cid/answer` | 🔐 | COOの質問に回答 |
| POST | `/directives/:id/cancel` | 🔐 | 取り消し |

### Projects / Tasks
| Method | Path | 認証 | 説明 |
|---|---|---|---|
| GET/POST | `/projects` | 🔐 | 一覧 / 作成 |
| GET/PATCH | `/projects/:id` | 🔐 | 詳細 / 更新 |
| GET | `/tasks` | 🔑 `read:directives` | フィルタ: status, division, assignee, project, date |
| GET | `/tasks/:id` | 🔑 | 詳細（runs, steps, deliverables） |
| PATCH | `/tasks/:id` | 🔐 | 優先度・担当変更 |
| POST | `/tasks/:id/retry` / `/cancel` | 🔐 | 再実行 / 中止 |

### AI Employees / Divisions
| Method | Path | 認証 | 説明 |
|---|---|---|---|
| GET | `/divisions` | 🔐 | 部署一覧（メンバー・稼働状況） |
| GET | `/agents` | 🔐 | AI社員一覧（presence込み） |
| GET/PATCH | `/agents/:id` | 🔐 | 詳細 / 設定変更（persona, tier, tools, budget, enabled） |
| GET | `/agents/:id/activity` | 🔐 | 作業履歴・runs |
| GET | `/agents/:id/memory` | 🔐 | メモリ一覧 |
| GET | `/messages` | 🔐 | AI社員の会話ログ（thread単位） |

### Approvals（CEO ACTION REQUIRED）
| Method | Path | 認証 | 説明 |
|---|---|---|---|
| GET | `/approvals` | 🔑 `read:approvals` | 一覧（status=pending をスコア順） |
| GET | `/approvals/:id` | 🔑 | 詳細（payload, preview, 履歴） |
| POST | `/approvals/:id/approve` | 🔐 **のみ** | body: `{ payload_hash, comment? }`（表示中の内容と一致確認） |
| POST | `/approvals/:id/reject` | 🔐 | body: `{ comment }` |
| POST | `/approvals/:id/request-revision` | 🔐 | body: `{ comment }`（必須） |
| POST | `/approvals/bulk-approve` | 🔐 | `low` のみ |
| POST | `/approvals/:id/retry-execution` | 🔐 | 実行失敗の再試行 |

### Reports
| Method | Path | 認証 | 説明 |
|---|---|---|---|
| GET | `/reports` | 🔑 `read:reports` | 一覧（type, 期間） |
| GET | `/reports/:id` | 🔑 | 詳細（content, 状態） |
| GET | `/reports/:id/pdf-url` | 🔑 | 署名付きURLを発行 |
| POST | `/reports/generate` | 🔐 | 手動生成 `{ type, period }` |

### Deliverables / Knowledge
| Method | Path | 認証 | 説明 |
|---|---|---|---|
| GET | `/deliverables/:id` | 🔑 `read:deliverables` | 成果物 |
| GET | `/knowledge/search?q=` | 🔑 `read:knowledge` | Vault 横断検索（ベクトル + キーワード） |
| GET | `/search?q=` | 🔐 | ⌘K 全体検索（社員・PJ・タスク・レポート） |

### Notifications
| Method | Path | 認証 | 説明 |
|---|---|---|---|
| GET | `/notifications` | 🔐 | 一覧 |
| POST | `/notifications/:id/read` / `/read-all` | 🔐 | 既読 |
| POST | `/push-subscriptions` | 🔐 | Web Push 登録 |
| GET/PUT | `/notification-rules` | 🔐 | 通知設定 |

### KPI / Schedule / Meetings
| Method | Path | 認証 | 説明 |
|---|---|---|---|
| GET/POST | `/kpis` , `/kpis/:id/values` | 🔐 | KPI定義・値 |
| GET | `/schedule?date=` | 🔐 | 予定 |
| GET | `/meetings` , `/meetings/:id` | 🔐 | 会議記録 |

### Settings
| Method | Path | 認証 | 説明 |
|---|---|---|---|
| GET/PUT | `/settings/company` | 🔐 | 自律度、レポート時刻、予算、一時停止 |
| POST | `/settings/company/pause` / `/resume` | 🔐 | Kill Switch |
| GET/PUT | `/settings/providers` | 🔐 | Provider設定 |
| GET/PUT | `/settings/model-routes` | 🔐 | ルーティング表 |
| POST | `/settings/providers/preset` | 🔐 | `{ preset: "gemini_free" \| "claude" \| "hybrid" }` |
| POST | `/settings/providers/:id/test` | 🔐 | 接続テスト |
| GET | `/settings/usage` | 🔐 | LLM使用量・コスト |
| GET/POST/DELETE | `/settings/api-clients` | 🔐 | 万能AI用APIキー発行・失効 |
| GET/POST/DELETE | `/settings/webhooks` | 🔐 | Webhook管理 |
| GET | `/settings/vault/status` , POST `/settings/vault/sync` | 🔐 | Vault同期状態・手動同期 |

## 10.3 Realtime チャネル

| チャネル | イベント | UI |
|---|---|---|
| `presence` | `agent.state_changed` | LIVE AI WORKFORCE |
| `approvals` | `approval.created/updated` | CEO ACTION REQUIRED（＋音・バッジ） |
| `activity` | `task.*`, `deliverable.*`, `report.*` | KPIカウンタ・Today's Performance |
| `messages` | `agent_message.created` | AI社員の会話ログ |
| `notifications` | `notification.created` | ベル |

## 10.4 Webhook イベント（万能AI向け）

`directive.accepted`, `directive.clarification_needed`, `directive.completed`, `directive.failed`, `report.ready`, `deliverable.created`

```json
{
  "id": "evt_01JA...",
  "type": "directive.completed",
  "created_at": "2026-10-02T12:00:00Z",
  "data": { "directive_id": "01JA...", "summary": "...", "deliverable_ids": ["01JA..."] }
}
```
ヘッダー: `X-Friday-Signature: t=<unix>,v1=<hmac>`

## 10.5 POST /directives の例

Request
```json
{
  "text": "今月の売上を伸ばすための施策を考えて",
  "priority": "p1",
  "deadline": "2026-10-05T09:00:00+09:00",
  "hints": { "divisions": ["strategy", "marketing", "finance"] },
  "callback": true
}
```

Response `202`
```json
{ "directive_id": "01JA7K...", "status": "received", "links": { "self": "/api/v1/directives/01JA7K..." } }
```
