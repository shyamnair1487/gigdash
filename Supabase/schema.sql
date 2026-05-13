-- GigDash: run this once in Supabase SQL Editor
-- https://supabase.com → SQL Editor → New Query

CREATE TABLE IF NOT EXISTS leads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company         text NOT NULL,
  contact_name    text,
  email           text,
  whatsapp        text,
  industry        text,
  market          text CHECK (market IN ('MY','SG','UK','US')),
  status          text DEFAULT 'new'
                  CHECK (status IN ('new','contacted','replied','negotiating','won','lost')),
  channel         text DEFAULT 'email'
                  CHECK (channel IN ('email','whatsapp','linkedin')),
  notes           text,
  deal_value      numeric,
  source          text,
  created_at      timestamptz DEFAULT now(),
  last_contacted  timestamptz,

  -- Prevent duplicate companies per market
  UNIQUE (company, market)
);

-- Index for fast dashboard queries
CREATE INDEX IF NOT EXISTS leads_status_idx  ON leads(status);
CREATE INDEX IF NOT EXISTS leads_market_idx  ON leads(market);
CREATE INDEX IF NOT EXISTS leads_created_idx ON leads(created_at DESC);

-- Enable Row Level Security (good practice even on personal projects)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Allow full access with service_role key (used by the scraper)
-- The dashboard uses anon key — add a policy if you want auth later
CREATE POLICY "service_role_all" ON leads
  FOR ALL USING (true);
