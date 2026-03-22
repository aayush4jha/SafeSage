require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

const categories = ['dark_road', 'unsafe_street', 'suspicious_activity', 'harassment', 'no_streetlights', 'poor_visibility', 'isolated_area', 'other'];

// 30 simulated users
const SIMULATED_USERS = Array.from({ length: 30 }, (_, i) =>
  `user_${String(i + 1).padStart(3, '0')}`
);

// ─── AHMEDABAD HOTSPOTS ────────────────────────────────────────
const AHMEDABAD_CENTER = { lat: 23.0225, lng: 72.5714 };

const ahmedabadHotspots = [
  // RED (5+ users)
  { lat: 23.0300, lng: 72.5600, name: 'Navrangpura dark zone', bias: ['dark_road', 'no_streetlights'], userCount: 7 },
  { lat: 23.0100, lng: 72.5800, name: 'Maninagar underpass', bias: ['unsafe_street', 'harassment'], userCount: 6 },
  { lat: 23.0150, lng: 72.5650, name: 'Kalupur station area', bias: ['suspicious_activity', 'harassment'], userCount: 8 },
  // ORANGE (3-4 users)
  { lat: 23.0400, lng: 72.5500, name: 'University road isolate', bias: ['isolated_area', 'poor_visibility'], userCount: 4 },
  { lat: 23.0350, lng: 72.5750, name: 'SG Highway stretch', bias: ['dark_road', 'isolated_area'], userCount: 3 },
  { lat: 23.0050, lng: 72.5550, name: 'Sabarmati riverside', bias: ['isolated_area', 'dark_road'], userCount: 4 },
  // GREEN (1-2 users)
  { lat: 23.0250, lng: 72.5900, name: 'Vastral area', bias: ['unsafe_street', 'no_streetlights'], userCount: 2 },
  { lat: 23.0500, lng: 72.5400, name: 'Chandkheda outskirts', bias: ['isolated_area', 'poor_visibility'], userCount: 1 },
];

// ─── SURAT HOTSPOTS ────────────────────────────────────────────
const SURAT_CENTER = { lat: 21.1702, lng: 72.8311 };

const suratHotspots = [
  // RED (5+ users) — well-known unsafe stretches in Surat
  { lat: 21.1950, lng: 72.8190, name: 'Varachha dark lanes', bias: ['dark_road', 'no_streetlights', 'harassment'], userCount: 7 },
  { lat: 21.1700, lng: 72.7900, name: 'Udhna station underpass', bias: ['unsafe_street', 'harassment', 'suspicious_activity'], userCount: 6 },
  { lat: 21.1550, lng: 72.8400, name: 'Katargam industrial belt', bias: ['isolated_area', 'dark_road', 'suspicious_activity'], userCount: 8 },
  { lat: 21.2100, lng: 72.8600, name: 'Puna Kumbharia road', bias: ['dark_road', 'poor_visibility', 'unsafe_street'], userCount: 5 },

  // ORANGE (3-4 users)
  { lat: 21.1800, lng: 72.8100, name: 'Ring Road (Dindoli stretch)', bias: ['dark_road', 'isolated_area'], userCount: 4 },
  { lat: 21.1600, lng: 72.8700, name: 'Sachin GIDC area', bias: ['isolated_area', 'poor_visibility'], userCount: 3 },
  { lat: 21.2050, lng: 72.8350, name: 'Althan canal road', bias: ['dark_road', 'no_streetlights'], userCount: 4 },
  { lat: 21.1450, lng: 72.8200, name: 'Udhna Magdalla connector', bias: ['unsafe_street', 'isolated_area'], userCount: 3 },
  { lat: 21.1850, lng: 72.8500, name: 'Vesu back roads', bias: ['poor_visibility', 'dark_road'], userCount: 4 },

  // GREEN (1-2 users) — minor reports
  { lat: 21.1750, lng: 72.8300, name: 'Athwa Gate area', bias: ['suspicious_activity'], userCount: 2 },
  { lat: 21.1950, lng: 72.8450, name: 'Adajan riverside', bias: ['isolated_area', 'dark_road'], userCount: 2 },
  { lat: 21.2000, lng: 72.8050, name: 'Pal Gam outskirts', bias: ['poor_visibility'], userCount: 1 },
  { lat: 21.1650, lng: 72.8550, name: 'Bhatar road side lanes', bias: ['dark_road'], userCount: 1 },
  { lat: 21.2150, lng: 72.8250, name: 'VR Mall surroundings', bias: ['suspicious_activity'], userCount: 2 },
];

// ────────────────────────────────────────────────────────────────

function randomOffset(base, range) {
  return base + (Math.random() - 0.5) * range;
}

function randomHoursAgo(maxHours) {
  return new Date(Date.now() - Math.random() * maxHours * 60 * 60 * 1000);
}

function getTimeOfDay(date) {
  const hour = date.getHours();
  if (hour >= 0 && hour < 5) return 'late_night';
  if (hour >= 5 && hour < 7) return 'early_morning';
  if (hour >= 17 && hour < 20) return 'evening';
  if (hour >= 20) return 'night';
  return 'day';
}

