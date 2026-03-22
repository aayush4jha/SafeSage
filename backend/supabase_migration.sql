-- NightShield AI - Supabase Migration
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Enable PostGIS for geospatial queries
create extension if not exists postgis;

-- Safety Reports
create table if not exists safety_reports (
  id uuid default gen_random_uuid() primary key,
  location geography(Point, 4326) not null,
  latitude double precision not null,
  longitude double precision not null,
  category text not null check (category in ('dark_road', 'unsafe_street', 'suspicious_activity', 'harassment', 'no_streetlights', 'poor_visibility', 'isolated_area', 'other')),
  severity integer default 3 check (severity between 1 and 5),
  description text default '',
  time_of_day text check (time_of_day in ('night', 'late_night', 'early_morning', 'evening', 'day')),
  verified boolean default false,
  upvotes integer default 0,
  anonymous boolean default true,
  created_at timestamptz default now()
);

create index if not exists idx_reports_location on safety_reports using gist(location);
create index if not exists idx_reports_created on safety_reports(created_at desc);
create index if not exists idx_reports_category on safety_reports(category);

-- Users
create table if not exists users (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text unique not null,
  password_hash text not null,
  phone text default '',
  safety_preferences jsonb default '{"avoidIsolatedRoads": true, "preferWellLit": true, "preferCrowded": true}',
  created_at timestamptz default now()
);

-- Emergency Contacts (per user)
create table if not exists emergency_contacts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references users(id) on delete cascade,
  name text not null,
  phone text not null,
  email text default '',
  relationship text default '',
  created_at timestamptz default now()
);

-- Emergency Alerts
create table if not exists emergency_alerts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references users(id) on delete set null,
  latitude double precision not null,
  longitude double precision not null,
  location geography(Point, 4326),
  trigger_type text not null check (trigger_type in ('manual', 'voice_detection', 'movement_anomaly', 'inactivity', 'panic_button')),
  status text default 'active' check (status in ('active', 'resolved', 'false_alarm')),
  contacts_notified jsonb default '[]',
  location_history jsonb default '[]',
  resolved_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_alerts_status on emergency_alerts(status);
create index if not exists idx_alerts_user on emergency_alerts(user_id, status);

-- Family Network
create table if not exists family_networks (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references users(id) on delete cascade,
  network_name text default 'My Safety Network',
  created_at timestamptz default now()
);

create table if not exists family_members (
  id uuid default gen_random_uuid() primary key,
  network_id uuid references family_networks(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  name text not null,
  phone text default '',
  email text default '',
  relationship text default 'Family',
  status text default 'invited' check (status in ('active', 'invited', 'inactive')),
  last_latitude double precision,
  last_longitude double precision,
  last_location_at timestamptz,
  safety_score integer default 75,
  area_risk_level text default 'unknown',
  movement_status text default 'unknown',
  last_activity_at timestamptz default now(),
  is_in_danger_zone boolean default false,
  tracking_enabled boolean default true,
  created_at timestamptz default now()
);

create table if not exists family_safety_alerts (
  id uuid default gen_random_uuid() primary key,
  network_id uuid references family_networks(id) on delete cascade,
  member_id uuid,
  member_name text,
  alert_type text,
  message text,
  severity text default 'info' check (severity in ('info', 'warning', 'critical')),
  latitude double precision,
  longitude double precision,
  acknowledged boolean default false,
  created_at timestamptz default now()
);

-- Safety Codeword
create table if not exists safety_codewords (
  id uuid default gen_random_uuid() primary key,
  user_id uuid unique references users(id) on delete cascade,
  codeword_hash text not null,
  is_enabled boolean default true,
  escalation_stage integer default 0,
  escalation_started_at timestamptz,
  last_reminder_at timestamptz,
  reminder_count integer default 0,
  is_recording boolean default false,
  contacts_notified boolean default false,
  resolved boolean default true,
  created_at timestamptz default now()
);

-- Helper function to calculate distance (returns meters)
create or replace function distance_meters(lat1 float8, lng1 float8, lat2 float8, lng2 float8)
returns float8 as $$
  select ST_Distance(
    ST_MakePoint(lng1, lat1)::geography,
    ST_MakePoint(lng2, lat2)::geography
  );
$$ language sql immutable;

-- Enable Row Level Security (optional, good practice)
alter table safety_reports enable row level security;
create policy "Anyone can read reports" on safety_reports for select using (true);
create policy "Anyone can insert reports" on safety_reports for insert with check (true);
create policy "Anyone can update reports" on safety_reports for update using (true);

alter table emergency_alerts enable row level security;
create policy "Anyone can read alerts" on emergency_alerts for select using (true);
create policy "Anyone can insert alerts" on emergency_alerts for insert with check (true);
create policy "Anyone can update alerts" on emergency_alerts for update using (true);

alter table users enable row level security;
create policy "Users can read own data" on users for select using (true);
create policy "Anyone can insert users" on users for insert with check (true);

alter table family_members enable row level security;
create policy "Anyone can read members" on family_members for select using (true);
create policy "Anyone can manage members" on family_members for all using (true);

alter table family_safety_alerts enable row level security;
create policy "Anyone can read alerts" on family_safety_alerts for select using (true);
create policy "Anyone can manage alerts" on family_safety_alerts for all using (true);

alter table family_networks enable row level security;
create policy "Anyone can read networks" on family_networks for select using (true);
create policy "Anyone can manage networks" on family_networks for all using (true);

alter table emergency_contacts enable row level security;
create policy "Anyone can manage contacts" on emergency_contacts for all using (true);

alter table safety_codewords enable row level security;
create policy "Anyone can manage codewords" on safety_codewords for all using (true);
