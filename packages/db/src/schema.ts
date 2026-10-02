import {
  boolean, date, index, integer, jsonb, numeric, pgEnum, pgTable, primaryKey, smallint, text, timestamp, uniqueIndex,
} from "drizzle-orm/pg-core";
import {
  ACTOR_TYPES, AGENT_LEVELS, APPROVAL_KINDS, APPROVAL_STATUSES, BACKUP_KINDS, DATA_SENSITIVITY, DELIVERABLE_STATUSES,
  DIRECTIVE_SOURCES, DIRECTIVE_STATUSES, DIVISION_KINDS, EVENT_VISIBILITY, MEMORY_KINDS, METRIC_CALC_TYPES,
  METRIC_SCOPES, MODEL_TIERS, NOTIFICATION_CATEGORIES, PRESENCE_STATES, PRIORITIES, PROJECT_HEALTH, PROJECT_STATUSES,
  REPORT_STATUSES, REPORT_TYPES, RISK_LEVELS, SEVERITIES, TASK_STATUSES,
} from "@friday/core";

// ---------------------------------------------------------------------------
// Enums (system behaviour). Company-grown concepts are tables, not enums.
// ---------------------------------------------------------------------------
export const agentLevel = pgEnum("agent_level", AGENT_LEVELS);
export const modelTier = pgEnum("model_tier", MODEL_TIERS);
export const presenceState = pgEnum("presence_state", PRESENCE_STATES);
export const divisionKind = pgEnum("division_kind", DIVISION_KINDS);
export const projectStatus = pgEnum("project_status", PROJECT_STATUSES);
export const projectHealth = pgEnum("project_health", PROJECT_HEALTH);
export const dataSensitivity = pgEnum("data_sensitivity", DATA_SENSITIVITY);
export const priority = pgEnum("priority", PRIORITIES);
export const directiveSource = pgEnum("directive_source", DIRECTIVE_SOURCES);
export const directiveStatus = pgEnum("directive_status", DIRECTIVE_STATUSES);
export const taskStatus = pgEnum("task_status", TASK_STATUSES);
export const deliverableStatus = pgEnum("deliverable_status", DELIVERABLE_STATUSES);
export const approvalKind = pgEnum("approval_kind", APPROVAL_KINDS);
export const approvalCategory = pgEnum("approval_category", ["action", "review"]);
export const approvalStatus = pgEnum("approval_status", APPROVAL_STATUSES);
export const riskLevel = pgEnum("risk_level", RISK_LEVELS);
export const reportType = pgEnum("report_type", REPORT_TYPES);
export const reportStatus = pgEnum("report_status", REPORT_STATUSES);
export const actorType = pgEnum("actor_type", ACTOR_TYPES);
export const eventVisibility = pgEnum("event_visibility", EVENT_VISIBILITY);
export const notificationCategory = pgEnum("notification_category", NOTIFICATION_CATEGORIES);
export const severity = pgEnum("severity", SEVERITIES);
export const memoryKind = pgEnum("memory_kind", MEMORY_KINDS);
export const metricCalcType = pgEnum("metric_calc_type", METRIC_CALC_TYPES);
export const metricScope = pgEnum("metric_scope", METRIC_SCOPES);
export const backupKind = pgEnum("backup_kind", BACKUP_KINDS);
export const agentRuntime = pgEnum("agent_runtime", ["mock", "llm"]);

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const timestamps = {
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
};

// ---------------------------------------------------------------------------
// A. Organisation
// ---------------------------------------------------------------------------
export const divisions = pgTable("divisions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  nameJa: text("name_ja").notNull(),
  kind: divisionKind("kind").notNull().default("corporate"),
  mission: text("mission").notNull().default(""),
  color: text("color"),
  icon: text("icon"),
  leadAgentId: text("lead_agent_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
});

