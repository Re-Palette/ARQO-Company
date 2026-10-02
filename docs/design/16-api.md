# 16. API設計（v1.0）

## 16.1 共通仕様

| 項目 | 内容 |
|---|---|
| Base | `/api/v1` |
| 形式 | JSON、日時は ISO 8601（UTC） |
| 認証 | 🔐 CEOセッション（Supabase Auth Cookie）/ 🔑 APIキー（Universal AI、scope 制限） |
| ID | ULID |
| ページング | cursor 方式 `?cursor=&limit=` → `{ data, next_cursor }` |
| エラー | `{ error: { code, message, details? } }` — `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN`, `CONFLICT`, `RATE_LIMITED`, `APPROVAL_HASH_MISMATCH`, `POLICY_VIOLATION`, `SERVICE_UNAVAILABLE` |
| 冪等性 | 作成系は `Idempotency-Key` 必須（🔑）/ 推奨（🔐） |
| 非同期 | `202 Accepted` + リソースID。進捗は Realtime / ポーリング / Webhook / Event Feed |
| スキーマ | Zod（`packages/core`）から OpenAPI 3.1 を自動生成 → Universal AI との契約 |

> 🆕 = v1.0 で追加、✏️ = 変更

## 16.2 エンドポイント

### System
| Method | Path | 認証 | 説明 |
|---|---|---|---|
| GET | `/health` 🆕 | なし | 軽量ヘルスチェック（`{ web: ok, worker: ok/degraded, queue_lag_s }`） |
| GET | `/status` | 🔑 `read:status` | 会社状況サマリー |

### Dashboard
| Method | Path | 認証 | 説明 |
|---|---|---|---|
| GET | `/dashboard` ✏️ | 🔐 | Home 1画面分を一括取得: action_queue, summary, timeline(最新30), workforce, performance_7d, projects, repalette_headline, schedule, latest_reports |

### CEO Action Required / Approvals
| Method | Path | 認証 | 説明 |
|---|---|---|---|
| GET | `/action-queue` 🆕 | 🔐 | 判断待ち（approval + clarification + board議題）をスコア順に統合 |
| GET | `/approvals` | 🔑 `read:approvals` | 一覧 |
| GET | `/approvals/:id` | 🔑 | 詳細（payload, preview, 履歴, blocking） |
| POST | `/approvals/:id/approve` | 🔐 **のみ** | `{ payload_hash, comment? }` |
| POST | `/approvals/:id/reject` | 🔐 | `{ comment }` |
| POST | `/approvals/:id/request-revision` | 🔐 | `{ comment }` 必須 |
| POST | `/approvals/bulk-approve` | 🔐 | review かつ low のみ |
| POST | `/approvals/:id/retry-execution` | 🔐 | 実行失敗の再試行 |

### Company Timeline 🆕
| Method | Path | 認証 | 説明 |
|---|---|---|---|
| GET | `/timeline` | 🔐 | `?date=&actor=&division=&project=&kind=&min_importance=` |
| GET | `/timeline/:event_id` | 🔐 | イベント詳細（関連タスク・成果物・判断へのリンク） |
| GET | `/events` | 🔑 `read:events` | Universal AI 用イベントフィード `?after=<cursor>&types=` |

### Directives
| Method | Path | 認証 | 説明 |
|---|---|---|---|
| POST | `/directives` ✏️ | 🔑 `write:directives` | `{ text, type?(task/research/analysis), project?, priority?, deadline?, hints?, callback? }` |
| GET | `/directives`, `/directives/:id` | 🔑 `read:directives` | 一覧・詳細 |
| POST | `/directives/:id/comments` | 🔑 | 補足 |
| POST | `/directives/:id/clarifications/:cid/answer` | 🔐 | COO の質問に回答 |
| POST | `/directives/:id/cancel` | 🔐 | 取り消し |

### Projects ✏️（データ駆動）
| Method | Path | 認証 | 説明 |
|---|---|---|---|
| GET | `/project-templates` 🆕 | 🔐 | テンプレート一覧（custom_fields_schema 含む） |
| POST | `/project-templates` 🆕 | 🔐 | テンプレート追加 |
| GET | `/projects` | 🔐 | `?category=&status=&parent=&pinned=` |
| POST | `/projects` | 🔐 | `{ name, slug, template_key, parent?, owner_division, custom_fields }` → 202（Setup ジョブ） |
| GET/PATCH | `/projects/:id` | 🔐 | 詳細 / 更新（pinned, sort_order, phase…） |
| GET | `/projects/:id/kpis` 🆕 | 🔐 | プロジェクトKPI |
| GET/POST | `/projects/:id/milestones` 🆕 | 🔐 | マイルストーン |

