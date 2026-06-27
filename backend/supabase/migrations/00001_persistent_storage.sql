-- ============================================
-- Migration: Persistent Storage for Redis Data
-- Move persistent state from Redis to Supabase
-- ============================================

-- ---------------------------
-- 1. User Notification Settings
-- ---------------------------
CREATE TABLE IF NOT EXISTS user_notify_settings (
  user_id      TEXT PRIMARY KEY,
  notify_mode  TEXT NOT NULL DEFAULT 'follows'
               CHECK (notify_mode IN ('follows', 'all', 'none')),
  settings_json JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_notify_mode ON user_notify_settings (notify_mode);

-- ---------------------------
-- 2. User Follows (many-to-many)
-- ---------------------------
CREATE TABLE IF NOT EXISTS user_follows (
  user_id    TEXT NOT NULL,
  title_key  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, title_key)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_title_key ON user_follows (title_key);
CREATE INDEX IF NOT EXISTS idx_user_follows_user_id   ON user_follows (user_id);

-- ---------------------------
-- 3. All-Mode Users
-- ---------------------------
CREATE TABLE IF NOT EXISTS user_all_mode (
  user_id    TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------
-- 4. Manga Mutes (many-to-many)
-- ---------------------------
CREATE TABLE IF NOT EXISTS manga_mutes (
  user_id    TEXT NOT NULL,
  title_key  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, title_key)
);

CREATE INDEX IF NOT EXISTS idx_manga_mutes_title_key ON manga_mutes (title_key);

-- ---------------------------
-- 5. Popularity Index
-- ---------------------------
CREATE TABLE IF NOT EXISTS popularity_index (
  title_key  TEXT PRIMARY KEY,
  score      INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_popularity_score ON popularity_index (score DESC);

-- ---------------------------
-- 6. Cron Run Status
-- ---------------------------
CREATE TABLE IF NOT EXISTS cron_run_status (
  id         BIGSERIAL PRIMARY KEY,
  status     JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cron_run_status_created ON cron_run_status (created_at DESC);

-- ---------------------------
-- 7. Stale Warnings per manga
-- ---------------------------
CREATE TABLE IF NOT EXISTS stale_warnings (
  title_key  TEXT PRIMARY KEY,
  warned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------
-- 8. Health Recommendations (key-value)
-- ---------------------------
CREATE TABLE IF NOT EXISTS health_recommendations (
  id         BIGSERIAL PRIMARY KEY,
  key        TEXT NOT NULL UNIQUE,
  value      JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------
-- 9. Discord Stats (key-value)
-- ---------------------------
CREATE TABLE IF NOT EXISTS discord_stats (
  id         BIGSERIAL PRIMARY KEY,
  key        TEXT NOT NULL UNIQUE,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------
-- 10. Dispatch Claims
--     (claim lifecycle — separate from committed dispatch_history)
-- ---------------------------
CREATE TABLE IF NOT EXISTS dispatch_claims (
  chapter_url   TEXT PRIMARY KEY,
  title_key     TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'sent', 'expired')),
  duplicate_key TEXT,
  claimed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at       TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_claims_title_key  ON dispatch_claims (title_key);
CREATE INDEX IF NOT EXISTS idx_dispatch_claims_status      ON dispatch_claims (status);
CREATE INDEX IF NOT EXISTS idx_dispatch_claims_expires_at  ON dispatch_claims (expires_at);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_user_notify_settings_updated_at') THEN
    CREATE TRIGGER set_user_notify_settings_updated_at
      BEFORE UPDATE ON user_notify_settings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_popularity_index_updated_at') THEN
    CREATE TRIGGER set_popularity_index_updated_at
      BEFORE UPDATE ON popularity_index
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_stale_warnings_updated_at') THEN
    CREATE TRIGGER set_stale_warnings_updated_at
      BEFORE UPDATE ON stale_warnings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_health_recommendations_updated_at') THEN
    CREATE TRIGGER set_health_recommendations_updated_at
      BEFORE UPDATE ON health_recommendations
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_discord_stats_updated_at') THEN
    CREATE TRIGGER set_discord_stats_updated_at
      BEFORE UPDATE ON discord_stats
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_dispatch_claims_updated_at') THEN
    CREATE TRIGGER set_dispatch_claims_updated_at
      BEFORE UPDATE ON dispatch_claims
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;