export const agents = pgTable("agents", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  title: text("title").notNull(),
  avatarUrl: text("avatar_url"),
  divisionId: text("division_id").notNull().references(() => divisions.id),
  level: agentLevel("level").notNull(),
  reportsTo: text("reports_to"),
  persona: text("persona").notNull().default(""),
  responsibilities: text("responsibilities").array().notNull().default([]),
  deliverableTypes: text("deliverable_types").array().notNull().default([]),
  tools: text("tools").array().notNull().default([]),
  modelTier: modelTier("model_tier").notNull().default("standard"),
  modelOverride: text("model_override"),
  runtime: agentRuntime("runtime").notNull().default("mock"),
  memoryPolicy: jsonb("memory_policy").notNull().default({}),
  metricSet: text("metric_set").array().notNull().default([]),
  dataAccess: text("data_access").array().notNull().default(["normal"]),
  maxParallelTasks: integer("max_parallel_tasks").notNull().default(1),
  dailyTokenBudget: integer("daily_token_budget").notNull().default(200_000),
  enabled: boolean("enabled").notNull().default(true),
  vaultPath: text("vault_path"),
  ...timestamps,
}, (t) => [index("agents_division_idx").on(t.divisionId)]);

export const agentPresence = pgTable("agent_presence", {
  agentId: text("agent_id").primaryKey().references(() => agents.id),
  state: presenceState("state").notNull().default("idle"),
  activityLabel: text("activity_label"),
  currentTaskId: text("current_task_id"),
  currentRunId: text("current_run_id"),
  progress: smallint("progress"),
  lastHeartbeatAt: ts("last_heartbeat_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// B. Work
// ---------------------------------------------------------------------------
export const projectTemplates = pgTable("project_templates", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  defaultDivisions: text("default_divisions").array().notNull().default([]),
  defaultKpis: jsonb("default_kpis").notNull().default([]),
  phases: jsonb("phases").notNull().default([]),
  customFieldsSchema: jsonb("custom_fields_schema").notNull().default({}),
  vaultScaffold: jsonb("vault_scaffold").notNull().default({}),
  reportSections: jsonb("report_sections").notNull().default([]),
  approvalOverrides: jsonb("approval_overrides").notNull().default([]),
  ...timestamps,
});

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  category: text("category").notNull().default("general"),
  templateKey: text("template_key").notNull().references(() => projectTemplates.key),
  parentProjectId: text("parent_project_id"),
  ownerDivisionId: text("owner_division_id").notNull().references(() => divisions.id),
  status: projectStatus("status").notNull().default("active"),
  phase: text("phase"),
  progress: smallint("progress").notNull().default(0),
  health: projectHealth("health").notNull().default("on_track"),
  color: text("color"),
  icon: text("icon"),
  coverImage: text("cover_image"),
  pinned: boolean("pinned").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  customFields: jsonb("custom_fields").notNull().default({}),
  dataSensitivity: dataSensitivity("data_sensitivity").notNull().default("normal"),
  startDate: date("start_date"),
  targetDate: date("target_date"),
  vaultPath: text("vault_path"),
  archivedAt: ts("archived_at"),
  ...timestamps,
}, (t) => [uniqueIndex("projects_slug_uq").on(t.slug), index("projects_parent_idx").on(t.parentProjectId)]);

export const projectDivisions = pgTable("project_divisions", {
  projectId: text("project_id").notNull().references(() => projects.id),
  divisionId: text("division_id").notNull().references(() => divisions.id),
  role: text("role").notNull().default("support"),
}, (t) => [primaryKey({ columns: [t.projectId, t.divisionId] })]);

export const milestones = pgTable("milestones", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  title: text("title").notNull(),
  dueDate: date("due_date"),
  status: text("status").notNull().default("open"),
  completedAt: ts("completed_at"),
  ...timestamps,
});