### Tasks
| Method | Path | 認証 | 説明 |
|---|---|---|---|
| GET | `/tasks`, `/tasks/:id` | 🔑 `read:directives` | 一覧・詳細 |
| PATCH | `/tasks/:id` | 🔐 | 優先度・担当 |
| POST | `/tasks/:id/retry`, `/cancel` | 🔐 | |

### Divisions / AI Employees
| Method | Path | 認証 | 説明 |
|---|---|---|---|
| GET/POST | `/divisions` | 🔐 | 一覧 / 追加 |
| GET | `/divisions/:id` | 🔐 | メンバー・KPI・タスク |
| GET/POST | `/agents` | 🔐 | 一覧（presence込み）/ 採用 |
| GET/PATCH | `/agents/:id` | 🔐 | 詳細 / 設定 |
| GET | `/agents/:id/activity` | 🔐 | 作業履歴 |
| GET | `/messages` | 🔐 | 社員間の会話 |

### Agent Memory 🆕
| Method | Path | 認証 | 説明 |
|---|---|---|---|
| GET | `/agents/:id/memory/context` | 🔐 | Working Context Card |
| GET | `/agents/:id/memory/items` | 🔐 | `?kind=&status=` |
| PATCH | `/agents/:id/memory/items/:item_id` | 🔐 | CEO による修正（重要度・内容） |
| DELETE | `/agents/:id/memory/items/:item_id` | 🔐 | 忘れさせる |
| GET | `/agents/:id/memory/promotions` | 🔐 | Obsidian への昇格履歴 |
| POST | `/memory/consolidate` | 🔐 | 手動 Consolidation |

### Evaluation 🆕
| Method | Path | 認証 | 説明 |
|---|---|---|---|
| GET | `/metrics/definitions` | 🔐 | 指標定義 |
| POST/PATCH | `/metrics/definitions` | 🔐 | 指標追加・編集 |
| GET | `/agents/:id/metrics` | 🔐 | `?period=day|week|month&from=&to=` |
| GET | `/metrics/performance` | 🔐 | 社員横断（`?division=&period=7d`） |
| POST | `/outcomes` | 🔐 | 成果の手動記録（例: 投稿の反応、商談化） |

### Reports ✏️
| Method | Path | 認証 | 説明 |
|---|---|---|---|
| GET | `/reports` | 🔑 `read:reports` | 🔐: 全状態 / 🔑: approved・archived のみ |
| GET | `/reports/:id` | 🔑 | 詳細 |
| GET | `/reports/:id/pdf-url` | 🔑 | 署名付きURL |
| POST | `/reports/generate` | 🔐 | 手動生成 |
| GET | `/reports/approved` 🆕 | 🔑 | Approved Reports（`?year=&month=&type=`） |
| GET | `/reports/:id/archive` 🆕 | 🔐 | アーカイブ経路（Storage / Vault / commit / backup） |
| POST | `/reports/:id/archive/retry` 🆕 | 🔐 | アーカイブ再実行 |

### Meetings / Board 🆕
| Method | Path | 認証 | 説明 |
|---|---|---|---|
| GET | `/meetings`, `/meetings/:id` | 🔐 | 会議一覧・議事録 |
| GET | `/board/current` | 🔐 | 今週の Board（Pack・議題） |
| POST | `/board/:meeting_id/agenda/:item_id/decide` | 🔐 | `{ decision: approved|revised|deferred|rejected, comment }` |
| POST | `/board/:meeting_id/close` | 🔐 | 閉会 → 議事録・Weekly Board Report 生成 |

### Re-Palette 🆕
| Method | Path | 認証 | 説明 |
|---|---|---|---|
| GET | `/repalette/overview` | 🔐 | トップKPI・領域別サマリー |
| GET/POST | `/repalette/programs` | 🔐 | プログラム |
| GET/POST | `/repalette/programs/:id/sessions` | 🔐 | 実施記録（集計値のみ。個人情報フィールドは存在しない） |
| GET/POST | `/repalette/impact/frameworks`, `/impact/measurements` | 🔐 | 効果測定 |
| GET/POST/PATCH | `/repalette/grants` | 🔐 | 助成金パイプライン |
| GET/POST/PATCH | `/organizations` | 🔐 | 連携団体（Sales と共有） |

