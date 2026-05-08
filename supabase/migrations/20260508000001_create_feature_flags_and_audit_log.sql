CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN DEFAULT true,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by TEXT
);

INSERT INTO feature_flags (key, description) VALUES
  ('ai_chat', 'AI chat feature in the mobile app'),
  ('provider_directory', 'Provider directory tab'),
  ('lifestyle_tracking', 'Lifestyle dashboard tab'),
  ('paywall', 'Show paywall to free users'),
  ('maintenance_mode', 'Put the app in maintenance mode — all users see a maintenance screen')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email TEXT,
  action TEXT,
  target_type TEXT, -- 'user', 'provider', 'feature_flag', 'announcement'
  target_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
