-- Migration 00005: Replace permissive RLS with restrictive service-role-only access
-- Previous migration (00004) created USING(true) policies on all tables,
-- allowing any client with the anon key full unrestricted access.
-- This migration drops those and creates restrictive policies that only
-- allow the service_role key (which bypasses RLS by Supabase design).

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'user_notify_settings', 'user_follows', 'user_all_mode', 'manga_mutes',
    'popularity_index', 'cron_run_status', 'stale_warnings',
    'health_recommendations', 'discord_stats', 'dispatch_claims',
    'whitelist', 'manga_metadata', 'cron_logs', 'scraper_stats',
    'live_events', 'guild_settings', 'scrape_history', 'dispatch_history'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    -- Drop the old permissive allow_all policy
    EXECUTE format('DROP POLICY IF EXISTS allow_all_%I ON %I;', tbl, tbl);
    
    -- Create a restrictive policy that denies all non-service-role access.
    -- Supabase service_role key bypasses RLS entirely, so this effectively
    -- restricts access to backend-only operations.
    -- USING(false) means no row is visible to non-service-role clients.
    -- WITH CHECK(false) means no inserts/updates/deletes from non-service-role.
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = tbl AND policyname = 'backend_only_' || tbl
    ) THEN
      EXECUTE format(
        'CREATE POLICY backend_only_%I ON %I FOR ALL USING (false) WITH CHECK (false);',
        tbl, tbl
      );
    END IF;
  END LOOP;
END;
$$;