### KPI / Schedule
| Method | Path | 認証 | 説明 |
|---|---|---|---|
| GET/POST | `/kpis`, `/kpis/:id/values` | 🔐 | `?project=&division=&domain=` |
| GET | `/schedule?date=` | 🔐 | 予定 |

### Knowledge / Search
| Method | Path | 認証 | 説明 |
|---|---|---|---|
| GET | `/knowledge/search?q=` | 🔑 `read:knowledge` | Vault 検索（🔑 では restricted 除外） |
| GET | `/search?q=` | 🔐 | ⌘K 全体検索 |

### Notifications ✏️
| Method | Path | 認証 | 説明 |
|---|---|---|---|
| GET | `/notifications` | 🔐 | 一覧 |
| POST | `/notifications/:id/read`, `/read-all` | 🔐 | 既読 |
| POST | `/push-subscriptions` | 🔐 | Web Push 登録 |
| GET/POST/PATCH | `/notification-channels` 🆕 | 🔐 | チャネル管理（LINE/Discord/Slack を将来追加） |
| POST | `/notification-channels/:id/test` 🆕 | 🔐 | テスト送信 |
| GET/PUT | `/notification-rules` | 🔐 | ルール |

### Settings ✏️
| Method | Path | 認証 | 説明 |
|---|---|---|---|
| GET/PUT | `/settings/company` | 🔐 | スケジュール（07:00 / 23:00 / 日曜20:00）、静音時間、予算 |
| POST | `/settings/company/pause`, `/resume` | 🔐 | Kill Switch |
| GET | `/settings/operating-rules` 🆕 | 🔐 | AI運用ルール（固定ポリシー + 追加分） |
| PUT | `/settings/operating-rules/additions` 🆕 | 🔐 | 承認必須の**追加のみ**（緩和は `POLICY_VIOLATION`） |
| GET/PUT | `/settings/providers`, `/settings/model-routes` | 🔐 | AI Provider |
| POST | `/settings/providers/preset` | 🔐 | `gemini_free` / `claude` / `hybrid` |
| POST | `/settings/providers/:id/test` | 🔐 | 接続テスト |
| GET | `/settings/usage` | 🔐 | LLM使用量 |
| GET/POST/DELETE | `/settings/api-clients` | 🔐 | Universal AI 用キー |
| GET/POST/DELETE | `/settings/webhooks` | 🔐 | Webhook（Outbox 滞留数・最終成功時刻を含む） |
| GET | `/settings/vault/status` | 🔐 | Vault 同期状態（最終commit・push・LFS容量） |
| POST | `/settings/vault/sync` | 🔐 | 手動同期 |
| GET | `/settings/backups` 🆕 | 🔐 | `backup_runs` 一覧・最新の復元テスト結果 |
| POST | `/settings/backups/run` 🆕 | 🔐 | 手動バックアップ |

## 16.3 Realtime チャネル

| チャネル | イベント | UI |
|---|---|---|
| `action-queue` | 判断待ちの追加・更新・解消 | CEO ACTION REQUIRED（最上部） |
| `timeline` 🆕 | timeline 可視イベント | Company Timeline |
| `presence` | `agent.state_changed` | Live Workforce |
| `metrics` 🆕 | 当日カウンタ更新 | パフォーマンス / Workforce |
| `notifications` | 新着 | ベル |

## 16.4 Webhook イベント（Universal AI 向け）

`directive.accepted`, `directive.clarification_needed`, `directive.completed`, `directive.failed`, `report.approved` ✏️（未承認レポートは送らない）, `deliverable.created`

```json
{
  "id": "evt_01JA...",
  "type": "directive.completed",
  "contract_version": "v1",
  "created_at": "2026-10-02T12:00:00Z",
  "data": { "directive_id": "01JA...", "summary": "...", "deliverable_ids": ["01JA..."] }
}
```

## 16.5 レスポンス例: GET /action-queue

```json
{
  "data": [
    {
      "id": "01JA...",
      "type": "approval",
      "kind": "sns_post",
      "category": "action",
      "title": "Instagram投稿の承認",
      "summary": "10月キャンペーン告知（画像1枚・ハッシュタグ8個）",
      "requested_by": { "agent_id": "cmo", "name": "CMO" },
      "project": { "slug": "repalette", "name": "Re-Palette" },
      "risk_level": "high",
      "due_at": "2026-10-03T01:00:00Z",
      "blocking": { "tasks": 2 },
      "payload_hash": "9b1c...",
      "score": 83
    }
  ],
  "counts": { "total": 4, "critical": 0, "high": 1 }
}
```
