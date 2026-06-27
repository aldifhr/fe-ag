-- RPC: Increment/decrement popularity score atomically
CREATE OR REPLACE FUNCTION increment_popularity(key TEXT, delta INTEGER)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO popularity_index (title_key, score)
  VALUES (key, GREATEST(0, delta))
  ON CONFLICT (title_key)
  DO UPDATE SET score = GREATEST(0, popularity_index.score + delta);
END;
$$;