export const apiClients = pgTable("api_clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  keyHash: text("key_hash").notNull(),
  scopes: text("scopes").array().notNull().default([]),
  rateLimitPerMin: integer("rate_limit_per_min").notNull().default(60),
  contractVersion: text("contract_version").notNull().default("v1"),
  lastUsedAt: ts("last_used_at"),
  revokedAt: ts("revoked_at"),
  ...timestamps,
}, (t) => [uniqueIndex("api_clients_prefix_uq").on(t.keyPrefix)]);

export const directives = pgTable("directives", {
  id: text("id").primaryKey(),
  source: directiveSource("source").notNull(),
  apiClientId: text("api_client_id").references(() => apiClients.id),
  type: text("type").notNull().default("task"),
  rawText: text("raw_text").notNull(),
  spec: jsonb("spec").notNull().default({}),
  priority: priority("priority").notNull().default("p2"),
  status: directiveStatus("status").notNull().default("received"),
  projectId: text("project_id").references(() => projects.id),
  resultSummary: text("result_summary"),
  deadline: ts("deadline"),
  callback: boolean("callback").notNull().default(false),
  vaultPath: text("vault_path"),
  ...timestamps,
}, (t) => [index("directives_status_idx").on(t.status)]);

export const clarifications = pgTable("clarifications", {
  id: text("id").primaryKey(),
  directiveId: text("directive_id").notNull().references(() => directives.id),
  question: text("question").notNull(),
  options: jsonb("options").notNull().default([]),
  answer: text("answer"),
  answeredAt: ts("answered_at"),
  ...timestamps,
});

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  directiveId: text("directive_id").references(() => directives.id),
  projectId: text("project_id").references(() => projects.id),
  parentTaskId: text("parent_task_id"),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  divisionId: text("division_id").notNull().references(() => divisions.id),
  assigneeAgentId: text("assignee_agent_id").references(() => agents.id),
  status: taskStatus("status").notNull().default("queued"),
  priority: priority("priority").notNull().default("p2"),
  deliverableType: text("deliverable_type"),
  dueAt: ts("due_at"),
  startedAt: ts("started_at"),
  completedAt: ts("completed_at"),
  estMinutes: integer("est_minutes"),
  actualMinutes: integer("actual_minutes"),
  attempt: integer("attempt").notNull().default(0),
  vaultPath: text("vault_path"),
  ...timestamps,
}, (t) => [
  index("tasks_status_division_idx").on(t.status, t.divisionId),
  index("tasks_assignee_idx").on(t.assigneeAgentId, t.status),
  index("tasks_project_idx").on(t.projectId),
]);

export const taskDependencies = pgTable("task_dependencies", {
  taskId: text("task_id").notNull().references(() => tasks.id),
  dependsOnTaskId: text("depends_on_task_id").notNull().references(() => tasks.id),
}, (t) => [primaryKey({ columns: [t.taskId, t.dependsOnTaskId] })]);

export const agentRuns = pgTable("agent_runs", {
  id: text("id").primaryKey(),
  taskId: text("task_id").references(() => tasks.id),
  agentId: text("agent_id").notNull().references(() => agents.id),
  status: text("status").notNull().default("running"),
  promptVersion: text("prompt_version"),
  startedAt: ts("started_at").notNull().defaultNow(),
  endedAt: ts("ended_at"),
  stepCount: integer("step_count").notNull().default(0),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  costUsd: numeric("cost_usd", { precision: 12, scale: 6 }).notNull().default("0"),
  error: text("error"),
});

