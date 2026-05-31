-- ============================================
-- Migration: Application Tables
-- Tables used directly by the bot code
-- ============================================

-- ---------------------------
-- 1. Whitelist (daftar manga yang di-track)
-- ---------------------------
CREATE TABLE IF NOT EXISTS whitelist (
  title_key TEXT PRIMARY KEY,
  title     TEXT NOT NULL,
  sources   JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------
-- 2. Manga Metadata (cover, description, dll)
-- ---------------------------
CREATE TABLE IF NOT EXISTS manga_metadata (
  title_key    TEXT PRIMARY KEY,
  data         JSONB NOT NULL DEFAULT '{}',
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manga_metadata_updated ON manga_metadata (last_updated DESC);

-- ---------------------------
-- 3. Cron Logs (riwayat eksekusi cron)
-- ---------------------------
CREATE TABLE IF NOT EXISTS cron_logs (
  id           BIGSERIAL PRIMARY KEY,
  timestamp    TIMESTAMPTZ NOT NULL DEFAULT now(),
  tag          TEXT,
  code         TEXT,
  type         TEXT,
  source       TEXT,
  title        TEXT,
  count        INTEGER DEFAULT 0,
  sent         INTEGER DEFAULT 0,
  skipped      INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  message      TEXT,
  raw_payload  JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cron_logs_timestamp ON cron_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_cron_logs_tag ON cron_logs (tag);
CREATE INDEX IF NOT EXISTS idx_cron_logs_source ON cron_logs (source);

-- ---------------------------
-- 4. Scraper Stats (statistik harian)
-- ---------------------------
CREATE TABLE IF NOT EXISTS scraper_stats (
  date        TEXT PRIMARY KEY,
  sent        INTEGER DEFAULT 0,
  skipped     INTEGER DEFAULT 0,
  failed      INTEGER DEFAULT 0,
  hibernated  INTEGER DEFAULT 0,
  incremental_saved INTEGER DEFAULT 0,
  guilds      INTEGER DEFAULT 0,
  scraped     INTEGER DEFAULT 0,
  duration_avg DOUBLE PRECISION DEFAULT 0,
  raw_data    JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------
-- 5. Live Events (event real-time dashboard)
-- ---------------------------
CREATE TABLE IF NOT EXISTS live_events (
  id        BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  message   TEXT NOT NULL,
  type      TEXT NOT NULL DEFAULT 'info'
);

CREATE INDEX IF NOT EXISTS idx_live_events_timestamp ON live_events (timestamp DESC);

-- ---------------------------
-- 6. Guild Settings (channel notifikasi per guild)
-- ---------------------------
CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id   TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------
-- 7. Scrape History (tracking kapan terakhir discrape)
-- ---------------------------
CREATE TABLE IF NOT EXISTS scrape_history (
  title_key     TEXT PRIMARY KEY,
  last_check_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------
-- 8. Dispatch History (chapter yang sudah dikirim)
-- ---------------------------
CREATE TABLE IF NOT EXISTS dispatch_history (
  chapter_url   TEXT PRIMARY KEY,
  title_key     TEXT NOT NULL,
  source        TEXT,
  chapter_title TEXT,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_history_title_key ON dispatch_history (title_key);
CREATE INDEX IF NOT EXISTS idx_dispatch_history_sent_at   ON dispatch_history (sent_at DESC);

-- Auto-update updated_at trigger for tables that have it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_whitelist_updated_at') THEN
    CREATE TRIGGER set_whitelist_updated_at
      BEFORE UPDATE ON whitelist
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_scraper_stats_updated_at') THEN
    CREATE TRIGGER set_scraper_stats_updated_at
      BEFORE UPDATE ON scraper_stats
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_guild_settings_updated_at') THEN
    CREATE TRIGGER set_guild_settings_updated_at
      BEFORE UPDATE ON guild_settings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;
