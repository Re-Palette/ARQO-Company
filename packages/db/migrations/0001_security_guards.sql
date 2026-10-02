-- Security guards (docs/design/02-ai-operating-rules.md 2.2, 09-data-model-db.md 9.7)

-- 1) Row Level Security on every table, with no policies: Supabase anon /
--    authenticated roles get nothing; only the server (table owner /
--    service role) can read or write.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '__drizzle%' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
--> statement-breakpoint

-- 2) Only the CEO can move an approval request to "approved".
--    The API sets `friday.actor = 'ceo'` (transaction-local) only on the
--    authenticated CEO session path. Workers and API keys never do.
CREATE OR REPLACE FUNCTION friday_guard_approval() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
    IF coalesce(current_setting('friday.actor', true), '') <> 'ceo' THEN
      RAISE EXCEPTION 'POLICY_VIOLATION: only the CEO can approve (actor=%)',
        coalesce(nullif(current_setting('friday.actor', true), ''), 'unknown');
    END IF;
  END IF;
  IF NEW.payload_hash IS DISTINCT FROM OLD.payload_hash OR NEW.payload IS DISTINCT FROM OLD.payload THEN
    RAISE EXCEPTION 'POLICY_VIOLATION: approval payload is immutable; create a new request instead';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER approval_requests_guard BEFORE UPDATE ON approval_requests
  FOR EACH ROW EXECUTE FUNCTION friday_guard_approval();
--> statement-breakpoint

-- 3) Audit tables are append-only.
CREATE OR REPLACE FUNCTION friday_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'POLICY_VIOLATION: % is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER approval_events_append_only BEFORE UPDATE OR DELETE ON approval_events
  FOR EACH ROW EXECUTE FUNCTION friday_append_only();
--> statement-breakpoint
CREATE TRIGGER report_archives_append_only BEFORE UPDATE OR DELETE ON report_archives
  FOR EACH ROW EXECUTE FUNCTION friday_append_only();
--> statement-breakpoint
CREATE TRIGGER activity_events_no_delete BEFORE DELETE ON activity_events
  FOR EACH ROW EXECUTE FUNCTION friday_append_only();
