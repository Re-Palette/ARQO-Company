# 07. AI社員評価システム

## 7.1 目的

AI社員ごとの**稼働状況と成果を可視化**する。「誰が、どれだけ、どれくらい役に立つ仕事をしたか」を CEO が一目で把握でき、COO が配置やプロンプト改善に活かす。

評価は**懲罰ではなく改善のため**の指標。自動で社員を停止・降格することはしない（提案は COO が Board に出す）。

## 7.2 指標の仕組み（データ駆動）

指標は `metric_definitions` テーブルのデータ。**新しい指標や社員を追加してもコード修正は不要**。

| 計算タイプ | 意味 | 例 |
|---|---|---|
| `count` | 期間内のイベント件数 | 調査件数 = `deliverable.created` where kind=`research_report` |
| `ratio` | 分子イベント / 分母イベント | 採用率 = `deliverable.adopted` / `deliverable.decided` |
| `sum` | イベント値の合計 | 成果数 = `outcome.recorded` の value 合計 |
| `avg_duration` | 2イベント間の平均時間 | リードタイム = `task.started` → `task.completed` |

すべて `activity_events` から算出する（イベントソース）。

### 共通イベントの定義

| イベント | 発生タイミング |
|---|---|
| `task.assigned` / `task.completed` / `task.failed` | タスク状態変化 |
| `deliverable.created` | 成果物作成 |
| `deliverable.decided` | CEO（または統合時に COO）が採否を決めた |
| `deliverable.adopted` | **採用**: CEOが承認した、または承認されたCOO提案に組み込まれた |
| `deliverable.revised` | **修正**: 差し戻しで新バージョンが作られた |
| `knowledge.referenced` | **参照**: 他の社員の RAG / Agent Memory 想起、または成果物の引用でヒットした（作成者にカウント） |
| `outcome.recorded` | **成果**: 外部の結果が記録された（SNSのエンゲージメント取込、商談化、採択など） |
| `pr.merged` / `bug.fixed` | 開発系 |

## 7.3 指標セット

### 共通指標（全AI社員）

| 指標 | 定義 |
|---|---|
| 完了タスク数 | `task.completed` 件数 |
| 完了率 | completed / (completed + failed + cancelled) |
| 採用率 | adopted / decided |
| 修正率 | revised / created |
| 平均リードタイム | 着手〜完了 |
| 稼働率 | 非idle時間 / 有効時間 |
| コスト | LLMコスト合計、成果物1件あたりコスト |

### 職種別指標（CEO指定 + 補完）

| 部署 | 指標 | 定義 |
|---|---|---|
| **Research** | **調査件数** | 調査レポート・調査成果物の作成数 |
| | **採用率** | 調査成果物のうち採用されたもの |
| | **参照回数** | その社員の調査結果・知識が他の社員に参照された回数 |
| **Marketing** | **投稿作成数** | 投稿案の作成数 |
| | **採用率** | 投稿案のうち承認されたもの（`sns_post` 承認 / 申請） |
| | **成果数** | 投稿後のエンゲージメント（いいね・保存・コメント）合計、または問い合わせ数（取込可能になったら） |
| **Development** | **実装数** | マージされたPR数 / 完了した実装タスク数 |
| | **修正数** | 差し戻し・バグ修正の件数 |
| | **完了率** | 実装タスクの完了率 |
| Strategy | 提案数 / 採用率 | 戦略提案の採用 |
| Sales | 企業リスト件数 / 提案書採用率 / 商談化数 | |
| Finance | レポート数 / 予測誤差 | 予実の乖離 |
| Creative | デザイン数 / 採用率 / 修正回数 | |
| Operations | 検知件数 / 自動化数 | |
| Executive Assistant | 期限内配信率 / 判断待ち平均滞留時間 | |
| COO | 提案採用率 / Directive完了率 / Directiveリードタイム | |
| Re-Palette | 事業部KPI達成率 + 各担当の職種指標（申請数・採択率・投稿採用率など） | |

### ハイライト指標

社員ごとに **3つのハイライト指標**（`agents.metric_set`）を決め、ダッシュボードのカードに表示。例: Research AI = 調査件数・採用率・参照回数。

## 7.4 集計

- **リアルタイム**: 当日分はイベント発生ごとに軽量カウンタを更新（Workforce カードに即反映）。
- **日次スナップショット**: 毎日 22:15 に `agent_metric_snapshots`（社員×指標×日）を確定 → Daily Executive Report に掲載。
- **期間比較**: 7日 / 30日 / 前期比。トレンド矢印を表示。

## 7.5 表示

| 場所 | 内容 |
|---|---|
| Home: Live Workforce カード | presence + 今日のハイライト指標1つ（例:「調査 5件」） |
| Home: AI社員パフォーマンス パネル | 部署フィルタ付きの一覧。社員ごとにハイライト3指標 + 7日スパークライン |
| AI社員詳細 | 全指標の推移、採用/却下された成果物、コスト、Agent Memory |
| Analytics | 部署比較、コスト対成果、採用率の推移 |
| Daily Executive Report | 「AI社員活動」セクション |
| Weekly Board Meeting | COO の配置最適化提案の根拠 |

表示例（Home パネル）:

```
AI社員パフォーマンス（7日）           [全部署 ▾]
Research AI    調査 23件   採用率 78% ▲   参照 41回
CMO            投稿 14件   採用率 64% ▼   成果 1,230
CTO            実装 9件    修正 3件       完了率 92%
```
