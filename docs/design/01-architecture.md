# 01. システム概要・全体アーキテクチャ・データフロー

## 1.1 コンセプト

| 項目 | 内容 |
|---|---|
| プロダクト名 | F.R.I.D.A.Y. — AI COMPANY OS |
| ユーザー | CEO 1名（陽大）。シングルテナント・シングルユーザー前提 |
| 体験目標 | 画面を開いた瞬間「AI会社の本社に入った」と感じる。AI社員が"今"働いている様子が見える |
| CEOの仕事 | 指示を出す / 承認・却下・差し戻しをする / レポートを読む。それ以外はAIがやる |
| 非目標 | 汎用チャットUI、マルチユーザーSaaS、人間チームのタスク管理ツール |

### 設計原則

1. **Chain of Command** — すべての依頼は COO を経由する。部署は部署の仕事だけ、COO は統合と最適化。
2. **Human-in-the-Loop for Side Effects** — 社外に影響する行為は必ず CEO 承認。AI社員に「実行権限」はなく「申請権限」だけを与える。
3. **Memory is Markdown** — 会社の記憶は人間が読める Markdown（Obsidian）で残す。DBが消えても会社の歴史は残る。
4. **Provider Agnostic** — どのAIモデルにも依存しない。モデルは設定値。
5. **Observable by Default** — AI社員の状態・思考の要約・成果物・コストは常に可視。"ブラックボックスな自動化"を作らない。
6. **Event Sourced Activity** — 会社で起きたことはすべてイベントとして記録し、ダッシュボード・ログ・Vault・通知はそのイベントから派生させる。

## 1.2 技術スタック（推奨）

| レイヤー | 採用技術 | 理由 |
|---|---|---|
| 言語 | TypeScript（全レイヤー共通） | 型をUI〜Worker〜外部APIまで共有 |
| モノレポ | pnpm workspaces + Turborepo | apps / packages 分離、型共有 |
| Web | Next.js（App Router）+ React + Tailwind CSS + shadcn/ui + Framer Motion | ダッシュボード表現力、Server Actions |
| チャート | Recharts（＋必要に応じ visx） | 進捗リング・スパークライン |
| DB | Supabase Postgres + Drizzle ORM | 型安全なスキーマ、マイグレーション |
| リアルタイム | Supabase Realtime（Postgres Changes / Broadcast） | AI社員の稼働状況をライブ表示 |
| ジョブキュー | pg-boss（Postgres上のキュー） | Redis不要。リトライ・スケジュール・優先度 |
| スケジューラ | pg-boss の cron 機能 | 朝礼・日報・定期調査 |
| ベクトル検索 | pgvector | Vault の知識・AI社員メモリの検索（RAG） |
| ストレージ | Supabase Storage（署名付きURL） | PDFレポート・成果物ファイル |
| PDF | React テンプレート → HTML → Playwright(Chromium) で PDF化 | 日本語フォント・デザイン再現性が高い |
| 認証 | Supabase Auth（パスキー or Magic Link）、CEO 1アカウントのみ許可 | |
| 外部連携 | REST API + **MCP Server**（万能AIエージェント向け）+ Webhook | |
| AI | Provider Layer（Gemini / Claude / Mock） | 06章 |
| 監視 | 構造化ログ（pino）+ Sentry（任意） | |

## 1.3 全体アーキテクチャ図