export const runSteps = pgTable("run_steps", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull().references(() => agentRuns.id),
  seq: integer("seq").notNull(),
  kind: text("kind").notNull(),
  toolName: text("tool_name"),
  summary: text("summary").notNull().default(""),
  payload: jsonb("payload"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const deliverables = pgTable("deliverables", {
  id: text("id").primaryKey(),
  taskId: text("task_id").references(() => tasks.id),
  projectId: text("project_id").references(() => projects.id),
  authorAgentId: text("author_agent_id").notNull().references(() => agents.id),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  contentMd: text("content_md").notNull().default(""),
  files: jsonb("files").notNull().default([]),
  status: deliverableStatus("status").notNull().default("draft"),
  adopted: boolean("adopted"),
  version: integer("version").notNull().default(1),
  vaultPath: text("vault_path"),
  ...timestamps,
});

// ---------------------------------------------------------------------------
// C. Agent Memory (embeddings are added in Phase 2 together with pgvector)
// ---------------------------------------------------------------------------
export const agentWorkingContext = pgTable("agent_working_context", {
  agentId: text("agent_id").primaryKey().references(() => agents.id),
  card: jsonb("card").notNull().default({}),
  cardText: text("card_text").notNull().default(""),
  version: integer("version").notNull().default(1),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const agentMemoryItems = pgTable("agent_memory_items", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull().references(() => agents.id),
  kind: memoryKind("kind").notNull(),
  content: text("content").notNull(),
  importance: smallint("importance").notNull().default(3),
  sourceType: text("source_type"),
  sourceId: text("source_id"),
  projectId: text("project_id").references(() => projects.id),
  sharedWith: text("shared_with").array().notNull().default([]),
  sensitivity: dataSensitivity("sensitivity").notNull().default("normal"),
  accessCount: integer("access_count").notNull().default(0),
  lastAccessedAt: ts("last_accessed_at"),
  validFrom: ts("valid_from").notNull().defaultNow(),
  expiresAt: ts("expires_at"),
  status: text("status").notNull().default("active"),
  ...timestamps,
}, (t) => [index("memory_agent_status_idx").on(t.agentId, t.status, t.expiresAt)]);

export const memoryPromotions = pgTable("memory_promotions", {
  id: text("id").primaryKey(),
  memoryItemId: text("memory_item_id").notNull().references(() => agentMemoryItems.id),
  agentId: text("agent_id").notNull().references(() => agents.id),
  target: text("target").notNull(),
  vaultPath: text("vault_path").notNull(),
  vaultCommit: text("vault_commit"),
  reason: text("reason").notNull().default(""),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// D. Decisions
// ---------------------------------------------------------------------------
export const approvalRequests = pgTable("approval_requests", {
  id: text("id").primaryKey(),
  category: approvalCategory("category").notNull(),
  kind: approvalKind("kind").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  requestedByAgentId: text("requested_by_agent_id").notNull().references(() => agents.id),
  divisionId: text("division_id").references(() => divisions.id),
  projectId: text("project_id").references(() => projects.id),
  subjectType: text("subject_type"),
  subjectId: text("subject_id"),
  payload: jsonb("payload").notNull().default({}),
  payloadHash: text("payload_hash").notNull(),
  preview: jsonb("preview").notNull().default({}),
  riskLevel: riskLevel("risk_level").notNull(),
  priority: priority("priority").notNull().default("p2"),
  blockingCount: integer("blocking_count").notNull().default(0),
  status: approvalStatus("status").notNull().default("pending"),
  dueAt: ts("due_at"),
  expiresAt: ts("expires_at"),
  decidedAt: ts("decided_at"),
  decisionComment: text("decision_comment"),
  idempotencyKey: text("idempotency_key").notNull(),
  ...timestamps,
}, (t) => [
  uniqueIndex("approval_idem_uq").on(t.idempotencyKey),
  index("approval_queue_idx").on(t.status, t.riskLevel, t.dueAt),
]);

export const approvalEvents = pgTable("approval_events", {
  id: text("id").primaryKey(),
  approvalRequestId: text("approval_request_id").notNull().references(() => approvalRequests.id),
  fromStatus: approvalStatus("from_status"),
  toStatus: approvalStatus("to_status").notNull(),
  actor: text("actor").notNull(),
  comment: text("comment"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const actionExecutions = pgTable("action_executions", {
  id: text("id").primaryKey(),
  approvalRequestId: text("approval_request_id").notNull().references(() => approvalRequests.id),
  executor: text("executor").notNull(),
  status: text("status").notNull(),
  attempt: integer("attempt").notNull().default(1),
  payloadHash: text("payload_hash").notNull(),
  result: jsonb("result"),
  externalRef: text("external_ref"),
  error: text("error"),
  startedAt: ts("started_at").notNull().defaultNow(),
  finishedAt: ts("finished_at"),
});

// ---------------------------------------------------------------------------
// E. Reports & archive
// ---------------------------------------------------------------------------
export const reports = pgTable("reports", {
  id: text("id").primaryKey(),
  type: reportType("type").notNull(),
  title: text("title").notNull(),
  periodStart: ts("period_start").notNull(),
  periodEnd: ts("period_end").notNull(),
  projectId: text("project_id").references(() => projects.id),
  divisionId: text("division_id").references(() => divisions.id),
  authorAgentId: text("author_agent_id").notNull().references(() => agents.id),
  dataSnapshot: jsonb("data_snapshot").notNull().default({}),
  content: jsonb("content").notNull().default({}),
  contentMd: text("content_md").notNull().default(""),
  version: integer("version").notNull().default(1),
  pdfStoragePath: text("pdf_storage_path"),
  pdfSha256: text("pdf_sha256"),
  status: reportStatus("status").notNull().default("generating"),
  approvedAt: ts("approved_at"),
  vaultPath: text("vault_path"),
  ...timestamps,
});

export const reportArchives = pgTable("report_archives", {
  id: text("id").primaryKey(),
  reportId: text("report_id").notNull().references(() => reports.id),
  approvedStoragePath: text("approved_storage_path"),
  contentSha256: text("content_sha256").notNull(),
  vaultNotePath: text("vault_note_path").notNull(),
  vaultPdfPath: text("vault_pdf_path"),
  vaultCommit: text("vault_commit"),
  githubPushedAt: ts("github_pushed_at"),
  firstBackupRunId: text("first_backup_run_id"),
  retention: text("retention").notNull().default("permanent"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("report_archives_report_uq").on(t.reportId)]);

// ---------------------------------------------------------------------------
// F. KPI & evaluation
// ---------------------------------------------------------------------------
export const kpiDefinitions = pgTable("kpi_definitions", {
  id: text("id").primaryKey(),
  key: text("key").notNull(),
  name: text("name").notNull(),
  projectId: text("project_id").references(() => projects.id),
  divisionId: text("division_id").references(() => divisions.id),
  domain: text("domain"),
  unit: text("unit").notNull().default(""),
  direction: text("direction").notNull().default("up"),
  targetValue: numeric("target_value"),
  period: text("period").notNull().default("monthly"),
  aggregation: text("aggregation").notNull().default("sum"),
  source: text("source").notNull().default("manual"),
  isHeadline: boolean("is_headline").notNull().default(false),
  ...timestamps,
}, (t) => [uniqueIndex("kpi_key_uq").on(t.key)]);

export const kpiValues = pgTable("kpi_values", {
  id: text("id").primaryKey(),
  kpiId: text("kpi_id").notNull().references(() => kpiDefinitions.id),
  periodStart: date("period_start").notNull(),
  value: numeric("value").notNull(),
  note: text("note"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("kpi_values_uq").on(t.kpiId, t.periodStart)]);

export const metricDefinitions = pgTable("metric_definitions", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  scope: metricScope("scope").notNull(),
  divisionId: text("division_id").references(() => divisions.id),
  agentId: text("agent_id").references(() => agents.id),
  calcType: metricCalcType("calc_type").notNull(),
  numerator: jsonb("numerator").notNull(),
  denominator: jsonb("denominator"),
  unit: text("unit").notNull().default(""),
  format: text("format").notNull().default("number"),
  direction: text("direction").notNull().default("up"),
  ...timestamps,
});

export const agentMetricSnapshots = pgTable("agent_metric_snapshots", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull().references(() => agents.id),
  metricKey: text("metric_key").notNull().references(() => metricDefinitions.key),
  period: text("period").notNull(),
  periodStart: date("period_start").notNull(),
  value: numeric("value").notNull(),
  numerator: numeric("numerator"),
  denominator: numeric("denominator"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("metric_snap_uq").on(t.agentId, t.metricKey, t.period, t.periodStart)]);

// ---------------------------------------------------------------------------
// G. Activity events & timeline
// ---------------------------------------------------------------------------
export const activityEvents = pgTable("activity_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  actorType: actorType("actor_type").notNull(),
  actorId: text("actor_id").notNull(),
  subjectType: text("subject_type"),
  subjectId: text("subject_id"),
  projectId: text("project_id").references(() => projects.id),
  divisionId: text("division_id").references(() => divisions.id),
  data: jsonb("data").notNull().default({}),
  importance: smallint("importance").notNull().default(3),
  visibility: eventVisibility("visibility").notNull().default("timeline"),
  processed: jsonb("processed").notNull().default({}),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [
  index("events_created_idx").on(t.createdAt),
  index("events_project_idx").on(t.projectId, t.createdAt),
  index("events_type_idx").on(t.type),
]);

export const timelineTemplates = pgTable("timeline_templates", {
  eventType: text("event_type").primaryKey(),
  icon: text("icon").notNull().default("•"),
  templateJa: text("template_ja").notNull(),
  minImportance: smallint("min_importance").notNull().default(1),
});

// ---------------------------------------------------------------------------
// H. Notifications
// ---------------------------------------------------------------------------
export const notificationChannels = pgTable("notification_channels", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  name: text("name").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  config: jsonb("config").notNull().default({}),
  priority: integer("priority").notNull().default(0),
  ...timestamps,
});

export const notificationRules = pgTable("notification_rules", {
  id: text("id").primaryKey(),
  category: notificationCategory("category").notNull(),
  minSeverity: severity("min_severity").notNull().default("info"),
  channelIds: text("channel_ids").array().notNull().default([]),
  quietHours: jsonb("quiet_hours"),
  enabled: boolean("enabled").notNull().default(true),
});

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  category: notificationCategory("category").notNull(),
  severity: severity("severity").notNull().default("info"),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  link: text("link"),
  approvalRequestId: text("approval_request_id").references(() => approvalRequests.id),
  dedupeKey: text("dedupe_key"),
  readAt: ts("read_at"),
  archivedAt: ts("archived_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("notifications_unread_idx").on(t.readAt, t.createdAt)]);

export const notificationDeliveries = pgTable("notification_deliveries", {
  id: text("id").primaryKey(),
  notificationId: text("notification_id").notNull().references(() => notifications.id),
  channelId: text("channel_id").notNull().references(() => notificationChannels.id),
  status: text("status").notNull(),
  attempts: integer("attempts").notNull().default(1),
  providerMessageId: text("provider_message_id"),
  error: text("error"),
  sentAt: ts("sent_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// I. Universal AI bridge (webhook outbox, idempotency)
// ---------------------------------------------------------------------------
export const webhookSubscriptions = pgTable("webhook_subscriptions", {
  id: text("id").primaryKey(),
  apiClientId: text("api_client_id").notNull().references(() => apiClients.id),
  url: text("url").notNull(),
  events: text("events").array().notNull().default([]),
  secretRef: text("secret_ref").notNull(),
  active: boolean("active").notNull().default(true),
  pausedUntil: ts("paused_until"),
  ...timestamps,
});

export const webhookOutbox = pgTable("webhook_outbox", {
  id: text("id").primaryKey(),
  subscriptionId: text("subscription_id").notNull().references(() => webhookSubscriptions.id),
  eventId: text("event_id").notNull().references(() => activityEvents.id),
  payload: jsonb("payload").notNull(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  nextRetryAt: ts("next_retry_at").notNull().defaultNow(),
  lastError: text("last_error"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("outbox_due_idx").on(t.status, t.nextRetryAt)]);

export const idempotencyKeys = pgTable("idempotency_keys", {
  key: text("key").notNull(),
  apiClientId: text("api_client_id").notNull(),
  requestHash: text("request_hash").notNull(),
  response: jsonb("response").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.apiClientId, t.key] })]);

// ---------------------------------------------------------------------------
// J. AI provider
// ---------------------------------------------------------------------------
export const providerConfigs = pgTable("provider_configs", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  displayName: text("display_name").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  baseUrl: text("base_url"),
  apiKeyEnv: text("api_key_env"),
  rateLimits: jsonb("rate_limits").notNull().default({}),
  dataPolicy: text("data_policy").notNull().default("may_train"),
  priority: integer("priority").notNull().default(0),
  ...timestamps,
});

export const modelRoutes = pgTable("model_routes", {
  id: text("id").primaryKey(),
  tier: text("tier").notNull(),
  providerConfigId: text("provider_config_id").notNull().references(() => providerConfigs.id),
  modelId: text("model_id").notNull(),
  params: jsonb("params").notNull().default({}),
  fallbackRouteId: text("fallback_route_id"),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

export const llmUsage = pgTable("llm_usage", {
  id: text("id").primaryKey(),
  runId: text("run_id"),
  agentId: text("agent_id"),
  purpose: text("purpose").notNull(),
  provider: text("provider").notNull(),
  modelId: text("model_id").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  costUsd: numeric("cost_usd", { precision: 12, scale: 6 }).notNull().default("0"),
  latencyMs: integer("latency_ms").notNull().default(0),
  status: text("status").notNull(),
  error: text("error"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("llm_usage_created_idx").on(t.createdAt)]);

// ---------------------------------------------------------------------------
// K. Vault & backup & settings
// ---------------------------------------------------------------------------
export const vaultDocuments = pgTable("vault_documents", {
  id: text("id").primaryKey(),
  path: text("path").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  contentHash: text("content_hash").notNull(),
  frontmatter: jsonb("frontmatter").notNull().default({}),
  gitCommit: text("git_commit"),
  lastIndexedAt: ts("last_indexed_at").notNull().defaultNow(),
}, (t) => [index("vault_docs_path_idx").on(t.path)]);

export const vaultSyncLog = pgTable("vault_sync_log", {
  id: text("id").primaryKey(),
  direction: text("direction").notNull(),
  commitSha: text("commit_sha"),
  filesChanged: integer("files_changed").notNull().default(0),
  pushed: boolean("pushed").notNull().default(false),
  status: text("status").notNull(),
  error: text("error"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const backupRuns = pgTable("backup_runs", {
  id: text("id").primaryKey(),
  kind: backupKind("kind").notNull(),
  storage: text("storage").notNull(),
  startedAt: ts("started_at").notNull().defaultNow(),
  finishedAt: ts("finished_at"),
  status: text("status").notNull().default("running"),
  artifactPath: text("artifact_path"),
  sizeBytes: integer("size_bytes"),
  sha256: text("sha256"),
  commitSha: text("commit_sha"),
  verified: boolean("verified").notNull().default(false),
  error: text("error"),
});

export const companySettings = pgTable("company_settings", {
  id: text("id").primaryKey().default("company"),
  companyName: text("company_name").notNull().default("ARQO"),
  paused: boolean("paused").notNull().default(false),
  timezone: text("timezone").notNull().default("Asia/Tokyo"),
  schedule: jsonb("schedule").notNull().default({}),
  quietHours: jsonb("quiet_hours").notNull().default({ start: "00:00", end: "06:30" }),
  dailyTokenBudget: integer("daily_token_budget").notNull().default(2_000_000),
  approvalPolicyAdditions: text("approval_policy_additions").array().notNull().default([]),
  workerHeartbeatAt: ts("worker_heartbeat_at"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});
