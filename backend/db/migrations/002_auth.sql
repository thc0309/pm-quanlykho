CREATE INDEX IF NOT EXISTS idx_sessions_user_expiry
  ON sessions (user_id, expires_at);