```mermaid
flowchart TB
    subgraph Actors["指示を出す主体"]
        CEO["👤 CEO<br/>Dashboard / ⌘K Command"]
        UA["🤖 万能AIエージェント<br/>(別システム)"]
        CRON["⏰ Scheduler<br/>朝礼・日報・定期調査"]
    end

    subgraph Web["apps/web — 本社 (Next.js)"]
        UI["Dashboard UI<br/>CEO ACTION REQUIRED / Live Workforce"]
        API["REST API /api/v1"]
        MCP["MCP Server<br/>(万能AI用ツール)"]
        RT["Realtime Subscriber"]
    end

    subgraph Runtime["apps/worker — Company Runtime"]
        INTAKE["Intake Gateway<br/>(全依頼の入口)"]
        COO["COO: F.R.I.D.A.Y.<br/>理解→分解→振分→統合→提案"]
        DISP["Dispatcher<br/>(pg-boss queues)"]
        subgraph Divs["Divisions"]
            AG["AI Employees<br/>(Agent Executor)"]
        end
        GATE["Approval Gate<br/>(副作用の唯一の出口)"]
        EXEC["Action Executor<br/>Deploy / SNS / Mail / 外部API"]
        REP["Report Engine<br/>(PDF生成)"]
        NOTI["Notification Hub"]
        VW["Vault Writer / Indexer"]
    end

    subgraph AI["Provider Layer"]
        ROUTER["Model Router<br/>tier→model / fallback / rate-limit / cost"]
        GEM["Gemini API<br/>(初期・無料枠)"]
        CLA["Claude API<br/>(将来)"]
    end

    subgraph Data["Memory & State"]
        PG[("Postgres<br/>状態・イベント・pgvector")]
        ST[("Storage<br/>PDF・成果物")]
        VAULT[("Obsidian Vault<br/>会社の脳 (Git)")]
    end

    subgraph Ext["外部サービス"]
        EXTS["GitHub / Vercel / Instagram / X<br/>Gmail / Calendar / Web検索"]
        PUSH["Web Push / Email / LINE"]
    end

    CEO --> UI --> API
    UA --> MCP --> API
    CRON --> INTAKE
    API --> INTAKE --> COO --> DISP --> AG
    AG -- 成果物 --> COO
    AG -- 副作用の申請 --> GATE
    COO -- 承認依頼 --> GATE
    GATE -- 承認待ち --> NOTI
    CEO -- 承認/却下 --> API --> GATE
    GATE -- 承認済みのみ --> EXEC --> EXTS
    REP --> ST
    REP --> GATE
    NOTI --> PUSH
    NOTI --> RT
    COO & AG --> ROUTER
    ROUTER --> GEM & CLA
    Runtime <--> PG
    VW <--> VAULT
    PG -- events --> VW
    PG -- changes --> RT --> UI
```

### コンポーネント責務

| コンポーネント | 責務 | 持たない責務 |
|---|---|---|
| Dashboard UI | 会社の可視化、指示入力、承認操作 | ビジネスロジック |
| REST API | 認証、入力検証、Intakeへの投入、照会 | 長時間処理（Workerへ） |
| MCP Server | 万能AI向けのツール公開（REST APIの薄いラッパー） | 独自ロジック |
| Intake Gateway | 依頼の正規化（`Directive`化）、出所(source)と権限の記録、重複排除 | タスク分解 |
| COO（F.R.I.D.A.Y.） | 指示理解・タスク分解・部署振分け・成果統合・CEO提案・全社最適化 | 実作業 |
| Dispatcher | キュー投入、依存解決、並列度/優先度制御、リトライ | 判断 |
| Agent Executor | AI社員の実行ループ（思考→ツール→成果物）、状態の発行 | 外部副作用の実行 |
| Approval Gate | 承認リクエストの作成・状態遷移・ペイロード固定・監査 | 実行そのもの |
| Action Executor | 承認済みアクションの冪等実行 | 判断 |
| Report Engine | データ収集→AI執筆→PDF→保存→URL発行 | |
| Notification Hub | 通知のルーティング・重複抑制・既読管理 | |
| Vault Writer/Indexer | DBイベント→Markdown書き出し、Vault変更→DB取込・ベクトル化 | |
| Model Router | モデル解決・フォールバック・レート制御・コスト記録 | プロンプト設計 |

## 1.4 データフロー図

### (A) CEO指示 → 成果物 → CEO提案（メインフロー）