function generateReportsForHotspots(hotspots, cityName) {
  const reports = [];

  hotspots.forEach(hotspot => {
    const shuffledUsers = [...SIMULATED_USERS].sort(() => Math.random() - 0.5);
    const usersForHotspot = shuffledUsers.slice(0, hotspot.userCount);

    usersForHotspot.forEach(userId => {
      const reportsPerUser = 1 + Math.floor(Math.random() * 3);
      for (let r = 0; r < reportsPerUser; r++) {
        const cat = Math.random() < 0.7
          ? hotspot.bias[Math.floor(Math.random() * hotspot.bias.length)]
          : categories[Math.floor(Math.random() * categories.length)];

        const timestamp = randomHoursAgo(168);
        const lat = randomOffset(hotspot.lat, 0.002);
        const lng = randomOffset(hotspot.lng, 0.002);

        reports.push({
          latitude: lat,
          longitude: lng,
          location: `POINT(${lng} ${lat})`,
          category: cat,
          severity: Math.min(5, Math.max(1, Math.round(2 + Math.random() * 3))),
          description: `Report near ${hotspot.name} - ${cat.replace(/_/g, ' ')}`,
          time_of_day: getTimeOfDay(timestamp),
          upvotes: Math.floor(Math.random() * 15),
          anonymous: false,
          user_id: userId,
          created_at: timestamp.toISOString(),
        });
      }
    });

    const expected = hotspot.userCount >= 5 ? 'RED' : hotspot.userCount >= 3 ? 'ORANGE' : 'GREEN';
    console.log(`  [${cityName}] ${hotspot.name}: ${hotspot.userCount} users → ${expected}`);
  });

  return reports;
}

function generateScatteredReports(center, count, cityName) {
  const reports = [];
  for (let i = 0; i < count; i++) {
    const timestamp = randomHoursAgo(336);
    const lat = randomOffset(center.lat, 0.05);
    const lng = randomOffset(center.lng, 0.06);
    const userId = SIMULATED_USERS[Math.floor(Math.random() * SIMULATED_USERS.length)];

    reports.push({
      latitude: lat,
      longitude: lng,
      location: `POINT(${lng} ${lat})`,
      category: categories[Math.floor(Math.random() * categories.length)],
      severity: Math.min(5, Math.max(1, Math.round(1 + Math.random() * 4))),
      description: `Community safety report - ${cityName}`,
      time_of_day: getTimeOfDay(timestamp),
      upvotes: Math.floor(Math.random() * 5),
      anonymous: false,
      user_id: userId,
      created_at: timestamp.toISOString(),
    });
  }
  return reports;
}

async function seed() {
  console.log('Connecting to Supabase...\n');

  // Clear existing reports
  const { error: delErr } = await supabase.from('safety_reports').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delErr) console.log('Clear error (may be fine if table is empty):', delErr.message);
  else console.log('Cleared existing reports\n');

  const reports = [];

  // ─── Ahmedabad ───
  console.log('=== AHMEDABAD ===');
  reports.push(...generateReportsForHotspots(ahmedabadHotspots, 'Ahmedabad'));
  reports.push(...generateScatteredReports(AHMEDABAD_CENTER, 10, 'Ahmedabad'));

  // ─── Surat ───
  console.log('\n=== SURAT ===');
  reports.push(...generateReportsForHotspots(suratHotspots, 'Surat'));
  reports.push(...generateScatteredReports(SURAT_CENTER, 10, 'Surat'));

  console.log(`\nTotal reports to insert: ${reports.length}`);

  // Insert in batches of 50
  let inserted = 0;
  for (let i = 0; i < reports.length; i += 50) {
    const batch = reports.slice(i, i + 50);
    const { error } = await supabase.from('safety_reports').insert(batch);
    if (error) {
      // If user_id column doesn't exist, retry without it
      if (error.message.includes('user_id')) {
        const batchFixed = batch.map(({ user_id, ...rest }) => rest);
        const { error: e2 } = await supabase.from('safety_reports').insert(batchFixed);
        if (e2) console.error(`  Batch ${i} retry error:`, e2.message);
        else { console.log(`  Inserted ${batchFixed.length} reports (without user_id)`); inserted += batchFixed.length; }
      }
      // If PostGIS location column fails, retry without it
      else if (error.message.includes('geography') || error.message.includes('POINT') || error.message.includes('location')) {
        const batchNoLoc = batch.map(({ location, ...rest }) => rest);
        const { error: e2 } = await supabase.from('safety_reports').insert(batchNoLoc);
        if (e2) console.error(`  Batch ${i} retry error:`, e2.message);
        else { console.log(`  Inserted ${batchNoLoc.length} reports (without geo)`); inserted += batchNoLoc.length; }
      } else {
        console.error(`  Batch ${i} error:`, error.message);
      }
    } else {
      console.log(`  Inserted ${batch.length} reports`);
      inserted += batch.length;
    }
  }

  console.log(`\nSeeded ${inserted} safety reports across Ahmedabad + Surat`);
  console.log('Done.');
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
