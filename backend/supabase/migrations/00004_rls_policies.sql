-- Enable RLS + allow all for backend bot (anon key)
-- Bot is the only client using this Supabase project

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
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = tbl AND policyname = 'allow_all_' || tbl
    ) THEN
      EXECUTE format(
        'CREATE POLICY allow_all_%I ON %I FOR ALL USING (true) WITH CHECK (true);',
        tbl, tbl
      );
    END IF;
  END LOOP;
END;
$$;