```mermaid
sequenceDiagram
    autonumber
    actor CEO
    participant UI as Dashboard
    participant IN as Intake
    participant COO as COO (F.R.I.D.A.Y.)
    participant Q as Dispatcher
    participant AG as AI社員 (部署)
    participant DB as Postgres
    participant V as Vault
    participant G as Approval Gate

    CEO->>UI: 「今月の売上を伸ばす施策を考えて」
    UI->>IN: POST /directives
    IN->>DB: directive(status=received, source=ceo)
    IN->>COO: intake.directive
    COO->>COO: 意図理解（不明点があればCEOへ質問=clarification）
    COO->>DB: project? / tasks(DAG) / assignments
    COO->>Q: enqueue tasks (依存順)
    DB-->>UI: Realtime: タスク生成・社員ステータス変化
    Q->>AG: task.run (Strategy / Marketing / Finance 並列)
    AG->>AG: 調査・分析・執筆（Provider Layer経由）
    AG->>DB: deliverable + agent_messages + run_steps
    AG->>V: 作業ログ・成果物ノート
    AG-->>COO: task.completed
    COO->>COO: 成果統合・矛盾チェック・優先順位付け
    COO->>DB: proposal（CEO提案）
    COO->>G: approval_request(kind=proposal_review)
    G-->>UI: CEO ACTION REQUIRED に表示 + 通知
    CEO->>G: 承認 / 差し戻し(コメント) / 却下
    G->>COO: decision
    COO->>V: 01_CEO/Decisions に意思決定記録
```

### (B) 副作用アクション（例: Instagram投稿）

```mermaid
flowchart LR
    A["Marketing AI<br/>投稿案作成"] --> B["ActionRequest 作成<br/>kind=sns_post<br/>payload=本文+画像+日時<br/>payload_hash 固定"]
    B --> C{"Policy<br/>リスク判定"}
    C -->|"外部副作用 = 必ず承認"| D["CEO ACTION REQUIRED<br/>+ Push通知"]
    D -->|承認| E["Action Executor<br/>hash一致を検証して実行<br/>idempotency_key"]
    D -->|差し戻し| A
    D -->|却下| F["closed: rejected"]
    E -->|成功| G["結果を記録<br/>Activity / Vault"]
    E -->|失敗| H["failed → COOへ<br/>リトライ可否をCEOへ"]
```

### (C) 日次レポート

```mermaid
flowchart LR
    S["21:00 cron"] --> C["Collect<br/>tasks / runs / KPI / approvals"]
    C --> W["COO + EA が執筆<br/>(構造化JSON)"]
    W --> R["HTMLテンプレート描画"]
    R --> P["Playwright → PDF"]
    P --> U["Storage保存<br/>署名付きURL発行"]
    U --> V["Vaultにmd版 + PDFリンク"]
    U --> N["通知"]
    N --> A["承認: report_review"]
```

### (D) 記憶の流れ（DB ⇄ Obsidian）

```mermaid
flowchart LR
    EV["domain events<br/>(activity_events)"] --> VW["Vault Writer"]
    VW --> MD["Markdown<br/>(frontmatter id = DB id)"]
    MD --> GIT["git commit/push"]
    GIT --> OBS["CEOのObsidian"]
    OBS -- CEOが編集/追記 --> GIT
    GIT --> IDX["Vault Indexer<br/>(pull → diff)"]
    IDX --> PG[("Postgres<br/>vault_documents / knowledge_chunks")]
    PG --> RAG["AI社員のRAG検索"]
```

## 1.5 非機能要件

| 項目 | 目標 |
|---|---|
| ダッシュボード初期表示 | < 1.5s（サーバーコンポーネントで集計済みデータを返す） |
| ライブ更新遅延 | < 2s（Realtime） |
| 承認の整合性 | 承認したペイロードと実行ペイロードのハッシュ一致を保証 |
| 実行の冪等性 | 全 ActionRequest に idempotency_key、二重実行なし |
| コスト制御 | 日次/月次のトークン予算。超過時は fast tier に自動降格し CEO に通知 |
| 可用性 | Worker 停止時も Dashboard は閲覧可能。復帰時にキューから再開 |
| セキュリティ | CEO 1アカウントのみ。外部APIキーはサーバー側環境変数（DBに平文保存しない）。万能AI用APIキーはスコープ付き・ハッシュ保存 |
| バックアップ | Vault は Git 履歴、DB は日次バックアップ |
| タイムゾーン | すべて UTC 保存、表示とスケジュールは Asia/Tokyo |
