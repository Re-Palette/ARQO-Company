/**
 * System seed: what every F.R.I.D.A.Y. installation needs, independent of any
 * particular company. Company-specific data lives in seed/companies/*.
 */
import { DEFAULT_SCHEDULE } from "@friday/core";

export const projectTemplates = [
  { key: "company", name: "会社", defaultDivisions: ["coo"], phases: ["運営中"],
    vaultScaffold: { folders: ["Tasks", "Deliverables", "Decisions"] } },
  { key: "software_product", name: "ソフトウェア製品", defaultDivisions: ["development", "creative"],
    phases: ["構想", "企画", "開発", "運用"],
    customFieldsSchema: { type: "object", properties: { repository: { type: "string" }, stage: { type: "string" } } },
    vaultScaffold: { folders: ["Tasks", "Deliverables", "Decisions", "Releases"] } },
  { key: "social_program", name: "社会事業プログラム", defaultDivisions: ["repalette", "research", "marketing"],
    phases: ["準備中", "実施中", "振り返り"],
    customFieldsSchema: { type: "object", properties: { domains: { type: "array", items: { type: "string" } } } },
    vaultScaffold: { folders: ["Tasks", "Deliverables", "Decisions", "Programs", "Grants", "Impact"] } },
  { key: "venture", name: "新規事業", defaultDivisions: ["strategy", "research"],
    phases: ["アイデア", "検証", "PoC", "事業化"],
    customFieldsSchema: { type: "object", properties: { hypothesis: { type: "string" }, marketSize: { type: "string" } } },
    vaultScaffold: { folders: ["Tasks", "Deliverables", "Decisions", "Research"] } },
  { key: "study", name: "学習・大学", defaultDivisions: ["executive"], phases: ["準備", "進行中", "完了"],
    customFieldsSchema: { type: "object", properties: { subject: { type: "string" }, examDate: { type: "string" } } },
    vaultScaffold: { folders: ["Tasks", "Notes"] } },
  { key: "personal", name: "個人", defaultDivisions: ["executive"], phases: ["進行中"],
    vaultScaffold: { folders: ["Tasks", "Notes"] } },
  { key: "portfolio", name: "ポートフォリオ（新規事業の受け皿）", defaultDivisions: ["strategy"], phases: ["探索中"],
    vaultScaffold: { folders: ["Ideas", "Decisions"] } },
];

export const timelineTemplates = [
  { eventType: "project.created", icon: "📁", templateJa: "新規プロジェクト発足: {data.name}", minImportance: 4 },
  { eventType: "agent.registered", icon: "🧑‍💼", templateJa: "AI社員を採用: {data.displayName}（{data.title}）", minImportance: 4 },
  { eventType: "agent.state_changed", icon: "●", templateJa: "{actor} が {data.label}", minImportance: 2 },
  { eventType: "directive.received", icon: "📨", templateJa: "{actor} から指示を受付: {data.summary}", minImportance: 4 },
  { eventType: "task.created", icon: "🧩", templateJa: "{actor} がタスクを作成: {data.title}", minImportance: 3 },
  { eventType: "task.started", icon: "▶", templateJa: "{actor} が着手: {data.title}", minImportance: 2 },
  { eventType: "task.completed", icon: "✅", templateJa: "{actor} が完了: {data.title}", minImportance: 3 },
  { eventType: "deliverable.created", icon: "📄", templateJa: "{actor} {data.title} 完成", minImportance: 4 },
  { eventType: "research.finding", icon: "🔎", templateJa: "{actor} {data.title}", minImportance: 4 },
  { eventType: "approval.requested", icon: "⚖", templateJa: "{actor} が承認を申請: {data.title}", minImportance: 4 },
  { eventType: "approval.approved", icon: "✔", templateJa: "CEO 承認: {data.title}", minImportance: 5 },
  { eventType: "approval.rejected", icon: "✖", templateJa: "CEO 却下: {data.title}", minImportance: 5 },
  { eventType: "approval.revision_requested", icon: "↩", templateJa: "CEO 差し戻し: {data.title}", minImportance: 5 },
  { eventType: "report.generation_started", icon: "📝", templateJa: "{actor} レポート作成開始: {data.title}", minImportance: 3 },
  { eventType: "report.ready", icon: "📊", templateJa: "{actor} レポート完成: {data.title}", minImportance: 4 },
  { eventType: "report.archived", icon: "🗄", templateJa: "承認済みレポートをアーカイブ: {data.title}", minImportance: 3 },
  { eventType: "vault.synced", icon: "🧠", templateJa: "会社の記憶を保存（{data.files}ファイル）", minImportance: 1 },
  { eventType: "backup.completed", icon: "💾", templateJa: "バックアップ完了（{data.storage}）", minImportance: 2 },
  { eventType: "backup.failed", icon: "⚠", templateJa: "バックアップ失敗: {data.error}", minImportance: 5 },
  { eventType: "notification.sent", icon: "🔔", templateJa: "通知: {data.title}", minImportance: 1 },
  { eventType: "provider.called", icon: "✦", templateJa: "AI呼び出し {data.provider}/{data.model}", minImportance: 1 },
  { eventType: "bridge.request_received", icon: "🤖", templateJa: "{actor} から依頼を受付: {data.summary}", minImportance: 4 },
];

