CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  sent_by TEXT,
  recipient_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS provider_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
  tier TEXT DEFAULT 'basic' CHECK (tier IN ('basic', 'featured', 'premium')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired')),
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (provider_id)
);
