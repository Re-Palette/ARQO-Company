CREATE TYPE "public"."actor_type" AS ENUM('ceo', 'agent', 'system', 'client');--> statement-breakpoint
CREATE TYPE "public"."agent_level" AS ENUM('executive', 'lead', 'specialist');--> statement-breakpoint
CREATE TYPE "public"."agent_runtime" AS ENUM('mock', 'llm');--> statement-breakpoint
CREATE TYPE "public"."approval_category" AS ENUM('action', 'review');--> statement-breakpoint
CREATE TYPE "public"."approval_kind" AS ENUM('email_send', 'sns_post', 'external_publish', 'deploy', 'contract', 'payment', 'external_integration', 'pdf_submission', 'report_review', 'proposal_review', 'deliverable_review', 'board_decision');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected', 'revision_requested', 'expired', 'cancelled', 'executing', 'executed', 'execution_failed');--> statement-breakpoint
CREATE TYPE "public"."backup_kind" AS ENUM('vault', 'db', 'reports', 'restore_test');--> statement-breakpoint
CREATE TYPE "public"."data_sensitivity" AS ENUM('normal', 'confidential', 'restricted');--> statement-breakpoint
CREATE TYPE "public"."deliverable_status" AS ENUM('draft', 'in_review', 'approved', 'rejected', 'published');--> statement-breakpoint
CREATE TYPE "public"."directive_source" AS ENUM('ceo', 'universal_agent', 'scheduler', 'system');--> statement-breakpoint
CREATE TYPE "public"."directive_status" AS ENUM('received', 'understanding', 'clarifying', 'planning', 'in_progress', 'integrating', 'awaiting_ceo', 'completed', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."division_kind" AS ENUM('executive', 'corporate', 'business_unit');--> statement-breakpoint
CREATE TYPE "public"."event_visibility" AS ENUM('timeline', 'internal');--> statement-breakpoint
CREATE TYPE "public"."memory_kind" AS ENUM('conversation', 'active_task', 'decision', 'project_context', 'plan', 'finding', 'preference');--> statement-breakpoint
CREATE TYPE "public"."metric_calc_type" AS ENUM('count', 'ratio', 'sum', 'avg_duration');--> statement-breakpoint
CREATE TYPE "public"."metric_scope" AS ENUM('common', 'division', 'agent');--> statement-breakpoint
CREATE TYPE "public"."model_tier" AS ENUM('fast', 'standard', 'deep');--> statement-breakpoint
CREATE TYPE "public"."notification_category" AS ENUM('action_required', 'report', 'project', 'task', 'system', 'alert');--> statement-breakpoint
CREATE TYPE "public"."presence_state" AS ENUM('idle', 'thinking', 'researching', 'coding', 'writing', 'designing', 'meeting', 'waiting_approval', 'blocked', 'offline');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('p0', 'p1', 'p2', 'p3');--> statement-breakpoint
CREATE TYPE "public"."project_health" AS ENUM('on_track', 'at_risk', 'off_track');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('proposed', 'planning', 'active', 'on_hold', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('generating', 'ready', 'pending_review', 'revision_requested', 'approved', 'rejected', 'archiving', 'archived', 'failed');--> statement-breakpoint
CREATE TYPE "public"."report_type" AS ENUM('morning_briefing', 'daily_executive', 'weekly_board', 'board_pack', 'division', 'project', 'repalette_monthly', 'impact');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('info', 'success', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('queued', 'blocked', 'in_progress', 'waiting_approval', 'review', 'done', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "action_executions" (
	"id" text PRIMARY KEY NOT NULL,
	"approval_request_id" text NOT NULL,
	"executor" text NOT NULL,
	"status" text NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"payload_hash" text NOT NULL,
	"result" jsonb,
	"external_ref" text,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "activity_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"actor_type" "actor_type" NOT NULL,
	"actor_id" text NOT NULL,
	"subject_type" text,
	"subject_id" text,
	"project_id" text,
	"division_id" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"importance" smallint DEFAULT 3 NOT NULL,
	"visibility" "event_visibility" DEFAULT 'timeline' NOT NULL,
	"processed" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_memory_items" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"kind" "memory_kind" NOT NULL,
	"content" text NOT NULL,
	"importance" smallint DEFAULT 3 NOT NULL,
	"source_type" text,
	"source_id" text,
	"project_id" text,
	"shared_with" text[] DEFAULT '{}' NOT NULL,
	"sensitivity" "data_sensitivity" DEFAULT 'normal' NOT NULL,
	"access_count" integer DEFAULT 0 NOT NULL,
	"last_accessed_at" timestamp with time zone,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_metric_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"metric_key" text NOT NULL,
	"period" text NOT NULL,
	"period_start" date NOT NULL,
	"value" numeric NOT NULL,
	"numerator" numeric,
	"denominator" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_presence" (
	"agent_id" text PRIMARY KEY NOT NULL,
	"state" "presence_state" DEFAULT 'idle' NOT NULL,
	"activity_label" text,
	"current_task_id" text,
	"current_run_id" text,
	"progress" smallint,
	"last_heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text,
	"agent_id" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"prompt_version" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"step_count" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "agent_working_context" (
	"agent_id" text PRIMARY KEY NOT NULL,
	"card" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"card_text" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"title" text NOT NULL,
	"avatar_url" text,
	"division_id" text NOT NULL,
	"level" "agent_level" NOT NULL,
	"reports_to" text,
	"persona" text DEFAULT '' NOT NULL,
	"responsibilities" text[] DEFAULT '{}' NOT NULL,
	"deliverable_types" text[] DEFAULT '{}' NOT NULL,
	"tools" text[] DEFAULT '{}' NOT NULL,
	"model_tier" "model_tier" DEFAULT 'standard' NOT NULL,
	"model_override" text,
	"runtime" "agent_runtime" DEFAULT 'mock' NOT NULL,
	"memory_policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metric_set" text[] DEFAULT '{}' NOT NULL,
	"data_access" text[] DEFAULT '{"normal"}' NOT NULL,
	"max_parallel_tasks" integer DEFAULT 1 NOT NULL,
	"daily_token_budget" integer DEFAULT 200000 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"vault_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_clients" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"scopes" text[] DEFAULT '{}' NOT NULL,
	"rate_limit_per_min" integer DEFAULT 60 NOT NULL,
	"contract_version" text DEFAULT 'v1' NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_events" (
	"id" text PRIMARY KEY NOT NULL,
	"approval_request_id" text NOT NULL,
	"from_status" "approval_status",
	"to_status" "approval_status" NOT NULL,
	"actor" text NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"category" "approval_category" NOT NULL,
	"kind" "approval_kind" NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"requested_by_agent_id" text NOT NULL,
	"division_id" text,
	"project_id" text,
	"subject_type" text,
	"subject_id" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"payload_hash" text NOT NULL,
	"preview" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"risk_level" "risk_level" NOT NULL,
	"priority" "priority" DEFAULT 'p2' NOT NULL,
	"blocking_count" integer DEFAULT 0 NOT NULL,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"due_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"decision_comment" text,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backup_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "backup_kind" NOT NULL,
	"storage" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"artifact_path" text,
	"size_bytes" integer,
	"sha256" text,
	"commit_sha" text,
	"verified" boolean DEFAULT false NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "clarifications" (
	"id" text PRIMARY KEY NOT NULL,
	"directive_id" text NOT NULL,
	"question" text NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"answer" text,
	"answered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"id" text PRIMARY KEY DEFAULT 'company' NOT NULL,
	"company_name" text DEFAULT 'ARQO' NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"timezone" text DEFAULT 'Asia/Tokyo' NOT NULL,
	"schedule" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"quiet_hours" jsonb DEFAULT '{"start":"00:00","end":"06:30"}'::jsonb NOT NULL,
	"daily_token_budget" integer DEFAULT 2000000 NOT NULL,
	"approval_policy_additions" text[] DEFAULT '{}' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliverables" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text,
	"project_id" text,
	"author_agent_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"content_md" text DEFAULT '' NOT NULL,
	"files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "deliverable_status" DEFAULT 'draft' NOT NULL,
	"adopted" boolean,
	"version" integer DEFAULT 1 NOT NULL,
	"vault_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "directives" (
	"id" text PRIMARY KEY NOT NULL,
	"source" "directive_source" NOT NULL,
	"api_client_id" text,
	"type" text DEFAULT 'task' NOT NULL,
	"raw_text" text NOT NULL,
	"spec" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"priority" "priority" DEFAULT 'p2' NOT NULL,
	"status" "directive_status" DEFAULT 'received' NOT NULL,
	"project_id" text,
	"result_summary" text,
	"deadline" timestamp with time zone,
	"callback" boolean DEFAULT false NOT NULL,
	"vault_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "divisions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_ja" text NOT NULL,
	"kind" "division_kind" DEFAULT 'corporate' NOT NULL,
	"mission" text DEFAULT '' NOT NULL,
	"color" text,
	"icon" text,
	"lead_agent_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"key" text NOT NULL,
	"api_client_id" text NOT NULL,
	"request_hash" text NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_keys_api_client_id_key_pk" PRIMARY KEY("api_client_id","key")
);
--> statement-breakpoint
CREATE TABLE "kpi_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"project_id" text,
	"division_id" text,
	"domain" text,
	"unit" text DEFAULT '' NOT NULL,
	"direction" text DEFAULT 'up' NOT NULL,
	"target_value" numeric,
	"period" text DEFAULT 'monthly' NOT NULL,
	"aggregation" text DEFAULT 'sum' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"is_headline" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kpi_values" (
	"id" text PRIMARY KEY NOT NULL,
	"kpi_id" text NOT NULL,
	"period_start" date NOT NULL,
	"value" numeric NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text,
	"agent_id" text,
	"purpose" text NOT NULL,
	"provider" text NOT NULL,
	"model_id" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory_promotions" (
	"id" text PRIMARY KEY NOT NULL,
	"memory_item_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"target" text NOT NULL,
	"vault_path" text NOT NULL,
	"vault_commit" text,
	"reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_definitions" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"scope" "metric_scope" NOT NULL,
	"division_id" text,
	"agent_id" text,
	"calc_type" "metric_calc_type" NOT NULL,
	"numerator" jsonb NOT NULL,
	"denominator" jsonb,
	"unit" text DEFAULT '' NOT NULL,
	"format" text DEFAULT 'number' NOT NULL,
	"direction" text DEFAULT 'up' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"due_date" date,
	"status" text DEFAULT 'open' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_routes" (
	"id" text PRIMARY KEY NOT NULL,
	"tier" text NOT NULL,
	"provider_config_id" text NOT NULL,
	"model_id" text NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"fallback_route_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_channels" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"notification_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"status" text NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"provider_message_id" text,
	"error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"category" "notification_category" NOT NULL,
	"min_severity" "severity" DEFAULT 'info' NOT NULL,
	"channel_ids" text[] DEFAULT '{}' NOT NULL,
	"quiet_hours" jsonb,
	"enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"category" "notification_category" NOT NULL,
	"severity" "severity" DEFAULT 'info' NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"link" text,
	"approval_request_id" text,
	"dedupe_key" text,
	"read_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_divisions" (
	"project_id" text NOT NULL,
	"division_id" text NOT NULL,
	"role" text DEFAULT 'support' NOT NULL,
	CONSTRAINT "project_divisions_project_id_division_id_pk" PRIMARY KEY("project_id","division_id")
);
--> statement-breakpoint
CREATE TABLE "project_templates" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"default_divisions" text[] DEFAULT '{}' NOT NULL,
	"default_kpis" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"phases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"custom_fields_schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"vault_scaffold" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"report_sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"approval_overrides" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"template_key" text NOT NULL,
	"parent_project_id" text,
	"owner_division_id" text NOT NULL,
	"status" "project_status" DEFAULT 'active' NOT NULL,
	"phase" text,
	"progress" smallint DEFAULT 0 NOT NULL,
	"health" "project_health" DEFAULT 'on_track' NOT NULL,
	"color" text,
	"icon" text,
	"cover_image" text,
	"pinned" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"data_sensitivity" "data_sensitivity" DEFAULT 'normal' NOT NULL,
	"start_date" date,
	"target_date" date,
	"vault_path" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"display_name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"base_url" text,
	"api_key_env" text,
	"rate_limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"data_policy" text DEFAULT 'may_train' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_archives" (
	"id" text PRIMARY KEY NOT NULL,
	"report_id" text NOT NULL,
	"approved_storage_path" text,
	"content_sha256" text NOT NULL,
	"vault_note_path" text NOT NULL,
	"vault_pdf_path" text,
	"vault_commit" text,
	"github_pushed_at" timestamp with time zone,
	"first_backup_run_id" text,
	"retention" text DEFAULT 'permanent' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "report_type" NOT NULL,
	"title" text NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"project_id" text,
	"division_id" text,
	"author_agent_id" text NOT NULL,
	"data_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"content_md" text DEFAULT '' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"pdf_storage_path" text,
	"pdf_sha256" text,
	"status" "report_status" DEFAULT 'generating' NOT NULL,
	"approved_at" timestamp with time zone,
	"vault_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_steps" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"seq" integer NOT NULL,
	"kind" text NOT NULL,
	"tool_name" text,
	"summary" text DEFAULT '' NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_dependencies" (
	"task_id" text NOT NULL,
	"depends_on_task_id" text NOT NULL,
	CONSTRAINT "task_dependencies_task_id_depends_on_task_id_pk" PRIMARY KEY("task_id","depends_on_task_id")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"directive_id" text,
	"project_id" text,
	"parent_task_id" text,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"division_id" text NOT NULL,
	"assignee_agent_id" text,
	"status" "task_status" DEFAULT 'queued' NOT NULL,
	"priority" "priority" DEFAULT 'p2' NOT NULL,
	"deliverable_type" text,
	"due_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"est_minutes" integer,
	"actual_minutes" integer,
	"attempt" integer DEFAULT 0 NOT NULL,
	"vault_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timeline_templates" (
	"event_type" text PRIMARY KEY NOT NULL,
	"icon" text DEFAULT '•' NOT NULL,
	"template_ja" text NOT NULL,
	"min_importance" smallint DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"path" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"content_hash" text NOT NULL,
	"frontmatter" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"git_commit" text,
	"last_indexed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_sync_log" (
	"id" text PRIMARY KEY NOT NULL,
	"direction" text NOT NULL,
	"commit_sha" text,
	"files_changed" integer DEFAULT 0 NOT NULL,
	"pushed" boolean DEFAULT false NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription_id" text NOT NULL,
	"event_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"api_client_id" text NOT NULL,
	"url" text NOT NULL,
	"events" text[] DEFAULT '{}' NOT NULL,
	"secret_ref" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"paused_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "action_executions" ADD CONSTRAINT "action_executions_approval_request_id_approval_requests_id_fk" FOREIGN KEY ("approval_request_id") REFERENCES "public"."approval_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memory_items" ADD CONSTRAINT "agent_memory_items_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memory_items" ADD CONSTRAINT "agent_memory_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_metric_snapshots" ADD CONSTRAINT "agent_metric_snapshots_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_metric_snapshots" ADD CONSTRAINT "agent_metric_snapshots_metric_key_metric_definitions_key_fk" FOREIGN KEY ("metric_key") REFERENCES "public"."metric_definitions"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_presence" ADD CONSTRAINT "agent_presence_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_working_context" ADD CONSTRAINT "agent_working_context_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_events" ADD CONSTRAINT "approval_events_approval_request_id_approval_requests_id_fk" FOREIGN KEY ("approval_request_id") REFERENCES "public"."approval_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requested_by_agent_id_agents_id_fk" FOREIGN KEY ("requested_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clarifications" ADD CONSTRAINT "clarifications_directive_id_directives_id_fk" FOREIGN KEY ("directive_id") REFERENCES "public"."directives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_author_agent_id_agents_id_fk" FOREIGN KEY ("author_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directives" ADD CONSTRAINT "directives_api_client_id_api_clients_id_fk" FOREIGN KEY ("api_client_id") REFERENCES "public"."api_clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "directives" ADD CONSTRAINT "directives_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_definitions" ADD CONSTRAINT "kpi_definitions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_definitions" ADD CONSTRAINT "kpi_definitions_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_values" ADD CONSTRAINT "kpi_values_kpi_id_kpi_definitions_id_fk" FOREIGN KEY ("kpi_id") REFERENCES "public"."kpi_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_promotions" ADD CONSTRAINT "memory_promotions_memory_item_id_agent_memory_items_id_fk" FOREIGN KEY ("memory_item_id") REFERENCES "public"."agent_memory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_promotions" ADD CONSTRAINT "memory_promotions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_definitions" ADD CONSTRAINT "metric_definitions_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_definitions" ADD CONSTRAINT "metric_definitions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_routes" ADD CONSTRAINT "model_routes_provider_config_id_provider_configs_id_fk" FOREIGN KEY ("provider_config_id") REFERENCES "public"."provider_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_channel_id_notification_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."notification_channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_approval_request_id_approval_requests_id_fk" FOREIGN KEY ("approval_request_id") REFERENCES "public"."approval_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_divisions" ADD CONSTRAINT "project_divisions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_divisions" ADD CONSTRAINT "project_divisions_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_template_key_project_templates_key_fk" FOREIGN KEY ("template_key") REFERENCES "public"."project_templates"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_division_id_divisions_id_fk" FOREIGN KEY ("owner_division_id") REFERENCES "public"."divisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_archives" ADD CONSTRAINT "report_archives_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_author_agent_id_agents_id_fk" FOREIGN KEY ("author_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_run_id_agent_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_depends_on_task_id_tasks_id_fk" FOREIGN KEY ("depends_on_task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_directive_id_directives_id_fk" FOREIGN KEY ("directive_id") REFERENCES "public"."directives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_agent_id_agents_id_fk" FOREIGN KEY ("assignee_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_outbox" ADD CONSTRAINT "webhook_outbox_subscription_id_webhook_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."webhook_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_outbox" ADD CONSTRAINT "webhook_outbox_event_id_activity_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."activity_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_api_client_id_api_clients_id_fk" FOREIGN KEY ("api_client_id") REFERENCES "public"."api_clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_created_idx" ON "activity_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "events_project_idx" ON "activity_events" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "events_type_idx" ON "activity_events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "memory_agent_status_idx" ON "agent_memory_items" USING btree ("agent_id","status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "metric_snap_uq" ON "agent_metric_snapshots" USING btree ("agent_id","metric_key","period","period_start");--> statement-breakpoint
CREATE INDEX "agents_division_idx" ON "agents" USING btree ("division_id");--> statement-breakpoint
CREATE UNIQUE INDEX "api_clients_prefix_uq" ON "api_clients" USING btree ("key_prefix");--> statement-breakpoint
CREATE UNIQUE INDEX "approval_idem_uq" ON "approval_requests" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "approval_queue_idx" ON "approval_requests" USING btree ("status","risk_level","due_at");--> statement-breakpoint
CREATE INDEX "directives_status_idx" ON "directives" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "kpi_key_uq" ON "kpi_definitions" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "kpi_values_uq" ON "kpi_values" USING btree ("kpi_id","period_start");--> statement-breakpoint
CREATE INDEX "llm_usage_created_idx" ON "llm_usage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications" USING btree ("read_at","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_slug_uq" ON "projects" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "projects_parent_idx" ON "projects" USING btree ("parent_project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "report_archives_report_uq" ON "report_archives" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "tasks_status_division_idx" ON "tasks" USING btree ("status","division_id");--> statement-breakpoint
CREATE INDEX "tasks_assignee_idx" ON "tasks" USING btree ("assignee_agent_id","status");--> statement-breakpoint
CREATE INDEX "tasks_project_idx" ON "tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "vault_docs_path_idx" ON "vault_documents" USING btree ("path");--> statement-breakpoint
CREATE INDEX "outbox_due_idx" ON "webhook_outbox" USING btree ("status","next_retry_at");