export const notificationChannels = [
  { id: "in_app", provider: "in_app", name: "App Notification", enabled: true, priority: 100 },
  { id: "web_push", provider: "web_push", name: "Web Push", enabled: false, priority: 90 },
];

export const notificationRules = [
  { id: "rule_action_required", category: "action_required", minSeverity: "info", channelIds: ["in_app", "web_push"] },
  { id: "rule_report", category: "report", minSeverity: "info", channelIds: ["in_app", "web_push"] },
  { id: "rule_alert", category: "alert", minSeverity: "warning", channelIds: ["in_app", "web_push"] },
  { id: "rule_project", category: "project", minSeverity: "info", channelIds: ["in_app"] },
  { id: "rule_task", category: "task", minSeverity: "info", channelIds: ["in_app"] },
  { id: "rule_system", category: "system", minSeverity: "info", channelIds: ["in_app"] },
] as const;

/** Provider configs: keys are referenced by env var name, never stored. */
export const providerConfigs = [
  { id: "gemini", provider: "gemini", displayName: "Google Gemini", enabled: true, apiKeyEnv: "GEMINI_API_KEY",
    rateLimits: { rpm: 10, rpd: 250 }, dataPolicy: "may_train", priority: 100 },
  { id: "claude", provider: "claude", displayName: "Anthropic Claude", enabled: false, apiKeyEnv: "ANTHROPIC_API_KEY",
    rateLimits: {}, dataPolicy: "no_train", priority: 90 },
  { id: "openai", provider: "openai", displayName: "OpenAI", enabled: false, apiKeyEnv: "OPENAI_API_KEY",
    baseUrl: "https://api.openai.com/v1", rateLimits: {}, dataPolicy: "no_train", priority: 80 },
  { id: "openrouter", provider: "openrouter", displayName: "OpenRouter", enabled: false, apiKeyEnv: "OPENROUTER_API_KEY",
    baseUrl: "https://openrouter.ai/api/v1", rateLimits: {}, dataPolicy: "depends_on_model", priority: 70 },
  { id: "mock", provider: "mock", displayName: "Mock (開発・デモ)", enabled: true, rateLimits: {},
    dataPolicy: "local", priority: 0 },
];

/**
 * Tier → model (data, not code; verify IDs against the provider's current list).
 *
 * Cost policy: Flash-Lite is the company's standard model for every tier, with
 * no fallback to a stronger model (a free-tier 429 must not silently cost more).
 * The stronger model sits on the "escalation" route and is used only when the
 * router has an enabled reason; if it fails, it falls back to Flash-Lite.
 */
