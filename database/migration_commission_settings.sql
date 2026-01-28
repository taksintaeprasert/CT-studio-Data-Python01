-- =============================================
-- COMMISSION SETTINGS TABLE
-- =============================================
-- This table stores commission percentages for each artist
-- Super Admin can set different commission rates for normal and 50% services

CREATE TABLE IF NOT EXISTS commission_settings (
  id SERIAL PRIMARY KEY,
  artist_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
  commission_normal_percent DECIMAL(5, 2) DEFAULT 0 CHECK (commission_normal_percent >= 0 AND commission_normal_percent <= 100),
  commission_50_percent DECIMAL(5, 2) DEFAULT 0 CHECK (commission_50_percent >= 0 AND commission_50_percent <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(artist_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_commission_settings_artist ON commission_settings(artist_id);

-- Enable RLS
ALTER TABLE commission_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policy (Allow all for authenticated users)
CREATE POLICY "Allow all for authenticated users" ON commission_settings FOR ALL USING (true);

-- Comments
COMMENT ON TABLE commission_settings IS 'Commission percentage settings for each artist';
COMMENT ON COLUMN commission_settings.commission_normal_percent IS 'Commission % for normal services (including FREE services, excluding 50% services)';
COMMENT ON COLUMN commission_settings.commission_50_percent IS 'Commission % for 50% discount services';

-- Insert default commission settings for existing artists (0% commission)
INSERT INTO commission_settings (artist_id, commission_normal_percent, commission_50_percent)
SELECT id, 0, 0
FROM staff
WHERE role = 'artist' AND is_active = true
ON CONFLICT (artist_id) DO NOTHING;
