-- ============================================
-- Migration: Redis Removal — Supabase-Only State
-- Tables and RPCs to replace Redis-only state
-- ============================================

-- ---------------------------
-- 1. Source Health
-- Replaces Redis hash SOURCES_HEALTH_KEY ("sources:health")
-- Stores per-source health state for the circuit breaker
-- ---------------------------
CREATE TABLE IF NOT EXISTS source_health (
  source            TEXT PRIMARY KEY,
  status            TEXT NOT NULL DEFAULT 'healthy'
                    CHECK (status IN ('healthy', 'degraded')),
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  disabled_until    TIMESTAMPTZ,
  last_error        TEXT,
  last_success_at   TIMESTAMPTZ,
  last_checked_at   TIMESTAMPTZ,
  response_time_ms  INTEGER,
  failures_today    INTEGER NOT NULL DEFAULT 0,
  successes_today   INTEGER NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------
-- 2. Cron Locks
-- Replaces Redis SET NX EX distributed lock
-- ---------------------------
CREATE TABLE IF NOT EXISTS cron_locks (
  name        TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------
-- 3. Title Last Chapters
-- Replaces Redis MANGA_LAST_CHAPTERS_KEY (manga:last_chapters)
-- Tracks the highest chapter number dispatched per title
-- Populated from dispatch_history on first migration
-- ---------------------------
CREATE TABLE IF NOT EXISTS title_last_chapters (
  title_key      TEXT PRIMARY KEY,
  chapter_number DOUBLE PRECISION NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_title_last_chapters_num ON title_last_chapters (chapter_number DESC);

-- ---------------------------
-- 4. Channel Validation Cache
-- Replaces Redis CHANNELS_VALIDATION_KEY (channels:validation)
-- In-memory cache is primary; this is a persistent fallback
-- ---------------------------
CREATE TABLE IF NOT EXISTS channel_validation_cache (
  channel_id TEXT PRIMARY KEY,
  valid      BOOLEAN NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_channel_validation_expires ON channel_validation_cache (expires_at);

-- ---------------------------
-- 5. Cron Log Throttle
-- Replaces Redis CRON_LOG_THROTTLE_KEY_PREFIX (cron:log:throttle)
-- Primary is in-memory; this is persistence to survive restarts
-- ---------------------------
CREATE TABLE IF NOT EXISTS cron_log_throttle (
  key        TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- RPC: Acquire cron lock (atomic)
-- ============================================
CREATE OR REPLACE FUNCTION acquire_cron_lock(p_name TEXT, p_instance_id TEXT, p_ttl_seconds INTEGER DEFAULT 35)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  acquired BOOLEAN;
BEGIN
  INSERT INTO cron_locks (name, instance_id, expires_at)
  VALUES (p_name, p_instance_id, now() + (p_ttl_seconds || ' seconds')::INTERVAL)
  ON CONFLICT (name) DO UPDATE
    SET instance_id = EXCLUDED.instance_id,
        expires_at = EXCLUDED.expires_at,
        updated_at = now()
    WHERE cron_locks.expires_at < now()
  RETURNING instance_id = p_instance_id INTO acquired;

  RETURN COALESCE(acquired, FALSE);
END;
$$;

-- ============================================
-- RPC: Release cron lock
-- ============================================
CREATE OR REPLACE FUNCTION release_cron_lock(p_name TEXT, p_instance_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM cron_locks
  WHERE name = p_name AND instance_id = p_instance_id;
  RETURN FOUND;
END;
$$;

-- ============================================
-- RPC: Claim a dispatch chapter atomically
-- Checks both primary key (chapter_url) and duplicate key
-- ============================================
CREATE OR REPLACE FUNCTION claim_dispatch_chapter(
  p_chapter_url    TEXT,
  p_duplicate_url  TEXT,
  p_title_key      TEXT,
  p_source         TEXT,
  p_ttl_seconds    INTEGER DEFAULT 600
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  claimed BOOLEAN;
BEGIN
  WITH primary_blocked AS (
    SELECT 1 FROM dispatch_claims
    WHERE chapter_url = p_chapter_url
      AND (status = 'sent' OR (status = 'pending' AND expires_at > now()))
    LIMIT 1
  ),
  duplicate_blocked AS (
    SELECT 1 FROM dispatch_claims
    WHERE chapter_url = p_duplicate_url
      AND p_duplicate_url != ''
      AND (status = 'sent' OR (status = 'pending' AND expires_at > now()))
    LIMIT 1
  ),
  claim AS (
    INSERT INTO dispatch_claims (chapter_url, title_key, status, claimed_at, expires_at)
    SELECT p_chapter_url, p_title_key, 'pending', now(), now() + (p_ttl_seconds || ' seconds')::INTERVAL
    WHERE NOT EXISTS (SELECT 1 FROM primary_blocked)
      AND NOT EXISTS (SELECT 1 FROM duplicate_blocked)
    ON CONFLICT (chapter_url) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) > 0 INTO claimed FROM claim;

  -- If duplicate key is different, also claim it
  IF claimed AND p_duplicate_url != '' AND p_duplicate_url != p_chapter_url THEN
    INSERT INTO dispatch_claims (chapter_url, title_key, status, claimed_at, expires_at)
    VALUES (p_duplicate_url, p_title_key, 'pending', now(), now() + (p_ttl_seconds || ' seconds')::INTERVAL)
    ON CONFLICT (chapter_url) DO NOTHING;
  END IF;

  RETURN claimed;
END;
$$;

-- ============================================
-- RPC: Mark dispatch claim as sent
-- ============================================
CREATE OR REPLACE FUNCTION complete_dispatch_claim(
  p_chapter_url   TEXT,
  p_duplicate_url TEXT DEFAULT ''
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE dispatch_claims
  SET status = 'sent', sent_at = now(), expires_at = NULL, updated_at = now()
  WHERE chapter_url = p_chapter_url AND status = 'pending';

  IF p_duplicate_url != '' AND p_duplicate_url != p_chapter_url THEN
    UPDATE dispatch_claims
    SET status = 'sent', sent_at = now(), expires_at = NULL, updated_at = now()
    WHERE chapter_url = p_duplicate_url AND status = 'pending';
  END IF;

  RETURN FOUND;
END;
$$;

-- ============================================
-- RPC: Upsert source health (atomic)
-- ============================================
CREATE OR REPLACE FUNCTION upsert_source_health(
  p_source             TEXT,
  p_status             TEXT,
  p_consecutive_failures INTEGER,
  p_disabled_until     TIMESTAMPTZ,
  p_last_error         TEXT,
  p_last_success_at    TIMESTAMPTZ,
  p_last_checked_at    TIMESTAMPTZ,
  p_response_time_ms   INTEGER,
  p_failures_today     INTEGER,
  p_successes_today    INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO source_health (source, status, consecutive_failures, disabled_until,
    last_error, last_success_at, last_checked_at, response_time_ms,
    failures_today, successes_today)
  VALUES (p_source, p_status, p_consecutive_failures, p_disabled_until,
    p_last_error, p_last_success_at, p_last_checked_at, p_response_time_ms,
    p_failures_today, p_successes_today)
  ON CONFLICT (source) DO UPDATE SET
    status = EXCLUDED.status,
    consecutive_failures = EXCLUDED.consecutive_failures,
    disabled_until = EXCLUDED.disabled_until,
    last_error = CASE WHEN EXCLUDED.last_error IS NOT NULL THEN EXCLUDED.last_error ELSE source_health.last_error END,
    last_success_at = CASE WHEN EXCLUDED.last_success_at IS NOT NULL THEN EXCLUDED.last_success_at ELSE source_health.last_success_at END,
    last_checked_at = COALESCE(EXCLUDED.last_checked_at, source_health.last_checked_at),
    response_time_ms = EXCLUDED.response_time_ms,
    failures_today = EXCLUDED.failures_today,
    successes_today = EXCLUDED.successes_today,
    updated_at = now();
END;
$$;

-- ============================================
-- Triggers
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_cron_locks_updated_at') THEN
    CREATE TRIGGER set_cron_locks_updated_at
      BEFORE UPDATE ON cron_locks
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_title_last_chapters_updated_at') THEN
    CREATE TRIGGER set_title_last_chapters_updated_at
      BEFORE UPDATE ON title_last_chapters
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_channel_validation_cache_updated_at') THEN
    CREATE TRIGGER set_channel_validation_cache_updated_at
      BEFORE UPDATE ON channel_validation_cache
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_source_health_updated_at') THEN
    CREATE TRIGGER set_source_health_updated_at
      BEFORE UPDATE ON source_health
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;

-- ============================================
-- Seed initial source health rows
-- ============================================
INSERT INTO source_health (source, status)
VALUES ('ikiru', 'healthy'), ('shinigami', 'healthy')
ON CONFLICT (source) DO NOTHING;
