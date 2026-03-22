-- ============================================
-- NightShield: Dynamic Safety Zones Setup
-- Run this in Supabase SQL Editor
-- ============================================
-- Safety zones are now computed dynamically from
-- safety_reports data. No static zone table needed.
-- The backend divides the city into a ~300m square
-- grid, aggregates reports per cell, and classifies
-- each cell as Red/Orange/Green based on report
-- density and severity.
-- ============================================

-- Step 1: Enable PostGIS extension (needed for spatial queries)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Step 2: Ensure safety_reports has spatial indexes for fast grid queries
-- These index the lat/lng columns used by the grid engine
CREATE INDEX IF NOT EXISTS idx_safety_reports_lat ON safety_reports (latitude);
CREATE INDEX IF NOT EXISTS idx_safety_reports_lng ON safety_reports (longitude);
CREATE INDEX IF NOT EXISTS idx_safety_reports_lat_lng ON safety_reports (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_safety_reports_created ON safety_reports (created_at DESC);

-- Step 3: Add circle code columns to family_networks for the circle system
ALTER TABLE family_networks ADD COLUMN IF NOT EXISTS circle_code text;
ALTER TABLE family_networks ADD COLUMN IF NOT EXISTS network_name text DEFAULT 'Safety Circle';
CREATE UNIQUE INDEX IF NOT EXISTS idx_family_networks_circle_code ON family_networks (circle_code);

-- Step 4: Add linked_user_id to family_members for user-linked memberships
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS linked_user_id uuid;
CREATE INDEX IF NOT EXISTS idx_family_members_linked_user ON family_members (linked_user_id);

-- Step 5: Add user_id to safety_reports for user-linked reports
ALTER TABLE safety_reports ADD COLUMN IF NOT EXISTS user_id text;

-- Step 5 (Optional): If you want a PostGIS geometry column on safety_reports
-- for future spatial queries, you can add it:
--
-- ALTER TABLE safety_reports ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);
-- UPDATE safety_reports SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
--   WHERE geom IS NULL AND longitude IS NOT NULL AND latitude IS NOT NULL;
-- CREATE INDEX IF NOT EXISTS idx_safety_reports_geom ON safety_reports USING GIST (geom);
--
-- Then keep it updated with a trigger:
--
-- CREATE OR REPLACE FUNCTION update_report_geom()
-- RETURNS trigger AS $$
-- BEGIN
--   NEW.geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
--
-- CREATE TRIGGER trg_update_report_geom
--   BEFORE INSERT OR UPDATE ON safety_reports
--   FOR EACH ROW EXECUTE FUNCTION update_report_geom();