export const modelRoutes = [
  { id: "route_gemini_fast", tier: "fast", providerConfigId: "gemini", modelId: "gemini-3.5-flash-lite", fallbackRouteId: null },
  { id: "route_gemini_standard", tier: "standard", providerConfigId: "gemini", modelId: "gemini-3.5-flash-lite", fallbackRouteId: null },
  { id: "route_gemini_deep", tier: "deep", providerConfigId: "gemini", modelId: "gemini-3.5-flash-lite", fallbackRouteId: null },
  {
    id: "route_gemini_escalation", tier: "escalation", providerConfigId: "gemini", modelId: "gemini-3.8-flash",
    fallbackRouteId: "route_gemini_fast",
    params: {
      escalation: {
        reasons: ["long_document", "complex_reasoning", "cross_source_analysis", "ceo_deep_request", "low_confidence"],
        long_input_chars: 40000,
      },
    },
  },
  { id: "route_mock", tier: "mock", providerConfigId: "mock", modelId: "mock-1", fallbackRouteId: null },
];

const evt = (type: string, filters: Record<string, unknown> = {}) => ({ type, filters });

export const metricDefinitions = [
  // Common
  { key: "common.tasks_completed", name: "完了タスク数", scope: "common", calcType: "count", numerator: evt("task.completed") },
  { key: "common.completion_rate", name: "完了率", scope: "common", calcType: "ratio", format: "percent",
    numerator: evt("task.completed"), denominator: evt("task.closed") },
  { key: "common.adoption_rate", name: "採用率", scope: "common", calcType: "ratio", format: "percent",
    numerator: evt("deliverable.adopted"), denominator: evt("deliverable.decided") },
  { key: "common.revision_rate", name: "修正率", scope: "common", calcType: "ratio", format: "percent", direction: "down",
    numerator: evt("deliverable.revised"), denominator: evt("deliverable.created") },
  // Research
  { key: "research.report_count", name: "調査件数", scope: "division", divisionId: "research", calcType: "count",
    numerator: evt("deliverable.created", { kind: "research_report" }) },
  { key: "research.adoption_rate", name: "採用率", scope: "division", divisionId: "research", calcType: "ratio", format: "percent",
    numerator: evt("deliverable.adopted"), denominator: evt("deliverable.decided") },
  { key: "research.reference_count", name: "参照回数", scope: "division", divisionId: "research", calcType: "count",
    numerator: evt("knowledge.referenced") },
  // Marketing
  { key: "marketing.post_count", name: "投稿作成数", scope: "division", divisionId: "marketing", calcType: "count",
    numerator: evt("deliverable.created", { kind: "sns_post_draft" }) },
  { key: "marketing.adoption_rate", name: "採用率", scope: "division", divisionId: "marketing", calcType: "ratio", format: "percent",
    numerator: evt("approval.approved", { kind: "sns_post" }), denominator: evt("approval.decided", { kind: "sns_post" }) },
  { key: "marketing.outcome_count", name: "成果数", scope: "division", divisionId: "marketing", calcType: "sum",
    numerator: evt("outcome.recorded") },
  // Development
  { key: "development.implementation_count", name: "実装数", scope: "division", divisionId: "development", calcType: "count",
    numerator: evt("deliverable.created", { kind: "code_pr" }) },
  { key: "development.fix_count", name: "修正数", scope: "division", divisionId: "development", calcType: "count",
    numerator: evt("deliverable.revised") },
  { key: "development.completion_rate", name: "完了率", scope: "division", divisionId: "development", calcType: "ratio", format: "percent",
    numerator: evt("task.completed"), denominator: evt("task.closed") },
];

export const companySettings = {
  id: "company",
  schedule: Object.fromEntries(Object.entries(DEFAULT_SCHEDULE).map(([k, v]) => [k, v])),
  quietHours: { start: "00:00", end: "06:30" },
};

/** Claude routes are registered but inactive until the CEO switches the preset. */
export const inactiveModelRoutes = [
  { id: "route_claude_fast", tier: "fast", providerConfigId: "claude", modelId: "claude-haiku-4-5", active: false },
  { id: "route_claude_standard", tier: "standard", providerConfigId: "claude", modelId: "claude-sonnet-5-5", active: false },
  { id: "route_claude_deep", tier: "deep", providerConfigId: "claude", modelId: "claude-opus-5-5", active: false },
];
