-- SafeSage Rewards System Migration
-- Run this in Supabase SQL Editor AFTER the main migration

-- Add user_id to safety_reports if not exists (needed for tracking who submitted)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'safety_reports' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE safety_reports ADD COLUMN user_id uuid REFERENCES users(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_reports_user ON safety_reports(user_id);
  END IF;
END $$;

-- ============================================================
-- 1. USER REWARDS (credits, tier, streaks, referral code)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_rewards (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  credits integer DEFAULT 0,
  lifetime_credits integer DEFAULT 0,
  tier text DEFAULT 'scout' CHECK (tier IN ('scout', 'guardian', 'sentinel', 'shield_champion')),
  tier_multiplier numeric(3,1) DEFAULT 1.0,

  -- Streaks
  current_streak integer DEFAULT 0,
  longest_streak integer DEFAULT 0,
  last_activity_date date,
  streak_multiplier numeric(3,1) DEFAULT 1.0,

  -- Referral
  referral_code text UNIQUE,
  referred_by uuid REFERENCES users(id) ON DELETE SET NULL,
  referral_count integer DEFAULT 0,

  -- Impact stats (cached, updated periodically)
  reports_submitted integer DEFAULT 0,
  reports_verified integer DEFAULT 0,
  reports_upvoted integer DEFAULT 0,
  bounties_completed integer DEFAULT 0,
  people_helped integer DEFAULT 0,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rewards_user ON user_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_rewards_referral ON user_rewards(referral_code);
CREATE INDEX IF NOT EXISTS idx_rewards_tier ON user_rewards(tier);
CREATE INDEX IF NOT EXISTS idx_rewards_credits ON user_rewards(lifetime_credits DESC);

-- ============================================================
-- 2. CREDIT TRANSACTIONS (ledger for all credit changes)
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  type text NOT NULL CHECK (type IN (
    'report_submitted', 'report_verified', 'report_upvoted',
    'bounty_completed', 'streak_bonus', 'referral_bonus',
    'referral_first_report', 'zone_adoption_bonus',
    'weekly_challenge', 'tier_promotion', 'redemption'
  )),
  description text DEFAULT '',
  reference_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON credit_transactions(user_id, created_at DESC);

-- ============================================================
-- 3. WEEKLY CHALLENGES
-- ============================================================
CREATE TABLE IF NOT EXISTS weekly_challenges (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text DEFAULT '',
  challenge_type text NOT NULL CHECK (challenge_type IN (
    'submit_reports', 'verify_reports', 'upvote_reports', 'complete_bounties', 'streak_days'
  )),
  target_count integer NOT NULL DEFAULT 3,
  reward_credits integer NOT NULL DEFAULT 50,
  week_start date NOT NULL,
  week_end date NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_challenge_progress (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  challenge_id uuid REFERENCES weekly_challenges(id) ON DELETE CASCADE,
  current_count integer DEFAULT 0,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, challenge_id)
);

-- ============================================================
-- 4. VERIFICATION BOUNTIES
-- ============================================================
CREATE TABLE IF NOT EXISTS verification_bounties (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  location geography(Point, 4326),
  area_name text DEFAULT '',
  description text DEFAULT '',
  time_window text CHECK (time_window IN ('night', 'late_night', 'early_morning', 'evening', 'day', 'any')),
  reward_credits integer NOT NULL DEFAULT 100,
  status text DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'completed', 'expired')),
  claimed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  completed_at timestamptz,
  report_id uuid REFERENCES safety_reports(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  reason text DEFAULT 'stale_data',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bounties_status ON verification_bounties(status);
CREATE INDEX IF NOT EXISTS idx_bounties_location ON verification_bounties USING gist(location);
CREATE INDEX IF NOT EXISTS idx_bounties_expires ON verification_bounties(expires_at);

-- ============================================================
-- 5. ZONE ADOPTIONS ("Adopt a Zone")
-- ============================================================
CREATE TABLE IF NOT EXISTS zone_adoptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  zone_name text NOT NULL,
  center_latitude double precision NOT NULL,
  center_longitude double precision NOT NULL,
  radius_meters integer DEFAULT 500,
  reports_this_month integer DEFAULT 0,
  total_reports integer DEFAULT 0,
  last_report_at timestamptz,
  badge_earned boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, zone_name)
);

CREATE INDEX IF NOT EXISTS idx_zones_user ON zone_adoptions(user_id);
CREATE INDEX IF NOT EXISTS idx_zones_active ON zone_adoptions(is_active);

-- ============================================================
-- 6. LEADERBOARD CACHE (refreshed periodically)
-- ============================================================
CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  user_name text NOT NULL,
  tier text DEFAULT 'scout',
  lifetime_credits integer DEFAULT 0,
  reports_count integer DEFAULT 0,
  current_streak integer DEFAULT 0,
  scope text DEFAULT 'global' CHECK (scope IN ('global', 'city', 'area')),
  scope_name text DEFAULT '',
  period text DEFAULT 'monthly' CHECK (period IN ('weekly', 'monthly', 'alltime')),
  rank integer,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_scope ON leaderboard_entries(scope, period, rank);

-- ============================================================
-- RLS Policies
-- ============================================================
ALTER TABLE user_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can manage rewards" ON user_rewards FOR ALL USING (true);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can manage transactions" ON credit_transactions FOR ALL USING (true);

ALTER TABLE weekly_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read challenges" ON weekly_challenges FOR ALL USING (true);

ALTER TABLE user_challenge_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can manage challenge progress" ON user_challenge_progress FOR ALL USING (true);

ALTER TABLE verification_bounties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can manage bounties" ON verification_bounties FOR ALL USING (true);

ALTER TABLE zone_adoptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can manage zones" ON zone_adoptions FOR ALL USING (true);

ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read leaderboard" ON leaderboard_entries FOR ALL USING (true);
