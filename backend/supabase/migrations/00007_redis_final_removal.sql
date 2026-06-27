-- ============================================
-- Migration: Redis Final Removal
-- Tables to replace remaining Redis-only state
-- ============================================

-- ---------------------------
-- 1. App Settings (General Key-Value Store)
-- Replaces Redis keys:
--   session:ikiru:cookies
--   health:broken-links
--   health:recommendations
--   health:last-check
--   cron:last_run  (moved here from cron_run_status)
-- ---------------------------
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_settings_updated ON app_settings (updated_at DESC);

-- ---------------------------
-- 2. Manga Last Updates
-- Replaces Redis hash MANGA_LAST_UPDATES_KEY ("manga:last_updates")
-- Tracks when each title was added to whitelist (used for "pre-whitelist skip" logic)
-- ---------------------------
CREATE TABLE IF NOT EXISTS manga_last_updates (
  title_key  TEXT PRIMARY KEY,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------
-- 3. Ensure dispatch_claims has duplicate_key index
-- (Already exists from migration 00001 or 00002, adding if missing)
-- ---------------------------
CREATE INDEX IF NOT EXISTS idx_dispatch_claims_duplicate_key
  ON dispatch_claims (duplicate_key)
  WHERE duplicate_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dispatch_claims_expires_at
  ON dispatch_claims (expires_at)
  WHERE status = 'pending';

-- ---------------------------
-- 4. Ensure title_last_chapters has proper index (from 00006)
-- ---------------------------
CREATE INDEX IF NOT EXISTS idx_title_last_chapters_updated ON title_last_chapters (updated_at DESC);

-- ============================================
-- RPC: Get or set app_settings value (atomic upsert)
-- ============================================
CREATE OR REPLACE FUNCTION upsert_app_setting(p_key TEXT, p_value TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO app_settings (key, value)
  VALUES (p_key, p_value)
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        updated_at = now();
END;
$$;

-- ============================================
-- RPC: Batch upsert manga_last_updates
-- ============================================
CREATE OR REPLACE FUNCTION upsert_manga_last_update(p_title_key TEXT, p_updated_at TIMESTAMPTZ DEFAULT now())
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO manga_last_updates (title_key, updated_at)
  VALUES (p_title_key, p_updated_at)
  ON CONFLICT (title_key) DO UPDATE
    SET updated_at = EXCLUDED.updated_at;
END;
$$;

-- ============================================
-- RPC: Batch upsert title_last_chapters
-- ============================================
CREATE OR REPLACE FUNCTION upsert_title_last_chapter(p_title_key TEXT, p_chapter_number DOUBLE PRECISION)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO title_last_chapters (title_key, chapter_number)
  VALUES (p_title_key, p_chapter_number)
  ON CONFLICT (title_key) DO UPDATE
    SET chapter_number = GREATEST(title_last_chapters.chapter_number, EXCLUDED.chapter_number),
        updated_at = now();
END;
$$;

-- ============================================
-- RPC: Cleanup expired dispatch claims
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_expired_dispatch_claims()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM dispatch_claims
  WHERE status = 'pending' AND expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ============================================
-- Triggers
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_app_settings_updated_at') THEN
    CREATE TRIGGER set_app_settings_updated_at
      BEFORE UPDATE ON app_settings
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_manga_last_updates_updated_at') THEN
    CREATE TRIGGER set_manga_last_updates_updated_at
      BEFORE UPDATE ON manga_last_updates
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

-- ============================================
-- RLS Policies for new tables
-- ============================================
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE manga_last_updates ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access" ON app_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access" ON manga_last_updates
  FOR ALL TO service_role USING (true) WITH CHECK (true);
